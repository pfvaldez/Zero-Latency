# tasks/todo.md: Ask Noor build plan

Status: `[ ]` to do, `[~]` in progress, `[x]` done (add a one-line proof), `[!]` blocked (say why).
Deadline: submit by 8:00 AM ET, October 4 (hard deadline 9:00 AM ET). Feature freeze at 4:00 AM ET.
Plan status: **awaiting captain's approval before implementation starts.**

## Checkpoints

| Time (ET) | Must be true | Proof |
|---|---|---|
| 8:00 PM | Guest app plays a clip offline; ask flow runs through `decide()` | Playwright offline test green |
| 10:00 PM | e5 worker live; first evaluation numbers | `docs/EVAL.md` generated |
| Midnight | Sync, monthly report and cooperative dashboard working | Report shows "held" or "ready" from synced data |
| 4:00 AM | Feature freeze | All tests green; demo footage recorded |
| 7:45 AM | Video exported (2–5 minutes, all five parts) | File in shared drive |
| 8:00 AM | Submitted on HackOS | Confirmation screenshot |

## Phase 0: Repo and tooling (Bee, about 45 min)

- [ ] Bun workspaces monorepo: `apps/web`, `packages/core`
- [ ] Vite, React 19.2, TypeScript strict, Tailwind CSS v4 in `apps/web`
- [ ] Biome, Vitest, Playwright configured, each with one passing sample test
- [ ] Animate UI components added through the shadcn CLI (Button, Dialog or Sheet, Tabs)
- [ ] GSAP installed; `animations/` module with a reduced-motion guard and a unit test
- [ ] Supabase project created and linked; `bunx supabase start` works locally
- [ ] `.env.example` and `.gitignore` (no secrets tracked)
- [ ] `CLAUDE.md`, `docs/`, `tasks/`, `.github/copilot-instructions.md` committed
- [ ] CI workflow: `bun install --frozen-lockfile`, check, typecheck, test

## Phase 1: Core domain and guardrails (Bee with Claude Code, about 1.5 h)

- [ ] `types.ts` with every contract from TRD section 6.1
- [ ] `normalize()` with tests (umlauts, `ß`, Swedish letters, punctuation)
- [ ] `decideSafety()` with a multilingual lexicon and at least 20 test cases (English, German, Dutch, Swedish)
- [ ] `decide()` with tests at, above and below the threshold
- [ ] `themeOf()` with the fixed taxonomy and tests for each theme
- [ ] `fillTemplate()`: only known placeholders, refuses unchecked labels, one SMS segment check
- [ ] Coverage of `packages/core` at least 90% of lines

## Phase 2: Content (Preet, in parallel)

- [ ] Decide Noor's language: Wolof speaker found, or labeled stand-in (post in Discord now)
- [ ] Choose visitor languages from The Gambia's arrival data; note source and year
- [ ] `content/ondera-noor/clips.json`: clips 1–8 with the three script fixes; clip 8 marked held back
- [ ] Recordings 1–7 (and 8 for the demo loop) plus typed transcripts
- [ ] `addons.json`: three fun facts with sources, Noor's recipe, three products with prices, farm card
- [ ] `test-questions.csv`: about 40 covered (4–5 per clip) plus about 10 not covered, each labeled
- [ ] `checks.json` and `templates.json` (monthly template and theme labels in Noor's language)
- [ ] Narrator voiceovers for add-ons (Preet's own voice, English)

## Phase 3: Pipeline (Bee, Colab, about 2.5 h)

- [ ] `transcribe.py` (MMS and forced alignment) on one recording; check output by hand
- [ ] `segment.py` into moments; pytest
- [ ] `translate.py` to draft subtitles; all marked unchecked
- [ ] `embed.py` and `export_model.py` (ONNX int8); record the model size
- [ ] `pack.py` in demo and production modes; pytest proves production excludes unchecked items
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
