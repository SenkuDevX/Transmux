-- Transmux Supabase Migration
-- Creates the jobs table for storing conversion job metadata

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  source_url TEXT,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  download_url TEXT,
  cloudinary_public_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for job operations
CREATE POLICY "Allow anonymous reads" ON jobs
  FOR SELECT USING (true);

CREATE POLICY "Allow anonymous inserts" ON jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous updates" ON jobs
  FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous deletes" ON jobs
  FOR DELETE USING (true);

-- Function to clean up expired jobs (for scheduled cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_jobs()
RETURNS TABLE(deleted_job_id TEXT) AS $$
DECLARE
  expired_job RECORD;
BEGIN
  FOR expired_job IN
    SELECT job_id, cloudinary_public_id
    FROM jobs
    WHERE status = 'completed'
      AND expires_at < NOW()
  LOOP
    -- Mark as expired
    UPDATE jobs SET status = 'expired' WHERE job_id = expired_job.job_id;
    deleted_job_id := expired_job.job_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;