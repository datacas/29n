-- Migration: 004_pilot_question_bank
-- Adds pilot_question_id column to questions table for linking JSON question bank to PostgreSQL.
-- The actual questions and positions are seeded by seed_pilot_questions.py which reads
-- questions_corrected.json and inserts into questions + positions tables.
-- Run after 001_create_tables.sql, 001_dimensions.sql, 002_demo_release.sql, 003_pilot_real_parties.sql.

-- Add pilot_question_id to questions table for linking to the JSON question bank
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pilot_question_id text UNIQUE;

-- Add evidence_jsonb column to positions to store full evidence from extracted claims
-- This allows storing multiple claims per position (one position per entity × question,
-- but multiple evidence entries in JSONB)
ALTER TABLE positions ADD COLUMN IF NOT EXISTS evidence_jsonb jsonb;

-- Add reviewed_by and reviewed_at columns for editorial audit trail
ALTER TABLE positions ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS review_note text;

-- Create index for pilot_question_id lookups
CREATE INDEX IF NOT EXISTS idx_questions_pilot_id ON questions(pilot_question_id);

-- Create index for editorial review
CREATE INDEX IF NOT EXISTS idx_positions_reviewed_at ON positions(reviewed_at) WHERE reviewed_at IS NOT NULL;