-- ============================================================
-- SUPABASE SCHEMA — GTR Fest 17
-- Run this in Supabase SQL Editor
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  team_id     INTEGER NOT NULL,
  invite_code TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id         SERIAL PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  team_id    INTEGER NOT NULL,
  max_uses   INTEGER DEFAULT 50,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT,
  sport_type        TEXT,
  distance          FLOAT DEFAULT 0,
  moving_time       INTEGER DEFAULT 0,
  calories          FLOAT DEFAULT 0,
  start_date        TIMESTAMPTZ NOT NULL,
  image_path        TEXT,
  image_hash        TEXT,
  dhash             TEXT,
  submission_method TEXT DEFAULT 'image_ocr',
  user_corrected    BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Admin passwords table (simple hashed)
CREATE TABLE IF NOT EXISTS admin_auth (
  id             SERIAL PRIMARY KEY,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_user       ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date);
CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type);
CREATE INDEX IF NOT EXISTS idx_activities_image_hash ON activities(image_hash);
CREATE INDEX IF NOT EXISTS idx_activities_dhash     ON activities(dhash);
CREATE INDEX IF NOT EXISTS idx_users_team_id         ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code     ON invite_codes(code);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_auth   ENABLE ROW LEVEL SECURITY;

-- Everyone can read (public leaderboard)
CREATE POLICY "public_read_users"        ON users        FOR SELECT USING (true);
CREATE POLICY "public_read_activities"   ON activities   FOR SELECT USING (true);
CREATE POLICY "public_read_invite_codes" ON invite_codes FOR SELECT USING (true);

-- Only service role (Edge Functions) can write
CREATE POLICY "service_write_users"        ON users        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_activities"   ON activities   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_invite_codes" ON invite_codes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_write_admin_auth"   ON admin_auth   FOR ALL USING (auth.role() = 'service_role');

-- ── SEED INVITE CODES (5 per team) ────────────────────────────

INSERT INTO invite_codes (code, team_id, max_uses) VALUES
  ('Z1-ALPHA',   1, 50), ('Z1-BRAVO',   1, 50), ('Z1-CHARLIE', 1, 50), ('Z1-DELTA', 1, 50), ('Z1-ECHO', 1, 50),
  ('Z2-ALPHA',   2, 50), ('Z2-BRAVO',   2, 50), ('Z2-CHARLIE', 2, 50), ('Z2-DELTA', 2, 50), ('Z2-ECHO', 2, 50),
  ('Z3-ALPHA',   3, 50), ('Z3-BRAVO',   3, 50), ('Z3-CHARLIE', 3, 50), ('Z3-DELTA', 3, 50), ('Z3-ECHO', 3, 50),
  ('Z4-ALPHA',   4, 50), ('Z4-BRAVO',   4, 50), ('Z4-CHARLIE', 4, 50), ('Z4-DELTA', 4, 50), ('Z4-ECHO', 4, 50),
  ('Z5-ALPHA',   5, 50), ('Z5-BRAVO',   5, 50), ('Z5-CHARLIE', 5, 50), ('Z5-DELTA', 5, 50), ('Z5-ECHO', 5, 50),
  ('Z6-ALPHA',   6, 50), ('Z6-BRAVO',   6, 50), ('Z6-CHARLIE', 6, 50), ('Z6-DELTA', 6, 50), ('Z6-ECHO', 6, 50)
ON CONFLICT (code) DO NOTHING;

-- ── DEFAULT ADMIN PASSWORD (change after deploy!) ─────────────
-- Password: admin123 — SHA-256 hash
INSERT INTO admin_auth (password_hash) VALUES
  ('240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9')
ON CONFLICT DO NOTHING;
