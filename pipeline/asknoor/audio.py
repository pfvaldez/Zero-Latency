"""Audio prep for pack clips: mono, trim, loudness, AAC, and an audit of the result.

Every recording goes through the same steps:

1. decode to float PCM
2. mono check: mixing both channels to mono must not lose more than 3 dB, otherwise use the
   louder single channel (an anti-phase dub averages to near silence)
3. trim leading and trailing silence down to at most 0.3 s each
4. normalize to -16 LUFS integrated, -1.5 dBTP true peak (ffmpeg loudnorm, two passes, linear)
5. encode mono AAC at 48 kbps (.m4a); AAC can add a fraction of a dB to the peak, so the audit
   allows -1.0 dBTP against the -1.5 pre-encode target
6. audit the encoded file; the build fails if any pack clip fails

ffmpeg comes from the pinned imageio-ffmpeg wheel, so CI and teammates need no system install.
"""

from __future__ import annotations

import json
import math
import re
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np

SAMPLE_RATE = 48_000
TARGET_LUFS = -16.0
LUFS_TOLERANCE = 1.0
TARGET_TRUE_PEAK = -1.5
MAX_TRUE_PEAK = -1.0  # after AAC encoding, which can overshoot the pre-encode target a little
AAC_BITRATE = "48k"
MONO_LOSS_LIMIT_DB = 3.0
KEEP_SILENCE_S = 0.3  # trim leading and trailing silence down to this
MAX_SILENCE_S = 0.5  # audit limit at either end
SILENCE_BELOW_REF_DB = 40.0  # silence is this far under the clip's own loud level...
NOISE_FLOOR_MARGIN_DB = 10.0  # ...but never closer than this to the clip's own noise floor
SILENT_DB = -70.0  # a clip whose loud level is below this is treated as silent
WINDOW_S = 0.02


class AudioError(Exception):
    pass


def ffmpeg_exe() -> str:
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _run(args: list[str], *, stdin: bytes | None = None) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run([ffmpeg_exe(), "-hide_banner", *args], input=stdin, capture_output=True)
    if result.returncode != 0:
        raise AudioError(f"ffmpeg failed: {result.stderr.decode(errors='replace')[-800:]}")
    return result


# ---- probe and decode ------------------------------------------------------------------------

_LAYOUT_CHANNELS = {"mono": 1, "stereo": 2}


def probe(path: Path) -> dict:
    """Channels, sample rate and codec of the first audio stream, read from ffmpeg's banner."""
    result = subprocess.run(
        [ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True
    )  # exits 1 without an output file; the banner is what we want
    text = result.stderr.decode(errors="replace")
    match = re.search(r"Audio: (\w+)[^\n]*?, (\d+) Hz, ([\w.()]+)", text)
    if not match:
        raise AudioError(f"no audio stream in {path}")
    codec, rate, layout = match.group(1), int(match.group(2)), match.group(3)
    channels = _LAYOUT_CHANNELS.get(layout)
    if channels is None:
        count = re.match(r"(\d+)\.?(\d)?", layout)
        channels = int(count.group(1)) if count else 0
    return {"codec": codec, "sample_rate": rate, "channels": channels}


def decode(path: Path, channels: int = 2) -> np.ndarray:
    """Decode to float32 samples at 48 kHz, shape (frames, channels)."""
    raw = _run(
        ["-v", "error", "-i", str(path), "-f", "f32le", "-ac", str(channels), "-ar", str(SAMPLE_RATE), "-"]
    ).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, channels).astype(np.float32)


# ---- mono check ------------------------------------------------------------------------------


@dataclass(frozen=True)
class MonoPlan:
    method: str  # "mean", "left" or "right"
    loss_db: float  # what averaging both channels would lose; inf for fully out-of-phase


def mono_plan(stereo: np.ndarray) -> MonoPlan:
    """Decide how to make mono. Averaging loses `loss_db` against the average channel power."""
    left, right = stereo[:, 0].astype(np.float64), stereo[:, 1].astype(np.float64)
    p_left, p_right = float(np.mean(left**2)), float(np.mean(right**2))
    if p_left + p_right == 0.0:
        raise AudioError("the recording is silent")
    p_mix = float(np.mean(((left + right) / 2) ** 2))
    loss = math.inf if p_mix == 0.0 else 10 * math.log10(((p_left + p_right) / 2) / p_mix)
    if loss > MONO_LOSS_LIMIT_DB:
        return MonoPlan("left" if p_left >= p_right else "right", loss)
    return MonoPlan("mean", loss)


def to_mono(stereo: np.ndarray, plan: MonoPlan) -> np.ndarray:
    if plan.method == "left":
        return stereo[:, 0].copy()
    if plan.method == "right":
        return stereo[:, 1].copy()
    return stereo.mean(axis=1).astype(np.float32)


# ---- silence ---------------------------------------------------------------------------------


def _window_db(mono: np.ndarray) -> np.ndarray:
    win = int(WINDOW_S * SAMPLE_RATE)
    frames = len(mono) // win
    if frames == 0:
        raise AudioError("the recording is too short")
    blocks = mono[: frames * win].astype(np.float64).reshape(frames, win)
    rms = np.sqrt(np.mean(blocks**2, axis=1))
    return 20 * np.log10(rms + 1e-12)


def _active(mono: np.ndarray) -> np.ndarray:
    """True for windows that are sound, not silence. The threshold is relative to the clip itself
    (its 95th-percentile level and its 5th-percentile noise floor), so a loudness change such as
    normalization never changes what counts as silence."""
    db = _window_db(mono)
    ref = float(np.percentile(db, 95))
    if ref < SILENT_DB:
        raise AudioError("the recording is silent")
    floor = float(np.percentile(db, 5))
    return db > max(ref - SILENCE_BELOW_REF_DB, floor + NOISE_FLOOR_MARGIN_DB)


def edge_silence_s(mono: np.ndarray) -> tuple[float, float]:
    """Seconds of silence before the first and after the last sound."""
    active = np.flatnonzero(_active(mono))
    win_s = int(WINDOW_S * SAMPLE_RATE) / SAMPLE_RATE
    frames = len(_window_db(mono))
    head = active[0] * win_s
    tail = (frames - 1 - active[-1]) * win_s + (len(mono) - frames * int(WINDOW_S * SAMPLE_RATE)) / SAMPLE_RATE
    return float(head), float(tail)


def trim_silence(mono: np.ndarray, keep_s: float = KEEP_SILENCE_S) -> tuple[np.ndarray, float, float]:
    """Cut leading and trailing silence down to at most `keep_s` each. Never pads a short edge.
    Returns the trimmed samples and the seconds removed from the head and the tail."""
    active = np.flatnonzero(_active(mono))
    win = int(WINDOW_S * SAMPLE_RATE)
    keep = int(keep_s * SAMPLE_RATE)
    start = max(0, int(active[0]) * win - keep)
    end = min(len(mono), (int(active[-1]) + 1) * win + keep)
    return mono[start:end], start / SAMPLE_RATE, (len(mono) - end) / SAMPLE_RATE


# ---- loudness --------------------------------------------------------------------------------


def _f32_bytes(mono: np.ndarray) -> bytes:
    return np.asarray(mono, dtype="<f4").tobytes()


_RAW_IN = ["-f", "f32le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0"]


def _measure_loudnorm(mono: np.ndarray, true_peak: float) -> dict:
    filt = f"loudnorm=I={TARGET_LUFS}:TP={true_peak}:LRA=11:print_format=json"
    result = _run([*_RAW_IN, "-af", filt, "-f", "null", "-"], stdin=_f32_bytes(mono))
    text = result.stderr.decode(errors="replace")
    block = text[text.rindex("{") : text.rindex("}") + 1]
    return json.loads(block)


def encode_normalized(mono: np.ndarray, dst: Path, true_peak: float = TARGET_TRUE_PEAK) -> None:
    """Two-pass linear loudnorm, then mono AAC 48 kbps. Writes `dst` (.m4a)."""
    m = _measure_loudnorm(mono, true_peak)
    filt = (
        f"loudnorm=I={TARGET_LUFS}:TP={true_peak}:LRA=11:"
        f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
        f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    dst.parent.mkdir(parents=True, exist_ok=True)
    _run(
        [
            *_RAW_IN,
            "-af",
            filt,
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-c:a",
            "aac",
            "-b:a",
            AAC_BITRATE,
            "-movflags",
            "+faststart",
            "-y",
            str(dst),
        ],
        stdin=_f32_bytes(mono),
    )


def measure(path: Path) -> dict:
    """Integrated loudness (LUFS) and true peak (dBTP) of a file, from ffmpeg's ebur128."""
    result = _run(["-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"])
    text = result.stderr.decode(errors="replace")
    summary = text[text.rindex("Summary:") :]
    lufs = re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary)
    peak = re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    if not lufs or not peak:
        raise AudioError(f"could not read loudness of {path}")
    return {"lufs": float(lufs.group(1)), "true_peak": float(peak.group(1))}


# ---- audit -----------------------------------------------------------------------------------


@dataclass
class Audit:
    channels: int
    codec: str
    lufs: float
    true_peak: float
    head_silence_s: float
    tail_silence_s: float
    duration_ms: int
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def audit_clip(path: Path) -> Audit:
    """Everything a pack clip must satisfy: mono, -16 +/-1 LUFS, at most 0.5 s of silence at
    either end, a true peak at or under -1.0 dBTP, AAC at 48 kHz."""
    info = probe(path)
    loud = measure(path)
    mono = decode(path, channels=1)[:, 0]
    head, tail = edge_silence_s(mono)
    audit = Audit(
        channels=info["channels"],
        codec=info["codec"],
        lufs=loud["lufs"],
        true_peak=loud["true_peak"],
        head_silence_s=round(head, 3),
        tail_silence_s=round(tail, 3),
        duration_ms=round(len(mono) / SAMPLE_RATE * 1000),
    )
    if info["channels"] != 1:
        audit.problems.append(f"not mono ({info['channels']} channels)")
    if info["codec"] != "aac" or info["sample_rate"] != SAMPLE_RATE:
        audit.problems.append(f"expected aac at {SAMPLE_RATE} Hz, got {info['codec']} at {info['sample_rate']} Hz")
    if abs(loud["lufs"] - TARGET_LUFS) > LUFS_TOLERANCE:
        audit.problems.append(f"loudness {loud['lufs']} LUFS is not {TARGET_LUFS} +/-{LUFS_TOLERANCE}")
    if loud["true_peak"] > MAX_TRUE_PEAK:
        audit.problems.append(f"true peak {loud['true_peak']} dBTP is above {MAX_TRUE_PEAK}")
    if head > MAX_SILENCE_S or tail > MAX_SILENCE_S:
        audit.problems.append(f"silence at the ends is {head:.2f} s and {tail:.2f} s (limit {MAX_SILENCE_S} s)")
    return audit


# ---- one clip --------------------------------------------------------------------------------


def build_clip(src: Path, dst: Path) -> dict:
    """Prepare one recording and return its report row. Raises AudioError if the result fails
    the audit."""
    info = probe(src)
    stereo = decode(src, channels=2)  # a mono source decodes to two identical channels
    plan = mono_plan(stereo)
    mono = to_mono(stereo, plan)
    trimmed, head_removed, tail_removed = trim_silence(mono)

    # loudnorm targets -1.5 dBTP before encoding, and AAC can add to the peak (clip 3 of the real
    # recordings reached -0.9). When that happens, encode once more with that much extra headroom.
    encode_normalized(trimmed, dst)
    audit = audit_clip(dst)
    if audit.true_peak > TARGET_TRUE_PEAK:
        headroom = audit.true_peak - TARGET_TRUE_PEAK + 0.1
        encode_normalized(trimmed, dst, TARGET_TRUE_PEAK - headroom)
        audit = audit_clip(dst)
    if not audit.ok:
        raise AudioError(f"{dst.name}: " + "; ".join(audit.problems))
    return {
        "source_channels": info["channels"],
        "mono_method": plan.method,
        "mono_loss_db": None if math.isinf(plan.loss_db) else round(plan.loss_db, 2),
        "trimmed_head_s": round(head_removed, 3),
        "trimmed_tail_s": round(tail_removed, 3),
        "lufs": audit.lufs,
        "true_peak": audit.true_peak,
        "duration_ms": audit.duration_ms,
        "head_silence_s": audit.head_silence_s,
        "tail_silence_s": audit.tail_silence_s,
    }


__all__ = [name for name in dir() if not name.startswith("_")]
_ = asdict  # re-exported for callers that serialise Audit
