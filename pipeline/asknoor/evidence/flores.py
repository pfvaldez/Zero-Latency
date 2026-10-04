"""FLORES-200 devtest: how good is NLLB from English into Wolof compared with German, and from
Wolof back into English (the direction the dub round trip uses)? FLORES-200 is CC-BY-SA-4.0."""

from __future__ import annotations

import tarfile
import time
from pathlib import Path

from .text import chrf, seeded_sample

DEVTEST = "flores200_dataset/devtest/{code}.devtest"


def load_flores(tar_path: Path, codes: tuple[str, ...]) -> dict[str, list[str]]:
    """The devtest sentences for each NLLB language code, one list per code, line-aligned."""
    out: dict[str, list[str]] = {}
    with tarfile.open(tar_path) as tar:
        names = {m.name.removeprefix("./"): m for m in tar.getmembers()}
        for code in codes:
            member = names.get(DEVTEST.format(code=code))
            if member is None:
                raise FileNotFoundError(f"{code} not in {tar_path.name}")
            fh = tar.extractfile(member)
            assert fh is not None
            out[code] = fh.read().decode("utf-8").splitlines()
    sizes = {len(v) for v in out.values()}
    if len(sizes) != 1:
        raise ValueError("the FLORES languages are not line-aligned")
    return out


def run_flores(translator, data: dict[str, list[str]], n: int | None, seed: int, log=print) -> dict:
    """chrF for English to Wolof, English to German and Wolof to English on the same sentences."""
    size = len(data["eng_Latn"])
    pick = seeded_sample(size, n, seed)
    eng = [data["eng_Latn"][i] for i in pick]
    result: dict = {
        "split": "devtest",
        "sentences_in_split": size,
        "n": len(pick),
        "seed": seed,
        "sampled": len(pick) < size,
        "directions": {},
    }
    jobs = [
        ("eng_Latn to wol_Latn", eng, "wol_Latn", "eng_Latn", [data["wol_Latn"][i] for i in pick]),
        ("eng_Latn to deu_Latn", eng, "deu_Latn", "eng_Latn", [data["deu_Latn"][i] for i in pick]),
        ("wol_Latn to eng_Latn", [data["wol_Latn"][i] for i in pick], "eng_Latn", "wol_Latn", eng),
    ]
    for name, source, target, src, refs in jobs:
        started = time.time()
        hyps = translator.translate(
            source, target, src=src, progress=lambda done, total, name=name: log(f"flores {name}: {done}/{total}") if done % 64 == 0 or done == total else None
        )
        score = chrf(hyps, refs)
        score["seconds"] = round(time.time() - started)
        result["directions"][name] = score
        log(f"flores {name}: chrF {score['chrf']} (n={score['n']}, {score['seconds']} s)")
    return result
