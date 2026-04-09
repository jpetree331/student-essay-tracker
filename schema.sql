-- Student science writing tracker — schema

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  period INTEGER NOT NULL,
  iep_flags TEXT,
  iep_goals TEXT,
  writing_goal BOOLEAN NOT NULL DEFAULT FALSE,
  writing_goal_summary VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_period_name ON students (period, last_name, first_name);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  aks_standard TEXT,
  prompt_text TEXT,
  source_documents TEXT,
  date_assigned DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_date_assigned ON assignments (date_assigned);

CREATE TABLE entries (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments (id) ON DELETE RESTRICT,
  date_submitted DATE NOT NULL,
  writing_sample TEXT,
  student_feedback TEXT,
  teacher_notes TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  flagged_for_followup BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entries_student ON entries (student_id);
CREATE INDEX idx_entries_assignment ON entries (assignment_id);
CREATE INDEX idx_entries_date_submitted ON entries (date_submitted);
CREATE INDEX idx_entries_student_date ON entries (student_id, date_submitted);

CREATE TABLE source_links (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries (id) ON DELETE CASCADE,
  label VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_links_entry ON source_links (entry_id);

CREATE TABLE writing_tags (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL UNIQUE REFERENCES entries (id) ON DELETE CASCADE,
  claim_present BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_cited BOOLEAN NOT NULL DEFAULT FALSE,
  explanation_present BOOLEAN NOT NULL DEFAULT FALSE,
  source_named BOOLEAN NOT NULL DEFAULT FALSE,
  response_incomplete BOOLEAN NOT NULL DEFAULT FALSE,
  ai_flag BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Phase 7: saved progress comparison reports (Claude JSON + entry set)
CREATE TABLE comparison_reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  entry_ids INTEGER[] NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comparison_reports_student ON comparison_reports (student_id, generated_at DESC);
