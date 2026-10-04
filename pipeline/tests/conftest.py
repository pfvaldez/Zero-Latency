"""Generated test signals. Real ffmpeg runs on them; nothing is mocked."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
import pytest

SR = 48_000


def speechlike(seconds: float, peak: float = 0.5, seed: int = 0) -> np.ndarray:
    """A voiced, syllable-paced signal: three harmonics under a 4 Hz amplitude envelope."""
    t = np.arange(int(seconds * SR)) / SR
    rng = np.random.default_rng(seed)
    carrier = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) for f in (180, 360, 720, 1440))
    envelope = (0.55 + 0.45 * np.sin(2 * np.pi * 4 * t)) ** 2
    x = carrier * envelope
    return (x / np.max(np.abs(x)) * peak).astype(np.float32)


def silence(seconds: float, seed: int = 1) -> np.ndarray:
    """Near-digital silence with a very low noise floor (about -90 dBFS)."""
    rng = np.random.default_rng(seed)
    return (rng.standard_normal(int(seconds * SR)) * 3e-5).astype(np.float32)


def write_wav(path: Path, left: np.ndarray, right: np.ndarray | None = None) -> Path:
    channels = [left] if right is None else [left, right]
    data = np.stack(channels, axis=1)
    pcm = (np.clip(data, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(len(channels))
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


@pytest.fixture
def tmp(tmp_path: Path) -> Path:
    return tmp_path
