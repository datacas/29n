-- Migration: 001_create_tables
-- Creates all tables for the MVP

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Dimensions
CREATE TABLE dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_scoring_dimension boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Topics (hierarchical taxonomy)
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  parent_id uuid REFERENCES topics(id) ON DELETE CASCADE,
  dimension_id uuid REFERENCES dimensions(id) ON DELETE CASCADE,
  depth integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Consultations (surveys)
CREATE TABLE consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'politics',
  base_locale text NOT NULL DEFAULT 'es',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Entities (parties, coalitions, historical references)
CREATE TABLE entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'party' CHECK (type IN ('party', 'coalition', 'historical', 'institutional')),
  is_historical boolean NOT NULL DEFAULT false,
  period_label text,
  country text,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Sources (original documents)
CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'program' CHECK (type IN ('program', 'constitution', 'manifesto')),
  original_url text,
  storage_path text NOT NULL,
  sha256_hash text CHECK (sha256_hash IS NULL OR sha256_hash ~ '^[0-9a-f]{64}$'),
  license text,
  language text NOT NULL DEFAULT 'es',
  year integer,
  edition text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'reviewed', 'accepted', 'rejected')),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Source passages (extracted text with locators)
CREATE TABLE source_passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  page integer,
  article_ref text,
  literal_text text NOT NULL,
  normalized_text text,
  coordinates jsonb
);

-- Claims (extracted proposals)
CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  literal_text text NOT NULL,
  normalized_text text,
  conditions text,
  exceptions text,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'machine_checked', 'needs_review', 'ready_for_batch', 'approved', 'rejected')),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Claim evidence (links claims to passages)
CREATE TABLE claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  passage_id uuid NOT NULL REFERENCES source_passages(id) ON DELETE CASCADE,
  quote text NOT NULL,
  support_type text NOT NULL DEFAULT 'direct' CHECK (support_type IN ('direct', 'indirect', 'contextual'))
);

-- Questions (question bank)
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid REFERENCES consultations(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  canonical_text text NOT NULL,
  answer_type text NOT NULL DEFAULT 'scale' CHECK (answer_type IN ('scale', 'categorical')),
  options jsonb,
  depth_level integer NOT NULL DEFAULT 1 CHECK (depth_level BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Positions (entity stance on questions)
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES claims(id) ON DELETE SET NULL,
  value integer CHECK (value BETWEEN -2 AND 2),
  categorical_value text,
  evidence_summary text,
  conditions text,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'machine_checked', 'needs_review', 'approved', 'rejected')),
  stance_status text NOT NULL DEFAULT 'unknown' CHECK (stance_status IN ('approved', 'explicit_neutral', 'ambiguous', 'not_stated', 'unknown', 'not_comparable', 'conflicting_sources', 'conditional')),
  not_comparable_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (entity_id, question_id)
);

-- Survey releases (immutable snapshots)
CREATE TABLE survey_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'published', 'archived')),
  manifest_jsonb jsonb,
  manifest_hash text CHECK (manifest_hash IS NULL OR manifest_hash ~ '^[0-9a-f]{64}$'),
  scoring_model_id text,
  scoring_model_version text NOT NULL DEFAULT '1.0.0',
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (consultation_id, version)
);

-- Release questions (N:N)
CREATE TABLE release_questions (
  release_id uuid NOT NULL REFERENCES survey_releases(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  PRIMARY KEY (release_id, question_id)
);

-- Release entities (N:N)
CREATE TABLE release_entities (
  release_id uuid NOT NULL REFERENCES survey_releases(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  PRIMARY KEY (release_id, entity_id)
);

-- Document jobs (processing queue)
CREATE TABLE document_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'extracting', 'extracted', 'classifying', 'verifying', 'completed', 'failed_pdf', 'failed_llm', 'failed_verify', 'timeout')),
  error_message text,
  metadata jsonb,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Editorial audit log
CREATE TABLE editorial_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  description text,
  changes jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Admin credentials
CREATE TABLE admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Admin sessions (authenticated sessions only)
CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES admin_credentials(id) ON DELETE CASCADE,
  session_token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Admin OTP challenges (one-time use, separate from sessions)
CREATE TABLE admin_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES admin_credentials(id) ON DELETE CASCADE,
  challenge_id text NOT NULL UNIQUE,
  otp_hash text NOT NULL,
  attempt_token text NOT NULL UNIQUE,
  max_attempts integer NOT NULL DEFAULT 3,
  attempts_remaining integer NOT NULL DEFAULT 3,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_consultations_slug ON consultations(slug);
CREATE INDEX idx_survey_releases_status ON survey_releases(status);
CREATE INDEX idx_positions_entity ON positions(entity_id);
CREATE INDEX idx_positions_question ON positions(question_id);
CREATE INDEX idx_positions_review_status ON positions(review_status) WHERE review_status = 'approved';
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_sources_entity ON sources(entity_id);
CREATE INDEX idx_document_jobs_status ON document_jobs(status);
CREATE INDEX idx_editorial_audit_created ON editorial_audit(created_at DESC);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX idx_admin_otp_attempt ON admin_otp_challenges(attempt_token);
CREATE INDEX idx_admin_otp_expires ON admin_otp_challenges(expires_at);

-- ============================================
-- Release immutability triggers
-- ============================================

-- Trigger UPDATE: allow only draft → published (requiring manifest) and published → archived (without modifying protected fields)
CREATE OR REPLACE FUNCTION enforce_release_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Transition draft → published: require manifest_jsonb and manifest_hash
  IF OLD.status = 'draft' AND NEW.status = 'published' THEN
    IF NEW.manifest_jsonb IS NULL THEN
      RAISE EXCEPTION 'Cannot publish without manifest_jsonb';
    END IF;
    IF NEW.manifest_hash IS NULL THEN
      RAISE EXCEPTION 'Cannot publish without manifest_hash';
    END IF;
    RETURN NEW;
  END IF;

  -- Transition published → archived: only allow status change
  IF OLD.status = 'published' AND NEW.status = 'archived' THEN
    IF OLD.manifest_jsonb IS DISTINCT FROM NEW.manifest_jsonb THEN
      RAISE EXCEPTION 'Cannot modify manifest_jsonb during archiving';
    END IF;
    IF OLD.manifest_hash IS DISTINCT FROM NEW.manifest_hash THEN
      RAISE EXCEPTION 'Cannot modify manifest_hash during archiving';
    END IF;
    IF OLD.version IS DISTINCT FROM NEW.version THEN
      RAISE EXCEPTION 'Cannot modify version during archiving';
    END IF;
    IF OLD.published_at IS DISTINCT FROM NEW.published_at THEN
      RAISE EXCEPTION 'Cannot modify published_at during archiving';
    END IF;
    RETURN NEW;
  END IF;

  -- Prevent any other modification to published or archived
  IF OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'Cannot modify a published or archived release. Current status: %', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_release_immutability
  BEFORE UPDATE ON survey_releases
  FOR EACH ROW
  EXECUTE FUNCTION enforce_release_immutability();

-- Trigger DELETE: prevent deletion of published and archived releases
CREATE OR REPLACE FUNCTION prevent_release_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('published', 'archived') THEN
    RAISE EXCEPTION 'Cannot delete a published or archived release';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_release_delete
  BEFORE DELETE ON survey_releases
  FOR EACH ROW
  EXECUTE FUNCTION prevent_release_delete();

-- CHECK: manifest required when published
ALTER TABLE survey_releases
  ADD CONSTRAINT chk_published_manifest_required
  CHECK (
    status != 'published' OR
    (manifest_jsonb IS NOT NULL AND manifest_hash IS NOT NULL)
  );
