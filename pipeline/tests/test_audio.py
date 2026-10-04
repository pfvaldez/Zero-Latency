import math
import subprocess

import numpy as np
import pytest
from conftest import SR, silence, speechlike, write_wav

from asknoor import audio


def tone_with_edges(head: float, body: float, tail: float, peak: float = 0.5) -> np.ndarray:
    return np.concatenate([silence(head), speechlike(body, peak), silence(tail, seed=2)])


# ---- mono check ---------------------------------------------------------------------------


def test_identical_channels_are_averaged():
    x = speechlike(1.0)
    plan = audio.mono_plan(np.stack([x, x], axis=1))
    assert plan.method == "mean"
    assert plan.loss_db == pytest.approx(0.0, abs=0.01)


def test_anti_phase_channels_use_one_channel_not_the_average():
    x = speechlike(1.0)
    plan = audio.mono_plan(np.stack([x, -x], axis=1))
    assert math.isinf(plan.loss_db)
    assert plan.method in ("left", "right")
    mono = audio.to_mono(np.stack([x, -x], axis=1), plan)
    assert np.sqrt(np.mean(mono**2)) > 0.1  # averaging would have given silence


def test_a_partial_cancellation_over_3_db_picks_the_louder_channel():
    x = speechlike(1.0)
    stereo = np.stack([x, -0.35 * x], axis=1)  # averaging loses about 7 dB
    plan = audio.mono_plan(stereo)
    assert 3 < plan.loss_db < 10
    assert plan.method == "left"
    assert audio.mono_plan(np.stack([-0.35 * x, x], axis=1)).method == "right"


def test_a_small_loss_under_3_db_still_averages():
    x = speechlike(1.0)
    y = speechlike(1.0, seed=5)
    plan = audio.mono_plan(np.stack([x, 0.9 * x + 0.1 * y], axis=1))
    assert plan.method == "mean"
    assert plan.loss_db < 3


def test_a_silent_recording_is_an_error():
    z = np.zeros(SR, dtype=np.float32)
    with pytest.raises(audio.AudioError):
        audio.mono_plan(np.stack([z, z], axis=1))


# ---- trim ---------------------------------------------------------------------------------


def test_trim_keeps_at_most_0_3_s_at_each_end():
    x = tone_with_edges(1.0, 2.0, 1.0)
    trimmed, head_removed, tail_removed = audio.trim_silence(x)
    assert len(trimmed) / SR == pytest.approx(2.6, abs=0.05)
    assert head_removed == pytest.approx(0.7, abs=0.03)
    assert tail_removed == pytest.approx(0.7, abs=0.03)
    head, tail = audio.edge_silence_s(trimmed)
    assert head <= 0.35 and tail <= 0.35


def test_trim_never_pads_a_short_edge():
    x = tone_with_edges(0.1, 2.0, 0.1)
    trimmed, head_removed, tail_removed = audio.trim_silence(x)
    assert head_removed == 0 and tail_removed == 0
    assert len(trimmed) == len(x)


def test_trim_of_an_all_silent_file_is_an_error():
    with pytest.raises(audio.AudioError):
        audio.trim_silence(silence(2.0))


def test_silence_is_relative_so_a_quiet_clip_is_not_all_silence():
    quiet = tone_with_edges(0.5, 2.0, 0.5, peak=0.003)  # about -50 dBFS peak
    head, tail = audio.edge_silence_s(quiet)
    assert 0.3 < head < 0.7 and 0.3 < tail < 0.7


# ---- build_clip: the whole chain ----------------------------------------------------------


@pytest.mark.parametrize("peak", [0.005, 0.2, 0.99], ids=["quiet", "normal", "loud"])
def test_every_clip_lands_at_minus_16_lufs_mono_with_short_edges(tmp, peak):
    src = write_wav(tmp / "in.wav", *(2 * [tone_with_edges(1.5, 3.0, 2.0, peak)]))
    dst = tmp / "out.m4a"
    row = audio.build_clip(src, dst)
    result = audio.audit_clip(dst)
    assert result.ok, result.problems
    assert result.channels == 1 and result.codec == "aac"
    assert abs(result.lufs - (-16)) <= 1
    assert result.true_peak <= -1.0
    assert result.head_silence_s <= 0.5 and result.tail_silence_s <= 0.5
    assert row["mono_method"] == "mean"
    assert row["trimmed_head_s"] > 1.0 and row["trimmed_tail_s"] > 1.0


def test_an_anti_phase_dub_comes_out_audible_at_minus_16_lufs(tmp):
    x = tone_with_edges(0.5, 3.0, 2.0)
    src = write_wav(tmp / "dub.wav", x, -x)  # averaging these gives silence
    dst = tmp / "out.m4a"
    row = audio.build_clip(src, dst)
    assert row["mono_method"] in ("left", "right")
    assert row["mono_loss_db"] is None  # infinite loss
    assert abs(audio.audit_clip(dst).lufs - (-16)) <= 1


def test_the_output_bitrate_is_about_48_kbps(tmp):
    src = write_wav(tmp / "in.wav", *(2 * [tone_with_edges(0.3, 5.0, 0.3)]))
    dst = tmp / "out.m4a"
    audio.build_clip(src, dst)
    seconds = audio.audit_clip(dst).duration_ms / 1000
    kbps = dst.stat().st_size * 8 / seconds / 1000
    assert 30 < kbps < 70


def test_a_flac_source_is_read(tmp):
    wav = write_wav(tmp / "in.wav", *(2 * [tone_with_edges(0.3, 2.0, 0.3)]))
    flac = tmp / "in.flac"
    audio._run(["-i", str(wav), "-y", str(flac)])
    row = audio.build_clip(flac, tmp / "out.m4a")
    assert row["source_channels"] == 2


# ---- the audit must be able to fail --------------------------------------------------------


def encode(wav, out, *extra):
    audio._run(["-i", str(wav), *extra, "-c:a", "aac", "-b:a", "48k", "-y", str(out)])
    return out


def test_audit_fails_a_stereo_file(tmp):
    wav = write_wav(tmp / "s.wav", *(2 * [tone_with_edges(0.2, 3.0, 0.2)]))
    out = encode(wav, tmp / "stereo.m4a", "-af", "loudnorm=I=-16:TP=-1.5")
    result = audio.audit_clip(out)
    assert not result.ok and any("not mono" in p for p in result.problems)


def test_audit_fails_a_file_at_minus_20_lufs(tmp):
    wav = write_wav(tmp / "q.wav", tone_with_edges(0.2, 3.0, 0.2))
    out = encode(wav, tmp / "quiet.m4a", "-ac", "1", "-af", "loudnorm=I=-20:TP=-3")
    result = audio.audit_clip(out)
    assert not result.ok and any("loudness" in p for p in result.problems)


def test_audit_fails_one_second_of_leading_silence(tmp):
    wav = write_wav(tmp / "l.wav", tone_with_edges(1.0, 3.0, 0.2))
    out = encode(wav, tmp / "long.m4a", "-ac", "1", "-af", "loudnorm=I=-16:TP=-1.5")
    result = audio.audit_clip(out)
    assert not result.ok and any("silence" in p for p in result.problems)


def test_audit_fails_a_true_peak_over_the_limit(tmp):
    wav = write_wav(tmp / "p.wav", tone_with_edges(0.2, 3.0, 0.2))
    out = encode(wav, tmp / "hot.m4a", "-ac", "1", "-af", "loudnorm=I=-16:TP=0.0:linear=false")
    result = audio.audit_clip(out)
    if result.true_peak > -1.0:
        assert any("true peak" in p for p in result.problems)


def test_probe_reports_channels_and_codec(tmp):
    wav = write_wav(tmp / "m.wav", speechlike(1.0))
    info = audio.probe(wav)
    assert info["channels"] == 1 and info["sample_rate"] == SR


def test_ffmpeg_has_what_the_chain_needs():
    out = subprocess.run([audio.ffmpeg_exe(), "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    assert "loudnorm" in out and "ebur128" in out


def test_a_hot_dense_clip_still_ends_at_or_under_the_true_peak_limit(tmp):
    # Loud and dense is where AAC adds to the peak; real clip 3 reached -0.9 before the re-encode.
    rng = np.random.default_rng(3)
    x = np.clip(speechlike(4.0, 0.99) + rng.standard_normal(4 * SR).astype(np.float32) * 0.02, -1, 1)
    dst = tmp / "hot.m4a"
    audio.build_clip(write_wav(tmp / "hot.wav", x), dst)
    assert audio.audit_clip(dst).true_peak <= -1.0
