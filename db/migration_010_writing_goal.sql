-- Writing goal flag + short summary for roster visibility (additive only).
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS writing_goal BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS writing_goal_summary VARCHAR(500);
