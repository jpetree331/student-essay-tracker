-- Student science writing tracker — SQLite schema for the desktop (Tauri) build.
-- Hand-maintained sibling of schema.sql (Postgres). Applied idempotently on app start.
--
-- Dialect notes vs schema.sql:
--   SERIAL            -> INTEGER PRIMARY KEY AUTOINCREMENT
--   BOOLEAN           -> INTEGER 0/1 (mapped to real JSON booleans in Rust)
--   VARCHAR(n)        -> TEXT
--   TIMESTAMP(TZ)     -> TEXT, ISO 8601 UTC
--   DATE              -> TEXT 'YYYY-MM-DD'
--   INTEGER[] / JSONB -> TEXT holding a JSON string

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  period INTEGER NOT NULL,
  iep_flags TEXT,
  iep_goals TEXT,
  writing_goal INTEGER NOT NULL DEFAULT 0,
  writing_goal_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_students_period_name ON students (period, last_name, first_name);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  aks_standard TEXT,
  prompt_text TEXT,
  source_documents TEXT,
  date_assigned TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_date_assigned ON assignments (date_assigned);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments (id) ON DELETE RESTRICT,
  date_submitted TEXT NOT NULL,
  writing_sample TEXT,
  student_feedback TEXT,
  teacher_notes TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  flagged_for_followup INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_entries_student ON entries (student_id);
CREATE INDEX IF NOT EXISTS idx_entries_assignment ON entries (assignment_id);
CREATE INDEX IF NOT EXISTS idx_entries_date_submitted ON entries (date_submitted);
CREATE INDEX IF NOT EXISTS idx_entries_student_date ON entries (student_id, date_submitted);

CREATE TABLE IF NOT EXISTS source_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_source_links_entry ON source_links (entry_id);

CREATE TABLE IF NOT EXISTS writing_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL UNIQUE REFERENCES entries (id) ON DELETE CASCADE,
  claim_present INTEGER NOT NULL DEFAULT 0,
  evidence_cited INTEGER NOT NULL DEFAULT 0,
  explanation_present INTEGER NOT NULL DEFAULT 0,
  source_named INTEGER NOT NULL DEFAULT 0,
  response_incomplete INTEGER NOT NULL DEFAULT 0,
  ai_flag INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS comparison_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  entry_ids TEXT NOT NULL,
  report_json TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comparison_reports_student ON comparison_reports (student_id, generated_at DESC);
