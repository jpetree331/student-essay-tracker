const express = require('express');
const db = require('../db');
const { wordCount } = require('../lib/words');
const { optionalBoolean, parseBooleanValue } = require('../lib/boolean');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid entry id', 400);

  const entryResult = await db.query(
    `SELECT e.id, e.student_id, e.assignment_id, e.date_submitted, e.writing_sample,
            e.student_feedback, e.teacher_notes, e.word_count, e.flagged_for_followup, e.created_at,
            a.name AS assignment_name, a.unit AS assignment_unit, a.aks_standard, a.prompt_text,
            a.source_documents AS assignment_source_documents, a.date_assigned
     FROM entries e
     JOIN assignments a ON a.id = e.assignment_id
     WHERE e.id = $1`,
    [id]
  );
  if (!entryResult.rowCount) return fail(res, 'Entry not found', 404);

  const [links, tags] = await Promise.all([
    db.query(
      `SELECT id, entry_id, label, url, created_at FROM source_links WHERE entry_id = $1 ORDER BY id`,
      [id]
    ),
    db.query(`SELECT * FROM writing_tags WHERE entry_id = $1`, [id]),
  ]);

  const entry = entryResult.rows[0];
  return ok(res, {
    ...entry,
    source_links: links.rows,
    writing_tags: tags.rows[0] ?? null,
  });
});

router.post('/', async (req, res) => {
  const {
    student_id,
    assignment_id,
    date_submitted,
    writing_sample,
    student_feedback,
    teacher_notes,
    flagged_for_followup,
  } = req.body;

  const sid = Number(student_id);
  const aid = Number(assignment_id);
  if (!Number.isInteger(sid) || !Number.isInteger(aid) || !date_submitted) {
    return fail(res, 'student_id, assignment_id, and date_submitted are required', 400);
  }

  const wc = wordCount(writing_sample ?? '');
  const flagged = optionalBoolean(flagged_for_followup, false);

  const { rows } = await db.query(
    `INSERT INTO entries (
       student_id, assignment_id, date_submitted, writing_sample, student_feedback, teacher_notes,
       word_count, flagged_for_followup
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, student_id, assignment_id, date_submitted, writing_sample, student_feedback,
               teacher_notes, word_count, flagged_for_followup, created_at`,
    [
      sid,
      aid,
      date_submitted,
      writing_sample ?? null,
      student_feedback ?? null,
      teacher_notes ?? null,
      wc,
      flagged,
    ]
  );
  return ok(res, rows[0], 201);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid entry id', 400);

  const {
    assignment_id,
    date_submitted,
    writing_sample,
    student_feedback,
    teacher_notes,
    flagged_for_followup,
  } = req.body;

  const existing = await db.query(
    `SELECT writing_sample FROM entries WHERE id = $1`,
    [id]
  );
  if (!existing.rowCount) return fail(res, 'Entry not found', 404);

  const fields = [];
  const values = [];
  let i = 1;

  if (assignment_id !== undefined) {
    const aid = Number(assignment_id);
    if (!Number.isInteger(aid)) return fail(res, 'assignment_id must be an integer', 400);
    fields.push(`assignment_id = $${i++}`);
    values.push(aid);
  }
  if (date_submitted !== undefined) {
    fields.push(`date_submitted = $${i++}`);
    values.push(date_submitted);
  }
  if (writing_sample !== undefined) {
    fields.push(`writing_sample = $${i++}`);
    values.push(writing_sample);
  }
  if (student_feedback !== undefined) {
    fields.push(`student_feedback = $${i++}`);
    values.push(student_feedback);
  }
  if (teacher_notes !== undefined) {
    fields.push(`teacher_notes = $${i++}`);
    values.push(teacher_notes);
  }
  if (flagged_for_followup !== undefined) {
    fields.push(`flagged_for_followup = $${i++}`);
    values.push(parseBooleanValue(flagged_for_followup));
  }

  if (!fields.length) return fail(res, 'No fields to update', 400);

  let nextSample = existing.rows[0].writing_sample;
  if (writing_sample !== undefined) nextSample = writing_sample;
  const wc = wordCount(nextSample ?? '');
  fields.push(`word_count = $${i++}`);
  values.push(wc);

  values.push(id);
  const { rows, rowCount } = await db.query(
    `UPDATE entries SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, student_id, assignment_id, date_submitted, writing_sample, student_feedback,
               teacher_notes, word_count, flagged_for_followup, created_at`,
    values
  );
  if (!rowCount) return fail(res, 'Entry not found', 404);
  return ok(res, rows[0]);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid entry id', 400);

  const { rowCount } = await db.query('DELETE FROM entries WHERE id = $1', [id]);
  if (!rowCount) return fail(res, 'Entry not found', 404);
  return ok(res, { deleted: true, id });
});

module.exports = router;
