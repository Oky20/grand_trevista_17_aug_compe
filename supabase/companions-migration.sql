-- ============================================================
-- COMPANIONS MIGRATION — group activity bonus
-- Run once in Supabase SQL Editor against the live DB
-- ============================================================

ALTER TABLE activities ADD COLUMN IF NOT EXISTS companions UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_activities_companions ON activities USING GIN (companions);
