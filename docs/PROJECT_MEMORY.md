# Project memory: how to set up the Claude Project

Claude doesn't silently remember corrections between sessions. Memory lives in files: this repo's `CLAUDE.md` and `tasks/lessons.md`, and the knowledge you upload to the Claude Project. Keep those current and every session starts with what the team has learned.

## 1. Paste this into the Claude Project's custom instructions

```
You are working on Ask Noor (Team Zero Latency), our entry for the World Bank "Small AI for Development" challenge, Track C: Tourism, at Hack-Nation 7. Submission is due 8:00 AM ET on October 4, 2026.

Before answering, read CLAUDE.md, tasks/lessons.md and tasks/todo.md in project knowledge. Follow the workflow rules in CLAUDE.md: plan first for anything with 3+ steps, verify before calling anything done, and add a lesson after every correction.

Non-negotiables: the core tour works offline; no AI-generated text ever reaches guests or Noor; guests confirm every match; below the threshold, questions are saved for Noor; safety questions go to the guide and emergency card; unchecked content never reaches guests; Noor decides what's recorded, sold and sent; no personal data; secrets only server-side; label every stand-in and synthetic item.

Stack: Bun 1.3 (never npm), Node 24 LTS, React 19.3, TypeScript strict, Vite, Tailwind v4, Animate UI, GSAP (one signature timeline), Transformers.js with multilingual-e5-small on device, Supabase (Postgres, RLS, Edge Functions, pg_cron), Groq only on the cooperative side with a fixed theme enum, ElevenLabs only at build time from checked text.

When unsure what the user means, state your assumption in one line or ask one question. Quote the World Bank brief exactly; never overstate it.
```

## 2. Upload these files as project knowledge

| File | Why |
|---|---|
| `CLAUDE.md` | Rules, stack, commands, definition of done |
| `tasks/lessons.md` | Corrections that must never repeat |
| `tasks/todo.md` | Current plan and progress |
| `docs/PRD.md` | What we're building and why |
| `docs/TRD.md` | How it's built: architecture, contracts, tests |
| World Bank challenge PDF (Challenge 04) | Source of truth for rules and judging |
| `Ask_Noor.pdf` (Preet's scripts) | Content source |
| `docs/EVAL.md`, `docs/DATA_CARD.md`, `docs/RESPONSIBLE_AI.md` | Add once they exist |

## 3. Session ritual

**Start of session**

1. Re-upload `tasks/lessons.md` and `tasks/todo.md` if they changed.
2. Tell Claude which phase and item you're on.

**During the session**

- When you correct Claude, say "add a lesson." Claude writes the entry; you paste it into `tasks/lessons.md`.
- When a bug is fixed, add a row to the bug log with the root cause and the test that now prevents it.

**End of session**

- Check off finished items in `tasks/todo.md`, each with a one-line proof.
- Fill in the review section for the phase.
- Commit, then re-upload the changed files to the project.

## 4. Claude Code and Copilot

- Claude Code reads `CLAUDE.md` automatically from the repo root. Keep it current.
- Copilot in VS Code reads `.github/copilot-instructions.md`. It mirrors the essentials of `CLAUDE.md`, so both assistants follow the same rules.
- When the two disagree, `CLAUDE.md` wins. Update the Copilot file to match.
