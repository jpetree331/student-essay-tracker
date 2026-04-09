-- Add IEP goals (separate from iep_flags / disabilities). Run once on existing DBs:
-- psql $DATABASE_URL -f db/migration_008_iep_goals.sql

ALTER TABLE students ADD COLUMN IF NOT EXISTS iep_goals TEXT;
