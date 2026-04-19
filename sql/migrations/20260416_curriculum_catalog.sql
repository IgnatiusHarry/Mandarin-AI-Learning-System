-- Canonical textbook / Pleco catalog (public reference). Distinct from learner `vocabulary` (user cards).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS curriculum_books (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  series      TEXT,
  volume      INT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_chapters (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id         UUID NOT NULL REFERENCES curriculum_books(id) ON DELETE CASCADE,
  chapter_number  INT NOT NULL,
  title             TEXT NOT NULL DEFAULT '',
  summary           TEXT NOT NULL DEFAULT '',
  UNIQUE (book_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_chapters_book
  ON curriculum_chapters(book_id, chapter_number);

CREATE TABLE IF NOT EXISTS curriculum_vocabulary (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  word              TEXT NOT NULL,
  pinyin            TEXT NOT NULL DEFAULT '',
  meaning           TEXT NOT NULL DEFAULT '',
  meaning_en        TEXT,
  meaning_id        TEXT,
  example_sentence  TEXT,
  source            TEXT NOT NULL DEFAULT 'textbook'
    CHECK (source IN ('pleco', 'textbook', 'merged')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_vocab_word ON curriculum_vocabulary(word);

CREATE TABLE IF NOT EXISTS curriculum_chapter_vocab (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id      UUID NOT NULL REFERENCES curriculum_chapters(id) ON DELETE CASCADE,
  vocabulary_id   UUID NOT NULL REFERENCES curriculum_vocabulary(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,
  example_usage     TEXT,
  UNIQUE (chapter_id, vocabulary_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_chapter_vocab_chapter
  ON curriculum_chapter_vocab(chapter_id, sort_order);

CREATE TABLE IF NOT EXISTS curriculum_grammar_points (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id    UUID NOT NULL REFERENCES curriculum_chapters(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  structure     TEXT NOT NULL DEFAULT '',
  explanation   TEXT NOT NULL DEFAULT '',
  sort_order    INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_curriculum_grammar_chapter
  ON curriculum_grammar_points(chapter_id, sort_order);

CREATE TABLE IF NOT EXISTS curriculum_grammar_examples (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grammar_id     UUID NOT NULL REFERENCES curriculum_grammar_points(id) ON DELETE CASCADE,
  sentence       TEXT NOT NULL,
  translation    TEXT NOT NULL DEFAULT '',
  sort_order     INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_curriculum_grammar_examples_g
  ON curriculum_grammar_examples(grammar_id, sort_order);

ALTER TABLE curriculum_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_chapter_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_grammar_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_grammar_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS curriculum_books_read ON curriculum_books;
CREATE POLICY curriculum_books_read ON curriculum_books FOR SELECT USING (true);
DROP POLICY IF EXISTS curriculum_chapters_read ON curriculum_chapters;
CREATE POLICY curriculum_chapters_read ON curriculum_chapters FOR SELECT USING (true);
DROP POLICY IF EXISTS curriculum_vocabulary_read ON curriculum_vocabulary;
CREATE POLICY curriculum_vocabulary_read ON curriculum_vocabulary FOR SELECT USING (true);
DROP POLICY IF EXISTS curriculum_chapter_vocab_read ON curriculum_chapter_vocab;
CREATE POLICY curriculum_chapter_vocab_read ON curriculum_chapter_vocab FOR SELECT USING (true);
DROP POLICY IF EXISTS curriculum_grammar_points_read ON curriculum_grammar_points;
CREATE POLICY curriculum_grammar_points_read ON curriculum_grammar_points FOR SELECT USING (true);
DROP POLICY IF EXISTS curriculum_grammar_examples_read ON curriculum_grammar_examples;
CREATE POLICY curriculum_grammar_examples_read ON curriculum_grammar_examples FOR SELECT USING (true);
