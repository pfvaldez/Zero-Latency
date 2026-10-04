"""Build trimmed e5 models.

    uv run --group translate python -m asknoor.trim.run sweep 0.75 1.0     # choose keep lists from the corpus
    uv run --group translate python -m asknoor.trim.run apply --keep packages/pack/trim/keep-ids.json --out DIR

`sweep` writes .cache/trim/s<scale>/multilingual-e5-small/ (the folder layout Transformers.js loads)
and a summary. `apply` rebuilds a model folder from a committed keep list and the pinned full model,
so the trimmed model can be reproduced without the text corpora.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

from .corpus import REPO, VOCAB_DIR
from .pieces import (
    choose_keep,
    count_pieces,
    new_model_config,
    remap_tokenizer,
    remap_tokenizer_config,
    single_character_ids,
    slice_embedding,
    tokenization_fidelity,
)

E5 = REPO / ".cache" / "models" / "Xenova" / "multilingual-e5-small"
REVISION = "761b726dd34fb83930e26aab4e9ac3899aa1fa78"
BASE = E5 / REVISION
OUT = REPO / ".cache" / "trim"
HOLD = 20  # every 20th corpus line is held out of the selection and used to measure fidelity
LANGS = ("en", "de", "nl", "sv", "wo")
# Tokens kept per language at scale 1.0 (the most frequent ones); Wolof keeps everything it has.
BASE_QUOTAS = {"en": 14000, "de": 14000, "nl": 12000, "sv": 12000, "wo": 100000}
MIN_COUNT = {"en": 2, "de": 2, "nl": 2, "sv": 2, "wo": 1}


def _lines(path: Path) -> list[str]:
    return [ln.rstrip("\n") for ln in path.open(encoding="utf-8") if ln.strip()]


def corpus_groups() -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {}
    for lang in LANGS:
        rows = _lines(VOCAB_DIR / f"wiki_{lang}.txt") + _lines(VOCAB_DIR / f"tatoeba_{lang}.txt")
        if lang == "wo":
            rows += _lines(VOCAB_DIR / "fleurs_wo_train_text.txt")
        groups[lang] = rows
    return groups


def write_model(keep: list[int], out: Path) -> dict:
    """Write the trimmed folder (tokenizer, configs, quantized ONNX) and return its sizes."""
    import onnx
    from tokenizers import Tokenizer  # noqa: F401  (import check: the folder must load)

    (out / "onnx").mkdir(parents=True, exist_ok=True)
    tok = json.loads((BASE / "tokenizer.json").read_text())
    (out / "tokenizer.json").write_text(json.dumps(remap_tokenizer(tok, keep), ensure_ascii=False))
    cfg = json.loads((BASE / "tokenizer_config.json").read_text())
    (out / "tokenizer_config.json").write_text(json.dumps(remap_tokenizer_config(cfg, keep), indent=2, ensure_ascii=False))
    shutil.copy(BASE / "special_tokens_map.json", out / "special_tokens_map.json")
    model_cfg = json.loads((BASE / "config.json").read_text())
    (out / "config.json").write_text(json.dumps(new_model_config(model_cfg, keep), indent=2))
    # Slice the 8-bit embedding rows of the shipped (Xenova) int8 model directly. Its embedding uses one
    # scale for the whole table, so a kept row is byte-identical to the full model's and nothing else
    # is requantized. (Re-quantizing from fp32 cost 5.4 points of held-out top-1, with or without
    # trimming: see docs/EVAL.md.)
    model = onnx.load(str(BASE / "onnx" / "model_quantized.onnx"))
    slice_embedding(model, keep, model_cfg["vocab_size"], model_cfg["hidden_size"])
    onnx.save(model, str(out / "onnx" / "model_quantized.onnx"))
    quantized = out / "onnx" / "model_quantized.onnx"
    return {"vocab": len(keep), "onnx_bytes": quantized.stat().st_size, "tokenizer_bytes": (out / "tokenizer.json").stat().st_size}


def sweep(scales: list[float]) -> list[dict]:
    from tokenizers import Tokenizer

    full = Tokenizer.from_file(str(BASE / "tokenizer.json"))
    tok = json.loads((BASE / "tokenizer.json").read_text())
    vocab = tok["model"]["vocab"]
    started = time.time()
    counts, held = {}, {}
    for lang, rows in corpus_groups().items():
        counts[lang] = count_pieces(full, [r for i, r in enumerate(rows) if i % HOLD])
        held[lang] = [r for i, r in enumerate(rows) if i % HOLD == 0][:400]
        print(f"{lang}: {len(rows)} lines, {len(counts[lang])} distinct pieces, {round(time.time() - started)} s", flush=True)
    seed = _lines(VOCAB_DIR / "seed_content.txt")  # our own content and interface strings; never the test questions
    content_ids = set(count_pieces(full, seed))
    must_keep = content_ids | single_character_ids(vocab)
    results = []
    for scale in scales:
        quotas = {g: int(q * scale) if g != "wo" else q for g, q in BASE_QUOTAS.items()}
        keep = choose_keep(len(vocab), counts, quotas, must_keep, MIN_COUNT, specials=[a["id"] for a in tok["added_tokens"]])
        out = OUT / f"s{scale}" / "multilingual-e5-small"
        info = write_model(keep, out)
        trimmed = Tokenizer.from_file(str(out / "tokenizer.json"))
        info["fidelity"] = {lang: tokenization_fidelity(full, trimmed, keep, held[lang][:300]) for lang in held}
        info["fidelity"]["content"] = tokenization_fidelity(full, trimmed, keep, seed[:400])
        info["scale"] = scale
        (OUT / f"s{scale}" / "keep.json").write_text(json.dumps(keep))
        results.append(info)
        print(json.dumps({k: v for k, v in info.items() if k != "fidelity"}), flush=True)
    (OUT / "sweep.json").write_text(json.dumps(results, indent=2))
    return results


def apply(keep_path: Path, out: Path) -> dict:
    keep = json.loads(keep_path.read_text())
    return write_model(keep, out / "multilingual-e5-small")


def fidelity(keep_path: Path, trimmed_dir: Path, out: Path) -> dict:
    """Measure how often the shipped trimmed tokenizer splits text exactly like the full one, and write it down."""
    from tokenizers import Tokenizer

    keep = json.loads(keep_path.read_text())
    full = Tokenizer.from_file(str(BASE / "tokenizer.json"))
    trimmed = Tokenizer.from_file(str(trimmed_dir / "multilingual-e5-small" / "tokenizer.json"))
    held = {lang: [r for i, r in enumerate(rows) if i % HOLD == 0][:300] for lang, rows in corpus_groups().items()}
    seed = _lines(VOCAB_DIR / "seed_content.txt")[:400]
    result = {lang: tokenization_fidelity(full, trimmed, keep, rows) for lang, rows in held.items()}
    result["content"] = tokenization_fidelity(full, trimmed, keep, seed)
    doc = {
        "what": "Share of text that the trimmed tokenizer splits into exactly the pieces of the full tokenizer (identical), and the share of pieces dropped.",
        "keepCount": len(keep),
        "heldOut": "every 20th line of the Wikipedia and Tatoeba (and FLEURS wo train) corpus, first 300 per language; never used to choose the keep list. content = our own clip text, translations and interface strings (400 lines), which the keep list covers by construction.",
        "tokenizerSha256": __import__("hashlib").sha256((trimmed_dir / "multilingual-e5-small" / "tokenizer.json").read_bytes()).hexdigest(),
        "byLanguage": result,
    }
    out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    return doc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="asknoor.trim.run")
    sub = parser.add_subparsers(dest="command", required=True)
    s = sub.add_parser("sweep")
    s.add_argument("scales", nargs="+", type=float)
    a = sub.add_parser("apply")
    a.add_argument("--keep", type=Path, required=True)
    a.add_argument("--out", type=Path, required=True)
    f = sub.add_parser("fidelity")
    f.add_argument("--keep", type=Path, required=True)
    f.add_argument("--trimmed", type=Path, required=True)
    f.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.command == "fidelity":
        print(json.dumps(fidelity(args.keep, args.trimmed, args.out)["byLanguage"]))
    elif args.command == "sweep":
        sweep(args.scales)
    else:
        print(apply(args.keep, args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
