"""Machine-drafted translations with NLLB-200 (distilled 600M). Build time only.

Everything this writes is a DRAFT: labeled `draft`, never checked here (a person checks it and
signs checks.json), and the subtitles it makes for Wolof are translations of the English text,
not a transcript of what the AI-dubbed audio says. Sentence by sentence, so cue i in every
language lines up with English sentence i.

Reruns automatically: each output stores the sha256 of the English sentences it came from. A
changed English text (for example after the transcript is checked) changes the hash, and the
step retranslates exactly that item. Model: facebook/nllb-200-distilled-600M, CC-BY-NC-4.0
(non-commercial: fine for the hackathon, noted in the data card).
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

MODEL = "facebook/nllb-200-distilled-600M"
REVISION = "f8d333a098d19b4fd9a8b18f94170487ad3f821d"
LICENSE = "CC-BY-NC-4.0"
CODES = {"de": "deu_Latn", "nl": "nld_Latn", "sv": "swe_Latn", "wo": "wol_Latn"}
VISITOR = ("de", "nl", "sv")  # clip subtitles and add-ons
NOTE = (
    "Machine drafts from facebook/nllb-200-distilled-600M (CC-BY-NC-4.0). Not checked by anyone. "
    "Wolof lines are translations of the English text, not a transcript of the AI-dubbed audio."
)


class TranslateError(Exception):
    pass


# ---- sentences and hashes (must match splitSentences in packages/core/src/vtt.ts) -------------


def split_sentences(text: str) -> list[str]:
    """Split after . ! or ? followed by whitespace. "3.5" and "e.g.x" stay whole."""
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s]


def source_hash(sentences: list[str]) -> str:
    return hashlib.sha256("\n".join(sentences).encode("utf-8")).hexdigest()


# ---- placeholders (SMS templates keep {guests} and friends intact) ----------------------------

_PLACEHOLDER = re.compile(r"\{[^{}]*\}")
_MASKS = ("[[{n}]]", "<ph{n}>", "#{n}#")  # tried in order; the first that survives wins


def protect(text: str, style: str) -> tuple[str, dict[str, str]]:
    mapping: dict[str, str] = {}

    def swap(match: re.Match[str]) -> str:
        token = style.format(n=len(mapping) + 1)
        mapping[token] = match.group(0)
        return token

    return _PLACEHOLDER.sub(swap, text), mapping


def restore(text: str, mapping: dict[str, str]) -> str | None:
    """Put the placeholders back. None if any marker was lost or duplicated."""
    for token in mapping:
        if text.count(token) != 1:
            return None
    for token, original in mapping.items():
        text = text.replace(token, original)
    return text


def placeholders_of(text: str) -> list[str]:
    return sorted(_PLACEHOLDER.findall(text))


# ---- what needs doing --------------------------------------------------------------------------


@dataclass(frozen=True)
class Item:
    key: str
    sentences: list[str]  # the English source, already split

    @property
    def sha(self) -> str:
        return source_hash(self.sentences)


def stale(existing: dict | None, item: Item, langs: tuple[str, ...]) -> bool:
    """True when the item has no translation, was made from different English, or lacks a language."""
    if not existing or existing.get("sourceSha256") != item.sha:
        return True
    rows = existing.get("sentences", [])
    if len(rows) != len(item.sentences):
        return True
    return any(row.get("en") != item.sentences[i] or any(not row.get(lang) for lang in langs) for i, row in enumerate(rows))


# ---- the model ---------------------------------------------------------------------------------


class Translator:
    def __init__(self) -> None:
        try:
            import torch
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        except ImportError as error:  # pragma: no cover - environment dependent
            raise TranslateError("the translate dependencies are missing: run `uv sync --group translate`") from error
        self._torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, src_lang="eng_Latn")
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL, revision=REVISION).eval()

    def translate(
        self, sentences: list[str], lang: str, src: str = "eng_Latn", batch_size: int = 16, progress=None
    ) -> list[str]:
        """Translate `sentences` from `src` (an NLLB code, English by default) into `lang` (our code)."""
        target = CODES.get(lang, lang)  # our short code ("wo") or an NLLB code ("wol_Latn")
        self.tokenizer.src_lang = src
        # Longest-first batches waste far less on padding; results go back in the caller's order.
        order = sorted(range(len(sentences)), key=lambda i: -len(sentences[i]))
        translated: dict[int, str] = {}
        for start in range(0, len(order), batch_size):
            idx = order[start : start + batch_size]
            batch = self.tokenizer([sentences[i] for i in idx], return_tensors="pt", padding=True)
            with self._torch.no_grad():
                ids = self.model.generate(
                    **batch,
                    forced_bos_token_id=self.tokenizer.convert_tokens_to_ids(target),
                    max_new_tokens=min(256, 2 * int(batch["input_ids"].shape[1]) + 10),  # stop runaway output
                    num_beams=4,
                )
            for i, text in zip(idx, self.tokenizer.batch_decode(ids, skip_special_tokens=True), strict=True):
                translated[i] = text
            if progress:
                progress(len(translated), len(sentences))
        out = [translated[i] for i in range(len(sentences))]
        self.tokenizer.src_lang = "eng_Latn"
        return out

    def translate_protected(self, text: str, lang: str) -> str | None:
        """Translate one string that may hold {placeholders}; None if they cannot be kept."""
        if not _PLACEHOLDER.search(text):
            return self.translate([text], lang)[0]
        for style in _MASKS:
            masked, mapping = protect(text, style)
            restored = restore(self.translate([masked], lang)[0], mapping)
            if restored is not None and placeholders_of(restored) == placeholders_of(text):
                return restored
        return None


# ---- the build step ----------------------------------------------------------------------------


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def _write(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def english_sources(content: Path) -> dict[str, Item]:
    """Clip English text: the checked-or-not transcript if it exists, otherwise the script."""
    clips = json.loads((content / "clips.json").read_text(encoding="utf-8"))["clips"]
    out: dict[str, Item] = {}
    for clip in clips:
        transcript = content / "transcripts" / "en" / f"clip{clip['id']:02d}.json"
        text = json.loads(transcript.read_text(encoding="utf-8"))["text"] if transcript.exists() else clip["script"]["en"]
        out[str(clip["id"])] = Item(str(clip["id"]), split_sentences(text))
    return out


def addon_sources(content: Path) -> dict[str, Item]:
    out: dict[str, Item] = {}
    facts = _read(content / "facts.json").get("facts", [])
    for f in facts:
        out[f["id"]] = Item(f["id"], split_sentences(f["text"]["en"]))
    recipe = _read(content / "recipe.json")
    if recipe:
        out["recipe"] = Item("recipe", [recipe["title"]["en"], *[s["en"] for s in recipe["steps"]]])
    for p in _read(content / "products.json").get("products", []):
        out[p["id"]] = Item(p["id"], [p["name"]["en"]])
    card = _read(content / "farm-card.json")
    if card:
        out["farm-card"] = Item("farm-card", [line["en"] for line in card["lines"]])
    return out


def _step(out_path: Path, key: str, sources: dict[str, Item], translator: Translator | None, log: list[str]) -> Translator | None:
    """Translate what is missing or stale into `out_path`; items live under `key`."""
    doc = _read(out_path)
    items: dict = doc.get(key, {})
    for k in list(items):
        if k not in sources:
            del items[k]  # the English source was removed
    langs = ("de", "nl", "sv", "wo")
    for it in (it for k, it in sources.items() if stale(items.get(k), it, langs)):
        translator = translator or Translator()
        columns = {lang: translator.translate(it.sentences, lang) for lang in langs}
        items[it.key] = {
            "sourceSha256": it.sha,
            "sentences": [{"en": s, **{lang: columns[lang][i] for lang in langs}} for i, s in enumerate(it.sentences)],
        }
        log.append(f"translated {out_path.stem} {it.key}")
    _write(out_path, {"note": NOTE, "model": MODEL, "revision": REVISION, "license": LICENSE, "draft": True, key: items})
    return translator


def step_translate(farm: str, content_root: Path | None = None) -> list[str]:
    """Translate whatever is missing or stale. Returns a log of what was done (empty = up to date)."""
    from .build import content_dir

    content = content_root or content_dir(farm)
    log: list[str] = []
    translator: Translator | None = None
    translator = _step(content / "translations" / "clips.json", "clips", english_sources(content), translator, log)
    translator = _step(content / "translations" / "addons.json", "items", addon_sources(content), translator, log)
    log += _step_sms(content, translator)
    return log


def _step_sms(content: Path, translator: Translator | None) -> list[str]:
    """Wolof drafts for the SMS templates and theme labels, written into sms-templates.json."""
    path = content / "sms-templates.json"
    doc = _read(path)
    log: list[str] = []
    targets = [("monthly", doc["monthly"]), ("orderLine", doc["orderLine"])] + [
        (f"theme/{k}", v) for k, v in doc["themeLabels"].items()
    ]
    for name, entry in targets:
        sha = source_hash([entry["en"]])
        wo = entry["wo"]
        if wo.get("text") is not None and wo.get("sourceSha256") == sha:
            continue
        translator = translator or Translator()
        text = translator.translate_protected(entry["en"], "wo")
        if text is None:
            wo.update({"text": None, "status": "needs-nllb-draft"})
            wo.pop("sourceSha256", None)
            log.append(f"could not keep the placeholders in {name}: left for a Wolof speaker")
            continue
        wo.update({"text": text, "status": "draft", "sourceSha256": sha})
        log.append(f"translated sms {name}")
    doc["note"] = doc.get("note", "")
    _write(path, doc)
    return log
