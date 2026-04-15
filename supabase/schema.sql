-- ============================================================
-- SUPABASE SCHEMA — Fitness Challenge
-- Run this in Supabase SQL Editor
-- ============================================================

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_athlete_id   BIGINT UNIQUE NOT NULL,
  name                TEXT NOT NULL,
  profile_pic         TEXT DEFAULT '',
  team_id             INTEGER,                      -- references CONFIG.TEAMS id
  access_token        TEXT,
  refresh_token       TEXT,
  token_expires_at    BIGINT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_activity_id  BIGINT UNIQUE NOT NULL,
  athlete_id          BIGINT NOT NULL REFERENCES members(strava_athlete_id) ON DELETE CASCADE,
  name                TEXT,
  sport_type          TEXT,
  distance            FLOAT DEFAULT 0,       -- meters
  moving_time         INTEGER DEFAULT 0,     -- seconds
  calories            FLOAT DEFAULT 0,
  start_date          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_athlete    ON activities(athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date);
CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type);
CREATE INDEX IF NOT EXISTS idx_members_team_id       ON members(team_id);

-- Auto-update updated_at on members
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Everyone can read (public leaderboard)
CREATE POLICY "public_read_members"    ON members    FOR SELECT USING (true);
CREATE POLICY "public_read_activities" ON activities FOR SELECT USING (true);

-- Only service role (Edge Functions) can write
CREATE POLICY "service_write_members"    ON members    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_activities" ON activities FOR ALL USING (auth.role() = 'service_role');
