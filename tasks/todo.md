# tasks/todo.md: Ask Noor build plan

Status: `[ ]` to do, `[~]` in progress, `[x]` done (add a one-line proof), `[!]` blocked (say why).
Deadline: submit by 8:00 AM ET, October 4 (hard deadline 9:00 AM ET). Feature freeze at 4:30 AM ET.
Plan status: **Phase 0 (PR #1) and Phase 1 (PR #2) are merged to `main`. Phases 2–7 are not started. Delivery order follows the slices below.**

## Checkpoints

| Time (ET) | Must be true | Proof |
|---|---|---|
| 11:00 PM | Slice 1: guest app plays a clip offline; ask flow runs through `decide()` | Playwright offline test green |
| 1:00 AM | Slice 2: e5 worker live; first evaluation numbers | `docs/EVAL.md` generated |
| 3:00 AM | Slice 3: sync, monthly report and cooperative dashboard working (hosted Supabase project) | Report shows "held" or "ready" from synced data |
| 4:30 AM | Slice 4 complete. Feature freeze | All tests green; demo footage recorded |
| 7:45 AM | Video exported (2–5 minutes, all five parts) | File in shared drive |
| 8:00 AM | Submitted on HackOS | Confirmation screenshot |

Slices 1 to 4 replace the old 8:00 PM, 10:00 PM, midnight and 4:00 AM checkpoints; the captain moved the times on 2026-10-03. The repo has no other definition of the slices, so each keeps the content of the row it replaces (an assumption). The feature freeze moved from 4:00 AM to 4:30 AM, and CLAUDE.md says so too.

## Delivery in vertical slices

Each slice ends working and tested, and no mocks ship: a stand-in used while a later slice is built is labeled in demo mode and is replaced by the slice that owns the real thing. Labels for unchecked content are honesty, not mocks. The phases below stay the task inventory; the slices are the delivery order and the checkpoint times in the table above.

### Slice 1: guest app offline, real guardrails
- [ ] The guest app plays a clip offline after one pack download (the airplane-mode e2e passes)
- [ ] Questions go through the real guardrails in `packages/core` (`decideSafety`, `decide`, `themeOf`, `redact`); until Slice 2 the matcher is the labeled `FakeMatcher` stand-in, shown in demo mode only
- Done when: the offline Playwright test passes, `bun run test:coverage` and `bun run check` are green

### Slice 2: content, pack and the real matcher
- [x] Content files (`clips.json`, `checks.json`, `facts.json`, `recipe.json`, `products.json`, `farm-card.json`, `sms-templates.json`, `eval/test-questions.csv`) Proof: see Step 1 below
- [x] NLLB draft subtitles, all marked unchecked Proof: see Step 2 below
- [x] Farm pack with moment embeddings built in TypeScript, using the same `Xenova/multilingual-e5-small` ONNX model that runs on the phone Proof: see Step 2 below
- [ ] The e5 worker is live in the app, behind the `Matcher` interface (the `FakeMatcher` stand-in is removed from the app)
- [x] Matching accuracy and the match threshold are measured and written to `docs/EVAL.md` Proof: threshold 0.8525, 3.0% false confirmations, 50% coverage
- Done when: a production pack builds (with Preet's disclosed stand-in voice and only checked content) and a demo pack builds, the offline e2e runs with the real matcher and no request leaves the page, and `docs/EVAL.md` has real numbers

#### Step 1: recordings, audio prep, transcript step and content files (branch `feat/content-audio`)
Plan approved 2026-10-04 with these defaults: audio is not committed (the repo is public and Preet's consent covers dubbing, not publishing); ffmpeg comes from the pinned `imageio-ffmpeg` wheel; Wolof template text stays null until the NLLB step drafts it; the stand-in English voice was first treated as demo-only; the captain then split the label (see the voice-label decision below).
- [x] Recordings sorted: 8 English (`recordings/en/clip01.m4a` to `clip08.m4a`, copied from `~/Downloads/Archive-2/`; the "Create Recordings" commit held only a 1-line file) and 8 Wolof (`recordings/wo/clip01_wo.flac` to `clip08_wo.flac`); none missing Proof: durations English 10.07, 11.78, 13.57, 11.61, 8.19, 6.31, 12.80, 8.70 s; Wolof 12.01, 11.80, 13.59, 11.63, 12.01, 12.01, 12.82, 12.01 s (clips 1, 5, 6, 8 padded)
- [x] Audio prep (`pipeline/asknoor/audio.py`): mono check, trim to 0.3 s, -16 LUFS / -1.5 dBTP, mono AAC 48 kbps, audit Proof: `uv run python -m asknoor.build --farm ondera-noor --mode demo --steps audio` prepares and audits all 16; LUFS -16.4 to -15.8, true peak at or under -1.4, silence at the ends at most 0.39 s; numbers in `recordings/audio-report.json`
- [x] Mono check on the real files, against what was expected: all 8 English files lose 0.14 to 0.47 dB when averaged (kept as an average). **Only two Wolof dubs fail**: clip 1 loses 7.47 dB (left channel used) and clip 4 loses 10.17 dB (right channel used); the other six lose under 0.3 dB. "The Wolof dubs fail" is true for two of eight
- [x] Consent gate (`consent.py`): dubbed audio is refused unless the person's row in `docs/CONSENT.md` is exactly `confirmed`, checked before any audio work, in every mode Proof: `test_consent.py` and `test_build.py` (pending, missing person, extra words in the status cell, production mode); the real file confirms Preet
- [x] Transcript step (`transcribe.py`): ElevenLabs speech-to-text (`scribe_v2`, word timestamps), comparison with the script, `comparison.md` for Preet, check bound to the transcript hash Proof: `test_compare.py` and `test_transcribe.py` pass. **Not run live: there is no `ELEVENLABS_API_KEY`** (put it in `pipeline/.env`). The response fixture is hand-written from the docs ("shape per docs, not recorded") and must be replaced by a real recorded response on the first live run; `scribe_v2` is the docs' current batch model id and is unconfirmed against the live API
- [x] Core schemas for every content file, `Addon.needs`, `toAddons`, the CSV parser; manifest JSON Schema regenerated Proof: `packages/core/test/content.test.ts` and `schemas.test.ts`; a production manifest with an add-on that still needs something is refused
- [x] Content files: `clips.json` (script verbatim, clip 8 held back), `checks.json` (English subtitle entries, all unchecked), `facts.json`, `recipe.json`, `products.json`, `farm-card.json` (an extra file for the farm card), `sms-templates.json` (Wolof null), `eval/test-questions.csv` Proof: `content/ondera-noor.test.ts` validates all of them against the core schemas
- [x] 116 synthetic test questions, 29 per language: 14 covered, 4 held-back overnight (clip 8), 7 never answered (28 in total) and 4 safety Proof: the real `decideSafety()` sends every safety question to the card and no other question, in en, de, nl and sv; `redact()` leaves all of them unchanged
- [x] Controls: a pending consent row stops the build; an anti-phase file is not averaged; a quiet, a loud and a -20 LUFS file; 1 s of leading silence; deleting the lexicon word `schwindelig` fails the safety-question test; a fact with neither source nor needs fails the schema; a checked Wolof entry fails the content test
- [ ] Live transcript run and Preet's check of the English subtitles. Blocked on two things only the captain can supply: Preet's **transcription** consent (a second row in `docs/CONSENT.md`, `pending`; sending her voice to ElevenLabs speech-to-text is not covered by her dubbing consent, and the step refuses to run until it is `confirmed`) and `ELEVENLABS_API_KEY` in `pipeline/.env`. Then Preet signs `checks.json`. (Resolved: CLAUDE.md non-negotiable 10 now allows ElevenLabs speech-to-text and dubbing at build time for recordings with a confirmed consent row.)
- [ ] Wolof (and de, nl, sv) template and subtitle drafts from NLLB (next Slice 2 step)
- [x] Captain's decisions (2026-10-04): non-negotiable 10 reworded (ElevenLabs build-time dubbing and speech-to-text with a confirmed consent row, plus narrator audio); the stand-in label is split so a **disclosed stand-in voice** (`labels.standInVoice`, shown as "Voice: Preet, standing in for Noor" in every guest language) can ship in production, while other stand-ins, drafts and AI-dubbed audio (`labels.aiDubbed`) stay demo-only; a `publishing` consent row for Preet (pending); `pipeline/.env` confirmed ignored Proof: `schemas.test.ts` (stand-in voice allowed in production, `standIn` and `aiDubbed` refused, narrator audio allowed), `i18n.test.ts` (the label in en, de, nl, sv); `git check-ignore -v pipeline/.env` prints `.gitignore:153:.env`
- [x] Finding for Phase 5, resolved by Slice 4 step 5: the NLLB Wolof draft of Noor's monthly text needed 3 SMS segments, so it was refused. `fillTemplate` now drops the lowest-priority parts until it fits 2; it is still a draft that a Wolof speaker must check, and the dashboard should show `dropped` to the reviewer
- [ ] Pack builder, for the voice split: every file whose registry `kind` is `stand-in-voice` must be listed in `labels.standInVoice`, every `ai-dubbed` file in `labels.aiDubbed`; any voice in any pack needs a confirmed `publishing` row; the Player (Pablo) shows `t(lang, "labels.standInVoice", { person })` for those clips with a component test
- [ ] Pack builder (Phase 3 / next step), from the guardrail review: `toMoments` that drops or falls back to the English source for de, nl, sv topics and subtitles without a `checks.json` entry (a `draft: {de: false}` flag on unchecked text must not pass); a per-item `draft` marker on facts, recipe, products and farm card so demo mode can label each; an `audioLabel` on clips so the "AI-dubbed" and stand-in labels reach the guest UI from the pack; the Discord message link for Preet's dubbing consent filed in `docs/CONSENT.md`

#### Step 2: translation drafts, the farm pack and the evaluation (branch `feat/pack-eval`)
Plan approved 2026-10-04 (answers: clip 8 held back in every pack and published by `--publish clip08`; false confirmation = wrong confirms over all ordinary questions at most 5%; a cached CI `model` job).
- [x] Evaluation (`packages/pack`, `bun run eval`, maths in `packages/core/src/eval.ts`): 116 questions through `decideSafety`, the pinned e5 model with `query: `, and the real `decide()`; sweep 0.60 to 0.99; threshold chosen at the lowest value with at most 5% false confirmations Proof: `docs/EVAL.md`: **match = 0.8525**, false confirmations 3.0% (3 of 100), coverage 50.0% (28 of 56), top-1 83.9%, fail-safe 100%; English-only passages gave 30.4% coverage at 5.0% (the first run), so the same-language NLLB passages help; leave-one-language-out picks the same threshold for every language; safety recall 100%, no ordinary question sent to the safety card
- [x] Honest limits written into `docs/EVAL.md`: synthetic questions written by the team, threshold chosen and measured on the same questions (in sample), small n (5% is about 5 questions), timings from Node on this machine (model load 0.4 to 0.6 s, median query 1.7 ms), not a mid-range Android
- [x] NLLB-200 distilled 600M drafts (`pipeline/asknoor/translate.py`), sentence by sentence into de, nl, sv and wo for clips, add-ons, the Wolof SMS templates and theme labels, all labeled drafts; each stores the sha256 of its English source and reruns when the English changes Proof: `content/ondera-noor/translations/`; `test_translate.py` (sentence split, hash, staleness, placeholder masking); placeholders survived in the Wolof SMS drafts. **Quality is visibly mixed** (German "braten" for roast, an untranslated "Love:" in Wolof): they are drafts for a person to check. NLLB is CC-BY-NC-4.0 (non-commercial): note in the data card
- [x] Finding: the Wolof draft of Noor's monthly text needs **3 UCS-2 SMS segments** (limit 2), so `fillTemplate` refuses it and the report is held until a Wolof speaker shortens it
- [x] `planPack` (pure, `packages/core/src/pack.ts`) with the exclusion table tested: production has only checked English text, checked add-ons without `needs`, the disclosed stand-in voice; no draft language, no unchecked or needy add-on, no held-back clip, no AI-dubbed audio; both modes refuse Preet's voice without a confirmed publishing row and refuse a stale translation Proof: `packages/core/test/pack.test.ts` (35 cases); **today a production pack is empty** (nothing is checked yet) and the builder warns
- [x] Pack builder (`bun run pack:build -- --mode demo|production [--publish clip08]`): audio, WebVTT per language (word timestamps once a transcript exists, otherwise estimated and labeled), `embeddings.f32` from the model files copied into the pack, `manifest.json` validated by the core schema and every file re-checked; version bumps only when the content changes Proof: `bun run pack:build -- --mode demo` stops with "consent for Preet Patel (publishing) is 'pending'"; `--mode production` builds an empty pack (0 clips, 135.4 MB model); a second build reports unchanged v1
- [x] Model pinned in `packages/pack/model.lock.json` (revision `761b726d`, sha256 per file, 135.4 MB), downloaded and verified by `bun run pack:model`; Transformers.js 4.3.0 runs on Node 24 with `env.allowRemoteModels = false`
- [x] Committed fixture pack `apps/web/public/packs/fixture/` (192 KB, 3 clips of generated tones, synthetic text, draft de/nl/sv, 12 real embeddings, no model folder), labeled as a synthetic stand-in Proof: `bun run pack:fixture` reproduces it byte for byte; `fixture.test.ts` (schema, sizes, hashes, no stray files, no model, tamper detection); model tests re-embed it at cosine at least 0.999
- [x] CI `model` job (cached download of the pinned model, `bun run test:model`) Proof: see the PR
- [x] `docs/PACK.md` (how teammates get the real audio privately; `recordings/audio.sha256` verifies the 16 originals, all OK); `docs/CONSENT.md` says "demo app" means the hackathon demo site in both modes and real guests need new consent
- [ ] The real demo pack from Preet's audio waits for her **publishing** row to be `confirmed` (and the live transcript for her transcription row and the API key); then `pack:build --mode demo` and re-run `bun run eval` with the checked transcript
- [ ] **Finding (CI, 2026-10-04):** the int8 model gives slightly different vectors on different CPUs: the same fixture passages on Linux x64 were at cosine 0.9948 (worst) against the macOS arm64 vectors. The threshold 0.8525 was chosen with Node vectors for passages and queries; the phone embeds queries with ONNX Runtime Web. Re-check the threshold with phone-made query vectors in the offline e2e (Pablo) and keep a margin; if it matters, ship passage vectors made by the phone runtime
- [ ] Phone timings (model first load, question to outcome) come from Pablo's offline e2e with the real worker

### Slice 3: backend, sync, dashboard and a real text
- [ ] Supabase tables and RLS on the hosted project
- [ ] `ingest` Edge Function using `redact()` from core, idempotent upsert
- [ ] Sync from the guest app to the real `ingest` (the mock endpoint is removed)
- [ ] `monthly-summary` with `pg_cron`, held or ready from a checked template
- [ ] `/coop` dashboard with review and approval
- [ ] An approved monthly text is sent as a real SMS through Twilio's trial to a verified demo phone
- Done when: a question asked offline syncs, shows in `/coop`, and an approved monthly text arrives on the demo phone

### Slice 4: Wolof evidence, Groq and narrator audio
- [ ] Wolof evidence: FLORES-200 chrF with NLLB, FLEURS word error rate with MMS, and a round trip on the AI-dubbed Wolof clips (only once Preet's row in `docs/CONSENT.md` is `confirmed`)
- [ ] Groq theme cross-check on the cooperative side (strict schema, Zod, review queue)
- [ ] ElevenLabs narrator audio from checked text, labeled as an AI voice
- Done when: the numbers are in `docs/EVAL.md` with their limits, and every AI-voice file is listed in `labels.syntheticVoice`

## Slice 4 (Bee's track): honest evaluation, coverage, smaller model, Wolof evidence, SMS fit, docs

Plan approved 2026-10-04 (01:08 ET; freeze 4:30 AM). Order: 1 honest evaluation, 5 monthly text fit, 6 docs, 2 index-only passages, 4 Wolof evidence, 3 smaller model, 7 Groq and ElevenLabs if time. Answers: the trimmed model is hosted as a GitHub Release asset verified by sha256 (ask before uploading); index-only passages ship in production, labeled in the manifest; the shipped threshold is the strictest of the full-set pick and the two fold picks. Cut order if behind: 7, then 3, then the reverse FLORES run. Each step has its own branch, PR, guardrail review and merge.

- [x] **1. Honest evaluation** (`feat/eval-cv`): the 116 questions are parallel across languages, so the split is by slot; tune on one half, report on the other, then swap; full-set numbers kept and labeled in sample Proof: `docs/EVAL.md`: pooled held-out false confirm **5.0%** (5 of 100, interval 2% to 11%), coverage **51.8%** (interval 39% to 64%), top-1 **83.9%**, fail-safe 97.7%; one fold alone shows 9.6% false confirm, so the variance is real; shipped `match` = **0.855** (full-set pick 0.8525, fold picks 0.855 and 0.8475); control: tuning on all questions makes the no-leak test fail
- [x] 5. Monthly text fits two segments (`fillTemplate` drops the lowest-priority parts) (`feat/sms-fit`) Proof: `template.test.ts` (12 new cases: each drop in order, ties, custom priority, UCS-2 limit, last part never dropped, validation of dropped parts); the real NLLB Wolof draft, which needed 3 segments, now fits in 2 and `dropped` lists what went; control: dropping the highest priority first fails 5 tests; the Wolof template is still an unchecked draft, so Noor's report stays held
- [x] 6. `docs/DATA_CARD.md` and `docs/RESPONSIBLE_AI.md` (drafts for Preet), with tests that check their claims (`docs/data-rai`) Proof: `content/docs.test.ts`: every `file :: test title` reference in RESPONSIBLE_AI.md exists (30 references), every dataset row has source, revision, license, size, use and gaps, and the NLLB and MMS non-commercial licenses are called out; controls: a wrong test title and a blank license each fail it. **Honest finding written into the document: the guest app, backend and SMS sending do not exist in the repository yet, so guardrails 1, 3 (confirm card), 4 (not stored), 6 (reports) and 7 (ingest) are proven only in core and the pipeline, and the airplane-mode e2e does not exist**
- [x] 2. Index-only passages (`feat/index-passages`): 96 phrasings written by an isolated subagent that was given only the clip scripts in its prompt (its transcript shows no repository read); a leakage audit removed **3 exact repeats of test questions** (93 kept) and found the closest remaining overlap at 0.86; rows flagged `indexOnly` in the manifest, never shown, both modes, published clips only Proof: `docs/EVAL.md`, pooled held-out on the shipped pack: false confirm 5.0% to **3.0%**, coverage 51.8% to **73.2%** (interval 60% to 83%), top-1 83.9% to **91.1%**; production today (English subtitles plus index-only) 60.7% coverage at 3.0%; the sensitivity run without the 11 phrasings that overlap a question by 0.6 or more still gives 80.4% coverage, so the gain does not come from near-copies; limits written in (same model family as the questions, small n); shipped `match` now **0.8675** (strictest of the demo and production picks); controls: unflagged rows fail 4 tests, a leak in tuning fails the no-leak test
- [x] 4. Wolof evidence (`feat/wolof-evidence`; `pipeline/asknoor/evidence/`, results in `content/ondera-noor/eval/wolof.json`, report in `docs/EVAL.md`) Proof: FLORES-200 devtest, **a seeded 300-sentence sample of the 1012** (the full set would have taken about an hour on CPU): NLLB chrF **23.9 English to Wolof** vs **62.5 English to German** (38.6 points lower), 38.3 Wolof to English; MMS-1b-all `wol` on **100 FLEURS Wolof utterances** (of 371): word error rate **38.2%**, character error rate **12.0%**; round trip on the **8 AI-dubbed clips**: pooled chrF **15.3**, clip 1's transcript is character noise and clip 3's back-translation is a repetition loop, so the dubbed Wolof is **unverified** (poor dub or MMS on synthetic speech: the numbers cannot say which; a Wolof speaker is the real test); 25 Python tests (chrF, error rates, sampling, FLORES tar, parquet audio, round-trip plumbing) and a core schema for the results; two long runs on CPU (NLLB and MMS, about 8 GB of models and data in `.cache/`)
- [x] 3. Trimmed e5 vocabulary: top-1 within 2 points of the full model, pack under 50 MB (`feat/trim-vocab`; `pipeline/asknoor/trim/`, `packages/pack/src/{compare-models,vocab-seed}.ts`, `model-trimmed.lock.json`, `trim/keep-ids.json`) Proof: `bun run eval` writes `docs/EVAL.md` "Model size": the trimmed model (52,005 of 250,002 rows) is **44.3 MB instead of 135.4 MB**, held-out top-1 **91.1%, equal to the full model** (rule: within 2 points), mean cosine to full 0.9995, threshold unchanged (0.8675); a pack built with `--model trimmed` verifies and is under 50 MB (`bun run test:model`). Control that changed the method: re-quantizing from fp32 lost **5.4 points** with or without trimming, so the shipped model slices the original int8 rows (byte-identical to the full model's rows) and `apply` rebuilds the folder byte for byte from the committed list. Not done: uploading the trimmed model as a Release asset (needs your OK); CI does not build the trimmed folder, so its tests skip there.
- [ ] 7. Groq theme cross-check and review queue (pure parts; live run needs `GROQ_API_KEY`); ElevenLabs narrator audio (needs checked text and the key)

## Phase 0: Repo and tooling (Bee, about 45 min; estimate with pinning and verification: 75–90 min)

Plan written 2026-10-03 19:57 ET (system clock) from docs checked the same day. **Approved the same evening with seven changes (rows D1, D4, D5, D9, D10, D11, D13 and D14 below). Built on branch `phase-0-tooling`.**
Rules for this phase: Bun only (no npm, yarn or pnpm); Node 24 runs the Node-based CLIs; stage explicit paths only, never `git add -A`; touch `CLAUDE.md`, `docs/` and `.claude/` only as the captain's changes require, and leave `.githooks/` and `.github/copilot-instructions.md` alone (`tasks/` changes only by ticking these items and the checkpoint edit); commits grouped by area, pushed on a branch with a PR.

### Decisions (as approved)

| # | Question | Default | Why (checked 2026-10-03) |
|---|---|---|---|
| D1 | React version | **19.3.0** (captain's change 1) | The latest stable, released 2026-09-09; its changelog lists no breaking changes. CLAUDE.md, TRD section 4 and `docs/PROJECT_MEMORY.md` now say 19.3. |
| D2 | TypeScript | 6.0.3, exact | npm `latest` is now 7.0.2 (Go-native, GA 2026-07-08). It passed our build, Vitest and shadcn tests and type-checks about 6 times faster on a toy workspace, but it has open regressions (#64552 stale incremental checks, reproduced only with `tsc -p --incremental`, not with `tsc -b`; #64423 out-of-memory) and no JS API yet, and the Vite template still scaffolds 6.0. The config is written 7-clean, so switching is a one-line change. |
| D3 | Vitest | 4.1.11 with jsdom 29.1.1 | Vitest 5.0.3 is current, but jest-dom's types don't work with it yet (needs an unofficial shim) and jsdom 30 needs Node 24.15 or later (this machine has 24.14.0). Revisit when jest-dom PR #742 ships; moving to Vitest 5 also raises `engines.node` to `^24.15.0`. |
| D4 | Bun | Stay on 1.3.10, pinned in `packageManager` and in CI; CLAUDE.md tells teammates to use the same version (captain's change 4) | It is what CLAUDE.md says and what is installed. Bun 1.4 shipped 2026-08-20 (latest 1.4.2) and `bun upgrade` now installs it. Per Bun's release post it writes lockfile version 2, which 1.3.10 rejects under `--frozen-lockfile` (tested with a synthetic file), so everyone on the team must stay on 1.3.x or CI fails. CI also fails if the installed Bun differs from the pin. The cost of staying: no `bun add --filter`, so packages are added with `--cwd`. |
| D5 | Body font | Atkinson Hyperlegible Next, self-hosted through Fontsource, no CDN (captain's change 2) | Fontsource bundles weights 400 and 700 (about 40 kB, SIL OFL 1.1) into the build, so the core tour works in airplane mode. The e2e smoke test fails on any request to another origin and checks the font loaded. The TRD named the original font; Next is the Braille Institute's recommended successor, smaller than the original (53 kB for 400 and 700) and covering more languages. Both ship only Latin and Latin-ext; other scripts use the system font. |
| D6 | `motion` version | 12.x | Animate UI was built on motion 12. Motion 14.0.0 shipped 2026-10-02 and is untested with it. Animate UI has had no commits since 2025-12-31; we copy its source into the repo, so we own the code. |
| D7 | Overlay component | Sheet (bottom sheet), not Dialog | The TRD's `OrderSheet` and mobile-first use. Dialog is one more `add` command if Phase 4 wants it. |
| D8 | vite-plugin-pwa | Not installed in Phase 0 (Phase 4, Pablo) | It isn't in the Phase 0 list. Compatibility is confirmed: 1.3.0 and later accept Vite 8 (2.0.0 shipped on 2026-10-03 with the same code). |
| D9 | Cyan rule in light mode | Cyan is a fill only, with navy text on it; icons, borders and focus rings are navy or `--input` (captain's change 3: TRD 6.5 updated) | Measured: cyan on `--surface` is 2.83:1, below the 3:1 that icons and focus rings need. `cyan-rule.test.ts` enforces it across all source, including the generated components. |
| D10 | `--ok`, `--draft`, `--safety` | Real values, no stand-ins (captain's change 3). `--ok` #006450 and `--safety` #98252B are official World Bank secondary colors; `--draft` #876400 is derived | World Bank Group Branding and Visual Identity Guidelines (Feb 2016) p.19. No official amber or gold reaches 4.5:1 as text on the page, so `--draft` is the official dark gold darkened until it passes. Ratios are recorded in `theme-pairs.ts` and checked by `theme.test.ts`. |
| D11 | Supabase | Out of Phase 0 (captain's change 6): a hosted Supabase project in Slice 3, so no Docker and no `bunx supabase start` | The local setup needed Docker, which isn't on this machine's PATH. |
| D12 | Git flow | Branch `phase-0-tooling`, commits grouped by area, push the branch and open a PR so CI runs before `main` changes; the captain merges | Pablo and Preet pull from `main`, so it should only ever receive a green base. |
| D13 | Permission rules | Moved from `.claude/settings.json` to `.claude/settings.local.json` (captain's change 5), which `.gitignore` now ignores | 36 allow rules had been saved into the shared file by approvals during research; `settings.json` is back to `HEAD`. |
| D14 | Checkpoints | Slice 1 by 11 PM, Slice 2 by 1 AM, Slice 3 by 3 AM, Slice 4 by 4:30 AM, feature freeze 4:30 AM (captain's change 7) | The checkpoints table is updated; CLAUDE.md's freeze time now matches. |

### A. Preflight
- [x] Preflight: repo root confirmed, `origin/main` at fbd038e, Bun 1.3.10, Node v24.14.0. Proof: all printed as expected before the first change. The uncommitted `.claude/settings.json` change found at that point (36 allow rules saved by research approvals) was moved to `.claude/settings.local.json` and the tracked file restored (D13)

### B. Workspaces, Bun only, Node 24
- [x] Root `package.json`: `private`, `type: module`, `workspaces: ["apps/*", "packages/*"]`, `packageManager: "bun@1.3.10"` (CI reads it), `engines.node: "24.x"` (Bun enforces neither; they document the versions and feed CI), and scripts: `dev` and `e2e` as `bun run --cwd apps/web <script>`, `test` as `vitest run`, `test:coverage`, `check` as `biome check .`, `typecheck` as `tsc -b`. Run repo tools through these scripts, never `bunx`: a root `bunx` can fetch the registry's latest (TypeScript 7.0.2) instead of our pin. Never `bun test` (Bun's own runner, which chokes on Playwright specs) and never `bun add --filter` (not in 1.3.10; the flag is ignored and can write into the root dependencies) Proof: `bun run check`, `typecheck`, `test`, `test:coverage`, `e2e` and `dev` all run from the root and pass; `bun run dev` serves 200 for `/`, `/src/main.tsx` and `/src/styles/theme.css`
- [x] `.nvmrc` containing `24` (not `lts/krypton`, and never `lts/*`, which moves to Node 26 on 2026-10-28) Proof: `.nvmrc` is `24`; CI reads it through `node-version-file`
- [x] `bunfig.toml` with `[install] linker = "isolated"` (Bun 1.3's default for new workspaces, pinned so an older lockfile setting can't flip it). Each package then sees only what it declares, so tools live where they are imported: Biome, TypeScript, Vitest and jsdom at the root; Playwright, Testing Library, React and the rest in `apps/web`. The research agent ran Vite 8, Vitest, Playwright, Biome, tsc and the shadcn CLI under it with no problems; `hoisted` is the fallback if something won't resolve. Add packages with `bun add -d --cwd apps/web <pkg>` or from inside the workspace (both touch only that `package.json` and the one root `bun.lock`). No `trustedDependencies` (defining it replaces Bun's default list); `bun install` must show no blocked postinstall that we need Proof: a from-scratch `bun install --frozen-lockfile` after deleting every `node_modules` installs 1052 packages with no blocked-script messages
- [x] Root dev tools, exact versions: Biome 2.5.15, TypeScript 6.0.3 (npm `latest` is 7.0.2, so pin explicitly), Vitest 4.1.11 with `@vitest/coverage-v8` 4.1.11, jsdom 29.1.1 (at the root so root scripts and every Vitest project can resolve them) Proof: root `package.json` devDependencies are exactly Biome 2.5.15, TypeScript 6.0.3, Vitest 4.1.11, coverage-v8 4.1.11 and jsdom 29.1.1
- [x] One lockfile: `bun.lock` committed, `bun install --frozen-lockfile` passes (it also passes silently when `bun.lock` is missing, so CI checks the file exists), and `find` finds no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml` Proof: `bun.lock` is tracked; `find` shows no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml`

### C. `packages/core` and `apps/web`
- [x] `packages/core` (`@asknoor/core`): `exports` points at `./src/index.ts` (consumed as source, no build step). Its tsconfig uses `lib: ["ES2023"]` and `types: []`, so the package cannot touch DOM or Node APIs; this enforces "no React, no I/O" at type-check time. One sample export and sample test, labeled "Phase 0 sample, replaced in Phase 1" Proof: `tsc -b` passes with `lib: [ES2023]` and `types: []`; `cd packages/core && bun run test` passes; a test and a type error in `packages/core/test/` are both picked up (control run)
- [x] `apps/web` from `bunx create-vite@9.2.1 apps/web --template react-ts --no-interactive` (it installs nothing; the root `bun install` does), then pruned: remove Oxlint (Biome is our linter), demo assets and `App.css`; rename to `@asknoor/web`; add `@asknoor/core: workspace:*` Proof: scaffolded, then pruned (Oxlint, demo assets, README and the nested `.gitignore` removed); the package is `@asknoor/web`
- [x] React and React DOM 19.3.0 (D1); Vite 8.3.x; `@vitejs/plugin-react` 6.1.x (no Babel; React Compiler stays off) Proof: `apps/web/package.json`: react and react-dom 19.3.0, `@types/react` and `@types/react-dom` 19.3.0, vite 8.3.2, `@vitejs/plugin-react` 6.1.1
- [x] TypeScript strict, checked by one `tsc -b` from the root. The root `tsconfig.json` is a solution file (`files: []`) referencing `packages/core` and `apps/web`; `apps/web/tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json` (create-vite's layout). Every leaf is non-composite with `noEmit`, and web does not reference core: core resolves through `exports` and is checked as part of web's program. A shared `tsconfig.base.json` holds the flags web and core must agree on (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `erasableSyntaxOnly`), because web re-checks core's source under its own options. `tsconfig.node.json` also covers `vitest.config.ts`, `playwright.config.ts` and `e2e/`, with the DOM lib for Playwright callbacks Proof: `bun run typecheck` exits 0
- [x] TypeScript-7-clean config: no `baseUrl`, explicit `types` (`vite/client` in the app config, `node` in the node config, since `types` defaults to `[]` in TS 6), no `ignoreDeprecations`. Trap: `tsc --noEmit -p tsconfig.json` on a solution file exits 0 and checks nothing, so always use `tsc -b` Proof: TypeScript 7.0.2 `tsc -b` over the repo exits 0 and 6.0.3 still passes afterwards; `grep baseUrl` finds none
- [x] `@/` alias: tsconfig `paths` (no `baseUrl`) in both `tsconfig.json` and `tsconfig.app.json` (the shadcn CLI reads the first) plus `resolve.alias` in `vite.config.ts` Proof: `@/components/...` imports resolve in `tsc -b`, `vite build`, Vitest and the shadcn CLI
- [x] Tailwind v4: `tailwindcss` and `@tailwindcss/vite` both 4.3.3; `@import "tailwindcss"` in `src/index.css`; no config file, no PostCSS Proof: `tailwindcss` and `@tailwindcss/vite` are 4.3.3; the build emits 26 kB of CSS (5.5 kB gzipped)
- [x] Placeholder screen `src/app/App.tsx` (and `index.html` with `lang="en"` and the title "Ask Noor"), labeled on screen "Placeholder: Phase 0 tooling check, replaced in Phase 4", that shows the `@asknoor/core` sample export. Done when: `bun run dev` serves with no console errors, `bun run --cwd apps/web build` succeeds, and the built page shows the core marker Proof: the e2e smoke test passes against `vite preview` and against `bun run dev`; the label shows on screen and the built page shows `@asknoor/core`

### D. Biome, Vitest, Playwright
- [x] Biome 2.5.15: `biome.jsonc` (plain `biome.json` rejects the comments that explain the exceptions) with `files.includes` limited to `apps/**`, `packages/**` and root config files (`*.json`, `*.jsonc`, `*.ts`); `!!` force-ignores `dist`, `coverage`, `.claude`, `.github`, `.githooks`, `docs`, `tasks`; VCS ignore file on; `css.parser.tailwindDirectives: true`; recommended rules and the React domain; formatter with 2-space indent and 100 columns (matches Vite and shadcn output). `bun run check` runs `biome check .`. Four narrow `overrides` entries switch off one rule in one file each for generated Animate UI code (`noExplicitAny`, `noArrayIndexKey`, `useExhaustiveDependencies`), each explained in a comment. Done when: `bun run check --verbose` lists only files under `apps/` and `packages/` plus root config files, and `bun run check` exits 0 Proof: `bun run check` checks 45 files with no warnings; `bun run check --verbose` lists only `apps/`, `packages/` and five root config files; control: an `any` in new code is still flagged
- [x] Vitest: root `vitest.config.ts` with `projects: ["apps/web", "packages/core"]`, each project with its own `vitest.config.ts` and its own `test` script (`vitest run`); Vitest and jsdom live at the root, the Testing Library packages in `apps/web`. Core runs in `node`, web in `jsdom` with Testing Library (setup file loads jest-dom and cleans up after each test, because we don't enable globals); web `include` is `src/**/*.test.{ts,tsx}` so Playwright's `e2e/*.spec.ts` never runs under Vitest; coverage provider v8 with a 90% line threshold on `packages/core/src`, enforced by `bun run test:coverage`, which must run from the root without `--project` or the coverage paths match nothing (Phase 1 relies on it). Sample tests: core sample export; web `App` renders its heading and placeholder label. Done when: `bun run test` runs both projects green, and `cd packages/core && bun run test` passes too Proof: `bun run test` runs 5 files and 85 tests; `cd packages/core && bun run test` passes; `test:coverage` is 100% against the 90% gate, and a control with an uncovered file fails it
- [x] Playwright: `@playwright/test` 1.63.0 and `@types/node` 24 in `apps/web`, exact versions; `bunx playwright install chromium` from `apps/web`. The CLI runs on Node through its shebang: never pass `--bun`, and keep Node on PATH (without it Bun 1.3.10 quietly runs the tests on itself). Config: `webServer` runs `bun run build && bun run preview --port 4173 --strictPort` with a 120 s timeout and `reuseExistingServer: false` (a leftover preview would test an old build); one mobile Chromium project (`Pixel 7`); `forbidOnly` and 2 retries in CI; trace on first retry. Smoke test `e2e/smoke.spec.ts`: page loads, heading and core marker visible, the Sheet opens, Tabs switch, no `console.error` and no page errors. Done when: `bun run e2e` passes Proof: `bun run e2e` passes; controls: an injected Google Fonts link and a lookalike-origin link each make it fail

### E. Theme tokens, fonts and the contrast rule
- [x] `src/styles/theme.css`, imported from `index.css`: the TRD 6.5 tokens as CSS variables (`--wb-navy` #002244, `--wb-cyan` #009FDA, `--surface` #F5F8FB, `--line` #D6E1EA), exposed to Tailwind through `@theme inline` (`bg-wb-navy`, `text-wb-navy`, `bg-wb-cyan`, `bg-surface`, `border-line`) and mapped to shadcn's semantic tokens (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--border`, `--ring`, and the rest); a `.dark` block per the TRD (navy surfaces); no toggle UI in Phase 0 Proof: the build, tests and e2e use it; `bun run check` is clean
- [x] `--ok`, `--draft`, `--safety`: real values, no stand-ins (D10); sources and the one derived value are explained in `theme.css` and TRD 6.5. Light mode `#006450`, `#876400`, `#98252B`; dark mode `#00AB51`, `#FDB714`, `#F56B74` Proof: no placeholder or stand-in marker anywhere in `apps/` or `packages/` (grep); `theme.test.ts` checks the official ones against the guide's hex values
- [x] The contrast rule, written next to the tokens with the ratios measured on 2026-10-03 (L-010) and in TRD 6.5: navy on white 16.00:1; navy on surface 15.01:1; navy text on cyan fill 5.31:1 (primary buttons); cyan on white 3.01:1 and cyan on surface 2.83:1 (fails AA for text, and fails 3:1 for icons and focus rings on the page background); `--line` on surface 1.25:1 (dividers only). **Rule: in light mode cyan is a fill, never text, an icon, a border or a focus ring; text on it is navy; focus rings are navy; borders of interactive components use `--input` (3.87:1), not `--line`.** The dark-mode ring is `--surface`, not cyan: a ring is drawn at 50% opacity, and cyan at 50% on navy is only 2.35:1 Proof: recorded in `theme.css` and TRD 6.5; every pair is in `theme-pairs.ts` with its ratio
- [x] `src/styles/theme.test.ts`, with `contrast.ts` (the maths and a reader for `theme.css`) and `theme-pairs.ts` (every pair the components use, with its recorded ratio): fails below 4.5:1 for text or 3:1 for icons, rings and borders, and fails when a token change moves a ratio without the table being updated. It imports `theme.css` as raw text (`?raw`, so no Node types leak into app code; `css.include` in the web Vitest config lets `?raw` CSS through). It also checks that the tokens called official match the World Bank's published hex values. `cyan-rule.test.ts` scans every source file for cyan used as text, an icon, a border or a ring Proof: 75 theme tests pass; control: restoring the bright green `--ok` made 3 of them fail with the measured ratios (2.84 and 3.02 against 4.5)
- [x] Fonts (D5): `@fontsource/atkinson-hyperlegible-next` 400 and 700, bundled by Vite so they work offline and under a same-origin CSP; `--font-sans` with a system fallback; headings in an Arial-compatible stack (TRD 6.5); shadcn's Inter import removed Proof: the build emits hashed woff2 and woff files (latin and latin-ext, 400 and 700); the e2e test confirms the face loaded and that no request leaves the origin

### F. shadcn and Animate UI
- [x] In `apps/web`: `bunx --bun shadcn@4.21.1 init -t vite -b radix -p vega` (Radix, because Animate UI's Base UI items import a deprecated package). The `@/*` paths must already be in `apps/web/tsconfig.json`, not only `tsconfig.app.json`, or init writes into a literal `./@/` folder (found by experiment); shadcn's guide also says to add `baseUrl`, which now errors, so skip it. Then replace the generated OKLCH tokens and the Inter font with ours from section E Proof: init succeeded (`components.json`, `src/lib/utils.ts`); its OKLCH tokens and Inter font are replaced by ours
- [x] `bunx --bun shadcn@4.21.1 add @animate-ui/components-buttons-button @animate-ui/components-radix-sheet @animate-ui/components-radix-tabs`: a Button, a Sheet (D7) and Tabs. Files land in `src/components/animate-ui/` Proof: 12 files created under `src/components/animate-ui/`, `src/hooks` and `src/lib`; `@animate-ui` registered in `components.json`
- [x] Pin the dependencies those items pull in with `--exact`: `motion` 12.43.0 (D6; the add pulled in 14.0.0), `radix-ui` 1.6.7, `lucide-react` 1.51.0, `class-variance-authority` 0.7.1, `cn` 0.4.0, `shadcn` 4.21.1, `tw-animate-css` 1.4.0. Checked before keeping them (TRD section 4): all MIT with no install scripts, and `cn` is published from the `shadcn-ui/cn` repo by the shadcn maintainer Proof: `apps/web/package.json` shows the exact versions
- [x] App root wrapped in `<MotionConfig reducedMotion="user">` (Animate UI's accessibility advice) Proof: `App.tsx` wraps the screen in `<MotionConfig reducedMotion="user">`
- [x] Generated files pass `bun run check` and `tsc -b`. Fixes in our copy: unused `React` imports removed and one type-only import (our strict flags); the Button's `link` and `outline` variants no longer use cyan text or the decorative border (documented at the top of that file); the unused shadcn `ui/button.tsx` removed. The copied source has no network, storage or `eval` calls (checked by grep). Done when: the Playwright smoke test opens the Sheet and switches Tabs, and `bun run check` and `bun run typecheck` stay green Proof: `bun run check` and `tsc -b` exit 0; the e2e test opens the Sheet and switches Tabs

### G. GSAP and the reduced-motion helper
- [x] `bun add gsap@3.15.0 @gsap/react@2.1.2` in `apps/web`. GSAP is free for commercial use under Webflow's "No Charge" license, which is proprietary, not MIT: list it in the README's third-party notes in Phase 7 Proof: gsap 3.15.0 and @gsap/react 2.1.2 are in `apps/web/package.json`
- [x] `src/animations/reduced-motion.ts`: `REDUCED_MOTION_QUERY` and `reducedMotion()`, true only when `matchMedia` exists and matches, safe where it is missing. Phase 4's signature timeline will use `gsap.matchMedia()` with the same query Proof: implemented and covered by the test below
- [x] `src/animations/reduced-motion.test.ts`: true, false and no-`matchMedia` cases, plus a check that `import gsap from "gsap"` resolves and exposes `matchMedia`. Done when: it passes under `bun run test` Proof: 4 tests pass under `bun run test`

### H. Env and ignore files
- [x] `.env.example` at the repo root, names only (TRD section 12), grouped by where each real value lives; server-side names (`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and so on) marked "never prefix with VITE_, never in apps/web" Proof: names only (a grep for `NAME=value` finds none); the server-side group says never to prefix with `VITE_`
- [x] `.gitignore`: append Bun, Vite and Node entries (`node_modules/`, `coverage/`, `.vitest/`, `playwright-report/`, `test-results/`, `blob-report/`, `*.tsbuildinfo`, `dev-dist/`, `.env.*` with `!.env.example`, `.DS_Store`, the other package managers' lockfiles, `.claude/settings.local.json`, which the captain's global gitignore also covers; captain's change 5). **Fixes a latent bug:** the existing Python `lib/` rule also ignores `apps/web/src/lib/` (a TRD source folder and where shadcn writes `utils.ts`), so add `!apps/web/src/lib/`. Done when: `git check-ignore -v apps/web/src/lib/utils.ts` prints nothing, `node_modules/` and `.env.local` are ignored, and `.env.example` is not Proof: `git check-ignore -v apps/web/src/lib/utils.ts` prints nothing; `node_modules`, `.env.local` and `.DS_Store` are ignored and `.env.example` is not; `.claude/settings.local.json` is ignored by `.gitignore:241` with the global rule switched off

### I. CI
- [x] `.github/workflows/ci.yml`: on push to `main` and on pull requests; `ubuntu-24.04` (`ubuntu-latest` moves to 26.04 on 2026-10-19); `permissions: contents: read`; concurrency cancels superseded runs; 15-minute timeout. Steps: `actions/checkout@v7` (`persist-credentials: false`), `oven-sh/setup-bun` pinned by commit SHA (v2.2.0, `0c5077e`, verified with `gh api`) with `bun-version-file: package.json` (it reads `packageManager`), then a step that fails if the installed Bun differs from that pin (captain's change 4), `actions/setup-node@v7` with `node-version-file: .nvmrc` (the runner's default Node is 22, and setup-node can't cache Bun), then `test -f bun.lock && bun install --frozen-lockfile` (the frozen flag alone passes when the lockfile is missing), `bun run check`, `bun run typecheck`, `bun run test`. The first-party actions use their major tags. No e2e job yet: add it later with `bunx playwright install --with-deps chromium` (don't cache browsers) once the offline test exists. Done when: after the push, `gh run list --limit 1` shows success Proof: PR #1: the `verify` job passed in 19 s on 0caf40b; its log shows `bun 1.3.10, node v24.21.0`, a frozen install, Biome on 45 files, `tsc -b` and 85 tests passing

### J. Already done, and out of Phase 0
- [x] `CLAUDE.md`, `docs/`, `tasks/` and `.github/copilot-instructions.md` committed. Proof: `git ls-files` lists them (added in commit 8c5292f)
- Supabase project created and linked: **moved to Slice 3 (D11).** A hosted project, so there is no Docker and no `bunx supabase start`. Not part of Phase 0

### K. Verification and hand-off (nothing above is ticked until each of these passes)
- [x] Fresh-install proof: remove the `node_modules` folders, run `bun install --frozen-lockfile`, then `bun run check`, `bun run typecheck`, `bun run test` and `bun run e2e` all exit 0 Proof: a fresh clone of the pushed branch (65 tracked files): frozen install, `bun run check`, `typecheck`, `test:coverage` (85 tests, core 100%) and `e2e` all exit 0
- [x] `bun run build` succeeds; record the gzipped initial JavaScript size against the 250 KB budget (TRD section 9) Proof: JavaScript is 143.2 kB gzipped (444 kB raw) and CSS 5.5 kB gzipped, against the 250 KB budget
- [x] Guards: `bun.lock` is tracked and no foreign lockfiles exist; no secret names in `apps/` or `packages/` (`git grep`); no `baseUrl` anywhere; `git diff --stat` shows `.githooks/`, `.github/copilot-instructions.md` and `.claude/settings.json` unchanged, and `CLAUDE.md`, `docs/TRD.md` and `docs/PROJECT_MEMORY.md` changed only as the captain's changes require Proof: all clean on 2026-10-03
- [x] `test-verifier` and `guardrail-reviewer` both report clean. The project agents load only after a session restart; until then run the same briefs through general-purpose agents Proof: both briefs were run through general-purpose agents because the project agent types load only at session start. test-verifier: every step passed. guardrail-reviewer: no rule violations and six suggestions; four fixed (a stale 8 PM mention in the TRD, the origin check in the smoke test, core's `test/` folder, wording in this file), and two left open: CI runs `bun run test` rather than `test:coverage` (the gate is trivial until Phase 1) and the `shadcn` package sits in `dependencies`
- [x] Git (D12): branch `phase-0-tooling`, commits grouped by area with explicit paths, push the branch, open a PR, CI green; the captain merges. Each item above ticked with a one-line proof; Review section filled in for Phase 0 Proof: six commits on `phase-0-tooling`, PR #1 open, CI green; awaiting the captain's merge
- [x] Docs follow-ups for the captain: Animate UI files live in `components/animate-ui/`, not `components/ui/` (TRD section 5); CLAUDE.md's commands table and `.github/copilot-instructions.md` listed `bunx supabase start`, which needs Docker and is no longer planned (D11) Proof: fixed in the `docs/catch-up` PR (TRD section 5, CLAUDE.md, copilot-instructions)

<details>
<summary>Research notes, 2026-10-03: what changed since the stack was chosen</summary>

- **Vite 8** (March 2026): Rolldown and Oxc replace Rollup and esbuild; `build.rollupOptions` is now `rolldownOptions`; default browser target is Chrome and Edge 111, Firefox 114, Safari 16.4. `@vitejs/plugin-react` 6 has no Babel. The create-vite template now ships Oxlint.
- **Browser floor:** Tailwind 4 needs Safari 16.4, Chrome 111 or Firefox 128. Older phones (for example an iPhone stuck on iOS 15) cannot run the app. State this limit in the README.
- **TypeScript 6.0** (March 2026): `baseUrl` deprecated, `types` defaults to `[]`, `strict` defaults on. **TypeScript 7.0** (Go-native, GA 2026-07-08) removed `baseUrl` and the old `moduleResolution` values outright and has no JS API yet (typescript-eslint doesn't work with it; we use Biome). shadcn's Vite guide still says to add `baseUrl`, which now errors.
- **Tailwind 4.3:** no config file; unused `@theme` tokens are dropped unless used or declared `@theme static`.
- **Biome 2.x:** `files.includes` replaces include and ignore; `assist.actions.source.organizeImports` replaces `organizeImports`; `!!` force-ignores a folder; `rules.preset` replaces `rules.recommended`; Tailwind directives need `css.parser.tailwindDirectives`. Biome's own docs say to pin the exact version.
- **Vitest 4 and 5:** `workspace` is gone (use `projects`); only `node_modules` and `.git` are excluded by default, so web sets `include`; Vitest 5 no longer finds a config in parent folders.
- **shadcn 4:** registries are `@namespace/item`; Base UI became the default in July 2026 (we choose Radix); a new `cn` package replaces clsx and tailwind-merge. Animate UI items were renamed `[type]-[category]-[name]` in its 1.0.
- **GSAP:** every plugin has been free since 3.13 (license proprietary); 3.14 added an `exports` map.
- **vite-plugin-pwa 2.0.0:** needs Node 20.19 or later; `workbox.globPatterns` replaces the default list, so woff2 and wasm must be listed; files over 2 MiB fail the build.
- **Bun:** 1.3 uses the isolated linker for new workspaces. `bun add --filter` arrived in 1.4; on 1.3.10 it is silently ignored. `engines` and `packageManager` are not enforced. `--frozen-lockfile` passes when `bun.lock` is missing. Bun 1.4 (2026-08-20, latest 1.4.2) is where `bun upgrade` now lands. A Node-shebang tool run without `node` on PATH silently runs on Bun, which is why Node 24 must be on PATH everywhere.
- **World Bank palette:** the only public source found is the February 2016 Branding and Visual Identity Guidelines (p.18 primary; p.19 secondary: 14 colors with PMS, RGB and hex). The printed hex for the PMS 185 C red has a typo (`2EB1C2D`), so `#EB1C2D` is derived from its RGB. The live worldbank.org CSS uses other state colors (`#388004`, `#E19D00`, `#DA1E28`). No license for palette reuse was found; only the logo needs written permission.
- **Tooling surprises met while building:** Vitest replaces every CSS file with an empty string, `?raw` imports included, unless `test.css.include` matches them; Biome's `biome.json` rejects comments (use `biome.jsonc`); `bun add pkg@19.3 --exact` saves the partial range literally, so give a full version; `shadcn add` wrote code that fails our strict TypeScript flags and five Biome rules.
- **Playwright 1.63:** no official Bun support (requests closed "not planned"), so tests run on Node. Playwright releases before 1.60 hang in `playwright install` on Node 24.16 or later.
- **Node and CI:** Node 24 is Active LTS until 2026-10-20, then Maintenance until 2028-04-30; Node 26 becomes LTS on 2026-10-28. GitHub removed the Node 20 actions runtime on 2026-09-23; checkout v7, setup-node v7, setup-bun v2 and cache v6 all run on Node 24. `ubuntu-latest` moves to Ubuntu 26.04 on 2026-10-19, so CI pins `ubuntu-24.04`.

**For later phases**
- vite-plugin-pwa issue #894 reports that an iPhone home-screen PWA won't play video from the service-worker cache. Nobody has confirmed audio, so Pablo should test Noor's clips on a real iPhone early in Phase 4.
- The airplane-mode e2e (the most important test): since Playwright 1.57, `setOffline(true)` in Chromium also blocks the service worker's own fetches, so the test is valid. Use the Pixel profile (WebKit with offline and service workers has an open bug, #42775). Don't set `use.offline`, because the worker must install while online. `navigator.onLine` can read `true` wrongly in 1.62 and 1.63 (#42174), so assert on the UI instead.
</details>

## Phase 1: Core domain and guardrails (Bee with Claude Code, about 1.5 h)

Plan approved 2026-10-03 (`/Users/bhagi/.claude/plans/` copy of the plan). Built on branch `phase-1-core`, cut from `phase-0-tooling` because PR #1 is not merged yet. One change from the plan: `themeOf` scores a theme as matched or not (it does not count hints), because counting made "Wie lange dauert das Rösten?" resolve to `length` (two hits) instead of `roast` (one).

- [x] `types.ts` with every contract from TRD section 6.1 (plus `Addon` and `Thresholds`, which the TRD references without defining), Zod schemas for `FarmPackManifest` and `OutboxItem`, and the JSON Schema export Proof: `bun run typecheck` exits 0 with each schema pinned by `satisfies` (control: adding a field to `Thresholds` fails `tsc -b`); `schemas.test.ts` has 16 tests, including the drift test against `packages/core/schema/manifest.schema.json`
- [x] `normalize()` with tests (umlauts, `ß`, Swedish letters, punctuation) Proof: `normalize.test.ts`, 11 tests pass
- [x] `decideSafety()` with a multilingual lexicon and at least 20 test cases (English, German, Dutch, Swedish) Proof: `safety.test.ts` has 48 tests: 28 must-trigger and 11 must-not-trigger sentences plus boundary and lexicon checks; control: removing `ambulans` fails "[sv] Ring en ambulans"
- [x] `decide()` with tests at, above and below the threshold Proof: `decide.test.ts`, 11 tests; control: `<` changed to `<=` fails "confirms exactly at the threshold"
- [x] `themeOf()` with the fixed taxonomy and tests for each theme Proof: `themes.test.ts` has 54 tests: 45 phrases covering all 15 themes in at least two languages, plus tie, whole-word and taxonomy-guard tests
- [x] `fillTemplate()`: only known placeholders, refuses unchecked labels, one SMS segment check Proof: `template.test.ts`, 19 tests; control: dropping the checked test fails "throws on an unchecked label"
- [x] i18n strings for en, de, nl, sv covering the guest interface (PRD section 6) Proof: 79 keys per language; a missing key fails `tsc -b` (control: a key added to `en.ts` only); `i18n.test.ts` checks keys, placeholders, no pasted English, no phone or email patterns. **de, nl and sv are unchecked drafts** (`I18N_STATUS`); a native speaker must check them before a production pack
- [x] Coverage of `packages/core` at least 90% of lines Proof: `bun run test:coverage`: 257 tests pass, core lines 100% (106 of 106)
- [x] Housekeeping: CI runs `test:coverage`; `shadcn` moved to devDependencies Proof: `ci.yml` runs `bun run test:coverage`; `bun install --frozen-lockfile` passes, `vite build` and `bun run e2e` still pass after the move
- [x] Bundle check: importing core from the placeholder screen first grew the web bundle from 143.2 kB to 172.9 kB gzipped; `"sideEffects": false` in core's `package.json` brings it back Proof: `vite build` reports 143.22 kB gzipped against the 250 KB budget

Guardrail-reviewer (2026-10-03): no violation of the ten non-negotiables after two fixes: `decide` failed open on a NaN threshold (now saves; test added), and the safety lexicon missed inflected forms such as "hurts", "snakes", "dizzy", "Kopfschmerzen" (added, with a test table). Tracked for later phases:
- [ ] Phase 3 `pack.py`: in production mode fail while any language in `visitorLangs` is `draft` in `I18N_STATUS`, require every non-source subtitle to be checked (the `draft` flag on a moment is opt-in), and require every clip with synthetic audio to be listed in `labels.syntheticVoice`
- [ ] Phase 3 eval: pick `thresholds.match` from the sweep; the schema allows 0 to 1 (a floor is not set because no calibrated value exists yet). Record that `margin`, `ambiguous` and the P1 "A or B" step are unused in the evaluation limits
- [ ] Phase 5 `ingest`: call `redact()` from core on every free-text field before storing, with a Deno test; decide whether feedback text should pass `decideSafety`
- [ ] Phase 5 `monthly-summary` (from the Slice 4 step 5 review): show the reviewer `fillTemplate`'s `dropped` list before approval; refuse an empty body; never pass `options.priority` in production; refuse an unchecked template ("held") with a test, since `fillTemplate` checks only the labels

Captain's follow-ups, same day:
- [x] `farmId` is the Supabase `farms.id` UUID everywhere and `farmSlug` (`ondera-noor`) is for paths and pack folders Proof: `schemas.test.ts` rejects a slug as `farmId`, and rejects `../etc`, `a/b`, uppercase and spaces as `farmSlug`; schema regenerated; TRD 6.1 updated; `packages/core/schema` is excluded from Biome because it is generated
- [x] `redact()` in core: emails and phone numbers (international, national, Gambian `+220` and 7-digit local) Proof: `redact.test.ts`, 46 tests including 10 Gambian formats and the things that must stay ("stop 3", `2026-10-03`, prices); non-negotiable 7 is now covered in core, and `ingest` still has to call it (Phase 5)
- [x] `fillTemplate` segment math uses 153 (GSM-7) and 67 (UCS-2) per part, not 160 and 70 Proof: the limits were already right for plain text, and tests now pin 306/307/459/460 (GSM-7) and 134/135/201/202 (UCS-2). The check found one bug: `ceil(length / limit)` undercounts when an escape pair (`€`) or an emoji straddles a part boundary, so parts are now packed (a test with 152 + `€` + 152 septets needs 3 parts, not 2)
- Result: 330 tests pass, core lines 100% (126 of 126)

Open items for the captain and Preet (found while building):
- The safety lexicon and theme hints are first drafts; review them against real questions.
- The emergency number for the safety card is not in any string yet (content item for Preet).
- Wolof uses `ë`, which is outside GSM-7, so a Wolof text is UCS-2 with 70 characters per segment. One segment will rarely be possible; `fillTemplate` flags it and allows two.

## Phase 2: Content (Preet, in parallel)

- [ ] Decide Noor's language: Wolof speaker found, or labeled stand-in (post in Discord now)
- [ ] Choose visitor languages from The Gambia's arrival data; note source and year
- [ ] `content/ondera-noor/clips.json`: clips 1–8 with the three script fixes; clip 8 marked held back
- [ ] Recordings 1–7 (and 8 for the demo loop) plus typed transcripts
- [~] `facts.json`, `recipe.json`, `products.json`, `farm-card.json`: three fun facts with sources, Noor's recipe, three products with prices, farm card (written as drafts; sources, prices and a demo phone number are still needed)
- [ ] `test-questions.csv`: about 40 covered (4–5 per clip) plus about 10 not covered, each labeled
- [~] `checks.json` and `sms-templates.json` (monthly template and theme labels: English written, Wolof null until drafted and checked)
- [ ] Narrator voiceovers for add-ons (Preet's own voice, English)

## Phase 3: Pipeline (Bee, Colab, about 2.5 h)

- [ ] `transcribe.py` (MMS and forced alignment) on one recording; check output by hand
- [ ] `segment.py` into moments; pytest
- [ ] `translate.py` to draft subtitles; all marked unchecked
- [ ] `embed.py` and `export_model.py` (ONNX int8); record the model size
- [ ] `pack.py` in demo and production modes; pytest proves production excludes unchecked items
- [ ] Consent gate: the pipeline refuses to use any dubbed audio whose row in `docs/CONSENT.md` is not `confirmed`, in every mode, and labels it "AI-dubbed"; pytest proves a `pending` row stops the build and that no dubbed file is listed without a matching confirmed row
- [ ] `eval/` threshold sweep, matching accuracy, fail-safe rate, translation chrF, WER, latency; writes `docs/EVAL.md`

## Phase 4: Guest PWA (Pablo, about 4 h)

- [ ] `ServicesProvider` with interfaces from TRD section 6.2
- [ ] Pack download with size and progress; checksum verification; persistent-storage request
- [ ] Stop list; in-app QR scanner (qr-scanner); number fallback
- [ ] Player: audio and WebVTT subtitles; GSAP progress timeline; reduced motion
- [ ] Ask flow: AskBox, ConfirmCard, SavedCard, SafetyCard, all through `decide()`
- [ ] `E5WorkerMatcher` (Transformers.js, local files only) behind the `Matcher` interface
- [ ] Feedback form; shop and order sheet with Noor's confirmation; recipe, farm card, fun facts
- [ ] Dexie outbox; `SyncService` with backoff; pending count
- [ ] Interface strings in all visitor languages; demo-mode labels and example questions
- [ ] World Bank–inspired theme tokens; contrast checked

## Phase 5: Backend and cooperative dashboard (Bee and Pablo, about 2 h)

- [ ] Migrations `0001_init.sql`, `0002_rls.sql`, `0003_cron.sql`
- [ ] `ingest`: Zod, redaction, idempotent upsert; Deno tests
- [ ] `monthly-summary`: counts, checked template, held versus ready; Deno tests
- [ ] `send-sms`: approval required; demo mode logs; Deno tests
- [ ] `/coop` sign-in (magic link), insights, unanswered questions, feedback themes, orders, review queue, report approval
- [ ] `seed.sql` with a labeled synthetic month for the demo
- [ ] P1: `classify` with Groq, strict schema, Zod, review queue for disagreements

## Phase 6: Verification (everyone, about 1.5 h)

- [ ] Playwright offline suite green on a production pack
- [ ] Evaluation numbers final in `docs/EVAL.md`
- [ ] Lighthouse: PWA installable, accessibility 95 or higher
- [ ] Pack size and latency measured on a low-end profile
- [ ] `DATA_CARD.md` and `RESPONSIBLE_AI.md` complete (Preet)
- [ ] Staff-engineer review pass: read every diff once more

## Phase 7: Demo and submission (Preet and Pablo, about 2.5 h)

- [ ] Rewrite `docs/DEMO.md` for Ask Noor (the old script was for the farming idea)
- [ ] Record demo footage with airplane mode visible
- [ ] Record narration; edit; export (2–5 minutes, all five required parts)
- [ ] README: what it is, how to run it, tech stack, evaluation summary, labels
- [ ] Submit on HackOS; post on LinkedIn for the Go Viral award

## Cut list (apply in this order if a checkpoint slips by more than 30 minutes)

1. ElevenLabs narrator audio (keep text cards)
2. Groq classification (device themes only)
3. Vocabulary trimming (ship int8 and report the size honestly)
4. Spoken guest questions
5. Live SMS provider (demo-mode log only)
6. Cooperative sign-in (seeded demo login for judges, clearly labeled)

Never cut: offline tour, guest confirmation, fail-safe, safety card, checked-content gating, evaluation numbers, the video.

## Review

(Fill in after each phase: what shipped, the proof, what slipped and why, what we learned.)

### Phase 0: Repo and tooling (2026-10-03)
- **Shipped:** Bun 1.3.10 workspaces (`apps/web`, `packages/core`); a React 19.3, Vite 8 and Tailwind 4 app with a labeled placeholder screen; Animate UI Button, Sheet and Tabs; self-hosted Atkinson Hyperlegible Next; the World Bank–inspired theme with real status colors; GSAP and `reducedMotion()`; Biome, Vitest (85 tests), a Playwright smoke test; CI.
- **Proof:** from a clean install, `bun run check`, `typecheck`, `test:coverage` and `e2e` all pass. Every guard test had a control run in which the thing it guards was broken on purpose and the test failed (offline origin check, contrast pairs, cyan rule, coverage gate, the lint exceptions).
- **What slipped:** the plan said about 45 minutes. Research (12 subagents, three re-run after a session limit) ran from 18:24 to about 20:05 ET, and building and verifying took until about 21:45 ET. The old 8:00 PM checkpoint passed before Phase 0 was approved, and the captain re-baselined to Slices 1 to 4.
- **What we learned:** see L-016 and L-017 and the five bug-log rows. Generated code needs the same rules as ours (it broke the cyan rule and our strict TypeScript flags), and a guard that has never failed has not been shown to work.
