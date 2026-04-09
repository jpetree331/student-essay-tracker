const express = require('express');
const db = require('../db');
const { ok, fail } = require('../middleware/responses');
const { parseBooleanValue } = require('../lib/boolean');

const router = express.Router();

function mergeBool(bodyVal, key, prev) {
  if (bodyVal !== undefined) return parseBooleanValue(bodyVal);
  if (prev) return prev[key];
  return false;
}

function mergeNotes(bodyVal, prev) {
  if (bodyVal !== undefined) return bodyVal;
  if (prev) return prev.notes;
  return null;
}

router.post('/', async (req, res) => {
  const {
    entry_id,
    claim_present,
    evidence_cited,
    explanation_present,
    source_named,
    response_incomplete,
    ai_flag,
    notes,
  } = req.body;

  const eid = Number(entry_id);
  if (!Number.isInteger(eid)) return fail(res, 'entry_id is required', 400);

  const entryCheck = await db.query('SELECT 1 FROM entries WHERE id = $1', [eid]);
  if (!entryCheck.rowCount) return fail(res, 'Entry not found', 404);

  const prevResult = await db.query(
    `SELECT claim_present, evidence_cited, explanation_present, source_named,
            response_incomplete, ai_flag, notes
     FROM writing_tags WHERE entry_id = $1`,
    [eid]
  );
  const prev = prevResult.rows[0];

  const merged = {
    claim_present: mergeBool(claim_present, 'claim_present', prev),
    evidence_cited: mergeBool(evidence_cited, 'evidence_cited', prev),
    explanation_present: mergeBool(explanation_present, 'explanation_present', prev),
    source_named: mergeBool(source_named, 'source_named', prev),
    response_incomplete: mergeBool(response_incomplete, 'response_incomplete', prev),
    ai_flag: mergeBool(ai_flag, 'ai_flag', prev),
    notes: mergeNotes(notes, prev),
  };

  const { rows } = await db.query(
    `INSERT INTO writing_tags (
       entry_id, claim_present, evidence_cited, explanation_present, source_named,
       response_incomplete, ai_flag, notes
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (entry_id) DO UPDATE SET
       claim_present = EXCLUDED.claim_present,
       evidence_cited = EXCLUDED.evidence_cited,
       explanation_present = EXCLUDED.explanation_present,
       source_named = EXCLUDED.source_named,
       response_incomplete = EXCLUDED.response_incomplete,
       ai_flag = EXCLUDED.ai_flag,
       notes = EXCLUDED.notes
     RETURNING id, entry_id, claim_present, evidence_cited, explanation_present, source_named,
               response_incomplete, ai_flag, notes, created_at`,
    [
      eid,
      merged.claim_present,
      merged.evidence_cited,
      merged.explanation_present,
      merged.source_named,
      merged.response_incomplete,
      merged.ai_flag,
      merged.notes,
    ]
  );

  const status = prev ? 200 : 201;
  return ok(res, rows[0], status);
});

module.exports = router;
