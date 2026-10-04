"""Generated test tones for the committed fixture pack (SYNTHETIC: not a voice, nobody's
recording). Each clip is a different pitched tone with a slow beat, so it is audibly distinct, run
through the same prep chain as real clips (mono, trim, -16 LUFS, AAC) and audited.

    uv run python -m asknoor.fixture_audio
"""

from __future__ import annotations

import json
import tempfile
import wave
from pathlib import Path

import numpy as np

from . import audio

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "packages" / "pack" / "fixtures" / "audio"  # en/clipNN.m4a and audio-report.json
# (clip, base frequency Hz, seconds of tone)
CLIPS = [(1, 330.0, 5.0), (2, 440.0, 6.0), (3, 550.0, 5.5)]


def tone(freq: float, seconds: float, sr: int = audio.SAMPLE_RATE) -> np.ndarray:
    """A tone with a gentle 3 Hz beat, 0.3 s of near-silence before and after."""
    t = np.arange(int(seconds * sr)) / sr
    body = np.sin(2 * np.pi * freq * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 3 * t))
    body += 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    edge = np.zeros(int(0.3 * sr))
    return np.concatenate([edge, body * 0.4, edge]).astype(np.float32)


def write_wav(path: Path, samples: np.ndarray) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(audio.SAMPLE_RATE)
        w.writeframes(pcm.tobytes())


def build(out: Path = OUT) -> dict:
    (out / "en").mkdir(parents=True, exist_ok=True)
    report: dict[str, dict] = {}
    with tempfile.TemporaryDirectory() as tmp:
        for n, freq, seconds in CLIPS:
            src = Path(tmp) / f"clip{n:02d}.wav"
            write_wav(src, tone(freq, seconds))
            dst = out / "en" / f"clip{n:02d}.m4a"
            row = audio.build_clip(src, dst)
            report[f"en/clip{n:02d}.m4a"] = row
    doc = {
        "note": "SYNTHETIC generated tones for the fixture pack. Not a voice and not anyone's recording.",
        "clips": report,
    }
    (out / "audio-report.json").write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return doc


if __name__ == "__main__":
    done = build()
    print(f"fixture tones: {len(done['clips'])} clips written to {OUT}")
