# tasks/lessons.md

Read at the start of every session. After any correction or bug, add an entry: what happened, the rule that prevents it, and how to check. Keep rules short and testable. Delete a rule only when it's replaced by a better one.

## Rules (quick list)

1. Confirm the current date and time from the user's screen or the system before giving schedule advice.
2. When a name, role or feature reference is ambiguous, ask or state the assumption in one line before planning around it.
3. Quote the brief exactly. Never strengthen a claim beyond what the source says.
4. Check every design against the brief's four rules before proposing it.
5. Read the actual challenge document before designing for a sponsor.
6. Check cadences and volumes against numbers in the brief.
7. After a pivot, list every artifact the old plan produced and mark what must be rewritten.
8. No generated text ever reaches guests or Noor. Fixed lists and checked templates only.
9. Verify runtime and library versions against current LTS and stable releases before writing them into docs.
10. Label every stand-in, placeholder and synthetic item, everywhere.
11. Compute deadlines from official times (the dashboard), not estimates.
12. Keep the setting consistent: language, country and data sources must match.
13. Before adding a teammate: confirm the registration email, acceptance, age eligibility (18–35 for the World Bank track) and what they will build.
14. Respect platform limits when drafting messages (Discord: 2,000 characters).
15. Check text-color contrast before choosing brand colors for text.
16. Shell commands must check location and inputs first and stop on failure; run git only after `git rev-parse --show-toplevel` shows the project.
17. Write shell commands for zsh; find files with `find` and quoted patterns, never bare globs that may match nothing.
18. When a file is found by search, take the newest match and verify its contents before using it.
19. When a new approach replaces an old one, say which steps to stop using and give one path at a time.
20. Tell research subagents to write only to the scratchpad, run `git status` after every research batch, and choose the local scope when approving "always allow".
21. Start every shell command with `cd <repo root> &&`, or use `--cwd`: a `cd` in one call stays in effect for the next.
22. Never cut real functionality to save time without the captain's sign-off; sequence it into vertical slices instead. Labels for unchecked content are honesty, not mocks.

## Entries

### L-001: Wrong day assumed
- **What happened:** Planning advice said "Friday night" and "tomorrow" when it was already Saturday, 45 minutes before kickoff (the user's Luma page showed it).
- **Rule:** Confirm the date and time from the user's screen or the system before giving any schedule.
- **Check:** Every schedule message names the current time it's based on.

### L-002: Ambiguous name treated as known
- **What happened:** "Nadha" was assumed to be Norah.
- **Rule:** If a name doesn't match a known person, state the assumption in one line or ask.
- **Check:** No plan depends on an unconfirmed identity.

### L-003: Feature reference misread
- **What happened:** "Preet will only give the voiceover" was read as voicing Noor's clips, and the language plan was changed. She meant the add-ons (fun facts, recipe, product cards).
- **Rule:** When a statement could apply to two features, confirm which one before redesigning anything.
- **Check:** Restate the change in one sentence before acting on it.

### L-004: Overstated the brief
- **What happened:** Noor's own phone was called a "basic phone." The brief only says her daughter's phone is a smartphone; Noor's is used for calls, texts and mobile money.
- **Rule:** Quote the brief exactly. Mark inferences as inferences.
- **Check:** Every claim about the brief can point to a page and a sentence.

### L-005: Proposed ideas that broke the rules
- **What happened:** An offline translator on a Raspberry Pi was entertained, but the brief requires a device the user already has. A Databricks plus World Bank combination was proposed before the challenge PDFs were read; the real briefs pulled in opposite directions (cloud agent lab versus offline small AI).
- **Rule:** Check every idea against the four rules (device, offline, small model, local language), and read the actual challenge document before designing for a sponsor.
- **Check:** A rules table accompanies every proposed idea.

### L-006: Cadence didn't match volume
- **What happened:** Noor's summary was planned as weekly, but the brief says six or seven visitors a month, so weekly texts would usually be empty.
- **Rule:** Check cadence and thresholds against volumes in the brief.
- **Check:** State the expected count per period next to any cadence.

### L-007: Stale artifacts after a pivot
- **What happened:** The video script was written for the farming idea; after the switch to tourism it was out of date.
- **Rule:** After a pivot, list every artifact produced so far and mark what needs rewriting.
- **Check:** `tasks/todo.md` has an item for each stale artifact.

### L-008: Deadline estimated instead of read
- **What happened:** Build time was given as "about 22 hours" from a hub page; the dashboard showed a 12:00 PM ET start and a 9:00 AM ET deadline, which is 21 hours.
- **Rule:** Compute deadlines from the official dashboard times.
- **Check:** Deadlines are quoted with their source.

### L-009: End-of-life runtime requested
- **What happened:** Node.js 16 was requested "to avoid security issues," but it's end-of-life and gets no security fixes. Node 24 is the Active LTS today.
- **Rule:** Verify versions against current LTS and stable releases before writing them into docs.
- **Check:** The TRD stack table cites the version source and date.

### L-010: Brand color fails contrast for text
- **What happened:** World Bank bright blue `#009FDA` on white is about 3:1, which fails WCAG AA for body text.
- **Rule:** Check contrast before using a brand color for text. Use navy text on cyan fills.
- **Check:** Contrast ratios recorded next to each text and background pair.

### L-011: Prototype stand-ins must be labeled
- **What happened:** The first prototype matched questions with a keyword list instead of the e5 model.
- **Rule:** Any stand-in must be labeled in the UI (demo mode), in the docs and in the video until it's replaced.
- **Check:** `manifest.labels.standIn` is empty in the production pack.

### L-012: Git ran in the home folder
- **What happened:** Setup commands assumed paths; a failed `cd` made git run in the home folder, which was an accidental repo.
- **Rule:** Shell commands must check location and inputs first and stop on failure; run git only after `git rev-parse --show-toplevel` shows the project.
- **Check:** Before any git command, `git rev-parse --show-toplevel` prints the project folder, not the home folder, and steps are joined with `&&` so nothing runs after a failed `cd`.

### L-013: Bare glob aborted in zsh
- **What happened:** A glob aborted with "no matches found".
- **Rule:** Write shell commands for zsh; find files with `find` and quoted patterns, never bare globs that may match nothing.
- **Check:** Every file search looks like `find <folder> -name '<pattern>'`, with the pattern in quotes.

### L-014: Old file picked from a search
- **What happened:** An old zip from `~/files` was copied.
- **Rule:** When a file is found by search, take the newest match and verify its contents before using it.
- **Check:** Matches are sorted newest first by modification time without bare globs (see L-013), and the expected contents are verified before copying (for a zip, `unzip -l` lists the expected files).

### L-015: Superseded steps run again
- **What happened:** Superseded download commands were run again.
- **Rule:** When a new approach replaces an old one, say which steps to stop using and give one path at a time.
- **Check:** A message that replaces earlier steps opens with a "Stop using" line naming them, then gives a single numbered path.

### L-016: Research left files in the repo and rules in shared settings
- **What happened:** Research subagents downloaded a web page into the repo root, and "always allow" approvals during the research saved 36 permission rules into the tracked `.claude/settings.json`, two of them very broad (`python3 -c` and `gh pr *`).
- **Rule:** Tell every research subagent to write only to the scratchpad, run `git status` after each research batch, and approve "always allow" at the local scope.
- **Check:** `git status` is clean before the first commit, `.claude/settings.json` has no diff, and the rules live in `.claude/settings.local.json`, which `.gitignore` covers.

### L-017: Shell directory leaked between commands
- **What happened:** A `cd apps/web` in one shell call stayed in effect, so the next commands ran in the wrong folder.
- **Rule:** Start every shell command with `cd <repo root> &&`, and run package-manager commands with `--cwd` instead of `cd`.
- **Check:** Every command begins with the `cd` to the repo root, or uses `--cwd`.

### L-018: Re-plan cut real functionality without asking
- **What happened:** A re-plan to save time dropped the Python pipeline, Groq and the live SMS without asking the captain.
- **Rule:** Never cut real functionality to save time without the captain's sign-off; sequence it into vertical slices instead. Labels for unchecked content are honesty, not mocks.
- **Check:** A scope change names what is kept and what moves later, and gets the captain's yes first.

## Bug log

| Date | Bug | Root cause | Fix | Test added |
|---|---|---|---|---|
| 2026-10-03 | `theme.css?raw` was an empty string in Vitest | Vitest replaces every CSS file with an empty string unless `test.css.include` matches it, `?raw` imports included | `css: { include: [/\.css\?raw$/] }` in `apps/web/vitest.config.ts` | `theme.test.ts` and `cyan-rule.test.ts` read the real CSS; a deliberately bad token fails them |
| 2026-10-03 | `bun add react@19.3 --exact` saved `"19.3"`, not an exact version | Bun saves a partial range literally | Re-added with full versions (the lockfile pinned them either way) | None; `apps/web/package.json` shows exact versions |
| 2026-10-03 | The generated Animate UI Button used cyan text (`link`) and the decorative border (`outline`) | Vendored classes assume shadcn's default tokens, not our contrast rule | Edited our copy, documented at the top of the file | `cyan-rule.test.ts` scans all source; `theme-pairs.ts` records every pair's ratio |
| 2026-10-03 | The offline guard accepted `http://localhost:41730` | It matched the origin with `startsWith` | Compare `new URL(url).origin` | A control run with a lookalike link makes `e2e/smoke.spec.ts` fail |
| 2026-10-03 | A test in `packages/core/test/` (the TRD's location) would have been skipped | Core's Vitest and tsconfig included only `src/` | Include `test/` in both | A control run: a test and a type error in `test/` are picked up |
