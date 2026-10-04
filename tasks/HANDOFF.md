# Status after the overnight autopilot (written 2026-10-04, about 03:35 ET)

Everything below this block was written earlier for Pablo and is kept for reference; where it says the guest app is on a draft PR, this block is newer: **it is merged**.

## Deploy (Vercel, static)

Live demo: https://ask-noor.vercel.app (Vercel project `ask-noor`). Since 2026-10-04 it serves the **real demo pack**: 7 stops in Preet's voice (labeled "Voice: Preet, standing in for Noor"), the 7 AI-dubbed Wolof clips, the Wolof drafts and the 44 MB trimmed model; clip 8 is held back. Preet confirmed publishing and transcription in writing on 2026-10-04 (team Discord; the message link is not filed yet). It is a static deploy of the built app, uploaded from this machine:

```sh
bun run --cwd packages/pack build --mode demo --model trimmed        # needs the recordings in content/ondera-noor/recordings/
VITE_PACK_BASE=/packs/ondera-noor/demo bun run --cwd apps/web build   # point the app at the demo pack
cd apps/web/dist && vercel link --project ask-noor --yes && vercel deploy --prod --yes
```

`apps/web/public/vercel.json` rewrites `/stop/n` to `index.html` (first visit to a stop link) and keeps `sw.js` revalidating. `apps/web/public/.vercelignore` keeps the local production pack, the fixture pack (the deployed app does not use it) and an unused hashed copy of the runtime wasm out of the upload. Vercel Hobby allows 100 MB per CLI upload in total (no separate per-file limit); this upload is 88 MB (42.3 MB model, 26.9 + 14.3 MB runtime wasm, 1.4 MB audio). `vite build` empties `dist`, so run `vercel link` again before each deploy. Without `VITE_PACK_BASE` the build points at the fixture pack, which is excluded from the upload, so the deployed app would find no pack.

## What merged (all with CI green, including the Playwright airplane-mode test, and a guardrail-reviewer PASS)
| PR | What |
|---|---|
| #14, #15 | The 44 MB trimmed model, hosted as a private GitHub Release asset (`pack:model --trimmed` downloads and verifies it; needs `GITHUB_TOKEN` while the repo is private), MIT notice, committed fidelity figures |
| #16 | The guest app demo path: pack download, language picker, stops, player with labels, ask flow (safety first, e5 worker, confirm), feedback, shop, offline PWA, airplane-mode e2e. Review fixes: orders need Noor's 4-digit farm code (salted hash in the pack, prototype control), draft labels on every subtitle path, 16 px minimum text, translated AI-dubbed chip, the missing tests |
| #17 | Stop links (`/stop/1` to `/stop/n`, offline) and the in-app QR scanner (`NOOR-STOP-n` or a stop link; anything else ignored), with a fake-camera Playwright test. The first CI run caught a real bug in my test feed (the QR was cropped by the scanner's scan region); fixed |
| #18 | `docs/DATA_CARD.md`, `docs/RESPONSIBLE_AI.md` (every guardrail with the test that proves it), README Evaluation and Status tables from `docs/EVAL.md` |

Test status on main: 643 unit tests, 10 model tests, 97 pytest, 4 Playwright tests (smoke, offline tour, request-watcher control, stop links and scanner). `bun run check` and `bun run typecheck` clean.

## What is still open (guest app, in order)
1. The real-audio demo pack (blocked: Preet's publishing consent, see below).
2. Sync (`SyncService`: post the outbox when online, backoff, pending count; the Supabase ingest does not exist, so use a labeled mock).
3. Fun fact, Recipe and Farm cards from `manifest.addons`, and the GSAP progress timeline (reduced motion respected).
4. Pack update flow (swap on the next stop change, never mid-clip) and storage-persistence messaging for iOS.
5. Polish: keyboard and screen-reader pass, Lighthouse PWA and accessibility 95+, error boundary, a measured first-load time on a real phone.
6. `/coop` dashboard, Supabase, Groq theme check, monthly text and reviewer approval: **not started; `supabase/` is Pablo's and I did not touch it**. Step 7 (Groq) was skipped by decision.
7. The video (story in the earlier handoff below).

Small known items from the reviews: the farm-code lockout lives in page memory (a reload clears it); the e2e has no control for a foreign QR code (unit tests cover it); `waitForTimeout(3000)` in the e2e waits for the precache, so poll for it if it flakes; `/stop/n` links on a real host need a single-page-app fallback to `index.html` for the first online visit (the service worker and `vite preview` already do this); the older-Safari wasm build is precached but never exercised.

## Waiting for Bee
- **Preet's consent rows** (`docs/CONSENT.md`): all three are `confirmed` (publishing and transcription on 2026-10-04). File the Discord message links for the three written yeses.
- **The audio folder for Pablo**: the 8 English and 8 Wolof recordings are gitignored and only on your machine (`~/Downloads/Archive-2/`); verify with `content/ondera-noor/recordings/audio.sha256`.
- **Farm code**: pick the real production code (`ASKNOOR_FARM_CODE`, 4 digits, never committed) or decide that order confirmation moves to Noor's own device or the dashboard (a 4-digit code is brute-forceable offline from the pack). The demo code is `4827`.
- **Hosting and its file limits**: the largest files are the 42.3 MB model, the 26.9 MB runtime wasm and the 14.3 MB older-Safari wasm; the app also precaches about 41 MB before the pack download. Choose a host that allows them, and decide whether to drop the older-Safari wasm.
- **Private repo and the model download**: while the repo is private, `pack:model --trimmed` needs a token. If the repo goes public the plain URL works. The MIT notice is a release asset and in the repo, not inside each pack.
- **Native-speaker checks** (de, nl, sv interface text and subtitle drafts; Wolof drafts and dubs) are Preet's; until they are done, production packs must not ship those languages.
- **A real-phone run** (first load time, the matcher on a phone, iOS Safari) and a threshold check with phone-made vectors: not done.
- **Index-only passages in production**: your decision on record is that they may ship; the responsible-AI doc flags the tension with rule 5.
- **`.claude/settings.local.json`** has the autopilot permissions and is gitignored; I never committed it. `git push origin *` is allowed there, so narrow it if you want.

# Handoff to Pablo (written 2026-10-04, about 03:00 ET, by Bee's Claude Code session)

Branch `feat/guest-app`, draft PR #16. **Do not merge it until the guardrail review is back and CI is green.** Read CLAUDE.md, `tasks/lessons.md` and this file first. Bun is exactly 1.3.10. Feature freeze is 4:30 AM ET, submit by 8:00 AM ET.

## 1. What is where

### Merged on main
| PR | What | Proof |
|---|---|---|
| #14 | Trimmed-vocabulary e5: 52,005 of 250,002 embedding rows, model files 44.3 MB instead of 135.4 MB. Same held-out top-1 as the full model (91.1%). Lock file, `--model trimmed` build flag, manifest `trim` block, data card and EVAL "Model size" section | CI green (verify, pipeline, model); 570 unit tests, 10 model tests, 97 pytest at the time |
| #15 | The trimmed model as a GitHub Release (`model-trimmed-v1`, one asset per file plus `NOTICE-MIT.txt`); `bun run pack:model --trimmed` downloads and sha256-verifies it; `content/ondera-noor/eval/trim-fidelity.json` holds the tokenization-fidelity figures that EVAL.md cites | CI green; the real download was run once with a token and verified |

### On `feat/guest-app` (PR #16, not merged): one commit per step
| # | Commit | What | Tests |
|---|---|---|---|
| 1 | `4392bb6` | `LocalPackRepository` (downloads the pack into cache `pack-<slug>-v<version>`, checks every sha256, writes the manifest last, drops older versions); `Services` interfaces (`Matcher`, `PackRepository`, `Outbox`); Zustand store with the language persisted; language picker (en, de, nl, sv); pack download screen with size, progress, retry | `pack-repository.test.ts` (5, including a tampered file and an older version dropped), `App.test.tsx` (5) |
| 2 | `d3a91f9` | Stop list with number entry (also accepts `NOOR-STOP-3`); Player with WebVTT subtitles (20 px), the source-script fallback with a note, "Voice: Preet, standing in for Noor", "AI-dubbed" / "AI narrator voice" labels, demo-mode and draft-translation labels (hidden in production packs) | `vtt.test.ts`, `stops.test.ts`, `guest.test.tsx` |
| 3 | `21f5472` | Ask flow: `decideSafety` first (safety card, nothing stored, matcher never called), then the e5 worker (`workers/e5.worker.ts`, model and embeddings from the saved pack, `allowRemoteModels = false`, wasm from `/ort`), then `decide()` with the manifest threshold. Confirm card (Yes plays that moment only; No saves the question), Saved card, Safety card. Questions are `redact()`ed and get a device theme | `score.test.ts`, `ask.test.ts`, `AskPanel.test.tsx` |
| 4 | `41a4d3f` | Feedback form (loved, change) and a minimal shop; the order sheet is for Noor to read, and the order is stored only after the "Noor confirms your payment in person." button. All into `DexieOutbox` | `outbox.test.ts` (fake-indexeddb), `order-feedback.test.ts`, `shop-feedback.test.tsx` |
| 5 | `2e664da` | vite-plugin-pwa (injectManifest, `src/sw.ts`): precaches the shell and the ONNX runtime wasm (about 41 MB); serves `/packs/*` from the pack cache; registered in production builds only. The ORT wasm files are copied into `public/ort` (gitignored) by a Vite plugin | covered by the e2e |
| 6 | `3b163eb` | Playwright airplane-mode test (`e2e/offline.spec.ts`): download, offline, reload, play stop 1, ask a question and see the Confirm card, a question Noor never answered is saved, a German safety question shows the card with the outbox count unchanged. It fails on any request to another origin or any request that fails while offline, and has a control test that proves the watcher catches a leak. Also added to the CI `model` job. Docs (`RESPONSIBLE_AI.md`) and a fixture test were updated to match | 3 e2e tests passed locally |

Status at the last run (local, on this branch): `bun run check` clean, `bun run typecheck` clean, `bun run test` 617 passed, `bun run test:model` 10 passed, `bun run e2e` 3 passed. **CI had not reported on PR #16 when I wrote this, and the e2e step in the CI `model` job has never run in CI**: if it fails there, fix or drop that step, do not skip the local e2e. The guardrail-reviewer returned **FAIL** (section 1b).

## 1b. Guardrail review of PR #16: FAIL on the first read; items 1 to 5 were fixed on 2026-10-04 (autopilot), see the top of this file for the re-review result

The reviewer read the diff only (it ran nothing). Everything else in the ten non-negotiables passed (offline wiring, safety before matcher and nothing stored, redaction, no secrets, no Groq or ElevenLabs, nothing plays before Yes).

1. **Non-negotiable 6: a guest alone can create a sale.** The "Noor confirms your payment in person." button is on the guest's own screen (`components/guest/Shop.tsx` around lines 103 to 107) and `lib/order.ts` `confirmOrder` hardcodes `confirmedByNoor: true`. Fix: a Noor-only gate before `confirm()` (a PIN set in the pack, or a long press that only Noor knows), or store `confirmedByNoor: false` and let the coop side flip it (the schema currently only allows `true`, so that is a change in `packages/core`, Bee's). Done when: a test shows a guest tap alone stores nothing, and the gated path stores the order.
2. **Non-negotiables 5 and 9: draft labels missing on stops.** `Player.tsx` takes the draft flag only from a confirmed moment (`moment?.draft?.[lang]`), so a de, nl or sv subtitle opened from the stop list shows no "Draft translation" chip in a demo pack. Fix: use `clip.draft?.[lang]` when there is no moment. Also show the draft chip when `I18N_STATUS[lang] === "draft"` and the pack is a demo (the interface strings in de, nl and sv are unchecked drafts). Done when: a test opens a stop in German in a demo pack and finds the chip, and a production pack shows none.
3. **Small text.** Labels, notes and the privacy line use `text-sm` (14 px) in `Labels.tsx`, `Player.tsx`, `FeedbackForm.tsx`, `AskPanel.tsx`. Use at least `text-base`.
4. **"AI-dubbed" chip is hardcoded English** in `Labels.tsx`; it needs an i18n key (core, Bee's) or `t()` with a new key in all four languages.
5. **Missing tests:** a control for the safety test in `AskPanel.test.tsx`, that an order is not stored before the confirm tap, and feedback redaction through the UI.

## 2. What is left for the guest app, in order

(Do section 1b first.)

1. **Wire the real demo pack** (needs Preet's publishing consent, section 4). Done when: `VITE_PACK_BASE=/packs/ondera-noor/demo bun run dev` shows 7 stops with Preet's English recordings and the label "Voice: Preet, standing in for Noor", and `bun run e2e` still passes against the fixture.
2. **Stop 3 by scanning** (qr-scanner, `Scanner` interface in TRD 6.2), with the number entry as the fallback when the camera is refused. Done when: a component test with a fake scanner opens the stop for `NOOR-STOP-3`, a denied camera shows `stops.cameraDenied` and the number field still works.
3. **Progress animation** (the one GSAP timeline, reduced motion respected) and the Fun fact, Recipe and Farm cards from `manifest.addons` (demo shows them labeled; production only when checked and with no `needs`). Done when: component tests cover each card's demo and production states, and `prefers-reduced-motion` disables the timeline.
4. **Sync** (`SyncService`: post the outbox when online, exponential backoff, pending count `sync.pending`). Until the Supabase ingest exists, use a mock endpoint labeled as a stand-in. Done when: a Playwright test goes offline, saves a question, comes back online and the outbox count goes to 0, with nothing sent for a safety question.
5. **Pack update** (`checkForUpdate`, swap on the next stop change, never mid-clip) and "storage persisted" messaging for iOS. Done when: a unit test shows a newer manifest is downloaded in the background and swapped only when no clip is open.
6. **Polish**: keyboard and screen-reader pass, Lighthouse PWA and accessibility at least 95, a visible pending count, error boundary with a plain recovery message. Done when: the Lighthouse run is attached to the PR.
7. **`/coop` dashboard** (Prompt 9 in `tasks/pablo.md`) needs Bee's Supabase backend, which is not built. Do not start it before the backend lands.
8. **Demo footage** in airplane mode (section 5).

Known gaps in what is built: no QR scanning; the `Matcher` is only warmed when the Ask tab opens (first open waits for the model: about 5 s on this laptop, longer on a phone: measure it); the e2e asks the verbatim fixture sentence, so it proves the pipeline, not match quality; the matcher decision is untested on phone-made vectors (the threshold 0.8675 was chosen on laptop vectors); iOS Safari is untested; the wasm for Safari below 26 (non-asyncify) is precached but never exercised.

## 3. How to run it

```sh
cd /Users/bhagi/Zero-Latency && bun install --frozen-lockfile
bun run dev                      # dev server; the service worker is registered in production builds only
bun run test && bun run check && bun run typecheck
```

**The offline e2e needs the model inside the fixture pack** (not committed; gitignored):

```sh
# the trimmed model (44 MB); the repository is private, so a token is needed
GITHUB_TOKEN=$(gh auth token) bun run pack:model --trimmed
bun run pack:model --trimmed --into apps/web/public/packs/fixture
# or the full model (135 MB), the same files CI uses: bun run pack:model --into apps/web/public/packs/fixture
bun run e2e                      # builds, previews on :4173, runs smoke + offline specs
```

The fixture pack (`apps/web/public/packs/fixture`) is committed and synthetic (tones and made-up text). Its embeddings were made with the full model; the trimmed model's vectors differ slightly (mean cosine 0.9995) and the e2e passes with either.

**The real demo pack** (Preet's recordings as the stand-in voice, 8 clips, clip 8 held back):

```sh
bun run --cwd packages/pack build --mode demo --model trimmed   # writes apps/web/public/packs/ondera-noor/demo
VITE_PACK_BASE=/packs/ondera-noor/demo bun run dev
```

**Earlier this refused** ("consent for Preet Patel (publishing) is 'pending'"); since 2026-10-04 the row is confirmed and the build works. The audio is also not in git: `content/ondera-noor/recordings/en/clip01.m4a` to `clip08.m4a` (and `wo/clip01_wo.flac` to `clip08_wo.flac`) are gitignored. They are on Bee's machine (copied from `~/Downloads/Archive-2/`); ask Bee for the folder, check it with `content/ondera-noor/recordings/audio.sha256`, and put it at `content/ondera-noor/recordings/`. I did not build the real demo pack (the build was stopped before it ran).

## 4. Open decisions and blockers

- **Preet's consent rows** (`docs/CONSENT.md`): dubbing confirmed 2026-10-03; transcription and publishing confirmed 2026-10-04 (written yes in Discord, links not filed). The live ElevenLabs transcript has not been run, so subtitles are still time-estimated and labeled. Bee sets rows to `confirmed`, nobody else.
- **Native-speaker checks**: de, nl, sv interface strings and subtitle translations are drafts that nobody fluent has checked; the guest app labels them in demo mode and a production pack must not ship them. Wolof (NLLB draft and the AI-dubbed audio) needs a Wolof speaker. Preet owns the checks (`content/ondera-noor/checks.json`).
- **The 44 MB model and the host's file limit**: the hosting platform for the PWA is not chosen. The largest single files are the ONNX model (42.3 MB), the ONNX runtime wasm (26.9 MB asyncify, 14.3 MB plain) and `tokenizer.json` (2 MB). A host with a per-file limit under about 45 MB (some free static hosts use 25 MB) would break the download or the precache. Check the limit before choosing; the model has no smaller option (trim 0.5 is 41 MB). The trimmed model's own home is the private GitHub Release; the app serves it from `/packs/<farm>/<mode>/model/`.
- **Precache size**: the service worker precaches about 41 MB of ONNX runtime wasm before the guest even downloads the pack, and the pack then adds about 46 MB. Decide whether to drop the non-asyncify wasm (Safari below 26 only).
- **MIT notice** for the model travels as a release asset and in the repo, not yet inside each pack.
- **NLLB and MMS are CC-BY-NC-4.0** (non-commercial); they are build-time only, but they limit "any farm" use. Stated in `docs/DATA_CARD.md`.
- **Thresholds**: the shipped threshold (0.8675) was chosen on laptop vectors; recheck it with phone-made vectors in the e2e on a real phone.
- **Phase 5 not built**: Supabase, ingest, Groq theme check, the monthly text and reviewer approval, the dashboard. The responsible-AI doc says so plainly.

## 5. Demo story for the video

1. **Lena and Noor share no language.** Lena is a German guest at Ondera Noor's coffee farm in The Gambia; Noor speaks Wolof. Nothing between them is translated live.
2. **Why AI.** It is not a chatbot. Every answer is a moment from Noor's own recordings; Lena confirms it ("Noor talks about roasting. Is this what you asked?"); if nothing fits, the question is saved for Noor and the app says "Not sure, ask a person"; a health or safety question goes to the guide card and is never stored and never reaches the matcher. A menu or a spreadsheet cannot match a free question in four languages without a network.
3. **The offline tour.** Lena downloads the tour once at the guesthouse (show the size and the progress bar), then turns on airplane mode (show it on screen). She scans or types Stop 3, hears Noor's recording with German subtitles (labeled as draft in the demo). She asks about roasting, sees the Confirm card and taps Yes: the roasting moment plays. She asks about staying overnight: saved ("Not sure, ask a person"; Noor never recorded that answer). She types "my friend fell": the safety card, "please ask your guide", nothing stored. She orders beans: the sheet is for Noor, and the order counts only when Noor taps that she confirmed payment.
4. **A month later.** The outbox syncs. Noor's dashboard shows the most-asked theme, "staying overnight". Noor gets her monthly text on her own phone, a checked template with counts only, sent only after a cooperative reviewer approves it. She records the clip 8 answer (overnight stays); the next pack contains it and the next guest who asks gets Noor's own answer. **Phase 5 is not built, so show these as a clearly labeled mock-up, not as working software** (non-negotiable 9).
5. **Our take.** A 44 MB offline model (the full one is 135 MB) with the same held-out top-1 (91.1%); safety questions 16 of 16 sent to the card and 0 ordinary questions wrongly sent (`docs/EVAL.md`); honest limits: 116 synthetic questions written by us, wide intervals on the held-out halves, Wolof quality is weak and drafted, de/nl/sv are unchecked drafts, the threshold was not checked on phone vectors, and no real guests yet.

Label every stand-in on screen and in the narration: the voice is Preet standing in for Noor; the Wolof audio is AI-dubbed; the German, Dutch and Swedish text is a draft; the questions are synthetic.

## Prototype farm code (demo)

Orders are confirmed with Noor's 4-digit farm code. The pack carries only a salted PBKDF2 hash (`manifest.farmCode`, labeled `prototype`). **Demo and fixture code: `4827`** (a documented prototype value, not a real farm's code; `DEMO_FARM_CODE` in `packages/pack/src/fixture.ts`). A production pack is built with `ASKNOOR_FARM_CODE=<4 digits> bun run --cwd packages/pack build --mode production`; without it the pack has no code and the shop cannot confirm any order. Three wrong codes lock the form for 30 seconds. Limits: only 10,000 values, so someone holding the pack can find it offline; it is a speed bump, not security.
