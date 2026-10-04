from pathlib import Path

import pytest

from asknoor.consent import ConsentError, read_rows, require_confirmed

REPO = Path(__file__).resolve().parents[2]
HEADER = "| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n"


def table(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "CONSENT.md"
    path.write_text("# Consent\n\n" + HEADER + "\n".join(rows) + "\n")
    return path


def row(person="Preet Patel", what="AI dubbing of her English recordings", status="confirmed"):
    return f"| {person} | {what} | Discord | 2026-10-03 | {status} |"


def test_a_confirmed_row_passes(tmp_path):
    require_confirmed(table(tmp_path, row()), "Preet Patel")


def test_a_pending_row_stops_the_build(tmp_path):
    with pytest.raises(ConsentError, match="pending"):
        require_confirmed(table(tmp_path, row(status="pending")), "Preet Patel")


def test_a_missing_person_stops_the_build(tmp_path):
    with pytest.raises(ConsentError, match="no consent row"):
        require_confirmed(table(tmp_path, row()), "Someone Else")


def test_extra_words_in_the_status_cell_fail(tmp_path):
    for status in ("confirmed (set by the captain)", "Confirmed", "confirmed?", ""):
        with pytest.raises(ConsentError):
            require_confirmed(table(tmp_path, row(status=status)), "Preet Patel")


def test_one_unconfirmed_row_for_the_scope_is_enough_to_refuse(tmp_path):
    rows = table(tmp_path, row(), row(what="AI dubbing into Dutch", status="pending"))
    with pytest.raises(ConsentError):
        require_confirmed(rows, "Preet Patel")


def test_other_scopes_do_not_count(tmp_path):
    with pytest.raises(ConsentError, match="no consent row"):
        require_confirmed(table(tmp_path, row(what="Appearing in the video")), "Preet Patel")


def test_the_person_match_ignores_case(tmp_path):
    require_confirmed(table(tmp_path, row()), "preet patel")


def test_the_separator_and_other_text_are_not_rows(tmp_path):
    assert len(read_rows(table(tmp_path, row()))) == 1


def test_the_real_consent_file_confirms_preet():
    require_confirmed(REPO / "docs" / "CONSENT.md", "Preet Patel")


def test_a_row_that_reads_as_a_refusal_never_counts(tmp_path):
    for what in ("Does not consent to AI dubbing", "AI dubbing, except in the video", "No AI dubbing", "AI dubbing (revoked)"):
        with pytest.raises(ConsentError, match="refusal"):
            require_confirmed(table(tmp_path, row(what=what)), "Preet Patel")


def test_the_scope_is_a_whole_word(tmp_path):
    with pytest.raises(ConsentError, match="no consent row"):
        require_confirmed(table(tmp_path, row(what="Undubbing is not a word")), "Preet Patel")


def test_a_second_table_is_read_with_its_own_header(tmp_path):
    path = tmp_path / "CONSENT.md"
    path.write_text(
        "# Consent\n\n" + HEADER + row() + "\n\nOther notes\n\n"
        "| Person | Where | What they consented to | Date | Status |\n|---|---|---|---|---|\n"
        "| Preet Patel | Discord | AI dubbing | 2026-10-03 | pending |\n"
    )
    with pytest.raises(ConsentError, match="pending"):  # the second table's own columns are used
        require_confirmed(path, "Preet Patel")


def test_transcription_is_its_own_scope(tmp_path):
    path = table(tmp_path, row(), row(what="Transcription of her English recordings with ElevenLabs", status="pending"))
    require_confirmed(path, "Preet Patel", scope="dubbing")
    with pytest.raises(ConsentError, match="pending"):
        require_confirmed(path, "Preet Patel", scope="transcription")
