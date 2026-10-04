# CLAUDE.md: Ask Noor (Team Zero Latency)

Start every session by reading, in order: this file, `tasks/lessons.md`, `tasks/todo.md`. Then read `docs/PRD.md` and `docs/TRD.md` only for the parts your task touches.

## What we're building

Ask Noor is an offline tour companion for a small coffee-farm tourism operator, Noor. It is our entry for the World Bank "Small AI for Development" challenge, Track C: Tourism, at Hack-Nation 7 (October 3–4, 2026).

- Guests hear Noor's own recorded stories at each tour stop, with checked subtitles in their language.
- Guests ask questions. The answer is always a moment from Noor's own recordings, confirmed by the guest. If nothing fits, the question is saved for Noor.
- Guests say what they loved and what they'd change, and can order coffee to pay Noor in person.
- Noor gets a monthly text on her own phone: what guests loved, asked and wished for, plus orders. Her visitors' questions become her next product.

The brief's workflow we name in the video: **learning from visitor feedback**. The multilingual tour is how feedback is collected.

## Non-negotiables (breaking one fails the entry)

1. The core tour works fully offline after one farm-pack download. The airplane-mode e2e test must pass.
2. No AI-generated text ever reaches a guest or Noor. Guests see Noor's recordings, checked subtitles and fixed interface text. Noor's text message is a checked template filled with counts.
3. Every match is confirmed by the guest. Below the threshold, the question is saved for Noor ("not sure, ask a person"), never guessed.
4. Health, safety and emergency questions never reach the matcher. They show the fixed guide-and-emergency card and are not stored.
5. Unchecked content (translations, fun facts, recipe, Noor-language templates) never reaches guests in a production pack. Gating happens at pack build time; unchecked subtitles fall back to the checked source script.
6. Noor decides. New answers exist only when she records them. Sales count only when she confirms payment. Her monthly text is sent only after a cooperative reviewer approves it and her-language template is checked.
7. Privacy: never ask for names or contacts. Redact emails and phone numbers at ingest. Noor's text contains counts only.
8. Secrets live only in Supabase Edge Function secrets or a gitignored local `.env`. Never in the client bundle.
9. Label every stand-in, placeholder and synthetic record in the UI, data, docs and video.
10. Groq and ElevenLabs are never called at guest runtime. Groq classifies synced text into a fixed theme enum on the cooperative side, validated with Zod. ElevenLabs is used only at build time: AI dubbing and speech-to-text of recordings whose owner has a confirmed consent row, and narrator audio from checked text. Never clone or dub a person's voice without their explicit, written consent. AI-dubbed audio is always labeled 'AI-dubbed' and is never presented as the person's own words. Noor's voice is never synthesized. Consents are listed in `docs/CONSENT.md`.

## Workflow orchestration

### 1. Plan mode by default
- Enter plan mode for any non-trivial task (3+ steps or an architectural decision).
- If something goes sideways, stop and re-plan immediately. Don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs up front to reduce ambiguity.

### 2. Subagent strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration and parallel analysis to subagents.
- For complex problems, add compute through subagents.
- One task per subagent, for focused execution.

### 3. Self-improvement loop
- After any correction from the user, add the pattern to `tasks/lessons.md`.
- Write a rule for yourself that prevents the same mistake.
- Iterate on these lessons until the mistake rate drops.
- Review lessons at the start of every session.

### 4. Verification before done
- Never mark a task complete without proving it works.
- Diff behavior between main and your change when relevant.
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

### 5. Demand elegance (balanced)
- For non-trivial changes, pause and ask whether there is a more elegant way.
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution."
- Skip this for simple, obvious fixes. Don't over-engineer.
- Challenge your own work before presenting it.

### 6. Autonomous bug fixing
- When given a bug report, fix it. Don't ask for hand-holding.
- Point at logs, errors and failing tests, then resolve them.
- Zero context switching required from the user.
- Fix failing CI tests without being told how.

## Task management

1. **Plan first:** write the plan to `tasks/todo.md` with checkable items.
2. **Verify the plan:** check in before starting implementation.
3. **Track progress:** mark items complete as you go, each with a one-line proof.
4. **Explain changes:** give a high-level summary at each step.
5. **Document results:** add a review section to `tasks/todo.md`.
6. **Capture lessons:** update `tasks/lessons.md` after every correction or bug.

## Core principles

- **Simplicity first:** make every change as simple as possible. Touch minimal code.
- **No laziness:** find root causes. No temporary fixes. Senior-developer standards.
- **Minimal impact:** change only what's necessary. Avoid introducing bugs.

## Stack (decided; details and reasons in docs/TRD.md)

| Area | Choice |
|---|---|
| Package manager and scripts | Bun 1.3.x (`bun install`, `bun run`, `bunx`). Never npm, yarn or pnpm. |
| Tooling runtime | Node.js 24 LTS. Node 16 is end-of-life and must not be used. |
| Frontend | React 19.3, TypeScript strict, Vite, Tailwind CSS v4, Animate UI (shadcn CLI, Motion), GSAP 3 for the one signature timeline, Zustand, Dexie, vite-plugin-pwa, qr-scanner, TanStack Query (coop pages only) |
| On-device AI | multilingual-e5-small (ONNX, int8) through Transformers.js in a Web Worker, loaded from local pack files only |
| Backend | Supabase: Postgres with RLS, Edge Functions (Deno), Auth for cooperative staff, pg_cron |
| Cloud AI, cooperative side only | Groq with strict JSON schema output and a fixed theme enum |
| Build-time AI | Meta MMS (speech-to-text and forced alignment), NLLB-200 distilled 600M (draft subtitles), ElevenLabs (narrator audio from checked text) |
| Pipeline | Python 3.12 with uv |
| Quality | Biome, Vitest, Testing Library, Playwright (including offline), pytest |

**Bun version:** everyone uses exactly Bun 1.3.10 (the `packageManager` field in the root `package.json`, which CI also reads). Don't run `bun upgrade`: Bun 1.4 changes the lockfile format, so one teammate on 1.4 breaks `--frozen-lockfile` for everyone.

## Commands

| Task | Command |
|---|---|
| Install | `bun install` |
| Run the web app | `bun run dev` |
| Unit tests | `bun run test` |
| End-to-end tests (includes offline) | `bun run e2e` |
| Lint and format | `bun run check` |
| Type check | `bun run typecheck` |
| Supabase | We use a hosted Supabase project, not a local one: no Docker and no `bunx supabase start`. Migrations and Edge Functions go to the hosted project (Slice 3) |
| Build a farm pack | `cd pipeline && uv sync && uv run python -m asknoor.build --farm ondera-noor --mode demo` |
| Run evaluations | `cd pipeline && uv run python -m asknoor.eval --farm ondera-noor` |

## Repo map

- `apps/web`: the React PWA. Guest tour at `/`, cooperative dashboard at `/coop`.
- `packages/core`: shared TypeScript domain: types, guardrails, themes, safety lexicon, text-message templates. No React, no I/O.
- `pipeline`: Python build-time pipeline and evaluations. Produces farm packs.
- `supabase`: migrations, RLS policies, Edge Functions, seed data.
- `content`: source of truth for Noor's scripts, add-ons, checks and test questions.
- `docs`: PRD, TRD, data card, responsible-AI notes, evaluation report, demo script.
- `tasks`: `todo.md` and `lessons.md`.

## Definition of done (every task)

- Tests added or updated, and `bun run test` passes. Guardrail tests in `packages/core` still pass.
- If the guest app changed: the offline e2e passes.
- No new console errors or type errors. `bun run check` is clean.
- Behavior changes are reflected in docs.
- The todo item is checked with a one-line proof (command and result, or a screenshot path).

## Team, ownership and deadline

- **Bee (captain):** pipeline, `packages/core`, matcher worker, Supabase functions, evaluation numbers. Final calls.
- **Pablo (Philippines, 12 hours ahead of ET):** guest PWA, PWA offline behavior, cooperative dashboard UI, video editing. Covers the US-night shift.
- **Preet:** content (scripts, add-ons, checks, test questions), data card, responsible-AI section, problem evidence, presents the video, submits.
- Submit by 8:00 AM ET on October 4 (hard deadline 9:00 AM ET). Feature freeze at 4:30 AM ET.

## What the judges score (World Bank brief, section 09)

| Criterion | Weight | What it means for us |
|---|---|---|
| Built solution (Small AI fidelity) | 25% | Works end to end offline, on devices people already have |
| Development relevance and impact | 20% | Noor learns what visitors value and sells more |
| Data grounding | 15% | Every dataset named with license, size and gaps |
| Evidence it works | 15% | Real numbers from `pipeline/eval`, honest limits |
| Clarity, design, inclusivity, AI value | 15% | Why a menu, SMS or spreadsheet couldn't do this |
| Scalability and what happens next | 10% | Any farm, any language MMS and NLLB cover |
| Responsible AI, data and safety | Pass/fail | The non-negotiables above |

## Git

- No AI attribution in commits or pull requests: no Co-Authored-By trailers, no "Generated with" footers, no session links. The commit-msg hook in .githooks strips them anyway.
- The commit author is always the person running the session.

## Subagents in this repo (.claude/agents/)

- `guardrail-reviewer`: after any change to `apps/web`, `packages/core`, `supabase` or `pipeline`, and at every checkpoint. Read-only; checks the diff against the non-negotiables.
- `test-verifier`: before marking any task done and at every checkpoint. Runs install, check, typecheck, test and e2e (plus pytest if `pipeline/` changed) and reports a pass/fail table.
- `docs-researcher`: before writing config or integration code for any library in the stack. Returns the current version, the Bun or uv install command, a minimal snippet and sources.
