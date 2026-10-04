"""Metrics and sampling shared by the evidence runs: chrF, word and character error rate, and a
seeded sample. All pure, so they are tested on tiny known inputs."""

from __future__ import annotations

import random
import re
import unicodedata


def chrf(hypotheses: list[str], references: list[str]) -> dict:
    """Corpus chrF (sacrebleu defaults: character 6-grams, beta 2, no word n-grams)."""
    from sacrebleu.metrics import CHRF

    if len(hypotheses) != len(references) or not hypotheses:
        raise ValueError("chrF needs the same, non-zero number of hypotheses and references")
    metric = CHRF()
    score = metric.corpus_score(hypotheses, [references])
    return {"chrf": round(score.score, 2), "n": len(hypotheses), "signature": str(metric.get_signature())}


def sentence_chrf(hypothesis: str, reference: str) -> float:
    from sacrebleu.metrics import CHRF

    return round(CHRF().sentence_score(hypothesis, [reference]).score, 2)


def normalize_asr(text: str) -> str:
    """The same normalization on both sides of a word error rate: NFKC, lowercase, punctuation to
    spaces (letters with diacritics such as ë, ñ, à are kept), one space between words."""
    text = unicodedata.normalize("NFKC", text).lower().replace("’", "'")
    text = re.sub(r"[^\w\s']+", " ", text)
    text = text.replace("_", " ")
    return re.sub(r"\s+", " ", text).strip()


def error_rates(hypotheses: list[str], references: list[str]) -> dict:
    """Word and character error rate over the corpus, after normalize_asr."""
    import jiwer

    if len(hypotheses) != len(references) or not hypotheses:
        raise ValueError("error rates need the same, non-zero number of hypotheses and references")
    refs = [normalize_asr(r) for r in references]
    hyps = [normalize_asr(h) for h in hypotheses]
    return {
        "wer": round(jiwer.wer(refs, hyps), 4),
        "cer": round(jiwer.cer(refs, hyps), 4),
        "n": len(refs),
        "reference_words": sum(len(r.split()) for r in refs),
    }


def seeded_sample(size: int, n: int | None, seed: int) -> list[int]:
    """Indices 0..size-1: all of them when n is None or n >= size, otherwise a sorted seeded sample."""
    if n is None or n >= size:
        return list(range(size))
    return sorted(random.Random(seed).sample(range(size), n))
