from asknoor import audio
from asknoor.fixture_audio import CLIPS, build


def test_the_fixture_tones_are_mono_aac_at_minus_16_lufs_and_audited(tmp_path):
    report = build(tmp_path)
    assert len(report["clips"]) == len(CLIPS)
    for n, _, _ in CLIPS:
        result = audio.audit_clip(tmp_path / "en" / f"clip{n:02d}.m4a")
        assert result.ok, result.problems
        assert result.channels == 1
    assert "SYNTHETIC" in report["note"]
