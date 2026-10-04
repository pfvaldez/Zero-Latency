"""Text samples for choosing which tokens to keep: Wikipedia (CC-BY-SA-4.0) and Tatoeba (CC-BY-2.0 FR)
for en, de, nl, sv and wo, plus the FLEURS Wolof training transcripts (CC-BY-4.0, text only).
Streamed by row group, so only a sample is downloaded. Never includes the test questions."""

from __future__ import annotations

import bz2
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
VOCAB_DIR = REPO / ".cache" / "data" / "vocab"
WIKI = {
    "en": "20231101.en/train-00000-of-00041.parquet",
    "de": "20231101.de/train-00000-of-00020.parquet",
    "nl": "20231101.nl/train-00000-of-00006.parquet",
    "sv": "20231101.sv/train-00000-of-00005.parquet",
    "wo": "20231101.wo/train-00000-of-00001.parquet",
}
TARGET_CHARS = {"en": 30e6, "de": 30e6, "nl": 30e6, "sv": 30e6, "wo": 5e6}
TATOEBA = {"eng": "en", "deu": "de", "nld": "nl", "swe": "sv", "wol": "wo"}
FLEURS_WO_TRAIN = "https://huggingface.co/datasets/google/fleurs/resolve/70bb2e84b976b7e960aa89f1c648e09c59f894dd/data/wo_sn/train.tsv"


def fetch_wikipedia(lang: str, out: Path) -> int:
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem

    total = 0
    with HfFileSystem().open(f"datasets/wikimedia/wikipedia/{WIKI[lang]}", "rb") as fh, out.open("w", encoding="utf-8") as sink:
        for batch in pq.ParquetFile(fh).iter_batches(batch_size=200, columns=["text"]):
            for text in batch.column("text").to_pylist():
                for para in text.split("\n"):
                    if 40 <= len(para) <= 1200:
                        sink.write(para + "\n")
                        total += len(para)
            if total >= TARGET_CHARS[lang]:
                break
    return total


def fetch_tatoeba(code: str, out: Path, limit: int = 400_000) -> int:
    url = f"https://downloads.tatoeba.org/exports/per_language/{code}/{code}_sentences.tsv.bz2"
    lines = bz2.decompress(urllib.request.urlopen(url, timeout=60).read()).decode("utf-8").splitlines()[:limit]
    sentences = [ln.split("\t")[2] for ln in lines if ln.count("\t") >= 2]
    out.write_text("\n".join(sentences) + "\n", encoding="utf-8")
    return len(sentences)


def fetch_fleurs_wolof_text(out: Path) -> int:
    rows = urllib.request.urlopen(FLEURS_WO_TRAIN, timeout=60).read().decode("utf-8").splitlines()
    texts = [r.split("\t")[3] for r in rows if r.count("\t") >= 3]  # the normalized transcription column
    out.write_text("\n".join(texts) + "\n", encoding="utf-8")
    return len(texts)


def main() -> None:
    VOCAB_DIR.mkdir(parents=True, exist_ok=True)
    for lang in WIKI:
        dest = VOCAB_DIR / f"wiki_{lang}.txt"
        if not dest.exists():
            print("wikipedia", lang, round(fetch_wikipedia(lang, dest) / 1e6, 1), "M characters", flush=True)
    for code, lang in TATOEBA.items():
        dest = VOCAB_DIR / f"tatoeba_{lang}.txt"
        if not dest.exists():
            print("tatoeba", lang, fetch_tatoeba(code, dest), "sentences", flush=True)
    dest = VOCAB_DIR / "fleurs_wo_train_text.txt"
    if not dest.exists():
        print("fleurs wolof text", fetch_fleurs_wolof_text(dest), "lines", flush=True)


if __name__ == "__main__":
    main()
