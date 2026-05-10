-- ============================================
-- Read Later Tool — Database Schema + RLS
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. User Preferences
-- Stores interests, mode (strict/relaxed), and review schedule
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interests_text TEXT DEFAULT '',
  derived_topics TEXT[] DEFAULT '{}',
  mode TEXT DEFAULT 'relaxed' CHECK (mode IN ('strict', 'relaxed')),
  review_day TEXT DEFAULT 'saturday' CHECK (review_day IN (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  )),
  review_time TIME DEFAULT '09:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Links
-- Each saved URL with enrichment data
CREATE TABLE links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  topics TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'enriched', 'failed')),
  source TEXT DEFAULT 'paste',
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Digests
-- Generated weekly reading digests
CREATE TABLE digests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  markdown TEXT NOT NULL,
  total_links INT DEFAULT 0,
  included_links INT DEFAULT 0,
  filtered_links INT DEFAULT 0,
  mode TEXT NOT NULL CHECK (mode IN ('strict', 'relaxed')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Digest Links (join table)
-- Maps which links appear in which digest, with ordering
CREATE TABLE digest_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  digest_id UUID REFERENCES digests(id) ON DELETE CASCADE NOT NULL,
  link_id UUID REFERENCES links(id) ON DELETE CASCADE NOT NULL,
  section_topic TEXT,
  order_index INT DEFAULT 0
);

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_links ENABLE ROW LEVEL SECURITY;

-- user_preferences: users can only CRUD their own row
CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- links: users can only CRUD their own links
CREATE POLICY "Users manage own links"
  ON links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- digests: users can only CRUD their own digests
CREATE POLICY "Users manage own digests"
  ON digests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- digest_links: users can only see join rows for their own digests
CREATE POLICY "Users manage own digest_links"
  ON digest_links FOR ALL
  USING (
    digest_id IN (SELECT id FROM digests WHERE user_id = auth.uid())
  )
  WITH CHECK (
    digest_id IN (SELECT id FROM digests WHERE user_id = auth.uid())
  );

-- ============================================
-- Indexes for common queries
-- ============================================

CREATE INDEX idx_links_user_status ON links(user_id, status);
CREATE INDEX idx_links_user_created ON links(user_id, created_at DESC);
CREATE INDEX idx_digests_user_created ON digests(user_id, created_at DESC);
CREATE INDEX idx_digest_links_digest ON digest_links(digest_id);
