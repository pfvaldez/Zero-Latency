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

## Bug log

| Date | Bug | Root cause | Fix | Test added |
|---|---|---|---|---|
| | | | | |
