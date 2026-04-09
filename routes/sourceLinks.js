const express = require('express');
const db = require('../db');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

router.post('/', async (req, res) => {
  const { entry_id, label, url } = req.body;
  const eid = Number(entry_id);
  if (!Number.isInteger(eid) || !label || !url) {
    return fail(res, 'entry_id, label, and url are required', 400);
  }

  const entryCheck = await db.query('SELECT 1 FROM entries WHERE id = $1', [eid]);
  if (!entryCheck.rowCount) return fail(res, 'Entry not found', 404);

  const { rows } = await db.query(
    `INSERT INTO source_links (entry_id, label, url)
     VALUES ($1, $2, $3)
     RETURNING id, entry_id, label, url, created_at`,
    [eid, label, url]
  );
  return ok(res, rows[0], 201);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid source link id', 400);

  const { rowCount } = await db.query('DELETE FROM source_links WHERE id = $1', [id]);
  if (!rowCount) return fail(res, 'Source link not found', 404);
  return ok(res, { deleted: true, id });
});

module.exports = router;
