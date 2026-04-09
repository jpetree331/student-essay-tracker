-- Canonical source documents (e.g. Google Docs) for an assignment — JSON array of {label, url}.
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS source_documents TEXT;
