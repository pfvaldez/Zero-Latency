"""Run the Wolof evidence and write content/<farm>/eval/wolof.json.

    uv run --group translate --group evidence python -m asknoor.evidence.run --parts flores,fleurs,roundtrip

Parts are independent and merged into the file as they finish. Local, long (NLLB and MMS on CPU),
never in CI.
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
CACHE = REPO / ".cache"
MMS_DIR = CACHE / "models" / "facebook" / "mms-1b-all" / "3d33597edbdaaba14a8e858e2c8caa76e3cec0cd"


def versions() -> dict:
    import sacrebleu
    import torch
    import transformers

    from ..translate import MODEL, REVISION
    from .mms import MMS_ADAPTER, MMS_REVISION

    return {
        "date": date.today().isoformat(),
        "python": platform.python_version(),
        "torch": torch.__version__,
        "transformers": transformers.__version__,
        "sacrebleu": sacrebleu.__version__,
        "device": "cpu",
        "nllb": {"model": MODEL, "revision": REVISION, "license": "CC-BY-NC-4.0"},
        "mms": {"model": "facebook/mms-1b-all", "revision": MMS_REVISION, "adapter": MMS_ADAPTER, "license": "CC-BY-NC-4.0"},
        "flores": {"source": "dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz", "license": "CC-BY-SA-4.0"},
        "fleurs": {"source": "google/fleurs wo_sn test", "revision": "70bb2e84b976b7e960aa89f1c648e09c59f894dd", "license": "CC-BY-4.0"},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="asknoor.evidence.run")
    parser.add_argument("--farm", default="ondera-noor")
    parser.add_argument("--parts", default="flores,fleurs,roundtrip")
    parser.add_argument("--flores-n", type=int, default=None, help="sample size; default is all 1012 sentences")
    parser.add_argument("--fleurs-n", type=int, default=100)
    parser.add_argument("--seed", type=int, default=4)
    parser.add_argument("--threads", type=int, default=6)
    args = parser.parse_args(argv)
    parts = [p.strip() for p in args.parts.split(",") if p.strip()]
    import torch

    torch.set_num_threads(args.threads)
    content = REPO / "content" / args.farm
    out_path = content / "eval" / "wolof.json"
    doc: dict = {}

    def save() -> None:
        """Merge this process's parts into the file as it is on disk now (two runs may share it)."""
        current = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}
        current.update(doc)
        current["versions"] = versions()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    translator = recognizer = None
    if "flores" in parts or "roundtrip" in parts:
        from ..translate import Translator

        translator = Translator()
    if "fleurs" in parts or "roundtrip" in parts:
        from .mms import Recognizer

        recognizer = Recognizer(MMS_DIR)

    if "flores" in parts:
        from .flores import load_flores, run_flores

        data = load_flores(CACHE / "data" / "flores200_dataset.tar.gz", ("eng_Latn", "deu_Latn", "wol_Latn"))
        doc["flores"] = run_flores(translator, data, args.flores_n, args.seed)
        save()
    if "fleurs" in parts:
        from .mms import run_fleurs

        doc["fleurs"] = run_fleurs(recognizer, CACHE / "data" / "fleurs_wo_sn_test.parquet", args.fleurs_n, args.seed)
        print(f"fleurs: WER {doc['fleurs']['wer']} CER {doc['fleurs']['cer']} (n={doc['fleurs']['n']})")
        save()
    if "roundtrip" in parts:
        from .roundtrip import run_roundtrip

        doc["roundtrip"] = run_roundtrip(recognizer, translator, content)
        print(f"roundtrip: pooled chrF {doc['roundtrip']['pooled_chrf']} (n={doc['roundtrip']['n']})")
        save()
    print(f"wrote {out_path.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
