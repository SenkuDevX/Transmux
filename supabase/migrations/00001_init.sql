-- TransMux v5.0 - Supabase Schema

-- Users table (synced with Clerk)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_url TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0,
  output_format TEXT,
  input_name TEXT,
  input_size BIGINT DEFAULT 0,
  output_size BIGINT DEFAULT 0,
  output_path TEXT,
  error TEXT,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Presets table
CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presets_user_id ON presets(user_id);

-- Gallery table
CREATE TABLE IF NOT EXISTS gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  filename TEXT,
  filesize BIGINT DEFAULT 0,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_gallery_user_id ON gallery(user_id);
CREATE INDEX idx_gallery_visibility ON gallery(visibility);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER presets_updated_at BEFORE UPDATE ON presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_own ON users FOR ALL USING (clerk_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY jobs_own ON jobs FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
CREATE POLICY presets_own ON presets FOR ALL USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
CREATE POLICY gallery_public_read ON gallery FOR SELECT USING (visibility = 'public' OR user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
CREATE POLICY gallery_own ON gallery FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
CREATE POLICY gallery_update_delete ON gallery FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
CREATE POLICY gallery_update_delete ON gallery FOR DELETE USING (user_id IN (SELECT id FROM users WHERE clerk_id = current_setting('request.jwt.claims')::json->>'sub'));
