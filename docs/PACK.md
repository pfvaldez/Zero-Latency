# Building and checking a farm pack

A pack is everything the guest's phone needs for the offline tour: clips, subtitles, add-ons, the
embedding model and the moment embeddings, plus a `manifest.json` that the schema in
`packages/core` validates. Packs are built on a laptop (Node 24 and Python), never on the phone.

## The three packs

| Pack | Where | In git? | What it is |
|---|---|---|---|
| `fixture` | `apps/web/public/packs/fixture/` | **Yes** (192 KB, no model) | Generated tones and made-up text, labeled synthetic. For CI and the guest app's offline tests. A demo pack |
| `demo` | `apps/web/public/packs/ondera-noor/demo/` | No | The real clips (Preet's English recordings as Noor's stand-in voice) with drafts, needy add-ons and the AI-dubbed Wolof versions, all labeled |
| `production` | `apps/web/public/packs/ondera-noor/production/` | No | Only checked English text and checked add-ons, the disclosed stand-in voice, no drafts, no AI-dubbed audio, no held-back clip |

Clip 8 (staying overnight) is held back in every pack. `--publish clip08` builds the next version
with it, which is how the "new answer" loop is shown with two real pack versions.

## Getting the real audio (privately)

The recordings are people's voices and are **never** in git, in a pull request or on a public link
(the repository is public). Ask Bee for the `en/` and `wo/` folders over a private channel (a
direct message or a private drive), then:

1. Put them in `content/ondera-noor/recordings/en/` and `.../wo/` (both are gitignored).
2. Check you have the right files: `cd content/ondera-noor/recordings && shasum -a 256 -c audio.sha256`
   (every line must say OK; the list of hashes is committed and is not sensitive).
3. Prepare them: `cd pipeline && uv sync && uv run python -m asknoor.build --farm ondera-noor --steps audio`.

A pack that contains Preet's voice is **refused** unless her `publishing` row in `docs/CONSENT.md`
is `confirmed` (and her `dubbing` row for the Wolof versions). "Demo app" there means the hackathon
demo site, in both pack modes; any deployment to real guests needs new consent.

## Commands (repo root)

| Task | Command |
|---|---|
| Download and verify the pinned model | `bun run pack:model` |
| Build the demo pack | `bun run pack:build -- --mode demo` |
| Build the production pack | `bun run pack:build -- --mode production` |
| Next version with the held-back answer | `bun run pack:build -- --mode demo --publish clip08` |
| Rebuild the committed fixture | `bun run pack:fixture` (output is byte for byte the same) |
| Put the model next to the fixture for the offline tests | `bun run pack:model -- --into apps/web/public/packs/fixture` (gitignored) |
| Evaluation (writes `docs/EVAL.md` and `threshold.json`) | `bun run eval` |
| Model tests | `bun run test:model` (after `pack:model`) |
| Wolof evidence (FLORES chrF, MMS word error rate, dub round trip; long, local, writes `content/ondera-noor/eval/wolof.json`) | `cd pipeline && uv sync --group translate && uv run --group translate python -m asknoor.evidence.run --flores-n 300` (needs the models and data in `.cache/`, about 8 GB) |
| Translation drafts | `cd pipeline && uv sync --group translate && uv run python -m asknoor.build --farm ondera-noor --steps translate` |

`pack:build` stops with the command to run if a translation is stale (the English text changed)
or the prepared audio is missing.

## How the pack is made

1. **Content** in `content/<farm>/` and the prepared audio in `pipeline/build/` (audio step).
2. **Translations**: NLLB-200 distilled 600M drafts, sentence by sentence, in `content/<farm>/translations/`.
   They are machine drafts (CC-BY-NC-4.0 model, non-commercial) and stay drafts until a person checks them in `checks.json`.
   The Wolof subtitles translate the English text; they are not a transcript of what the AI-dubbed audio says.
3. **Plan** (`planPack` in `packages/core`, pure and tested): which clips, languages, add-ons and files go in each mode.
4. **Subtitles**: WebVTT per language. Timing comes from the transcript's word timestamps once the transcript exists;
   until then it is estimated from the script and the file says so.
5. **Embeddings** (the clip's own text in each language, plus its **index-only** phrasings, flagged `indexOnly` and never displayed): `Xenova/multilingual-e5-small` (int8 ONNX) at the revision in `packages/pack/model.lock.json`,
   `passage: ` prefix, mean pooling, normalized, one row per moment and language (`embeddings.rows`).
   The builder embeds with the **copies of the model files that go into the pack**, so the phone runs the same bytes.
6. **Manifest**: sizes and SHA-256 of every file, the model revision, the evaluated match threshold; validated by the core schema, then every file is re-checked.
7. **Version**: bumps only when the content changes (same inputs give the same pack on the same machine).

**Vectors differ a little between CPUs.** The int8 model rounds differently on different machines (Linux x64 against macOS arm64 gave cosine 0.9948 for one passage). So a pack built on another machine is the same except for `embeddings.f32` and the pack id; tests compare the embeddings by cosine (at least 0.99), not byte for byte. The committed fixture was built on macOS arm64.

## Size

With the pinned full model the pack is about 135 MB (model files) plus 1 to 2 MB of audio, against the P0 budget of 150 MB. With the trimmed-vocabulary model (`bun run --cwd packages/pack build -- --model trimmed`, after `pipeline/asknoor/trim/run.py apply` has produced the folder from `packages/pack/trim/keep-ids.json`) the model files are 44.3 MB and the pack is about 46 MB, under the 50 MB target. The builder verifies the folder against `model-trimmed.lock.json` (every file's sha256 and the kept-id list's hash) and refuses a mismatch; the manifest then says `model.vocab: "trimmed"` with a `trim` block. The trimmed folder is a local build product, not committed; hosting it as a GitHub Release asset is a decision for the captain (not done). The trimmed model is a GitHub Release asset set (tag `model-trimmed-v1`, one asset per file plus `NOTICE-MIT.txt`, the MIT notice for the base model); `bun run pack:model --trimmed` downloads it into `.cache/trimmed/` and checks every file against `packages/pack/model-trimmed.lock.json` before use. While the repository is private the plain download URL answers 404, so set `GITHUB_TOKEN` (for example `GITHUB_TOKEN=$(gh auth token) bun run pack:model --trimmed`); the token is only sent to api.github.com and is never stored. The MIT notice for the base model is `packages/pack/trim/NOTICE-MIT.txt` (also a release asset); it is not yet copied into each pack, so a pack that is handed to a third party must ship it alongside. Nothing unverified is ever staged.
