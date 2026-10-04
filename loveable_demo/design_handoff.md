# Ask Noor — Frontend Design Handoff Document (MVP)

This handoff document specifies the core screens, user flows, database integration, and authentication requirements for building the Ask Noor MVP frontend on top of Supabase and Tailwind/shadcn.

---

## 1. Product Context & Architecture Overview

Ask Noor is an offline-capable tour companion for coffee farm visits in The Gambia. 
- **Guests** use their own devices offline: listen to verified host voice clips in Wolof with checked subtitles (English, Dutch, Swedish, German), ask questions matched to clips or queued for the host, and submit in-person coffee orders and feedback.
- **Host (Noor & daughter)** logs in weekly on a smartphone to review queued questions and record voice answers.
- **Cooperative Reviewer** logs in monthly to approve the count-only template SMS report dispatched to Noor's phone.

**Auth Structure:**
- **Guest Interface:** 100% Anonymous (`anon` role). Operates offline via Service Worker / CacheStorage / IndexedDB after downloading a farm pack. No sign-up, no login, zero guest personal data.
- **Host Portal:** Authenticated (`authenticated` role, host credentials).
- **Reviewer Portal:** Authenticated (`authenticated` role, cooperative admin credentials).

---

## 2. Core User Flows (MVP)

### Flow 1: Offline Tour & Verified Audio Q&A (Guest)
1. **Download & Select Language:** Guest opens app, selects display/subtitle language (`en`, `nl`, `sv`, `de`), and downloads the farm pack once before arriving.
2. **Follow Stops:** Guest navigates through stops (1 to 7). Tapping a stop plays Noor's audio clip in Wolof while synchronized subtitles display in their language (or fallback to source script).
3. **Ask a Question:**
   - Guest types or speaks a query into the "Ask Noor" search bar.
   - Offline semantic/keyword matcher scores clips.
   - **Confidence >= Threshold:** App presents matched clip preview ("Did Noor mean this?"). Guest confirms -> plays clip -> logs confirmed interaction.
   - **Confidence < Threshold:** App displays "Ask your guide" message and asks: *"Would you like us to save this question for Noor to record an answer later?"*
   - Guest taps *"Yes, save for Noor"* -> queues unanswered question. (Emergency/health queries are blocked client-side and by backend trigger).

### Flow 2: In-Person Coffee Order & Feedback (Guest)
1. **Coffee Order Card:** Guest selects quantity of bean bags. Screen displays order confirmation in Wolof with the cash price in Gambian Dalasi (GMD) to show Noor in person.
2. **Host Confirmation:** Noor verifies cash received and marks the order confirmed.
3. **Quick Feedback:** Guest taps a sentiment (*Loved* vs. *Would Change*) and selects a fixed theme chip (e.g., *Roasting Experience*, *Coffee Taste*, *Terrain*, *Hospitality*). Optional note field is sanitized client-side before submission.

### Flow 3: Host Weekly Recording Loop (Host)
1. **Review Queued Questions:** Host logs in on mobile, views list of unanswered guest questions from recent visits.
2. **Record Answer:** Host taps *"Record Answer"*, records audio directly in browser (MediaRecorder API).
3. **Save & Tag:** Audio uploads to Supabase storage, sets `voice_label = 'noor_recording'`, associates the clip to the question, and marks it ready for transcription/translation verification.

### Flow 4: Cooperative Monthly SMS Review (Reviewer)
1. **Monthly Rollup:** Reviewer logs in, views the calculated summary for the selected farm and month (visitor count, orders, bags, saved questions).
2. **Preview Template:** Reviewer selects a checked Wolof SMS template; the screen renders the template populated with strict counts only.
3. **Approve & Send:** Reviewer approves the draft. System updates `monthly_sms_reports` with approval timestamp and triggers delivery.

---

## 3. Key Screens & Table Mappings

### Screen 1: Guest Tour Companion (`/` and `/tour`)
*Purpose:* Offline audio player, stop navigator, subtitle display, and question matcher.

- **Reads:**
  - `farms` (active farm metadata)
  - `languages` (available visitor languages)
  - `tour_stops` (ordered list of farm stops)
  - `v_production_farm_pack_items` (published clips, source scripts, and checked subtitles)
  - `farm_packs` (manifest and offline pack bundle)
- **Writes:**
  - `guest_clip_interactions` (inserts confirmed clip plays with `confirmed_by_guest = true`)
  - `unanswered_questions` (inserts questions with `guest_consent_given = true` when match score is below threshold)
- **Key UI Elements:**
  - Language selection drawer
  - Offline sync status badge ("Tour Pack Downloaded / Ready Offline")
  - Tour stop cards (Stops 1–7) with play/pause controls and audio timeline
  - Live subtitle card with verified badge and Wolof source fallback indicator
  - "Ask Noor" modal dialog with match confirmation card and consent-to-save prompt

---

### Screen 2: Coffee Order & Feedback (`/order`)
*Purpose:* In-person cash checkout card and structured guest sentiment feedback.

- **Reads:**
  - `farms` (farm name, pricing reference)
- **Writes:**
  - `confirmed_coffee_orders` (submitted only after in-person host confirmation)
  - `guest_feedback` (inserts `sentiment`, `theme`, and sanitized `note`)
- **Key UI Elements:**
  - Bag quantity counter (+ / -) with total in GMD
  - Big visual "Show Noor" card in Wolof with cash amount to show during payment
  - One-tap feedback sentiment pills (*Loved* / *Needs Change*)
  - Fixed theme selector chips (`roasting_experience`, `coffee_taste`, etc.)
  - Redaction notice: *"For your privacy, please do not include names or phone numbers."*

---

### Screen 3: Host Voice Studio (`/host`)
*Purpose:* Mobile-first interface for Noor and her daughter to record answers to visitor questions.

- **Auth Required:** `authenticated` (Host account)
- **Reads:**
  - `unanswered_questions` (where `resolved_clip_id IS NULL`)
  - `audio_clips` (existing host clips for this farm)
- **Writes:**
  - `audio_clips` (inserts new clip with `voice_label = 'noor_recording'` and `recorded_by_host_at = NOW()`)
  - `unanswered_questions` (updates `resolved_clip_id` with newly created clip ID)
- **Key UI Elements:**
  - List of unanswered guest questions sorted by date
  - In-browser microphone recorder with waveform visualization, playback check, and re-record option
  - Wolof title/script input
  - "Save to Next Pack" action button

---

### Screen 4: Cooperative SMS Reviewer Dashboard (`/reviewer`)
*Purpose:* Desktop/tablet portal for cooperative managers to verify monthly numbers and release SMS updates.

- **Auth Required:** `authenticated` (Reviewer account)
- **Reads:**
  - `v_farm_monthly_counts` (aggregate monthly counts for visitors, orders, and questions)
  - `sms_report_templates` (checked SMS templates)
  - `monthly_sms_reports` (history and pending draft reports)
- **Writes:**
  - `monthly_sms_reports` (creates monthly report row, updates `reviewer_approved_by` and `reviewer_approved_at`)
- **Key UI Elements:**
  - Month & Farm picker
  - Metric summary cards (Total Visitors, Orders Confirmed, Bags Sold, Questions Queued)
  - SMS Preview box showing rendered template text (strictly counts only, zero guest text)
  - "Approve & Dispatch SMS" confirmation button with signature badge

---

## 4. Design & State Guardrails

1. **Strict Client-Side Redaction & Safety:**
   - The question input and feedback fields must validate against emergency/medical keywords client-side, showing an immediate banner: *"For health, medical, or safety needs, please inform your tour guide right away."*
   - Strip email and phone number patterns prior to sending payloads to Supabase.
2. **Audio Provenance Badging:**
   - Every audio player component must render a clear provenance badge:
     - `noor_recording` -> *"Recorded by Noor"*
     - `standin` -> *"Tour Guide Voice"*
     - `ai_dubbed` -> *"Synthetic / AI Dubbed"* (Never displayed as Noor's voice).
3. **Offline Resilience:**
   - Use IndexedDB or localStorage to queue guest interactions and feedback when completely offline, synchronizing when network becomes momentarily available.
