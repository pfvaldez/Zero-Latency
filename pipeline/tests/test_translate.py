import pytest

from asknoor.translate import (
    Item,
    placeholders_of,
    protect,
    restore,
    source_hash,
    split_sentences,
    stale,
)

SCRIPT = "Welcome to my farm. I'm Noor. Smell that? That's my favorite time of the day! It costs 3.5 dalasi."


def test_sentences_split_after_terminal_punctuation_and_keep_decimals_whole():
    assert split_sentences(SCRIPT) == [
        "Welcome to my farm.",
        "I'm Noor.",
        "Smell that?",
        "That's my favorite time of the day!",
        "It costs 3.5 dalasi.",
    ]


def test_sentence_edge_cases():
    assert split_sentences("") == []
    assert split_sentences("  One sentence only  ") == ["One sentence only"]
    assert split_sentences("No end punctuation") == ["No end punctuation"]
    assert split_sentences("A.  B.\nC?") == ["A.", "B.", "C?"]


def test_the_hash_changes_with_the_english_and_only_with_the_english():
    assert source_hash(["a", "b"]) == source_hash(["a", "b"])
    assert source_hash(["a", "b"]) != source_hash(["a", "c"])
    assert source_hash(["a", "b"]) != source_hash(["ab"])


def _done(sentences, hash_of=None, langs=("de", "nl", "sv", "wo")):
    return {
        "sourceSha256": hash_of or source_hash(sentences),
        "sentences": [{"en": s, **{lang: f"{lang}:{s}" for lang in langs}} for s in sentences],
    }


LANGS = ("de", "nl", "sv", "wo")


def test_an_up_to_date_item_is_not_stale():
    item = Item("1", ["Hello.", "Bye."])
    assert not stale(_done(item.sentences), item, LANGS)


def test_a_missing_item_is_stale():
    assert stale(None, Item("1", ["Hello."]), LANGS)
    assert stale({}, Item("1", ["Hello."]), LANGS)


def test_changing_one_english_word_makes_it_stale():
    old = Item("1", ["Welcome to my farm.", "Bye."])
    new = Item("1", ["Welcome to our farm.", "Bye."])
    assert not stale(_done(old.sentences), old, LANGS)
    assert stale(_done(old.sentences), new, LANGS)


def test_a_missing_language_or_a_different_sentence_count_makes_it_stale():
    item = Item("1", ["Hello.", "Bye."])
    missing = _done(item.sentences)
    missing["sentences"][0]["wo"] = ""
    assert stale(missing, item, LANGS)
    short = _done(item.sentences[:1])
    short["sourceSha256"] = item.sha  # same hash claim, wrong shape
    assert stale(short, item, LANGS)


def test_a_hash_that_matches_but_english_that_does_not_is_stale():
    item = Item("1", ["Hello."])
    tampered = _done(["Goodbye."], hash_of=item.sha)
    assert stale(tampered, item, LANGS)


@pytest.mark.parametrize("style", ["[[{n}]]", "<ph{n}>", "#{n}#"])
def test_placeholders_are_masked_and_restored(style):
    text = "This month: {guests} guests, {orders} orders. Loved: {loved}."
    masked, mapping = protect(text, style)
    assert "{" not in masked and len(mapping) == 3
    assert restore(masked, mapping) == text


def test_a_lost_or_duplicated_marker_fails_the_restore():
    masked, mapping = protect("{a} and {b}", "[[{n}]]")
    assert restore(masked.replace("[[2]]", ""), mapping) is None
    assert restore(masked + " [[1]]", mapping) is None


def test_placeholders_of_lists_them_sorted():
    assert placeholders_of("{b} x {a} {b}") == ["{a}", "{b}", "{b}"]
