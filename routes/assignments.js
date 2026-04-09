const express = require('express');
const db = require('../db');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at
     FROM assignments
     ORDER BY date_assigned DESC, id`
  );
  return ok(res, rows);
});

router.get('/:id/print-submissions', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid assignment id', 400);

  const assignmentResult = await db.query(
    `SELECT id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at
     FROM assignments WHERE id = $1`,
    [id]
  );
  if (!assignmentResult.rowCount) return fail(res, 'Assignment not found', 404);
  const assignment = assignmentResult.rows[0];

  const { rows } = await db.query(
    `SELECT DISTINCT ON (e.student_id)
            e.student_id,
            s.first_name,
            s.last_name,
            e.writing_sample,
            e.teacher_notes
     FROM entries e
     INNER JOIN students s ON s.id = e.student_id
     WHERE e.assignment_id = $1
     ORDER BY e.student_id, e.date_submitted DESC, e.id DESC`,
    [id]
  );

  const students = [...rows].sort((a, b) => {
    const ln = String(a.last_name || '').localeCompare(String(b.last_name || ''), undefined, {
      sensitivity: 'base',
    });
    if (ln !== 0) return ln;
    return String(a.first_name || '').localeCompare(String(b.first_name || ''), undefined, {
      sensitivity: 'base',
    });
  });

  return ok(res, { assignment, students });
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid assignment id', 400);

  const { rows, rowCount } = await db.query(
    `SELECT id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at
     FROM assignments WHERE id = $1`,
    [id]
  );
  if (!rowCount) return fail(res, 'Assignment not found', 404);
  return ok(res, rows[0]);
});

router.post('/', async (req, res) => {
  const { name, unit, aks_standard, prompt_text, source_documents, date_assigned } = req.body;
  if (!name || !unit || !date_assigned) {
    return fail(res, 'name, unit, and date_assigned are required', 400);
  }

  const { rows } = await db.query(
    `INSERT INTO assignments (name, unit, aks_standard, prompt_text, source_documents, date_assigned)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at`,
    [
      name,
      unit,
      aks_standard ?? null,
      prompt_text ?? null,
      source_documents ?? null,
      date_assigned,
    ]
  );
  return ok(res, rows[0], 201);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid assignment id', 400);

  const { name, unit, aks_standard, prompt_text, source_documents, date_assigned } = req.body;
  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(name);
  }
  if (unit !== undefined) {
    fields.push(`unit = $${i++}`);
    values.push(unit);
  }
  if (aks_standard !== undefined) {
    fields.push(`aks_standard = $${i++}`);
    values.push(aks_standard);
  }
  if (prompt_text !== undefined) {
    fields.push(`prompt_text = $${i++}`);
    values.push(prompt_text);
  }
  if (source_documents !== undefined) {
    fields.push(`source_documents = $${i++}`);
    values.push(source_documents);
  }
  if (date_assigned !== undefined) {
    fields.push(`date_assigned = $${i++}`);
    values.push(date_assigned);
  }

  if (!fields.length) return fail(res, 'No fields to update', 400);

  values.push(id);
  const { rows, rowCount } = await db.query(
    `UPDATE assignments SET ${fields.join(', ')} WHERE id = $${i}
     RETURNING id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at`,
    values
  );
  if (!rowCount) return fail(res, 'Assignment not found', 404);
  return ok(res, rows[0]);
});

module.exports = router;
