-- dev.folio Database Schema
-- Run this in Supabase SQL Editor

-- Site configuration (single row)
CREATE TABLE IF NOT EXISTS site_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default config
INSERT INTO site_config (id, config)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'web',
  tags TEXT[] DEFAULT '{}',
  year TEXT DEFAULT '',
  link TEXT DEFAULT '#contact',
  image TEXT DEFAULT '',
  video TEXT DEFAULT '',
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read config"
  ON site_config FOR SELECT
  USING (true);

CREATE POLICY "Public can read projects"
  ON projects FOR SELECT
  USING (true);

-- Admin full access (via service_role key)
CREATE POLICY "Service role full access config"
  ON site_config FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access projects"
  ON projects FOR ALL
  USING (true)
  WITH CHECK (true);

-- Contact messages
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  service TEXT DEFAULT '',
  budget TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access contacts"
  ON contacts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio_uploads', 'portfolio_uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on uploads
CREATE POLICY "Public read uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio_uploads');

-- Allow service role uploads
CREATE POLICY "Service role upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'portfolio_uploads');

CREATE POLICY "Service role delete uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'portfolio_uploads');
