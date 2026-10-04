from pathlib import Path

import pytest

from asknoor.build import BuildError, step_audio

PENDING = (
    "| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n"
    "| Preet Patel | AI dubbing of her English recordings | Discord | 2026-10-03 | pending |\n"
)


def test_a_pending_consent_row_stops_the_build_before_any_audio_work(tmp_path: Path):
    consent = tmp_path / "CONSENT.md"
    consent.write_text(PENDING)
    with pytest.raises(BuildError, match="pending"):
        step_audio("ondera-noor", "demo", consent_md=consent)


def test_a_missing_consent_row_stops_the_build(tmp_path: Path):
    consent = tmp_path / "CONSENT.md"
    consent.write_text(PENDING.replace("Preet Patel", "Someone Else"))
    with pytest.raises(BuildError, match="no consent row"):
        step_audio("ondera-noor", "demo", consent_md=consent)


def test_the_stop_applies_in_production_mode_too(tmp_path: Path):
    consent = tmp_path / "CONSENT.md"
    consent.write_text(PENDING)
    with pytest.raises(BuildError):
        step_audio("ondera-noor", "production", consent_md=consent)


def _registry(tmp_path: Path, monkeypatch, recordings: list[dict]) -> None:
    import json

    from asknoor import build

    farm = tmp_path / "content" / "farm"
    (farm / "recordings").mkdir(parents=True, exist_ok=True)
    (farm / "recordings" / "recordings.json").write_text(json.dumps({"recordings": recordings}))
    monkeypatch.setattr(build, "REPO", tmp_path)


EN = {"clip": 1, "lang": "en", "file": "en/clip01.m4a", "person": "Preet Patel", "kind": "stand-in-voice"}
WO = {"clip": 1, "lang": "wo", "file": "wo/clip01_wo.flac", "person": "Preet Patel", "kind": "ai-dubbed", "consentPerson": "Preet Patel"}


def test_a_mislabeled_registry_entry_cannot_skip_the_gates(tmp_path, monkeypatch):
    from asknoor.build import load_registry

    for bad in (
        {**WO, "kind": "AI-dubbed"},  # mistyped kind
        {**WO, "kind": "stand-in-voice"},  # a Wolof file labeled as the stand-in voice
        {**EN, "kind": "ai-dubbed", "consentPerson": "Preet Patel"},  # an English file marked as a dub
        {**WO, "consentPerson": "Someone Else"},  # cleared by another person's row
    ):
        _registry(tmp_path, monkeypatch, [bad])
        with pytest.raises(BuildError):
            load_registry("farm")


def test_a_well_formed_registry_loads(tmp_path, monkeypatch):
    from asknoor.build import load_registry

    _registry(tmp_path, monkeypatch, [EN, WO])
    assert len(load_registry("farm")) == 2


def test_the_transcript_step_needs_its_own_consent_before_it_reads_a_key(tmp_path, monkeypatch):
    from asknoor import build
    from asknoor.transcribe import step_transcribe

    consent = tmp_path / "CONSENT.md"
    consent.write_text(PENDING.replace("AI dubbing of her English recordings", "Transcription of her English recordings"))
    _registry(tmp_path, monkeypatch, [EN])
    monkeypatch.setattr(build, "CONSENT_MD", consent)
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)
    with pytest.raises(BuildError, match="pending"):  # not "ELEVENLABS_API_KEY is not set"
        step_transcribe("farm")


def test_the_cli_prints_a_clean_message_and_exits_1_when_a_step_fails():
    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "-m", "asknoor.build", "--farm", "no-such-farm", "--steps", "transcribe"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).resolve().parents[1],
    )
    assert result.returncode == 1
    assert "build failed:" in result.stderr and "Traceback" not in result.stderr
