from collections import Counter

import numpy as np
import pytest
from tokenizers import Tokenizer, models, pre_tokenizers, trainers

from asknoor.trim.pieces import (
    choose_keep,
    count_pieces,
    new_model_config,
    remap_tokenizer,
    remap_tokenizer_config,
    single_character_ids,
    slice_embedding,
    tokenization_fidelity,
)

CORPUS = [
    "we roast the coffee in a pan over the fire",
    "wir rösten den kaffee in einer pfanne",
    "hoe roosteren jullie de koffie",
    "vi rostar kaffet i en panna",
    "kafe bi dafay togg ci safara",
] * 20


def tiny_unigram() -> Tokenizer:
    tok = Tokenizer(models.Unigram())
    tok.pre_tokenizer = pre_tokenizers.Metaspace()
    trainer = trainers.UnigramTrainer(vocab_size=120, special_tokens=["<s>", "<pad>", "</s>", "<unk>"], unk_token="<unk>")
    tok.train_from_iterator(CORPUS, trainer)
    return tok


def test_count_pieces_counts_token_ids_across_batches():
    tok = tiny_unigram()
    counts = count_pieces(tok, ["we roast the coffee"] * 7, batch_size=3)
    expected = Counter()
    for _ in range(7):
        expected.update(tok.encode("we roast the coffee", add_special_tokens=False).ids)
    assert counts == expected


def test_single_character_ids_finds_characters_but_not_specials_or_words():
    vocab = [["<s>", 0.0], ["<pad>", 0.0], ["</s>", 0.0], ["<unk>", 0.0], ["a", -1.0], ["▁a", -2.0], ["▁", -3.0], ["the", -2.0], ["▁the", -2.0]]
    assert single_character_ids(vocab) == {4, 5, 6}


def test_choose_keep_always_keeps_specials_and_must_keep_and_applies_per_group_quotas():
    counts = {"en": Counter({10: 50, 11: 40, 12: 3, 13: 1}), "wo": Counter({20: 2, 21: 2, 22: 1})}
    keep = choose_keep(30, counts, {"en": 2, "wo": 5}, must_keep=[25, 29], min_count={"en": 2, "wo": 2})
    assert keep == sorted({0, 1, 2, 3, 10, 11, 20, 21, 25, 29})  # en capped at its quota of 2; wo needs count >= 2; 22 and 13 dropped


def test_added_tokens_such_as_mask_are_always_kept():
    keep = choose_keep(300, {"en": Counter({10: 5})}, {"en": 1}, must_keep=[], specials=[0, 1, 2, 3, 250])
    assert 250 in keep and keep[:4] == [0, 1, 2, 3]


def test_choose_keep_ignores_ids_outside_the_vocabulary_and_is_sorted_and_unique():
    keep = choose_keep(10, {"en": Counter({5: 9, 99: 9})}, {"en": 10}, must_keep=[5, -1, 77])
    assert keep == [0, 1, 2, 3, 5]


def test_a_thin_language_is_not_crowded_out_by_a_big_one():
    en = Counter({i: 1000 - i for i in range(100, 200)})
    wo = Counter({i: 3 for i in range(300, 320)})
    keep = choose_keep(400, {"en": en, "wo": wo}, {"en": 10, "wo": 20}, must_keep=[])
    assert set(range(300, 320)) <= set(keep) and len([i for i in keep if i >= 100 and i < 200]) == 10


def test_the_remapped_tokenizer_segments_kept_text_exactly_like_the_full_one():
    full = tiny_unigram()
    counts = count_pieces(full, CORPUS[:15])  # the first three languages' sentences
    keep = choose_keep(full.get_vocab_size(), {"all": counts}, {"all": 10_000}, must_keep=single_character_ids(__import__("json").loads(full.to_str())["model"]["vocab"]))
    assert len(keep) < full.get_vocab_size()
    data = __import__("json").loads(full.to_str())
    trimmed = Tokenizer.from_str(__import__("json").dumps(remap_tokenizer(data, keep)))
    report = tokenization_fidelity(full, trimmed, keep, CORPUS[:15])
    assert report["identical"] == 1.0 and report["pieces_dropped"] == 0.0


def test_dropped_pieces_are_counted_and_new_ids_are_dense():
    full = tiny_unigram()
    data = __import__("json").loads(full.to_str())
    keep = sorted({0, 1, 2, 3, *single_character_ids(data["model"]["vocab"])})
    trimmed = Tokenizer.from_str(__import__("json").dumps(remap_tokenizer(data, keep)))
    assert trimmed.get_vocab_size() == len(keep)
    assert max(trimmed.encode("we roast the coffee", add_special_tokens=False).ids) < len(keep)
    assert tokenization_fidelity(full, trimmed, keep, ["we roast the coffee"])["identical"] in (0.0, 1.0)


def test_remap_renumbers_unk_added_tokens_and_the_post_processor():
    tok = {
        "model": {"vocab": [["<s>", 0.0], ["<pad>", 0.0], ["</s>", 0.0], ["<unk>", 0.0], ["a", -1.0], ["b", -1.0], ["<mask>", 0.0]], "unk_id": 3},
        "added_tokens": [{"id": 0, "content": "<s>"}, {"id": 6, "content": "<mask>"}],
        "post_processor": {"special_tokens": {"<s>": {"id": "<s>", "ids": [0], "tokens": ["<s>"]}, "</s>": {"id": "</s>", "ids": [2], "tokens": ["</s>"]}}},
    }
    keep = [0, 1, 2, 3, 5, 6]  # drops "a"
    new = remap_tokenizer(tok, keep)
    assert [p[0] for p in new["model"]["vocab"]] == ["<s>", "<pad>", "</s>", "<unk>", "b", "<mask>"]
    assert new["model"]["unk_id"] == 3
    assert [a["id"] for a in new["added_tokens"]] == [0, 5]
    assert new["post_processor"]["special_tokens"]["</s>"]["ids"] == [2]
    assert tok["added_tokens"][1]["id"] == 6  # the input is not modified


def test_remap_refuses_an_id_outside_the_vocabulary():
    with pytest.raises(ValueError):
        remap_tokenizer({"model": {"vocab": [["a", 0.0]], "unk_id": 0}, "added_tokens": []}, [0, 5])


def test_the_tokenizer_config_and_model_config_follow_the_new_ids():
    cfg = remap_tokenizer_config({"added_tokens_decoder": {"0": {"content": "<s>"}, "250001": {"content": "<mask>"}}}, [0, 1, 2, 3, 250001])
    assert set(cfg["added_tokens_decoder"]) == {"0", "4"}
    assert new_model_config({"vocab_size": 250037, "hidden_size": 384}, [0, 1, 2])["vocab_size"] == 3


def test_slice_embedding_keeps_exactly_the_kept_rows_and_changes_nothing_else():
    from onnx import TensorProto, helper, numpy_helper

    rows, hidden = 12, 4
    matrix = np.arange(rows * hidden, dtype=np.float32).reshape(rows, hidden)
    other = np.ones((hidden, hidden), dtype=np.float32)
    graph = helper.make_graph(
        [helper.make_node("Gather", ["emb", "ids"], ["out"])],
        "g",
        [helper.make_tensor_value_info("ids", TensorProto.INT64, [None])],
        [helper.make_tensor_value_info("out", TensorProto.FLOAT, [None, hidden])],
        [numpy_helper.from_array(matrix, "emb"), numpy_helper.from_array(other, "other")],
    )
    model = helper.make_model(graph)
    keep = [0, 3, 7, 11]
    name = slice_embedding(model, keep, rows, hidden)
    assert name == "emb"
    by_name = {t.name: numpy_helper.to_array(t) for t in model.graph.initializer}
    assert by_name["emb"].shape == (4, hidden) and np.array_equal(by_name["emb"], matrix[keep])
    assert np.array_equal(by_name["other"], other)
    with pytest.raises(ValueError, match="exactly one"):
        slice_embedding(model, keep, 99, hidden)
