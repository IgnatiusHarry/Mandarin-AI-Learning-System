-- ============================================================
--  明老師 — Mandarin AI Learning System
--  Supabase SQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Profiles ──────────────────────────────────────────────────────

CREATE TABLE profiles (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  -- Web auth linkage (nullable — Telegram-only users won't have this)
  supabase_auth_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_id       BIGINT UNIQUE,
  display_name      TEXT,
  hsk_level         INT DEFAULT 3,
  native_language   TEXT DEFAULT 'id',
  daily_goal_words  INT DEFAULT 5,
  streak_days       INT DEFAULT 0,
  last_active_date  DATE,
  timezone          TEXT DEFAULT 'Asia/Taipei',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_profiles_supabase_auth ON profiles(supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;

-- ── Vocabulary ────────────────────────────────────────────────────

CREATE TABLE vocabulary (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  word             TEXT NOT NULL,
  simplified       TEXT,
  pinyin           TEXT NOT NULL,
  tone_numbers     TEXT,
  meaning_en       TEXT,
  meaning_id       TEXT,
  part_of_speech   TEXT,
  hsk_level        INT,
  example_sentence TEXT,
  example_pinyin   TEXT,
  memory_tip       TEXT,
  source           TEXT DEFAULT 'telegram',   -- 'telegram' | 'manual' | 'web'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word)
);

-- ── SRS Review State ──────────────────────────────────────────────

CREATE TABLE user_reviews (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  vocabulary_id    UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
  interval_days    INT DEFAULT 0,
  ease_factor      FLOAT DEFAULT 2.5,
  review_count     INT DEFAULT 0,
  average_quality  FLOAT DEFAULT 0,
  mastery_level    INT DEFAULT 0,              -- 0-5, computed from interval
  next_review_at   TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE(user_id, vocabulary_id)
);

-- ── Review Sessions ───────────────────────────────────────────────

CREATE TABLE review_sessions (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_date     DATE DEFAULT CURRENT_DATE,
  words_reviewed   INT DEFAULT 0,
  words_correct    INT DEFAULT 0,
  duration_seconds INT,
  is_active        BOOLEAN DEFAULT TRUE,
  source           TEXT DEFAULT 'telegram',   -- 'telegram' | 'web'
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Individual Review Log (per card per session) ──────────────────

CREATE TABLE review_log (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id       UUID REFERENCES review_sessions(id) ON DELETE CASCADE,
  vocabulary_id    UUID REFERENCES vocabulary(id) ON DELETE CASCADE,
  quality          INT NOT NULL CHECK (quality BETWEEN 0 AND 5),
  response_time_ms INT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Conversations ─────────────────────────────────────────────────

CREATE TABLE conversations (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  topic         TEXT DEFAULT 'free conversation',
  source        TEXT DEFAULT 'telegram',
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  message_count INT DEFAULT 0
);

CREATE TABLE conversation_messages (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  corrections     JSONB,                        -- [{wrong, correct, reason}]
  vocab_introduced JSONB,                       -- ["word1", "word2"]
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Daily Goals & Streak Tracking ────────────────────────────────

CREATE TABLE daily_goals (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id             UUID REFERENCES profiles(id) ON DELETE CASCADE,
  goal_date           DATE DEFAULT CURRENT_DATE,
  target_new_words    INT DEFAULT 5,
  actual_new_words    INT DEFAULT 0,
  target_reviews      INT DEFAULT 10,
  actual_reviews      INT DEFAULT 0,
  streak_maintained   BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, goal_date)
);

-- ── Indexes ───────────────────────────────────────────────────────

CREATE INDEX idx_vocabulary_user        ON vocabulary(user_id);
CREATE INDEX idx_vocabulary_created     ON vocabulary(user_id, created_at DESC);
CREATE INDEX idx_reviews_next_due       ON user_reviews(user_id, next_review_at);
CREATE INDEX idx_reviews_mastery        ON user_reviews(user_id, mastery_level);
CREATE INDEX idx_reviews_weak           ON user_reviews(user_id, average_quality, review_count);
CREATE INDEX idx_sessions_active        ON review_sessions(user_id, is_active);
CREATE INDEX idx_daily_goals_date       ON daily_goals(user_id, goal_date);
CREATE INDEX idx_conv_messages_conv     ON conversation_messages(conversation_id, created_at);

-- ── Helper Function: upsert daily review count ────────────────────

CREATE OR REPLACE FUNCTION upsert_daily_review(
  p_user_id  UUID,
  p_date     DATE,
  p_correct  INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_goals (user_id, goal_date, actual_reviews, actual_new_words)
  VALUES (p_user_id, p_date, 1, 0)
  ON CONFLICT (user_id, goal_date)
  DO UPDATE SET actual_reviews = daily_goals.actual_reviews + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_new_words(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_goals (user_id, goal_date, actual_new_words, actual_reviews)
  VALUES (p_user_id, p_date, 1, 0)
  ON CONFLICT (user_id, goal_date)
  DO UPDATE SET actual_new_words = daily_goals.actual_new_words + 1;
END;
$$ LANGUAGE plpgsql;

-- ── Row Level Security ────────────────────────────────────────────
-- Backend uses service key (bypasses RLS).
-- Web app uses anon key with JWT — RLS enforces ownership.

ALTER TABLE vocabulary          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_goals         ENABLE ROW LEVEL SECURITY;

-- Web users can only see their own data (linked via supabase_auth_id)
CREATE POLICY "own data" ON vocabulary
  FOR ALL USING (
    user_id IN (
      SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own data" ON user_reviews
  FOR ALL USING (
    user_id IN (
      SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own data" ON review_sessions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own data" ON daily_goals
  FOR ALL USING (
    user_id IN (
      SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own sessions" ON review_log
  FOR ALL USING (
    session_id IN (
      SELECT rs.id FROM review_sessions rs
      JOIN profiles p ON p.id = rs.user_id
      WHERE p.supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own conversations" ON conversations
  FOR ALL USING (
    user_id IN (
      SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
    )
  );

CREATE POLICY "own messages" ON conversation_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN profiles p ON p.id = c.user_id
      WHERE p.supabase_auth_id = auth.uid()
    )
  );
