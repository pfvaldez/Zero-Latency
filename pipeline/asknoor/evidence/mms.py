"""Meta MMS (mms-1b-all) with the Wolof adapter, run locally. MMS is CC-BY-NC-4.0."""

from __future__ import annotations

import time
from pathlib import Path

import numpy as np

MMS_REVISION = "3d33597edbdaaba14a8e858e2c8caa76e3cec0cd"
MMS_ADAPTER = "wol"
MMS_RATE = 16_000


class Recognizer:
    def __init__(self, model_dir: Path) -> None:
        import torch
        from transformers import AutoProcessor, Wav2Vec2ForCTC

        self._torch = torch
        self.processor = AutoProcessor.from_pretrained(model_dir)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_dir)
        self.processor.tokenizer.set_target_lang(MMS_ADAPTER)
        self.model.load_adapter(MMS_ADAPTER)
        self.model.eval()

    def transcribe(self, samples: np.ndarray) -> str:
        """Greedy CTC transcript of mono 16 kHz float32 samples."""
        inputs = self.processor(samples, sampling_rate=MMS_RATE, return_tensors="pt")
        with self._torch.no_grad():
            logits = self.model(**inputs).logits
        ids = self._torch.argmax(logits, dim=-1)[0]
        return self.processor.decode(ids)


def run_fleurs(recognizer: Recognizer, parquet: Path, n: int, seed: int, log=print) -> dict:
    """Word and character error rate on a seeded sample of FLEURS wo_sn test utterances."""
    import pyarrow.parquet as pq

    from .. import audio
    from .text import error_rates, seeded_sample

    table = pq.read_table(parquet, columns=["id", "audio", "transcription"]).to_pylist()
    pick = seeded_sample(len(table), n, seed)
    hyps: list[str] = []
    refs: list[str] = []
    seconds = 0.0
    started = time.time()
    for k, i in enumerate(pick):
        row = table[i]
        samples = audio.decode_bytes(row["audio"]["bytes"], channels=1, sample_rate=MMS_RATE)[:, 0]
        seconds += len(samples) / MMS_RATE
        hyps.append(recognizer.transcribe(samples))
        refs.append(row["transcription"])
        if (k + 1) % 10 == 0:
            log(f"fleurs {k + 1}/{len(pick)} ({round(time.time() - started)} s)")
    rates = error_rates(hyps, refs)
    return {
        "split": "wo_sn test",
        "utterances_in_split": len(table),
        "seed": seed,
        "audio_seconds": round(seconds),
        "decode_seconds": round(time.time() - started),
        "examples": [{"id": table[i]["id"], "reference": refs[k], "hypothesis": hyps[k]} for k, i in enumerate(pick[:5])],
        **rates,
    }
