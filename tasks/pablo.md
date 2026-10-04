# Pablo: tasks and prompts

You own `apps/web`. Don't edit `packages/core`, `supabase/` or `pipeline/` (Bee's). Read CLAUDE.md first.

## Setup (once)
- Pull main and stay on Bun 1.3.10 (don't run `bun upgrade`; 1.4 breaks our lockfile).
- Run `git config core.hooksPath .githooks`.
- Work on branch `feat/web`, rebased on main, and open a PR to main after each item.

## To-do
- [ ] 1. Guest shell (Prompt 4): pack download, stop list with QR scan and number fallback, player with subtitles and the progress animation, fun fact, recipe and farm cards, offline PWA, tests
- [x] 2. Ask flow, feedback, shop and outbox, wired to the guardrails in packages/core (Prompt 5)
- [x] 3. Swap FakeMatcher for the real e5 worker (Prompt 7, once Bee's farm pack is on main)
- [ ] 4. Point the sync client at the real ingest function (once Bee's Supabase backend is on main)
- [ ] 5. /coop dashboard (Prompt 9)
- [ ] 6. Polish: keyboard and screen-reader pass, reduced motion, Lighthouse PWA and accessibility 95+
- [ ] 7. Record demo footage with airplane mode visible, edit it with Preet's narration, export a 2–5 minute video

## Rules
- Every feature has tests. Stand-ins are labeled in demo mode. No AI calls anywhere in apps/web.
- Ping Bee before touching shared files.
- Stuck for more than 20 minutes? Post the error in Discord and move to the next item.

## Prompts (paste into Claude Code in plan mode)

### Prompt 4: Guest shell
```
Phase 4 first half: the guest app shell. Read CLAUDE.md, docs/PRD.md sections 6–7 and docs/TRD.md sections 6.2, 6.4 and 6.5. Plan:
- ServicesProvider (React context) built once in main.tsx with the interfaces from TRD 6.2. For now: FakeMatcher (labeled stand-in), DexieOutbox, LocalPackRepository reading a demo manifest from public/packs/ondera-noor/demo/, HtmlAudioPlayer, and a Scanner using qr-scanner with a manual stop-number fallback
- Zustand store for guest UI state (language, current stop, ask outcome); language persisted
- Routes: / (guest) and /coop (placeholder)
- Pack download screen with size and progress, StopList, Player with WebVTT subtitles and the GSAP progress timeline (reduced motion respected), FunFact, RecipeCard, FarmCard
- The Player shows t(lang, "labels.standInVoice", { person }) ("Voice: Preet, standing in for Noor") for every clip whose audio is listed in manifest.labels.standInVoice, and "AI-dubbed" for files in labels.aiDubbed (demo packs only); a component test covers both
- vite-plugin-pwa: precache the shell; cache the pack at download
- Animate UI Sheet for overlays; Tailwind tokens from TRD 6.5 (cyan is a fill only); WCAG 2.2 AA; subtitles at least 20 px
- Tests: component tests for StopList and Player; Playwright: download the pack, go offline, reload, play stop 1
Write the plan into tasks/todo.md and stop for approval.
```

### Prompt 5: Ask flow, feedback, shop, sync
```
Phase 4, second half, using decide, decideSafety, themeOf and i18n from packages/core. Plan mode first. Plan:
- AskService: decideSafety first (safety card, nothing stored, matcher never called), then Matcher.match, then decide(). Outcomes render ConfirmCard ("Noor talks about {topic}. Is this what you asked?"), SavedCard and SafetyCard. Yes plays the exact moment (startMs to endMs); No saves the question
- Saved questions go to the outbox with deviceTheme from themeOf()
- Feedback form (loved, change) to the outbox with themes
- Shop: product cards; an order sheet with pictures, quantities and totals Noor can read; a Noor-language line only if checked; "Noor confirms payment" before anything is stored
- SyncService: posts outbox batches to the ingest endpoint when online, with exponential backoff and a pending count; use a mock endpoint, labeled as a stand-in, until the Supabase function exists
- Demo mode (VITE_DEMO_MODE): drafts shown with labels, example questions, match score visible. Production hides all of it
- Playwright, all offline after download: confirm then play; saved (overnight question); safety card in German and Swedish with the outbox unchanged; order needs Noor's confirmation; coming back online syncs and empties the outbox
Write the plan into tasks/todo.md and stop for approval.
```

### Prompt 7: Real e5 matcher
```
Replace FakeMatcher with E5WorkerMatcher (docs/TRD.md section 6.3), behind the existing Matcher interface. Callers must not change. Plan mode first:
- apps/web/src/workers/e5.worker.ts: Transformers.js with env.allowRemoteModels = false and env.localModelPath pointing at the pack's model folder; embeds "query: <text>" with mean pooling and normalization; dot product against the pack's embedding matrix; returns the top 3
- Warm-up on pack load; timings shown in demo mode only
- FakeMatcher stays for unit tests only
- Tests: a contract test for the Matcher interface; a Playwright offline run that fails on any network request leaving the page
- Measure model size, first-load time and median query time on a throttled CPU profile, and record them in docs/EVAL.md
Stop for approval after the plan.
```

### Prompt 9: Cooperative dashboard
```
Phase 5, dashboard: /coop in apps/web, per docs/PRD.md journey 7 and FR-11 to FR-13. Plan mode first:
- Supabase Auth magic link. Only coop_members see their farm (RLS enforces it; the UI just reflects it)
- TanStack Query for reads. Pages: Insights (top loved, asked and wished-for themes with counts), unanswered questions by theme, orders, review queue (content checks, plus theme disagreements if classify exists), monthly text preview on a basic-phone mockup with held or ready status and character count, approve and send (admins only)
- Synthetic rows always show a "Simulated" label
- Tests: component tests for each page's empty and filled states; Playwright for approve-then-send in demo mode
Stop for approval after the plan.
```
