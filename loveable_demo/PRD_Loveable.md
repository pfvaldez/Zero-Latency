# PRD: Ask Noor (Lovable build)

Version 0.1, 2026-10-04. Source: `20261004000000_init_ask_noor_schema.sql`, `docs/PRD.md`, `docs/TRD.md`, `CLAUDE.md`.
Tags: [Certain] hard evidence, [Likely] strong inference, [Unverified] not checked.

## 1. Scope of this PRD

Ask Noor = offline tour companion for a small coffee farm (host: Noor, The Gambia). This PRD covers only what the Lovable build produces: React web app + Supabase (Postgres, RLS, Edge Functions).

| In scope (Lovable) | Out of scope (stays in main repo) |
|---|---|
| Guest tour UI, ask flow UI, feedback, order sheet | Python pipeline (MMS, NLLB, ElevenLabs) |
| Cooperative dashboard, report approval | On-device e5 matcher (Transformers.js worker) |
| Supabase schema, RLS, Edge Functions | Groq theme classification (P1) |
| Demo-mode labels | Real SMS provider (P2) |

Consequence [Likely]: the Lovable app cannot prove the offline non-negotiable by itself. Matcher runs behind a labeled stand-in until the main-repo worker is wired in.

## 2. Problem

Noor hosts about six or seven visitors a month by word of mouth. Guests rely on a guide to translate. Once they leave, she does not learn what they loved, asked or wished for. (Source: World Bank brief Annex C, as cited in `docs/PRD.md`.)

Problem sentence for the video: "Because of this tool, Noor will learn every month what her visitors loved, asked about and wished for, in their own languages, which she otherwise never finds out once they leave." Evidence with source, year, country: still owed by Preet.

## 3. Users

| User | Need |
|---|---|
| Guest | Hear Noor's story in their language, ask, give feedback, order coffee. Own phone, little data. |
| Noor (host) | Monthly text on her own phone. Records new answers. Confirms cash payment in person. |
| Local guide | Handles safety questions, checks translations. |
| Cooperative reviewer | Approves monthly text, checks content. |

## 4. Goals and non-goals

| ID | Goal | Measure |
|---|---|---|
| G1 | Guests see only checked subtitles | Zero rows in guest-readable views with `is_checked = false` for translated text |
| G2 | Unknown questions saved, never guessed | Below-threshold path writes `unanswered_questions`, never plays a clip |
| G3 | Noor learns what visitors value | Monthly report row with counts, approved, then sent |
| G4 | Sales count only after Noor confirms | `confirmed_coffee_orders` rows exist only via authenticated host action |
| G5 | No personal data stored | Emails and phones redacted before persist (see 8.2) |

Non-goals: chatbot or generated answers; payment processing; booking; collecting names or contacts; cloning or dubbing any voice without written consent; synthesizing Noor's voice.

## 5. Non-negotiables mapped to the schema

| NN | Rule (CLAUDE.md) | Schema status |
|---|---|---|
| 1 | Core tour offline | Not a DB concern. `farm_packs` holds archive URL, hash, manifest. |
| 2 | No AI text to guests or Noor | Partly: `is_checked` flags exist. No gate on add-ons (no table). |
| 3 | Guest confirms every match | `chk_match_guest_confirmed` enforces, but default `true` makes consent implicit (8.3). |
| 4 | Safety questions never stored | Trigger rejects on `unanswered_questions` only. Client must also block. |
| 5 | Unchecked content never in production pack | `v_production_farm_pack_items` falls back to source script. Only covers clips and subtitles. |
| 6 | Noor decides | Orders and reports: authenticated only, but no role split (8.1). |
| 7 | Privacy | **Broken**: host phone readable by anon (8.1). |
| 8 | Secrets only in Edge Function secrets | Not in schema. |
| 9 | Label stand-ins and synthetic data | `voice_label` covers voice. No `is_synthetic` anywhere. |
| 10 | Groq/ElevenLabs never at guest runtime; consent | No consent link. No label for narrator voice (8.4). |

## 6. User journeys

1. Noor records clips on a weekend. Cooperative builds a pack (`audio_clips`, `subtitles`, `farm_packs`).
2. Guest downloads the pack once.
3. Guest tours offline, hears clips with subtitles.
4. Guest asks a question. Confirmed match writes `guest_clip_interactions`. Below threshold writes `unanswered_questions`. Safety shows the fixed card, stores nothing.
5. Guest gives feedback (`guest_feedback`) and orders. Noor confirms cash (`confirmed_coffee_orders`).
6. Outbox syncs when online.
7. Month end: counts fill a checked template (`sms_report_templates`), reviewer approves, text is sent (`monthly_sms_reports`).
8. Saved questions become Noor's next recordings. Next pack includes them.

## 7. Requirements summary

P0: pack download and offline tour; stop list; player with checked subtitles and source-script fallback; ask flow with confirm/saved/safety; feedback; order sheet with host confirmation; outbox sync; schema with RLS; monthly report with approval; cooperative dashboard; demo-mode labels.
P1: theme cross-check (Groq); narrator audio; disambiguation.
P2: real SMS provider; online listing; mobile-money link.

Detailed, testable requirements: `SPEC_Loveable.md`.

## 8. Schema review

Read from SQL only. Nothing was executed against a database. [Certain] means the finding follows directly from the SQL text.

### 8.1 Blockers (break a non-negotiable)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | `farms.host_phone_e164` is readable by anon | Policy `p_farms_public_read` is row-level (`is_active = true`). The comment "excluding host phone" has no effect. Supabase has no column-level security; use column grants or move the field. (verified 2026-10-04, [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security.md), [DEV: column-level security](https://dev.to/jdgamble555/supabase-needs-column-level-security)) [Certain] | Move phone to `farm_private(farm_id, host_phone_e164)` with authenticated-only RLS, or `REVOKE SELECT` on table and `GRANT SELECT (cols)` to anon. |
| B2 | Any authenticated user can read and write every farm's orders and reports | `p_orders_host_all`, `p_monthly_reports_reviewers`, `p_templates_read` all `USING (true)`. No farm scoping. [Certain] | Add `coop_members(user_id, farm_id, role)` and `is_member(farm_id)` as in `docs/TRD.md` 6.6. Scope every policy. |
| B3 | Reviewer can approve their own report; no role separation | `reviewer_approved_by` is free text, any authenticated user can UPDATE. [Certain] | Role column; only `reviewer` sets approval; `approved_by` becomes `uuid references auth.users`. |
| B4 | Report can be sent with an unchecked template | `chk_sms_approval_before_send` checks approval only. `template_id` may point to `is_checked = false`. `rendered_body` is unvalidated. [Certain] | Trigger: on insert/update, require `template.is_checked`; recompute `rendered_body` from counts server-side. |
| B5 | Views may bypass RLS | Views run with owner rights by default. `security_invoker = true` is available on Postgres 15 and later. (verified 2026-10-04, [Supabase RLS docs](https://supabase.com/docs/guides/auth/row-level-security), [kitemetric](https://kitemetric.com/blogs/supabase-views-a-supabase-security-deep-dive)) Neither view sets it. [Certain] | `CREATE VIEW ... WITH (security_invoker = true)`. `v_farm_monthly_counts` should also be unreachable by anon. |

### 8.2 Correctness bugs

| # | Finding | Effect |
|---|---|---|
| C1 | `v_farm_monthly_counts` joins `o` on `o.month_bucket = i.month_bucket`, `q` on `COALESCE(...)`. | Months with orders or questions but no interactions are mis-joined or dropped. [Certain] |
| C2 | `guest_visit_count` has no source table. Interactions are not visits. | Monthly text would report wrong "guests". Needs a count-only visit signal. [Certain] |
| C3 | Emergency regex includes `fire` and `danger`. | "Wood fire roast" question is rejected and not saved for Noor. [Certain] |
| C4 | Phone regex matches any digit run of about six or more. | Prices and quantities in notes get redacted. [Likely] |
| C5 | Redaction trigger covers `guest_feedback.note` but safety rejection covers only `unanswered_questions`. | Safety text in feedback notes is stored. [Certain] |
| C6 | `uuid-ossp` loaded; `gen_random_uuid()` from `pgcrypto` already used elsewhere in the stack. | Redundant extension. Minor. |
| C7 | No `updated_at` trigger on tables that have the column. | Column never changes. Minor. |

### 8.3 Consent and abuse

| # | Finding |
|---|---|
| A1 | `confirmed_by_guest` and `guest_consent_given` default `true` and are CHECKed `true`. They carry no information; consent is implicit. Make the client send them explicitly (drop DEFAULT). [Certain] |
| A2 | Anon can INSERT into `guest_clip_interactions`, `unanswered_questions`, `guest_feedback` for any `farm_id`, with no idempotency key. Offline outbox retries duplicate rows; anyone can spam counts. `docs/TRD.md` routes this through an `ingest` Edge Function with client-generated UUIDs. [Certain] |
| A3 | `WITH CHECK (true)` on feedback: no length limit on `note`. [Certain] |

### 8.4 Gaps against project docs

| # | Gap |
|---|---|
| D1 | Voice labels: `ai_dubbed` means dubbing a person. ElevenLabs narrator audio (TRD 6.8) needs its own label, e.g. `ai_narrator`. [Likely] |
| D2 | No link from `ai_dubbed` clips to `docs/CONSENT.md`. Nothing blocks a dubbed clip without a `confirmed` consent row. [Certain] |
| D3 | Nothing blocks `voice_label = 'ai_dubbed'` or `standin` on a clip recorded as Noor's. NN10: Noor's voice is never synthesized. [Likely] |
| D4 | No `is_synthetic` flag on guest tables (NN9). `docs/TRD.md` has it. [Certain] |
| D5 | No tables for matcher moments, add-ons (fun facts, recipe, products), test questions, or `content_checks`. NN5 gating covers clips only. [Certain] |
| D6 | Theme data: `guest_feedback.theme` is NOT NULL, set by whom? `unanswered_questions` has no theme. No `device_theme` / `final_theme` split. CLAUDE.md says Groq classifies on the cooperative side. [Certain] |
| D7 | SMS template variables are counts of visits, orders, bags, saved questions. CLAUDE.md promises "what guests loved, asked and wished for". Add per-theme counts. [Certain] |
| D8 | No stop-level plays. Monthly text cannot say which stop guests replayed. [Likely] |
| D9 | `farms.primary_language_code` and `languages.is_host_language` can disagree. Host-language template for Noor's text is not tied to a checked Wolof row. [Likely] |

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Privacy | No names or contacts collected; redaction before persist; Noor's text contains counts only |
| Security | RLS on every table; no service-role key in client; secrets in Edge Function secrets or gitignored `.env` |
| Accessibility | WCAG 2.2 AA; subtitles at least 20 px (from `docs/PRD.md`) |
| Reliability | Idempotent sync; outbox survives restart |
| Cost | Free tier first. SMS delivery to The Gambia: price [Unverified]; flag before adoption. |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Lovable app cannot show true offline | Keep e2e airplane-mode proof in the main repo; label Lovable demo as demo |
| Phone leak (B1) ships | Fix B1 before any public deploy |
| Lovable generates client code that calls the DB directly with anon | Route writes through `ingest` (A2) |
| Cross-farm data exposure (B2) | Membership table before second farm is added |

## 11. Open decisions

| Decision | Owner |
|---|---|
| Fix schema in a new migration or document only | Captain |
| Where Noor confirms orders: her phone, a coop reviewer, or the guide's device | Preet, as Noor |
| Source of `guest_visit_count` | Captain |
| Pack hosting: Supabase Storage or static host | Captain |
| SMS provider for demo, or log-only | Pablo |
