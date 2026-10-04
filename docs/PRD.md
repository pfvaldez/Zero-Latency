# Product Requirements Document: Ask Noor

Version 1.0, October 3, 2026. Owner: Bee (captain). Contributors: Preet, Pablo.
Challenge: World Bank "Small AI for Development," Track C: Tourism (Hack-Nation 7).

## 1. Summary

Ask Noor helps Noor, a coffee farmer who hosts six or seven visitors a month, learn what her visitors value and turn their questions into new products. Guests hear Noor's own recorded stories at each tour stop with checked subtitles in their language, ask questions that are answered only with Noor's own recordings, and say what they loved and what they'd change. Noor gets a short monthly text on her own phone summarizing it all. The guest experience works with no internet after one download.

**Problem sentence (required in the video):** Because of this tool, Noor will learn every month what her visitors loved, asked about and wished for, in their own languages, which she otherwise never finds out once they leave; we know because [evidence, with source, year and country].

## 2. Problem

From the brief (Annex C):

- Noor's farm isn't on any digital platform. Six or seven visitors a month find it by word of mouth.
- Visitors rely on a local guide to translate. Noor "has no way of knowing what value she created, what worked during the tourists' visits and what did not once they leave."
- Small operators run on instinct. They know visitors leave happy, but not why, which parts are worth building on, or how to turn a good visit into a returning customer, a referral or a new product.
- Where AI adds value, per the brief: reading a scattered set of reviews and messages and telling the operator what visitors return to, what they wish were different, and what to build next.

Evidence still to collect (Preet, with source, year and country): tourism arrivals and receipts (UN Tourism, World Development Indicators), constraints on small firms (World Bank Enterprise Surveys), phone versus smartphone ownership among women (GSMA Mobile Gender Gap).

## 3. Users

| User | Context | What they need |
|---|---|---|
| **Noor** (primary) | Speaks her local language; uses the national language with tourists when needed. Her own phone is used for calls, texts and mobile money. Her daughter's smartphone is home only on weekends. No Wi-Fi; buys 3G bundles occasionally. Her phone stays at the house while she works. | To know what visitors loved, asked and wished for, without new devices or skills. To decide what to record, change or sell. |
| **Guest** | International visitor with their own smartphone. May have little or no data at the farm. | To understand Noor's story in their language, get real answers, buy coffee, and say what they thought. |
| **Local guide** | Bilingual, already translates for visitors. | A trusted role: checks translations, handles safety questions, lends a phone with the pack to guests who need it. |
| **Cooperative reviewer** | Ondera Coffee Cooperative staff, online sometimes. | To review content checks and theme disagreements, approve Noor's monthly text, and roll the tool out to other member farms. |

## 4. Goals and non-goals

**Goals**

| ID | Goal | Measure |
|---|---|---|
| G1 | Guests understand Noor's story in their language | Subtitles available in all chosen visitor languages, all checked |
| G2 | Guests get correct answers or an honest "not yet" | Top-1 matching accuracy at least 85% on the held-out test set; false confirmations at most 5% |
| G3 | Noor learns what visitors value | Monthly text generated from synced feedback; themes agree with a human label on at least 80% of a labeled sample |
| G4 | Noor earns more | Orders recorded and confirmed by Noor; at least one product idea traced from saved questions (demo: overnight stays) |
| G5 | Works where connectivity is weak | Offline e2e passes; farm pack size and load time measured and reported |

**Non-goals**

- No chatbot and no generated answers. No live machine translation shown to guests.
- No payment processing. Guests pay Noor in person, with cash or mobile money.
- No booking system or online listing in this version. Named as a next step.
- No cloning of anyone's voice.
- No collection of names, phone numbers or emails.

## 5. Scope

| Priority | Includes |
|---|---|
| **P0 (submission)** | Farm-pack download and offline tour; stop list with in-app QR scan and number fallback; player with checked subtitles and the signature progress animation; ask flow on device (confirm, saved, safety); end-of-tour feedback; shop and order sheet with Noor's confirmation; recipe and farm cards; local outbox and sync; Supabase schema with RLS and ingest; monthly report from a checked template with "held" state; cooperative dashboard with approval; demo mode with labels; evaluation report; data card; responsible-AI section |
| **P1 (if time)** | Groq cross-check of themes with a review queue for disagreements; ElevenLabs narrator audio for add-ons in visitor languages; trimmed-vocabulary model to shrink the pack; spoken guest questions; "is it A or B?" disambiguation when two moments score close |
| **P2 (after the hackathon)** | Real SMS provider in production; online listing generated from Noor's checked stories; cooperative rollout tooling; offline local-LLM backup classifier on the cooperative laptop; mobile-money payment link |

## 6. User journeys

1. **Noor records once.** On a weekend, with her daughter's help, Noor records 8–12 short clips on the household smartphone. The cooperative runs the pipeline: transcription, translation drafts, a bilingual check, then a farm pack.
2. **Guest gets the pack.** From the booking message or a QR code at the gate, wherever there's signal, the guest downloads the pack once and sees its size and progress.
3. **Guest tours offline.** At each stop, the guest scans the stop code inside the app (or taps the stop number) and hears Noor with subtitles. Fun facts appear after relevant stops.
4. **Guest asks.** The guest types a question. The phone finds the best-matching moment and asks "Noor talks about roasting time. Is this what you asked?" Yes plays that moment. No, or low confidence, saves the question for Noor. Health or safety questions show the guide-and-emergency card.
5. **Guest gives feedback and orders.** "What did you love? What would you change?" Then the shop: the order sheet shows pictures, quantities and totals Noor can read, and Noor confirms payment.
6. **Sync.** When the guest's phone next has signal, saved items upload automatically.
7. **Noor's monthly text.** The cooperative's system groups the month's items into fixed themes and fills a checked template in Noor's language. A reviewer approves it, and Noor receives it on her own phone.
8. **The loop closes.** Many guests asked about staying overnight. Noor records an answer. The next pack includes it, and the next guest who asks hears her.

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-01 | Download the farm pack once, with size and progress shown | P0 | After download, reloading in airplane mode shows the full tour |
| FR-02 | Choose a visitor language; the choice persists | P0 | Language survives reload; interface and subtitles switch |
| FR-03 | Open a stop by in-app QR scan or by number | P0 | Scanning `NOOR-STOP-3` opens stop 3; manual entry works without a camera |
| FR-04 | Play a clip with checked subtitles; fall back to the checked source script | P0 | No unchecked text in a production pack |
| FR-05 | Ask a typed question; outcome is confirm, saved or safety | P0 | All guardrail tests pass (section 8) |
| FR-06 | Store saved questions locally with a device-assigned theme | P0 | Item appears in outbox with a client UUID |
| FR-07 | End-of-tour feedback (loved, change) | P0 | Stored in outbox with themes |
| FR-08 | Fun facts, recipe card, farm card | P0 | Only checked add-ons in production; farm card says "call or text" |
| FR-09 | Shop, order sheet, Noor confirms payment | P0 | Order stored only after Noor taps confirm; no payment processing |
| FR-10 | Sync outbox when online; idempotent; retries | P0 | Duplicate uploads create no duplicate rows; pending count shown |
| FR-11 | Cooperative sign-in and dashboard | P0 | Only signed-in cooperative members can read their farm's data |
| FR-12 | Monthly report from checked template; "held" if template unchecked | P0 | Body contains only template text and counts |
| FR-13 | Reviewer approves; send by SMS adapter (demo mode logs) | P0 | Nothing sends without approval |
| FR-14 | New answer loop: rebuild pack, guests update when online | P0 | Asking about staying overnight matches only after the new pack |
| FR-15 | Demo mode: drafts visible with labels, example questions shown | P0 | Production build hides drafts |
| FR-16 | Groq theme cross-check with review queue | P1 | Disagreements appear for a reviewer; nothing reaches guests or Noor unreviewed |
| FR-17 | ElevenLabs narrator audio for add-ons | P1 | Every clip labeled "AI narrator voice"; generated only from checked text |
| FR-18 | Trimmed-vocabulary model | P1 | Pack size reduced; matching accuracy within 2 points of the full model |

## 8. Guardrails (pass/fail requirement)

| ID | Rule | How we prove it |
|---|---|---|
| GR-1 | Answers only from Noor's recordings | No text-generation call exists in the guest app; code search and unit tests |
| GR-2 | Guest confirms every match | e2e: no clip plays after a question without a "Yes" tap |
| GR-3 | Below threshold, save, don't guess | Unit tests at, above and below threshold; eval report shows fail-safe rate |
| GR-4 | Safety questions go to a person | Multilingual safety tests (English, German, Dutch, Swedish); never stored |
| GR-5 | People check content before guests see it | Pack builder excludes unchecked items in production; test asserts it |
| GR-6 | Noor decides | Orders need her confirmation; new answers need her recording; texts need approval |
| GR-7 | Privacy | Ingest redacts emails and phone numbers; RLS denies anonymous reads; tests |
| GR-8 | Honest labels | Demo-mode labels for drafts, stand-ins and synthetic data; data card lists them |

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Offline | Core tour, ask flow, feedback and shop work in airplane mode after one download |
| Pack size | Report the measured size. P0 target at most 150 MB (side-loadable); P1 target at most 50 MB with a trimmed model |
| Latency | Question to outcome at most 800 ms median on a mid-range Android after warm-up; first model load at most 5 s |
| Devices | Android Chrome from the last two years; iOS Safari 17 or later |
| Accessibility | WCAG 2.2 AA; subtitles at least 20 px; reduced-motion respected; full keyboard and screen-reader support |
| Privacy | No personal data collected; redaction at ingest; anonymous items only |
| Security | RLS on every table; secrets only in Edge Function secrets; no service-role key in the client |
| Reliability | Outbox survives app restarts; sync retries with backoff |
| Maintainability | SOLID boundaries, strict TypeScript, unit coverage of `packages/core` at least 90% of lines |

## 10. Success metrics and evaluation (mapped to judging)

| Judging criterion | Our evidence |
|---|---|
| Small AI fidelity (25%) | Offline e2e video; pack size; on-device latency; devices people already have |
| Development relevance (20%) | Monthly text loop; orders; overnight-stay product idea from real questions |
| Data grounding (15%) | Data card: every dataset, source, license, size, and what it doesn't cover |
| Evidence it works (15%) | `docs/EVAL.md`: matching accuracy, fail-safe rate, translation scores for Wolof versus a better-supported language, transcription error rate |
| Clarity, design, AI value (15%) | "A menu only knows what Noor already thought of. Free questions reveal what she didn't." |
| Scalability (10%) | Pipeline reusable for any farm and any language MMS and NLLB cover; cooperative rollout |
| Responsible AI (pass/fail) | Guardrails table above, with tests |

## 11. Content requirements

- Noor's clips 1–7 from Preet's script, with three fixes: clip 4 names the Ondera Coffee Cooperative; clip 5 doesn't imply a meal is served; clip 7 says "we'll stay down here" rather than skipping the roasting. Clip 8 (staying overnight) is held back for the demo loop.
- Guest audio: guests hear Preet's English recordings of Noor's script as **Noor's labeled stand-in voice** (labeled in the app, the data card and the video). Noor speaks the national language with tourists, as the brief says; the stand-in stays until Noor records her own.
- Noor's language is Wolof. AI-dubbed Wolof versions of the clips (ElevenLabs, made with Preet's consent) are **labeled synthetic data**: they feed the pipeline and the Wolof evaluation, and reach guests only in demo mode until a Wolof speaker checks them. Noor's monthly text and her order line are in Wolof, checked by a Wolof speaker before they are used.
- Open conflict: the non-goal "no cloning of anyone's voice" (section 4) and non-negotiable 10 in CLAUDE.md rule out an AI dub of a teammate's voice. Preet has consented, but the captain must amend that wording before the dubbing step runs.
- Visitor languages: three or four, chosen from The Gambia's tourist-arrival data. Draft: English, Dutch, Swedish, German.
- Add-ons voiced by Preet as the narrator, never as Noor: three fun facts with sources, one recipe confirmed as Noor's, three products with Noor-set prices, one farm card.
- Test set: about 40 questions (4–5 phrasings per clip) plus about 10 Noor hasn't covered, labeled with the correct moment or "not covered."

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| No Wolof speaker found | Preet's English recordings stay as the labeled stand-in voice; Wolof text stays demo-only; Wolof evaluated on FLEURS and FLORES-200 and the AI-dubbed round trip |
| Model too large for a weak connection | Int8 now; vocabulary trimming as P1; side-load path documented |
| Time runs out | Cut list in `tasks/todo.md`, applied in order |
| Wrong match given confidently | Guest confirmation; threshold calibrated on the test set; disambiguation as P1 |
| iPhone clears saved site data after about a week of non-use | Download the pack shortly before the tour; installed home-screen app as an option |
| Model licenses (MMS and NLLB are non-commercial) | Disclosed in the data card and "what happens next" |
| Use of World Bank branding | Palette inspiration only; no logo or implied endorsement |

## 13. Open decisions

| Decision | Owner | Needed by |
|---|---|---|
| Noor's language: Wolof speaker or labeled stand-in | Preet | Before recording |
| Final visitor languages from arrival data | Preet | Before translation |
| Product prices | Preet (as Noor) | Before the shop build |
| Pack hosting: static host or Supabase Storage | Bee | Phase 3 |
| SMS provider for the demo (or log-only demo mode) | Pablo | Phase 5 |

## 14. Demo storyline (two to five minutes)

1. Problem sentence over a photo of a guest and Noor without a shared language.
2. What the AI does and why a menu, SMS or spreadsheet can't, plus the guardrails.
3. Demo with airplane mode visible: scan a stop, hear Noor with subtitles, ask about roasting and confirm, ask about staying overnight and see it saved, ask a safety question and see the card, order beans and have Noor confirm.
4. Noor's day and the tech stack: the monthly text on her own phone, the cooperative approving it, Noor recording the overnight answer, the next guest hearing it.
5. Our take on localizing AI, including honest trade-offs.
