-- Run once if your database was created before Phase 7:
-- psql $DATABASE_URL -f db/migration_007_comparison_reports.sql

CREATE TABLE IF NOT EXISTS comparison_reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  entry_ids INTEGER[] NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_reports_student ON comparison_reports (student_id, generated_at DESC);
