import json
from pathlib import Path

import pytest

from asknoor.transcribe import (
    Difference,
    TranscribeError,
    api_key,
    comparison_markdown,
    parse_response,
)

FIXTURE = Path(__file__).parent / "fixtures" / "scribe_response_shape.json"


def test_parse_keeps_words_and_drops_spacing_and_audio_events():
    words = parse_response(json.loads(FIXTURE.read_text()))
    assert [w["text"] for w in words] == ["Welcome", "to", "my", "farm."]
    assert words[0] == {"text": "Welcome", "start": 0.12, "end": 0.58}


def test_a_response_without_words_is_an_error():
    with pytest.raises(TranscribeError):
        parse_response({"words": [{"text": " ", "start": 0, "end": 1, "type": "spacing"}]})


def test_the_key_is_read_from_the_environment(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", " abc ")
    assert api_key() == "abc"


def test_the_key_is_read_from_a_env_file(monkeypatch, tmp_path):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    env = tmp_path / ".env"
    env.write_text('OTHER=1\nELEVENLABS_API_KEY="k-123"\n')
    assert api_key(env) == "k-123"


def test_a_missing_key_stops_with_a_clear_message(monkeypatch, tmp_path):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with pytest.raises(TranscribeError, match="pipeline/.env"):
        api_key(tmp_path / "missing.env")


def test_the_report_lists_every_difference_for_preet():
    md = comparison_markdown(
        [
            (1, "Welcome to my farm.", "Welcome to my farm", []),
            (2, "for years", "for ages", [Difference("replaced", "years", "ages", 1)]),
        ]
    )
    assert "## Clip 1: match" in md and "## Clip 2: differs" in md
    assert "replaced at script word 1: script `years`, heard `ages`" in md
