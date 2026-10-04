"""Round trip on the AI-dubbed Wolof clips: MMS Wolof transcript, then NLLB Wolof to English,
then chrF against the English script Preet recorded. Local only (the dubbing consent row is
confirmed); the transcripts are text."""

from __future__ import annotations

import json
from pathlib import Path

from .. import audio
from ..consent import require_confirmed
from .mms import MMS_RATE, Recognizer
from .text import chrf, sentence_chrf


def run_roundtrip(recognizer: Recognizer, translator, content: Path, consent_md: Path, log=print) -> dict:
    clips = json.loads((content / "clips.json").read_text(encoding="utf-8"))["clips"]
    registry = json.loads((content / "recordings" / "recordings.json").read_text(encoding="utf-8"))["recordings"]
    rows = []
    for clip in clips:
        rec = next((r for r in registry if r["clip"] == clip["id"] and r["lang"] == "wo"), None)
        if rec is None:
            continue
        # Dubbed audio needs a confirmed dubbing row, even for a local evaluation run.
        require_confirmed(consent_md, rec["consentPerson"], scope="dubbing")
        path = content / "recordings" / rec["file"]
        samples = audio.decode(path, channels=1, sample_rate=MMS_RATE)[:, 0]
        wolof = recognizer.transcribe(samples)
        english = translator.translate([wolof], "eng_Latn", src="wol_Latn")[0] if wolof.strip() else ""
        rows.append(
            {
                "clip": clip["id"],
                "wolof_transcript": wolof,
                "back_to_english": english,
                "script": clip["script"]["en"],
                "chrf": sentence_chrf(english, clip["script"]["en"]),
                "seconds_of_audio": round(len(samples) / MMS_RATE, 1),
            }
        )
        log(f"round trip clip {clip['id']}: chrF {rows[-1]['chrf']}")
    pooled = chrf([r["back_to_english"] for r in rows], [r["script"] for r in rows])
    return {"n": len(rows), "pooled_chrf": pooled["chrf"], "signature": pooled["signature"], "clips": rows}
