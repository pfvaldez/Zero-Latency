"""Farm pack build steps. Build time only: nothing here runs at guest runtime.

    uv run python -m asknoor.build --farm ondera-noor --mode demo --steps audio,transcribe
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import audio
from .consent import ConsentError, require_confirmed

REPO = Path(__file__).resolve().parents[2]
CONSENT_MD = REPO / "docs" / "CONSENT.md"
AUDIO_PARAMS = {
    "target_lufs": audio.TARGET_LUFS,
    "target_true_peak": audio.TARGET_TRUE_PEAK,
    "codec": "aac",
    "bitrate": audio.AAC_BITRATE,
    "sample_rate": audio.SAMPLE_RATE,
    "keep_silence_s": audio.KEEP_SILENCE_S,
    "mono_loss_limit_db": audio.MONO_LOSS_LIMIT_DB,
}


class BuildError(Exception):
    pass


def content_dir(farm: str) -> Path:
    return REPO / "content" / farm


def build_dir(farm: str) -> Path:
    return REPO / "pipeline" / "build" / farm


def load_registry(farm: str) -> list[dict]:
    """The recordings registry, checked so a mislabeled entry cannot skip the consent gate or the
    production skip: English files are stand-in voice, Wolof files are AI-dubbed with the
    consent person being the person whose voice was dubbed."""
    path = content_dir(farm) / "recordings" / "recordings.json"
    if not path.exists():
        raise BuildError(f"no recordings registry at {path}")
    registry = json.loads(path.read_text(encoding="utf-8"))["recordings"]
    for rec in registry:
        where = rec.get("file", "?")
        if rec.get("kind") not in ("stand-in-voice", "ai-dubbed"):
            raise BuildError(f"{where}: kind must be stand-in-voice or ai-dubbed, got {rec.get('kind')!r}")
        dubbed = rec["kind"] == "ai-dubbed"
        if dubbed != (rec.get("lang") == "wo") or dubbed != where.startswith("wo/"):
            raise BuildError(f"{where}: Wolof files must be ai-dubbed and English files stand-in-voice")
        if dubbed and rec.get("consentPerson") != rec.get("person"):
            raise BuildError(f"{where}: the consent person must be the person whose voice was dubbed")
    return registry


def step_audio(farm: str, mode: str, consent_md: Path = CONSENT_MD) -> dict:
    """Prepare every recording. AI-dubbed files need a confirmed consent row (any mode) and ship
    in demo packs only. The build fails if any prepared clip fails the audit."""
    recordings = content_dir(farm) / "recordings"
    registry = load_registry(farm)
    # Consent first, before any audio work: one pending row stops the whole build.
    for rec in registry:
        if rec["kind"] == "ai-dubbed":
            try:
                require_confirmed(consent_md, rec["consentPerson"])
            except ConsentError as error:
                raise BuildError(f"{rec['file']}: {error}") from error
    report: dict[str, dict] = {}
    for rec in registry:
        if rec["kind"] == "ai-dubbed" and mode == "production":
            continue  # dubbed audio is draft and demo-only until a Wolof speaker checks it
        src = recordings / rec["file"]
        if not src.exists():
            raise BuildError(f"missing recording {src}")
        dst = build_dir(farm) / "audio" / rec["lang"] / (src.stem + ".m4a")
        try:
            report[rec["file"]] = audio.build_clip(src, dst)
        except audio.AudioError as error:
            raise BuildError(str(error)) from error
    return report


def write_audio_report(farm: str, report: dict) -> Path:
    path = content_dir(farm) / "recordings" / "audio-report.json"
    doc = {"params": AUDIO_PARAMS, "clips": report}
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="asknoor.build")
    parser.add_argument("--farm", required=True)
    parser.add_argument("--mode", choices=["demo", "production"], default="demo")
    parser.add_argument("--steps", default="audio", help="comma list: audio, translate, transcribe")
    args = parser.parse_args(argv)
    steps = [s.strip() for s in args.steps.split(",") if s.strip()]
    try:
        if "audio" in steps:
            report = step_audio(args.farm, args.mode)
            path = write_audio_report(args.farm, report)
            print(f"audio: {len(report)} clips prepared and audited; report at {path.relative_to(REPO)}")
        if "translate" in steps:
            from .translate import TranslateError, step_translate

            try:
                done = step_translate(args.farm)
            except TranslateError as error:
                raise BuildError(str(error)) from error
            print("translate: " + ("; ".join(done) if done else "up to date"))
        if "transcribe" in steps:
            from .transcribe import step_transcribe

            step_transcribe(args.farm)
    except BuildError as error:
        print(f"build failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    # Run through the package module, so BuildError is one class however the CLI is started.
    from asknoor.build import main as _main

    raise SystemExit(_main())
