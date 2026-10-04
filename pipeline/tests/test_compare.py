from asknoor.transcribe import compare, normalize_words, transcript_sha256

SCRIPT = "Welcome to my farm. I'm Noor. My family has worked on this hillside for years."


def test_identical_text_matches():
    assert compare(SCRIPT, SCRIPT) == []


def test_case_and_punctuation_are_ignored():
    assert compare(SCRIPT, "welcome to my farm   i'm noor my family has worked on this hillside for years") == []


def test_curly_apostrophes_are_the_same_as_straight_ones():
    assert compare("I'm Noor", "I’m Noor") == []


def test_a_replaced_word_is_reported_with_its_position():
    heard = "Welcome to my farm. I'm Noor. My family has worked on this hillside for ages."
    [d] = compare(SCRIPT, heard)
    assert (d.kind, d.script, d.heard) == ("replaced", "years", "ages")
    assert d.position == len(normalize_words(SCRIPT)) - 1


def test_a_dropped_word_is_reported_as_missing():
    [d] = compare(SCRIPT, SCRIPT.replace("my farm", "farm"))
    assert (d.kind, d.script, d.heard) == ("missing", "my", "")


def test_an_added_word_is_reported_as_extra():
    [d] = compare(SCRIPT, SCRIPT.replace("Welcome to", "Welcome back to"))
    assert (d.kind, d.script, d.heard) == ("extra", "", "back")


def test_spelled_out_numbers_equal_digits():
    assert compare("a member for 11 years", "a member for eleven years") == []
    assert compare("a member for eleven years", "a member for 11 years") == []


def test_a_different_number_is_a_difference():
    [d] = compare("a member for 11 years", "a member for ten years")
    assert (d.script, d.heard) == ("11", "10")


def test_several_differences_are_all_reported():
    assert len(compare("one two three four five", "one 2 3 four six seven")) == 1  # only the end differs
    assert len(compare("alpha beta gamma delta", "alpha gamma delta epsilon")) == 2


def test_the_hash_ignores_case_and_punctuation_but_not_words():
    assert transcript_sha256("Welcome, to my farm!") == transcript_sha256("welcome to my farm")
    assert transcript_sha256("welcome to my farm") != transcript_sha256("welcome to our farm")
