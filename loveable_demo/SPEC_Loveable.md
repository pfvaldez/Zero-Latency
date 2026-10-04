# Feature Specification: Ask Noor (Lovable build)

**Feature Branch**: `001-ask-noor-lovable`
**Created**: 2026-10-04
**Status**: Draft
**Input**: `PRD_Loveable.md`, `20261004000000_init_ask_noor_schema.sql`

Format follows GitHub spec-kit `spec-template.md` (structure only; template fetched as a summary, not verbatim). [Likely]

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear Noor with checked subtitles (Priority: P1)

A guest picks a language, opens a stop, and plays Noor's clip with subtitles.

**Why this priority**: Core value. Everything else builds on content playing.

**Independent Test**: Seed one farm, one stop, one published checked clip, one checked subtitle (`de`). Open stop 1 as `de`; clip plays and shows the German subtitle.

**Acceptance Scenarios**:

1. **Given** a clip with `is_published` and `is_script_checked` true and a checked `de` subtitle, **When** the guest plays it in `de`, **Then** the checked `de` text is shown.
2. **Given** the same clip with an unchecked `nl` subtitle, **When** the guest plays it in `nl`, **Then** the checked source script is shown and the UI marks it as source language.
3. **Given** a clip with `is_script_checked = false`, **When** the guest lists stop clips, **Then** it does not appear.

---

### User Story 2 - Ask a question, confirm or save (Priority: P1)

A guest types a question. The app proposes a clip; the guest confirms. Below threshold the question is saved for Noor. Safety questions show a fixed card.

**Why this priority**: Core non-negotiables 3 and 4.

**Independent Test**: Submit three questions: a covered one, an uncovered one, "I was bitten by a snake". Covered: confirmation prompt, then an interaction row after "Yes". Uncovered: one `unanswered_questions` row. Snake: card shown, zero rows.

**Acceptance Scenarios**:

1. **Given** a match above threshold, **When** the guest taps Yes, **Then** one `guest_clip_interactions` row exists with `confirmed_by_guest = true` and the clip plays.
2. **Given** a match above threshold, **When** the guest taps No, **Then** the question is saved to `unanswered_questions` and no interaction row exists.
3. **Given** a match below threshold, **When** the question is submitted, **Then** it is saved and the guest sees "not sure, ask a person".
4. **Given** a safety/emergency question, **When** submitted, **Then** the guide-and-emergency card shows and nothing is stored.
5. **Given** a question containing `a@b.com`, **When** saved, **Then** the stored text contains `[REDACTED_EMAIL]`.

---

### User Story 3 - Feedback and order (Priority: P1)

A guest says what they loved and what they would change, and orders coffee. Noor confirms cash payment in person.

**Why this priority**: Source of Noor's monthly learning and sales.

**Independent Test**: Submit one `loved` and one `change_suggestion` feedback. Add an order sheet; before Noor confirms, `confirmed_coffee_orders` is empty. After Noor confirms, one row exists.

**Acceptance Scenarios**:

1. **Given** a guest, **When** feedback is submitted, **Then** a `guest_feedback` row exists with sentiment, theme and redacted note.
2. **Given** an order sheet, **When** Noor has not confirmed, **Then** no order row exists.
3. **Given** an anonymous session, **When** it inserts into `confirmed_coffee_orders`, **Then** RLS rejects it.

---

### User Story 4 - Monthly report approved and sent (Priority: P2)

At month end, counts fill a checked template; a reviewer approves; the text goes to Noor's phone.

**Why this priority**: Closes the loop (G3) but depends on stories 2 and 3 producing data.

**Independent Test**: Seed counts for 2026-10 and one checked template. Generate report: status held until approved; after approval, send is allowed; body contains only template text and counts.

**Acceptance Scenarios**:

1. **Given** an unchecked template, **When** the report is generated, **Then** it is held and cannot be sent.
2. **Given** a checked template and unapproved report, **When** send is attempted, **Then** it fails (`chk_sms_approval_before_send`).
3. **Given** a reviewer who is not the author of the data, **When** they approve, **Then** `reviewer_approved_at` is set and send is allowed.
4. **Given** a month with orders but zero interactions, **When** counts are read, **Then** the orders still appear. (Regression for bug C1.)

---

### User Story 5 - Cooperative dashboard (Priority: P2)

A reviewer signs in, sees only their farm's counts, saved questions and reports.

**Why this priority**: Needed for approval and for Noor's next recordings.

**Independent Test**: Two farms, two reviewers. Each sees only their farm.

**Acceptance Scenarios**:

1. **Given** reviewer A of farm A, **When** querying farm B's orders, **Then** zero rows return.
2. **Given** an anonymous visitor, **When** querying `farms`, **Then** `host_phone_e164` is not returned.

---

### User Story 6 - New answer loop (Priority: P3)

Noor records an answer to a saved question. It links to the question and ships in the next pack.

**Why this priority**: Demo storyline step 8.

**Independent Test**: Insert a `noor_recording` clip, set `resolved_clip_id`, publish a new `farm_packs` version; the clip is in the manifest.

**Acceptance Scenarios**:

1. **Given** a saved question, **When** a clip is linked, **Then** `resolved_clip_id` is set.
2. **Given** `voice_label = 'noor_recording'` and null `recorded_by_host_at`, **When** inserted, **Then** the CHECK rejects it.

---

### Edge Cases

- Guest offline when submitting: item stays in the local outbox; retry creates no duplicate. [NEEDS CLARIFICATION: schema has no client UUID or idempotency key; see FR-014]
- Question mixes safety words and a farm topic ("fire roasting"): current regex rejects it. [NEEDS CLARIFICATION: word list owner and test set]
- Note contains a price like `150000`: phone regex may redact it. [NEEDS CLARIFICATION: acceptable loss?]
- Language with no row in `subtitles`: fall back to source script; mark unverified.
- `is_active = false` stop or farm: hidden from guests; stored rows remain.
- Two reports for the same farm and month: blocked by `uq_farm_monthly_report`.
- Month boundary: months are UTC. Farm timezone assumed UTC. [NEEDS CLARIFICATION]

## Requirements *(mandatory)*

### Functional Requirements

Guest content
- **FR-001**: System MUST serve only clips with `is_published = true AND is_script_checked = true`.
- **FR-002**: System MUST show a translated subtitle only when `subtitles.is_checked = true`; otherwise show the checked source script and mark it.
- **FR-003**: System MUST display the voice label (`noor_recording`, `standin`, `ai_dubbed`) on every clip.
- **FR-004**: `ai_dubbed` clips MUST show "AI-dubbed" and MUST NOT be presented as the person's own words.

Ask flow
- **FR-005**: System MUST require an explicit guest tap before any matched clip plays.
- **FR-006**: System MUST save below-threshold questions to `unanswered_questions`, never play a guess.
- **FR-007**: Safety/emergency questions MUST show the fixed card and MUST NOT be stored (client check plus DB trigger backstop).
- **FR-008**: System MUST redact emails and phone numbers in `question_text` and `guest_feedback.note` before persist.
- **FR-009**: System MUST NOT request names, emails or phone numbers from guests.
- **FR-010**: Consent flags MUST be sent explicitly by the client; DB DEFAULT true MUST be removed. [NEEDS CLARIFICATION: confirm change]

Orders
- **FR-011**: A `confirmed_coffee_orders` row MUST exist only after Noor confirms payment.
- **FR-012**: Guests (anon) MUST NOT write `confirmed_coffee_orders`.
- **FR-013**: System MUST NOT process payments. [NEEDS CLARIFICATION: which device Noor confirms on]

Sync and abuse
- **FR-014**: Guest writes MUST carry a client-generated UUID and be idempotent. [NEEDS CLARIFICATION: via `ingest` Edge Function (TRD) or direct insert with `id` supplied]
- **FR-015**: Writes MUST be rate-limited per farm. [NEEDS CLARIFICATION: mechanism, Edge Function or pg]
- **FR-016**: Free-text length MUST be bounded (500 characters, as in `docs/TRD.md`).

Access control
- **FR-017**: Every table MUST have RLS enabled. (Satisfied by the migration for the 12 tables listed.)
- **FR-018**: Anon MUST NOT read `farms.host_phone_e164`.
- **FR-019**: Authenticated access MUST be scoped by farm membership and role (`admin`, `reviewer`).
- **FR-020**: Views MUST use `security_invoker = true`.
- **FR-021**: Guest reads of `monthly_sms_reports`, `confirmed_coffee_orders`, `guest_feedback`, `unanswered_questions` MUST be denied.

Reports
- **FR-022**: System MUST generate one report per farm per month from `v_farm_monthly_counts`.
- **FR-023**: Report body MUST be rendered server-side from a template with `is_checked = true` and counts only.
- **FR-024**: Report MUST NOT send without `reviewer_approved_at`, and approver MUST differ from the role that created it. [NEEDS CLARIFICATION: separation rule]
- **FR-025**: Counts MUST include months with orders or questions but no interactions.
- **FR-026**: Report MUST include per-theme feedback counts. [NEEDS CLARIFICATION: template variable names]
- **FR-027**: `guest_visit_count` MUST have a defined source. [NEEDS CLARIFICATION: count-only visit signal]

Labels and consent
- **FR-028**: Stand-ins, placeholders and synthetic records MUST be labeled in UI and data. [NEEDS CLARIFICATION: add `is_synthetic` column]
- **FR-029**: A clip with `voice_label = 'ai_dubbed'` MUST reference a `confirmed` row in `docs/CONSENT.md`. [NEEDS CLARIFICATION: store consent in DB?]
- **FR-030**: Noor's voice MUST NOT be synthesized. No `ai_*` label may attach to a clip recorded by Noor. [NEEDS CLARIFICATION: enforcement point]
- **FR-031**: ElevenLabs narrator audio MUST carry its own label. [NEEDS CLARIFICATION: add `ai_narrator` enum value]

Pack
- **FR-032**: Pack manifest MUST list only clips from `v_production_farm_pack_items`.
- **FR-033**: `farm_packs` MUST record `sha256_hash`; clients verify before use.

### Key Entities

- **languages**: `code`, host/guest flags. Seeded `wo`, `en`, `nl`, `sv`, `de`.
- **farms**: name, host, primary language. Phone MUST move out of anon reach (FR-018).
- **tour_stops**: numbered stops, unique per farm.
- **audio_clips**: script, voice label, storage path, publish and check flags, host recording timestamp.
- **subtitles**: per clip and language, `is_checked`, `checked_by`.
- **farm_packs**: versioned manifest, archive URL, hash.
- **guest_clip_interactions**: confirmed plays or matches, month bucket.
- **unanswered_questions**: redacted text, optional `resolved_clip_id`.
- **guest_feedback**: sentiment, theme (enum), redacted note.
- **confirmed_coffee_orders**: bags, GMD paid, host confirmation time.
- **sms_report_templates**: per language, checked flag, variables.
- **monthly_sms_reports**: counts, rendered body, approval, send time.
- **Proposed**: `coop_members(user_id, farm_id, role)`, `farm_private`, `consents`, `content_checks`, `is_synthetic` columns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A query as `anon` for unchecked subtitles returns 0 rows.
- **SC-002**: A query as `anon` for `host_phone_e164` returns an error or null on every farm.
- **SC-003**: A user from farm A reading farm B's orders, questions, feedback or reports returns 0 rows.
- **SC-004**: Insert of a question with an email or phone yields stored text with no email or phone pattern.
- **SC-005**: Insert of "ambulance" text into `unanswered_questions` raises an exception and stores nothing.
- **SC-006**: A report with an unchecked template cannot be marked sent.
- **SC-007**: Monthly view for a month with orders and zero interactions returns the order count.
- **SC-008**: Replaying the same outbox batch twice leaves row counts unchanged.
- **SC-009**: Every view has `security_invoker = true` (query `pg_class.reloptions`).
- **SC-010**: Matching accuracy and fail-safe rate on the held-out set come from the main-repo `docs/EVAL.md`; this build adds no numbers. [Unverified until Slice 2 runs]

## Assumptions

- Postgres 15 or later on hosted Supabase, so `security_invoker` is available. (verified 2026-10-04 via Supabase docs; project version not checked) [Unverified]
- Matching runs on device in the main repo; Lovable app calls a labeled stand-in until then.
- Currency is GMD; Noor's farm is in The Gambia (from schema comments and `docs/TRD.md`).
- Months bucket in UTC.
- SMS delivery to The Gambia is paid; price [Unverified]. Demo may log instead of send, as `docs/TRD.md` `SMS_MODE=demo`.
- No migration has been run. All findings are from reading the SQL.
