const express = require('express');
const db = require('../db');
const { parseBooleanValue } = require('../lib/boolean');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

function lastSubmissionFromEntry(e) {
  if (!e || e.id == null) return null;
  return {
    entry_id: e.id,
    date_submitted: e.date_submitted,
    assignment_name: e.assignment_name != null ? String(e.assignment_name) : '',
    tags: {
      claim_present: e.claim_present === true,
      evidence_cited: e.evidence_cited === true,
      explanation_present: e.explanation_present === true,
      source_named: e.source_named === true,
      response_incomplete: e.response_incomplete === true,
      ai_flag: e.ai_flag === true,
    },
  };
}

function mapStudentListRowWithLastSubmission(row) {
  const {
    last_entry_id,
    last_entry_date_submitted,
    last_entry_assignment_name,
    last_claim_present,
    last_evidence_cited,
    last_explanation_present,
    last_source_named,
    last_response_incomplete,
    last_ai_flag,
    ...student
  } = row;
  const last_submission =
    last_entry_id != null
      ? {
          entry_id: last_entry_id,
          date_submitted: last_entry_date_submitted,
          assignment_name: last_entry_assignment_name != null ? String(last_entry_assignment_name) : '',
          tags: {
            claim_present: last_claim_present === true,
            evidence_cited: last_evidence_cited === true,
            explanation_present: last_explanation_present === true,
            source_named: last_source_named === true,
            response_incomplete: last_response_incomplete === true,
            ai_flag: last_ai_flag === true,
          },
        }
      : null;
  return { ...student, last_submission };
}

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT s.id, s.first_name, s.last_name, s.period, s.iep_flags, s.iep_goals,
            s.writing_goal, s.writing_goal_summary, s.created_at,
            le.entry_id AS last_entry_id,
            le.date_submitted AS last_entry_date_submitted,
            le.assignment_name AS last_entry_assignment_name,
            le.claim_present AS last_claim_present,
            le.evidence_cited AS last_evidence_cited,
            le.explanation_present AS last_explanation_present,
            le.source_named AS last_source_named,
            le.response_incomplete AS last_response_incomplete,
            le.ai_flag AS last_ai_flag
     FROM students s
     LEFT JOIN LATERAL (
       SELECT e.id AS entry_id,
              e.date_submitted,
              a.name AS assignment_name,
              wt.claim_present,
              wt.evidence_cited,
              wt.explanation_present,
              wt.source_named,
              wt.response_incomplete,
              wt.ai_flag
       FROM entries e
       JOIN assignments a ON a.id = e.assignment_id
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id
       WHERE e.student_id = s.id
       ORDER BY e.date_submitted DESC, e.id DESC
       LIMIT 1
     ) le ON true
     ORDER BY s.period, s.last_name, s.first_name`
  );
  return ok(res, rows.map(mapStudentListRowWithLastSubmission));
});

router.get('/:id/entries', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const studentCheck = await db.query('SELECT 1 FROM students WHERE id = $1', [id]);
  if (!studentCheck.rowCount) return fail(res, 'Student not found', 404);

  const { rows: entryRows } = await db.query(
    `SELECT e.id, e.student_id, e.assignment_id, e.date_submitted, e.writing_sample,
            e.student_feedback, e.teacher_notes, e.word_count, e.flagged_for_followup, e.created_at,
            a.name AS assignment_name, a.unit AS assignment_unit, a.aks_standard AS assignment_aks_standard,
            a.source_documents AS assignment_source_documents,
            wt.claim_present, wt.evidence_cited, wt.explanation_present, wt.source_named,
            wt.response_incomplete, wt.ai_flag, wt.notes AS tag_notes
     FROM entries e
     JOIN assignments a ON a.id = e.assignment_id
     LEFT JOIN writing_tags wt ON wt.entry_id = e.id
     WHERE e.student_id = $1
     ORDER BY e.date_submitted ASC, e.id ASC`,
    [id]
  );

  const ids = entryRows.map((r) => r.id);
  const linksByEntry = {};
  if (ids.length) {
    const { rows: linkRows } = await db.query(
      `SELECT id, entry_id, label, url FROM source_links WHERE entry_id = ANY($1::int[]) ORDER BY entry_id, id`,
      [ids]
    );
    for (const l of linkRows) {
      if (!linksByEntry[l.entry_id]) linksByEntry[l.entry_id] = [];
      linksByEntry[l.entry_id].push({ id: l.id, label: l.label, url: l.url });
    }
  }

  const rows = entryRows.map((r) => ({
    ...r,
    source_links: linksByEntry[r.id] || [],
  }));

  return ok(res, rows);
});

router.get('/:id/comparisons', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const studentCheck = await db.query('SELECT 1 FROM students WHERE id = $1', [id]);
  if (!studentCheck.rowCount) return fail(res, 'Student not found', 404);

  const { rows } = await db.query(
    `SELECT id, student_id, entry_ids, report_json, generated_at
     FROM comparison_reports
     WHERE student_id = $1
     ORDER BY generated_at DESC`,
    [id]
  );
  return ok(res, rows);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const studentResult = await db.query(
    `SELECT id, first_name, last_name, period, iep_flags, iep_goals,
            writing_goal, writing_goal_summary, created_at
     FROM students WHERE id = $1`,
    [id]
  );
  if (!studentResult.rowCount) return fail(res, 'Student not found', 404);

  const entriesResult = await db.query(
    `SELECT e.id, e.student_id, e.assignment_id, e.date_submitted, e.writing_sample,
            e.student_feedback, e.teacher_notes, e.word_count, e.flagged_for_followup, e.created_at,
            a.name AS assignment_name, a.unit AS assignment_unit, a.aks_standard AS assignment_aks_standard,
            a.date_assigned AS assignment_date_assigned,
            a.source_documents AS assignment_source_documents,
            wt.claim_present, wt.evidence_cited, wt.explanation_present, wt.source_named,
            wt.response_incomplete, wt.ai_flag, wt.notes AS tag_notes
     FROM entries e
     JOIN assignments a ON a.id = e.assignment_id
     LEFT JOIN writing_tags wt ON wt.entry_id = e.id
     WHERE e.student_id = $1
     ORDER BY e.date_submitted ASC, e.id ASC`,
    [id]
  );

  const entryRows = entriesResult.rows;
  const ids = entryRows.map((r) => r.id);
  const linksByEntry = {};
  if (ids.length) {
    const { rows: linkRows } = await db.query(
      `SELECT id, entry_id, label, url FROM source_links WHERE entry_id = ANY($1::int[]) ORDER BY entry_id, id`,
      [ids]
    );
    for (const l of linkRows) {
      if (!linksByEntry[l.entry_id]) linksByEntry[l.entry_id] = [];
      linksByEntry[l.entry_id].push({ id: l.id, label: l.label, url: l.url });
    }
  }

  const entries = entryRows.map((r) => ({
    ...r,
    source_links: linksByEntry[r.id] || [],
  }));

  const lastEntry = entries.length ? entries[entries.length - 1] : null;
  const last_submission = lastSubmissionFromEntry(lastEntry);

  return ok(res, { ...studentResult.rows[0], entries, last_submission });
});

router.post('/', async (req, res) => {
  const { first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary } =
    req.body;
  if (!first_name || !last_name || period == null) {
    return fail(res, 'first_name, last_name, and period are required', 400);
  }
  const p = Number(period);
  if (!Number.isInteger(p)) return fail(res, 'period must be an integer', 400);

  const wg = writing_goal !== undefined ? parseBooleanValue(writing_goal) : false;
  let wgs = null;
  if (writing_goal_summary !== undefined) {
    const t = writing_goal_summary == null ? '' : String(writing_goal_summary).trim();
    wgs = t.length > 500 ? t.slice(0, 500) : t || null;
  }

  const { rows } = await db.query(
    `INSERT INTO students (first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary, created_at`,
    [first_name, last_name, p, iep_flags ?? null, iep_goals ?? null, wg, wgs]
  );
  return ok(res, rows[0], 201);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const { first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary } =
    req.body;
  const fields = [];
  const values = [];
  let i = 1;

  if (first_name !== undefined) {
    fields.push(`first_name = $${i++}`);
    values.push(first_name);
  }
  if (last_name !== undefined) {
    fields.push(`last_name = $${i++}`);
    values.push(last_name);
  }
  if (period !== undefined) {
    const p = Number(period);
    if (!Number.isInteger(p)) return fail(res, 'period must be an integer', 400);
    fields.push(`period = $${i++}`);
    values.push(p);
  }
  if (iep_flags !== undefined) {
    fields.push(`iep_flags = $${i++}`);
    values.push(iep_flags);
  }
  if (iep_goals !== undefined) {
    fields.push(`iep_goals = $${i++}`);
    values.push(iep_goals);
  }
  if (writing_goal !== undefined) {
    fields.push(`writing_goal = $${i++}`);
    values.push(parseBooleanValue(writing_goal));
  }
  if (writing_goal_summary !== undefined) {
    const t = writing_goal_summary == null ? '' : String(writing_goal_summary).trim();
    const clipped = t.length > 500 ? t.slice(0, 500) : t;
    fields.push(`writing_goal_summary = $${i++}`);
    values.push(clipped || null);
  }

  if (!fields.length) return fail(res, 'No fields to update', 400);

  values.push(id);
  const { rows, rowCount } = await db.query(
    `UPDATE students SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary, created_at`,
    values
  );
  if (!rowCount) return fail(res, 'Student not found', 404);
  return ok(res, rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const { rowCount } = await db.query('DELETE FROM students WHERE id = $1', [id]);
  if (!rowCount) return fail(res, 'Student not found', 404);
  return ok(res, { deleted: true, id });
});

module.exports = router;
