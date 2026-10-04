# Zero-Latency
Repo for Zero Latency's HackNation 7 submimission. Contributors: Bee, Preet and Pablo


# Ask Noor
 
**Noor's farm, in her own voice.** An offline tour guide that answers visitors only with Noor's own recordings, and tells her every month what they loved, asked about and wished for.
 
Built at Hack-Nation 7 (October 3–4, 2026) for the World Bank challenge "Small AI for Development," Track C: Tourism. Team Zero Latency.
 
## The problem
 
Noor, the fictional farmer from the World Bank brief, grows coffee on 2 hectares in the Ondera highlands and hosts six or seven visitors a month. She and her guests don't share a language, so a local guide translates. Once visitors leave, she has no way of knowing what they valued, what worked and what didn't.
 
Her constraints shape every design choice. Her own phone is used for calls, texts and mobile money. Her daughter's smartphone is home only on weekends. There's no Wi-Fi, and data bundles are bought only when needed.
 
## What Ask Noor does
 
1. **Noor records her stories once.** In this prototype, a teammate's voice stands in for hers, and it's labeled everywhere.
2. **Guests download the farm pack once, then tour offline.** At each stop they scan a code, or tap the stop number, and hear Noor with subtitles in their language.
3. **Guests ask questions.** The phone finds the moment where Noor answers, asks "Is this what you asked?", and plays it only after the guest taps Yes. If it isn't sure, the question is saved for Noor. Health and safety questions go straight to a guide-and-emergency card.
4. **Guests share feedback and can order coffee.** They say what they loved and what they'd change. Noor confirms any payment in person.
5. **Noor gets a monthly text on her own phone.** When a guest's phone next has signal, saved items sync. The text covers what guests loved, asked and wished for, with counts only and no names.
6. **Her visitors' questions become her next product.** When many guests ask about staying overnight, Noor records an answer, and the next guest who asks hears it.
## How the AI works
 
### On the guest's phone, fully offline
 
| | |
|---|---|
| Model | multilingual-e5-small (Microsoft, MIT license) |
| Size | About 118M parameters, 384-dimension embeddings, compressed to int8 ONNX |
| Runtime | Transformers.js in a Web Worker, loaded from the farm pack. No network requests after the one-time download |
| Job | Match a typed question to the right moment in Noor's recordings |
 
**It writes nothing.** It turns the guest's question (with a `query: ` prefix) and each clip moment (with a `passage: ` prefix) into embeddings, then picks the closest moment by cosine similarity. It can't invent an answer. The worst it can do is pick the wrong clip, and the guest's confirmation and the confidence threshold catch that.
 
### Guardrails: plain code, not AI (`packages/core`)
 
- **`decideSafety()`** checks every question first against a lexicon in English, German, Dutch and Swedish. Health and safety questions show the guide-and-emergency card, are never stored, and never reach the matcher.
- **`decide()`** saves the question for Noor when the best score is below the calibrated threshold. It never guesses.
- **Guest confirmation:** no clip plays without the guest's Yes.
- **Checked content only:** a production pack contains only content a person has checked. Drafts appear only in demo mode, labeled.
- **`redact()`** removes emails and phone numbers before anything is stored.
- **`fillTemplate()`** builds Noor's monthly text only from a checked template plus counts.
### Honest limits
 
- e5 is strong in widely used languages and weak in Wolof. Guests ask in their own languages, so Wolof is used where Noor reads it (her monthly text and the order line) and is measured in the pipeline. See `docs/EVAL.md`.
- The int8 model gives slightly different vectors on different machines, so the threshold is re-checked with vectors made in the browser.
- The German, Dutch, Swedish and Wolof text are machine drafts until native speakers check them. Until then, production mode falls back to Noor's checked English.
### Models used only at build time, never on a guest's phone
 
| Model | What it does | License |
|---|---|---|
| NLLB-200 distilled 600M (Meta) | Translation drafts for subtitles and templates, checked by people before guests see them | CC-BY-NC 4.0 |
| MMS (Meta) | Wolof speech recognition for the evaluation | CC-BY-NC 4.0 |
| ElevenLabs | AI-dubbed Wolof versions of the stand-in recordings, and English transcription for subtitle timing, only with the speaker's confirmed consent | Commercial service |
 
A Groq-based cross-check of feedback themes is planned as a next step.
 
## Evaluation
 
The full report is `docs/EVAL.md`, regenerated with `bun run eval`.
 
| Metric (synthetic questions, 116 in four languages) | Held-out result |
|---|---|
| Safety questions sent to the safety card | 16 of 16, with no ordinary question diverted |
| Top-1 accuracy, questions Noor can answer | 91.1% (95% interval 81% to 96%; 56 questions) |
| False confirmations | 3.0% (3 of 100; 1% to 8%) |
| Coverage (guest gets the right confirm card) | 73.2% (41 of 56; 60% to 83%) |
| Questions Noor never answers that were saved, not matched | 97.7% |
| Model files in the farm pack | 44.3 MB with the trimmed vocabulary, against 135.4 MB for the full model, with the same held-out top-1 |
| Wolof machine translation (NLLB, FLORES-200 chrF) | English to Wolof 23.9, English to German 62.5 (300 sentences) |
| Wolof speech recognition (MMS on FLEURS) | 38.2% word error rate, 12.0% character error rate (100 utterances) |
| Round trip on the 8 AI-dubbed Wolof clips | chrF 15.3 (n = 8): the dubbed Wolof is unverified |

"Held-out" means the match threshold (0.8675) is tuned on one half of the question slots and reported on the other half, then the halves swap, so no number was measured on the data that chose the threshold. The intervals are wide because there are only 116 synthetic questions. They were written by the team, not by guests, and German, Dutch and Swedish were not checked by native speakers. The in-sample numbers, the effect of the index-only phrasings, the timings and the limits are in `docs/EVAL.md`.

## Tech stack
 
| Layer | Tools |
|---|---|
| Package manager and runtime | Bun 1.3.10 (pinned), Node 24 LTS |
| Guest app | React 19.3, TypeScript 6 (strict), Vite 8, Tailwind CSS v4, Animate UI (shadcn with Radix, plus Motion), GSAP, Zustand, Dexie, vite-plugin-pwa, qr-scanner |
| Typeface | Atkinson Hyperlegible Next, self-hosted so it works offline |
| On-device AI | Transformers.js with multilingual-e5-small (int8 ONNX) in a Web Worker |
| Backend | Supabase: Postgres with row-level security, Edge Functions on Deno, Auth, pg_cron. Twilio trial for the demo SMS |
| Pipeline | Python 3.12 with uv (NLLB, MMS, audio prep with ffmpeg). TypeScript pack builder and evaluation |
| Quality | Biome, Vitest, Testing Library, Playwright (including an airplane-mode test), pytest, GitHub Actions CI |
 
## How we built it
 
| Tool | What we used it for |
|---|---|
| Claude Code | Main coding agent, with project subagents: `guardrail-reviewer`, `test-verifier` and `docs-researcher` |
| GitHub Copilot | Second opinions and debugging |
| Perplexity | Sourced research for facts and evidence |
| Graphify | A map of the codebase for navigation |
| Lovable | Screen sketches only. Nothing ships without review and tests |
 
Every change goes through a pull request with CI and a guardrail review.
 
## Data, consent and labels
 
- **Noor is fictional**, from the World Bank brief. Her clips are voiced by teammate Preet Patel as a disclosed stand-in, and the player says so: "Voice: Preet, standing in for Noor."
- **The Wolof versions are AI-dubbed** with ElevenLabs, with Preet's written consent. They're labeled "AI-dubbed" and appear only in demo mode until a Wolof speaker checks them.
- **The test questions are synthetic** and labeled as such.
- **Audio isn't in git**, because the repo is public. The real farm pack is built locally. A tiny synthetic fixture pack (generated tones) lets CI and the offline tests run without it.
- Consent records are in `docs/CONSENT.md`. Every dataset and model is listed in `docs/DATA_CARD.md`.
## Run it
 
```bash
git config core.hooksPath .githooks   # once per clone
bun install
bun run dev          # guest app
bun run test         # unit tests
bun run e2e          # Playwright, including the airplane-mode test (needs the model in the fixture pack, see tasks/HANDOFF.md)
bun run check        # Biome
bun run typecheck
bun run eval         # regenerates docs/EVAL.md
bun run pack:build --mode demo   # needs the real audio and confirmed consent rows
```
 
Requirements: Bun 1.3.10 (Bun 1.4 writes a lockfile 1.3.10 can't read), Node 24, and Python 3.12 with uv for the pipeline.
 
## Repository layout
 
```
apps/web        guest app and the /coop dashboard
packages/core   guardrails, contracts and interface text (no AI)
pipeline        Python: translation drafts, Wolof evaluation, audio prep
content         Noor's script, add-ons and test questions (audio is gitignored)
supabase        database migrations and Edge Functions
docs            PRD, TRD, EVAL, CONSENT, DATA_CARD
tasks           build plan, lessons and team tasks
```
 
## Status
 
| Part | Status |
|---|---|
| Guardrails (`packages/core`) | Done |
| Content, audio prep and test questions | Done |
| Translation drafts, farm pack and evaluation | Done |
| Wolof evidence and a smaller model | Done: measured (`docs/EVAL.md`); 44 MB trimmed model as a private GitHub Release asset |
| Guest app | Demo path built: pack download, stops, stop links and QR scanner, player, ask, feedback, shop, offline PWA, airplane-mode test. Not built: sync, pack updates, polish. The real-audio pack waits for a consent row |
| Backend and dashboard | Not started: nothing in the repository yet |
| Monthly text and reviewer approval | Not started (checked template and held-report logic exist in `packages/core`) |

## Team
 
- **Bhagyasri Uddandam**, AI and data
- **Pablo Valdez**: app and backend
- **Preet Patel**: content, research and the video
## Licenses and credits
 
- multilingual-e5-small is MIT licensed. NLLB-200 and MMS are CC-BY-NC 4.0, so they're limited to non-commercial use, and a commercial rollout would need other models or licenses.

 
