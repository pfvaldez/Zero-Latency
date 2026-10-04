"""Choosing which tokens of the e5 vocabulary to keep, and rewriting the tokenizer and the model
for the smaller vocabulary.

multilingual-e5-small spends about 96 of its 118 MB (int8) on a 250k-token embedding matrix, most of
it for scripts and languages we never see. Keeping the tokens that occur in a large public text
sample of en, de, nl, sv and wo plus our own content cuts that to a fraction. The kept ids stay in
their original order, so the new id of a token is its position in the keep list.
"""

from __future__ import annotations

import copy
from collections import Counter
from collections.abc import Iterable

import numpy as np

SPECIAL_IDS = (0, 1, 2, 3)  # <s> <pad> </s> <unk>: always kept, at the same ids


def count_pieces(tokenizer, texts: Iterable[str], batch_size: int = 4000) -> Counter:
    """How often each token id occurs when `texts` are tokenized (no special tokens added)."""
    counts: Counter = Counter()
    batch: list[str] = []

    def flush() -> None:
        for enc in tokenizer.encode_batch(batch, add_special_tokens=False):
            counts.update(enc.ids)
        batch.clear()

    for text in texts:
        batch.append(text)
        if len(batch) >= batch_size:
            flush()
    if batch:
        flush()
    return counts


def single_character_ids(vocab: list[list]) -> set[int]:
    """Ids of pieces that are one character (with or without the word-start marker)."""
    return {i for i, (piece, _score) in enumerate(vocab) if len(piece.lstrip("▁")) <= 1 and i not in SPECIAL_IDS}


def choose_keep(
    vocab_size: int,
    per_group_counts: dict[str, Counter],
    quotas: dict[str, int],
    must_keep: Iterable[int],
    min_count: dict[str, int] | None = None,
    specials: Iterable[int] = SPECIAL_IDS,
) -> list[int]:
    """The sorted ids to keep: the specials (the four fixed ones and every added token such as
    <mask>), everything in `must_keep` (our own content and every single character), and for each
    group its `quota` most frequent ids with at least `min_count` occurrences. Quotas are per group
    so a thin language (Wolof) is not crowded out by English."""
    keep = set(SPECIAL_IDS) | set(specials) | {i for i in must_keep if 0 <= i < vocab_size}
    for group, counts in per_group_counts.items():
        floor = (min_count or {}).get(group, 2)
        ranked = [i for i, c in counts.most_common() if c >= floor and 0 <= i < vocab_size]
        keep.update(ranked[: quotas.get(group, 0)])
    return sorted(keep)


# ---- rewriting the tokenizer -------------------------------------------------------------------


def remap_tokenizer(tokenizer_json: dict, keep: list[int]) -> dict:
    """tokenizer.json for the kept tokens: new vocabulary list, unk id, added tokens and the ids in
    the post-processor all renumbered. Segmentation of text made of kept pieces is unchanged."""
    tok = copy.deepcopy(tokenizer_json)
    old_vocab = tok["model"]["vocab"]
    old_to_new = {old: new for new, old in enumerate(keep)}
    if any(old >= len(old_vocab) for old in keep):
        raise ValueError("a kept id is outside the tokenizer vocabulary")
    tok["model"]["vocab"] = [old_vocab[old] for old in keep]
    tok["model"]["unk_id"] = old_to_new[tok["model"]["unk_id"]]
    for added in tok["added_tokens"]:
        added["id"] = old_to_new[added["id"]]
    post = tok.get("post_processor") or {}
    for entry in (post.get("special_tokens") or {}).values():
        entry["ids"] = [old_to_new[i] for i in entry["ids"]]
    return tok


def remap_tokenizer_config(config_json: dict, keep: list[int]) -> dict:
    cfg = copy.deepcopy(config_json)
    old_to_new = {old: new for new, old in enumerate(keep)}
    decoder = cfg.get("added_tokens_decoder")
    if decoder:
        cfg["added_tokens_decoder"] = {str(old_to_new[int(k)]): v for k, v in decoder.items()}
    return cfg


def new_model_config(config_json: dict, keep: list[int]) -> dict:
    cfg = copy.deepcopy(config_json)
    cfg["vocab_size"] = len(keep)
    return cfg


# ---- slicing the embedding matrix inside the ONNX graph ----------------------------------------


def slice_embedding(model, keep: list[int], old_rows: int, hidden: int):
    """Replace the (old_rows x hidden) word-embedding initializer by its kept rows. The graph is
    otherwise untouched: it gathers by the new, smaller ids."""
    from onnx import numpy_helper

    matches = [t for t in model.graph.initializer if list(t.dims) == [old_rows, hidden]]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one ({old_rows} x {hidden}) initializer, found {len(matches)}")
    old = numpy_helper.to_array(matches[0])
    new = numpy_helper.from_array(np.ascontiguousarray(old[keep]), name=matches[0].name)
    matches[0].CopyFrom(new)
    return matches[0].name


# ---- how well the smaller tokenizer reproduces the full one ------------------------------------


def tokenization_fidelity(full, trimmed, keep: list[int], sentences: list[str]) -> dict:
    """Share of sentences that the trimmed tokenizer splits into exactly the same pieces as the
    full one (after renumbering), and the share of pieces that were dropped (mapped to <unk>)."""
    old_to_new = {old: new for new, old in enumerate(keep)}
    unk = 3
    same = dropped = total = 0
    for s in sentences:
        a = full.encode(s, add_special_tokens=False).ids
        b = trimmed.encode(s, add_special_tokens=False).ids
        mapped = [old_to_new.get(i, unk) for i in a]
        same += int(mapped == b)
        dropped += sum(1 for i in a if i not in old_to_new)
        total += len(a)
    n = max(1, len(sentences))
    return {"sentences": len(sentences), "identical": round(same / n, 4), "pieces_dropped": round(dropped / max(1, total), 5)}
