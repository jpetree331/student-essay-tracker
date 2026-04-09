const express = require('express');
const db = require('../db');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

router.post('/', async (req, res) => {
  const { student_id, entry_ids, report_json } = req.body || {};
  const sid = Number(student_id);
  if (!Number.isInteger(sid)) return fail(res, 'student_id is required', 400);

  const ids = Array.isArray(entry_ids) ? entry_ids.map((x) => Number(x)).filter((x) => Number.isInteger(x)) : [];
  if (ids.length < 2 || ids.length > 6) return fail(res, 'entry_ids must have 2 to 6 integers', 400);
  if (new Set(ids).size !== ids.length) return fail(res, 'entry_ids must not contain duplicates', 400);

  if (report_json == null || typeof report_json !== 'object' || Array.isArray(report_json)) {
    return fail(res, 'report_json must be a JSON object', 400);
  }

  const stu = await db.query('SELECT 1 FROM students WHERE id = $1', [sid]);
  if (!stu.rowCount) return fail(res, 'Student not found', 404);

  const verify = await db.query(
    `SELECT COUNT(*)::int AS c FROM entries WHERE student_id = $1 AND id = ANY($2::int[])`,
    [sid, ids]
  );
  if (verify.rows[0].c !== ids.length) {
    return fail(res, 'One or more entries do not belong to this student', 400);
  }

  const { rows } = await db.query(
    `INSERT INTO comparison_reports (student_id, entry_ids, report_json)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, student_id, entry_ids, report_json, generated_at`,
    [sid, ids, JSON.stringify(report_json)]
  );
  return ok(res, rows[0], 201);
});

module.exports = router;
