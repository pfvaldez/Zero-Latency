-- ============================================================================
-- ASK NOOR: PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Offline Farm Tour Companion & Host Feedback System
-- ============================================================================

-- 0. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & DOMAINS
-- ============================================================================

-- Voice provenance: AI-dubbed clips must always be labeled and cannot be Noor's voice
CREATE TYPE voice_label_type AS ENUM (
    'noor_recording',
    'standin',
    'ai_dubbed'
);

-- Fixed feedback themes validated on write
CREATE TYPE feedback_theme_type AS ENUM (
    'roasting_experience',
    'coffee_taste',
    'farm_walk_terrain',
    'family_hospitality',
    'beans_purchase',
    'overnight_stay',
    'other'
);

CREATE TYPE feedback_sentiment_type AS ENUM (
    'loved',
    'change_suggestion'
);

-- ============================================================================
-- 2. CONFIGURATION & CORE FARM ENTITIES
-- ============================================================================

-- Supported languages configured as rows
CREATE TABLE languages (
    code VARCHAR(10) PRIMARY KEY, -- e.g., 'wo' (Wolof), 'en', 'nl', 'sv', 'de'
    name TEXT NOT NULL,
    is_host_language BOOLEAN NOT NULL DEFAULT false,
    is_guest_language BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial draft languages
INSERT INTO languages (code, name, is_host_language, is_guest_language) VALUES
('wo', 'Wolof', true, false),
('en', 'English', false, true),
('nl', 'Dutch', false, true),
('sv', 'Swedish', false, true),
('de', 'German', false, true);

-- Member farms (multitenant baseline)
CREATE TABLE farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    host_name TEXT NOT NULL, -- e.g., 'Noor'
    host_phone_e164 TEXT NOT NULL, -- Kept in farm record, never exposed to guests
    primary_language_code VARCHAR(10) NOT NULL REFERENCES languages(code),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tour stops on each farm
CREATE TABLE tour_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    stop_number INTEGER NOT NULL CHECK (stop_number > 0),
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_farm_stop_number UNIQUE (farm_id, stop_number)
);

-- ============================================================================
-- 3. AUDIO CONTENT, SUBTITLES & PRODUCTION PACKS
-- ============================================================================

-- Audio clips recorded by the host or prepared for tours/answers
CREATE TABLE audio_clips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    tour_stop_id UUID REFERENCES tour_stops(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    source_script TEXT NOT NULL, -- Source script in host language (Wolof)
    is_script_checked BOOLEAN NOT NULL DEFAULT false,
    voice_label voice_label_type NOT NULL,
    audio_storage_path TEXT NOT NULL,
    duration_seconds NUMERIC(5, 2) NOT NULL CHECK (duration_seconds > 0),
    -- Constraint: A new answer exists only after Noor records it
    recorded_by_host_at TIMESTAMPTZ,
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraint: 'noor_recording' must have a host recording timestamp
    CONSTRAINT chk_noor_voice_recorded CHECK (
        (voice_label = 'noor_recording' AND recorded_by_host_at IS NOT NULL) OR
        (voice_label IN ('standin', 'ai_dubbed'))
    )
);

-- Checked subtitles and translations
CREATE TABLE subtitles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    audio_clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code),
    subtitle_text TEXT NOT NULL,
    is_checked BOOLEAN NOT NULL DEFAULT false,
    checked_by TEXT,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clip_language UNIQUE (audio_clip_id, language_code)
);

-- Farm packs packaged for offline download
CREATE TABLE farm_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    pack_version INTEGER NOT NULL CHECK (pack_version > 0),
    manifest JSONB NOT NULL, -- Contains list of verified clip IDs & checksums
    archive_url TEXT NOT NULL,
    sha256_hash TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_farm_pack_version UNIQUE (farm_id, pack_version)
);

-- ============================================================================
-- 4. PRIVACY, SAFETY, & INGEST REDACTION TRIGGER
-- ============================================================================

-- Function to sanitize text, redacting email addresses and phone numbers
-- Also blocks emergency and health/safety submissions from persisting
CREATE OR REPLACE FUNCTION sanitize_and_redact_guest_input()
RETURNS TRIGGER AS $$
DECLARE
    redacted TEXT;
    email_regex CONSTANT TEXT := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
    phone_regex CONSTANT TEXT := '(\+?[0-9]{1,4}[\s-]?)?(\(?[0-9]{2,5}\)?[\s-]?)?[0-9]{3,4}[\s-]?[0-9]{3,5}';
    emergency_pattern CONSTANT TEXT := '\y(emergency|police|hospital|doctor|ambulance|fire|poison|allergic|allergy|bleeding|injury|danger|snake\s*bite)\y';
BEGIN
    -- 1. Enforce emergency safety rejection if applied to questions
    IF TG_TABLE_NAME = 'unanswered_questions' THEN
        IF NEW.question_text ~* emergency_pattern THEN
            RAISE EXCEPTION 'Health, safety, and emergency questions are never stored. Direct guest to local guide immediately.';
        END IF;
        
        redacted := NEW.question_text;
        redacted := regexp_replace(redacted, email_regex, '[REDACTED_EMAIL]', 'g');
        redacted := regexp_replace(redacted, phone_regex, '[REDACTED_PHONE]', 'g');
        NEW.question_text := redacted;
    END IF;

    -- 2. Redact free-form feedback notes
    IF TG_TABLE_NAME = 'guest_feedback' AND NEW.note IS NOT NULL THEN
        redacted := NEW.note;
        redacted := regexp_replace(redacted, email_regex, '[REDACTED_EMAIL]', 'g');
        redacted := regexp_replace(redacted, phone_regex, '[REDACTED_PHONE]', 'g');
        NEW.note := redacted;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';  -- pinned: the body only uses pg_catalog functions and NEW/TG_* variables

-- ============================================================================
-- 5. GUEST INTERACTIONS & SAVED QUESTIONS
-- ============================================================================

-- Confirmed audio clip plays / question matches
CREATE TABLE guest_clip_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    audio_clip_id UUID NOT NULL REFERENCES audio_clips(id) ON DELETE RESTRICT,
    confidence_score NUMERIC(4, 3) CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    confirmed_by_guest BOOLEAN NOT NULL DEFAULT true,
    interacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    interaction_month CHAR(7) GENERATED ALWAYS AS (
        lpad(extract(year FROM (interacted_at AT TIME ZONE 'UTC'))::int::text, 4, '0') || '-' ||
        lpad(extract(month FROM (interacted_at AT TIME ZONE 'UTC'))::int::text, 2, '0')
    ) STORED,
    
    -- Matches only store confirmed interactions
    CONSTRAINT chk_match_guest_confirmed CHECK (confirmed_by_guest = true)
);

-- Questions below threshold saved for Noor's weekend recording session
CREATE TABLE unanswered_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    guest_consent_given BOOLEAN NOT NULL DEFAULT true,
    -- Connected clip once Noor records an answer
    resolved_clip_id UUID REFERENCES audio_clips(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_month CHAR(7) GENERATED ALWAYS AS (
        lpad(extract(year FROM (created_at AT TIME ZONE 'UTC'))::int::text, 4, '0') || '-' ||
        lpad(extract(month FROM (created_at AT TIME ZONE 'UTC'))::int::text, 2, '0')
    ) STORED,
    
    CONSTRAINT chk_guest_consent CHECK (guest_consent_given = true)
);

CREATE TRIGGER trg_redact_unanswered_questions
BEFORE INSERT OR UPDATE ON unanswered_questions
FOR EACH ROW
EXECUTE FUNCTION sanitize_and_redact_guest_input();

-- Guest feedback with validated enum themes
CREATE TABLE guest_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    sentiment feedback_sentiment_type NOT NULL,
    theme feedback_theme_type NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    feedback_month CHAR(7) GENERATED ALWAYS AS (
        lpad(extract(year FROM (created_at AT TIME ZONE 'UTC'))::int::text, 4, '0') || '-' ||
        lpad(extract(month FROM (created_at AT TIME ZONE 'UTC'))::int::text, 2, '0')
    ) STORED
);

CREATE TRIGGER trg_redact_guest_feedback
BEFORE INSERT OR UPDATE ON guest_feedback
FOR EACH ROW
EXECUTE FUNCTION sanitize_and_redact_guest_input();

-- ============================================================================
-- 6. ORDERS & NOOR'S MONTHLY REPORT LOOP
-- ============================================================================

-- Orders: exists only after Noor confirms cash payment in person
CREATE TABLE confirmed_coffee_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    bags_ordered INTEGER NOT NULL CHECK (bags_ordered > 0),
    cash_paid_gmd NUMERIC(10, 2) NOT NULL CHECK (cash_paid_gmd >= 0),
    confirmed_by_host_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    order_month CHAR(7) GENERATED ALWAYS AS (
        lpad(extract(year FROM (confirmed_by_host_at AT TIME ZONE 'UTC'))::int::text, 4, '0') || '-' ||
        lpad(extract(month FROM (confirmed_by_host_at AT TIME ZONE 'UTC'))::int::text, 2, '0')
    ) STORED
);

-- Checked SMS templates for host monthly summary
CREATE TABLE sms_report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES languages(code),
    -- Template variables: {month}, {guest_count}, {order_count}, {bags_count}, {saved_questions_count}
    body_template TEXT NOT NULL,
    is_checked BOOLEAN NOT NULL DEFAULT false,
    checked_by TEXT,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly SMS records sent to host's phone
CREATE TABLE monthly_sms_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    report_month CHAR(7) NOT NULL CHECK (report_month ~ '^[0-9]{4}-[0-9]{2}$'),
    template_id UUID NOT NULL REFERENCES sms_report_templates(id),
    
    -- Strict count-only metrics
    guest_visit_count INTEGER NOT NULL DEFAULT 0,
    confirmed_order_count INTEGER NOT NULL DEFAULT 0,
    confirmed_bags_count INTEGER NOT NULL DEFAULT 0,
    saved_questions_count INTEGER NOT NULL DEFAULT 0,
    rendered_body TEXT NOT NULL,
    
    reviewer_approved_by TEXT,
    reviewer_approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Reviewer approval required before SMS can be dispatched
    CONSTRAINT chk_sms_approval_before_send CHECK (
        (sent_at IS NULL) OR (sent_at IS NOT NULL AND reviewer_approved_at IS NOT NULL)
    ),
    CONSTRAINT uq_farm_monthly_report UNIQUE (farm_id, report_month)
);

-- ============================================================================
-- 7. PERFORMANCE INDEXES (PER-FARM & PER-MONTH)
-- ============================================================================

-- Fast monthly aggregate lookups
CREATE INDEX idx_interactions_farm_month ON guest_clip_interactions (farm_id, interaction_month);
CREATE INDEX idx_questions_farm_month ON unanswered_questions (farm_id, created_month);
CREATE INDEX idx_feedback_farm_month ON guest_feedback (farm_id, feedback_month);
CREATE INDEX idx_orders_farm_month ON confirmed_coffee_orders (farm_id, order_month);

-- Offline pack build query speed
CREATE INDEX idx_audio_clips_farm_published ON audio_clips (farm_id) WHERE is_published = true;
CREATE INDEX idx_subtitles_clip_checked ON subtitles (audio_clip_id) WHERE is_checked = true;

-- ============================================================================
-- 8. PRODUCTION VIEWS: CHECKED CONTENT & SUBTITLE FALLBACK
-- ============================================================================

-- Offline farm pack generator view:
-- Only includes checked scripts/subtitles. Falls back to checked source script
-- if a specific language translation is unchecked.
CREATE OR REPLACE VIEW v_production_farm_pack_items
WITH (security_invoker = true) AS
SELECT 
    c.farm_id,
    c.id AS audio_clip_id,
    c.tour_stop_id,
    c.title AS clip_title,
    c.voice_label,
    c.audio_storage_path,
    c.duration_seconds,
    l.code AS language_code,
    CASE 
        WHEN s.is_checked = true THEN s.subtitle_text
        ELSE c.source_script -- Fallback to checked source script
    END AS subtitle_text,
    CASE 
        WHEN s.is_checked = true THEN true 
        ELSE false 
    END AS is_translation_verified
FROM audio_clips c
CROSS JOIN languages l
LEFT JOIN subtitles s 
    ON s.audio_clip_id = c.id 
    AND s.language_code = l.code
WHERE c.is_published = true 
  AND c.is_script_checked = true
  AND l.is_guest_language = true;

-- Monthly summary helper query view (cheap, zero guest PII)
CREATE OR REPLACE VIEW v_farm_monthly_counts
WITH (security_invoker = true) AS
-- One row per (farm, month) that has any activity; each count joins on that key,
-- so a month with orders but no interactions (or any other mix) is never dropped.
WITH months AS (
    SELECT farm_id, interaction_month AS report_month FROM guest_clip_interactions
    UNION
    SELECT farm_id, order_month FROM confirmed_coffee_orders
    UNION
    SELECT farm_id, created_month FROM unanswered_questions
)
SELECT
    m.farm_id,
    m.report_month,
    COALESCE(i.total_interactions, 0) AS total_interactions,
    COALESCE(o.total_orders, 0) AS total_orders,
    COALESCE(o.total_bags, 0) AS total_bags,
    COALESCE(q.total_unanswered, 0) AS total_unanswered
FROM months m
LEFT JOIN (
    SELECT farm_id, interaction_month AS report_month, COUNT(*) AS total_interactions
    FROM guest_clip_interactions
    GROUP BY farm_id, interaction_month
) i ON i.farm_id = m.farm_id AND i.report_month = m.report_month
LEFT JOIN (
    SELECT farm_id, order_month AS report_month, COUNT(*) AS total_orders, SUM(bags_ordered) AS total_bags
    FROM confirmed_coffee_orders
    GROUP BY farm_id, order_month
) o ON o.farm_id = m.farm_id AND o.report_month = m.report_month
LEFT JOIN (
    SELECT farm_id, created_month AS report_month, COUNT(*) AS total_unanswered
    FROM unanswered_questions
    GROUP BY farm_id, created_month
) q ON q.farm_id = m.farm_id AND q.report_month = m.report_month;

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_clip_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_coffee_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_sms_reports ENABLE ROW LEVEL SECURITY;

-- 1. Languages: Public read-only
CREATE POLICY p_languages_public_read ON languages
    FOR SELECT TO anon, authenticated
    USING (true);

-- 2. Farms: Public read-only for active farm details (excluding host phone)
-- RLS filters rows, not columns. Column privileges hide the phone: revoke the
-- table-level SELECT (a column-level REVOKE alone is a no-op while a table-level
-- grant exists), then grant SELECT on every column except host_phone_e164.
-- Only service_role (Edge Functions) can read the phone. Clients must list
-- columns: SELECT * on farms fails with "permission denied" for anon/authenticated.
CREATE POLICY p_farms_public_read ON farms
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

REVOKE SELECT ON farms FROM anon, authenticated;
GRANT SELECT (id, name, host_name, primary_language_code, is_active, created_at, updated_at)
    ON farms TO anon, authenticated;

-- 3. Tour stops: Public read-only for active stops
CREATE POLICY p_stops_public_read ON tour_stops
    FOR SELECT TO anon, authenticated
    USING (is_active = true);

-- 4. Audio clips & Subtitles: Read-only access to published, checked items
CREATE POLICY p_clips_public_read ON audio_clips
    FOR SELECT TO anon, authenticated
    USING (is_published = true AND is_script_checked = true);

CREATE POLICY p_subtitles_public_read ON subtitles
    FOR SELECT TO anon, authenticated
    USING (is_checked = true);

CREATE POLICY p_packs_public_read ON farm_packs
    FOR SELECT TO anon, authenticated
    USING (true);

-- 5. Guest interactions: Guests can only INSERT confirmed interactions
CREATE POLICY p_interactions_guest_insert ON guest_clip_interactions
    FOR INSERT TO anon, authenticated
    WITH CHECK (confirmed_by_guest = true);

-- 6. Unanswered questions: Guests can INSERT with consent; cannot read other guests' entries
CREATE POLICY p_questions_guest_insert ON unanswered_questions
    FOR INSERT TO anon, authenticated
    WITH CHECK (guest_consent_given = true);

-- 7. Feedback: Guests can INSERT feedback; cannot read other rows
CREATE POLICY p_feedback_guest_insert ON guest_feedback
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 8. Orders: Guests CANNOT insert directly. Only authenticated hosts can record confirmed cash orders
CREATE POLICY p_orders_host_all ON confirmed_coffee_orders
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 9. Cooperative Reviewer & Host SMS Reports
CREATE POLICY p_templates_read ON sms_report_templates
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY p_monthly_reports_reviewers ON monthly_sms_reports
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
