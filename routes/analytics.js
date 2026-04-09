const express = require('express');
const db = require('../db');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

function pgDateToYmd(d) {
  if (d == null) return null;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

async function loadStudentEntriesBundle(studentId) {
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
    [studentId]
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

  return entryRows.map((r) => ({
    ...r,
    source_links: linksByEntry[r.id] || [],
  }));
}

router.get('/class-summary', async (req, res) => {
  const [
    totals,
    periodSummary,
    tagAll,
    tagByPeriod,
    wordByDate,
    weekRows,
    periodsRows,
    exportRows,
  ] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS total_students FROM students`),
    db.query(
      `SELECT s.period,
              COUNT(DISTINCT s.id)::int AS student_count,
              COUNT(e.id)::int AS entry_count,
              COALESCE(ROUND(AVG(e.word_count)::numeric, 1), 0)::float AS avg_word_count,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.claim_present IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_claim_present,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.evidence_cited IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_evidence_cited,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.explanation_present IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_explanation_present,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.source_named IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_source_named,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.response_incomplete IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_response_incomplete,
              CASE
                WHEN COUNT(e.id) > 0
                THEN ROUND((100.0 * COUNT(*) FILTER (WHERE wt.ai_flag IS TRUE) / COUNT(e.id))::numeric, 1)::float
                ELSE 0
              END AS pct_ai_flag
       FROM students s
       LEFT JOIN entries e ON e.student_id = s.id
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id
       GROUP BY s.period
       ORDER BY s.period`
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE wt.claim_present IS TRUE)::int AS claim_present,
         COUNT(*) FILTER (WHERE wt.evidence_cited IS TRUE)::int AS evidence_cited,
         COUNT(*) FILTER (WHERE wt.explanation_present IS TRUE)::int AS explanation_present,
         COUNT(*) FILTER (WHERE wt.source_named IS TRUE)::int AS source_named,
         COUNT(*) FILTER (WHERE wt.response_incomplete IS TRUE)::int AS response_incomplete,
         COUNT(*) FILTER (WHERE wt.ai_flag IS TRUE)::int AS ai_flag
       FROM entries e
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id`
    ),
    db.query(
      `SELECT s.period,
              COUNT(*) FILTER (WHERE wt.claim_present IS TRUE)::int AS claim_present,
              COUNT(*) FILTER (WHERE wt.evidence_cited IS TRUE)::int AS evidence_cited,
              COUNT(*) FILTER (WHERE wt.explanation_present IS TRUE)::int AS explanation_present,
              COUNT(*) FILTER (WHERE wt.source_named IS TRUE)::int AS source_named,
              COUNT(*) FILTER (WHERE wt.response_incomplete IS TRUE)::int AS response_incomplete,
              COUNT(*) FILTER (WHERE wt.ai_flag IS TRUE)::int AS ai_flag
       FROM entries e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id
       GROUP BY s.period
       ORDER BY s.period`
    ),
    db.query(
      `SELECT e.date_submitted::date AS d,
              s.period,
              AVG(e.word_count)::float AS avg_word_count,
              COUNT(e.id)::int AS entry_count
       FROM entries e
       JOIN students s ON s.id = e.student_id
       GROUP BY e.date_submitted::date, s.period
       ORDER BY d ASC, s.period ASC`
    ),
    db.query(
      `SELECT COUNT(*)::int AS entries_this_week
       FROM entries
       WHERE date_submitted >= (CURRENT_DATE - INTERVAL '6 days')
         AND date_submitted <= CURRENT_DATE`
    ),
    db.query(`SELECT DISTINCT period FROM students ORDER BY period`),
    db.query(
      `SELECT st.last_name AS student_last,
              st.first_name AS student_first,
              st.period,
              a.name AS assignment_name,
              a.unit,
              a.aks_standard,
              e.date_submitted,
              e.word_count,
              wt.claim_present,
              wt.evidence_cited,
              wt.explanation_present,
              wt.source_named,
              wt.response_incomplete,
              wt.ai_flag,
              LEFT(COALESCE(e.writing_sample, ''), 200) AS writing_sample_excerpt
       FROM entries e
       JOIN students st ON st.id = e.student_id
       JOIN assignments a ON a.id = e.assignment_id
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id
       ORDER BY st.period, st.last_name, st.first_name, e.date_submitted, e.id`
    ),
  ]);

  const entriesTotalResult = await db.query(`SELECT COUNT(*)::int AS c FROM entries`);
  const totalEntries = entriesTotalResult.rows[0]?.c ?? 0;

  const tagFrequenciesByPeriod = {};
  for (const row of tagByPeriod.rows) {
    tagFrequenciesByPeriod[String(row.period)] = {
      claim_present: row.claim_present,
      evidence_cited: row.evidence_cited,
      explanation_present: row.explanation_present,
      source_named: row.source_named,
      response_incomplete: row.response_incomplete,
      ai_flag: row.ai_flag,
    };
  }

  const wordCountByDate = wordByDate.rows.map((r) => ({
    date: pgDateToYmd(r.d),
    period: r.period,
    avg_word_count: r.avg_word_count != null ? Number(r.avg_word_count) : 0,
    entry_count: r.entry_count,
  }));

  const entryExportRows = exportRows.rows.map((r) => ({
    student_last: r.student_last,
    student_first: r.student_first,
    period: r.period,
    assignment_name: r.assignment_name,
    unit: r.unit ?? '',
    aks_standard: r.aks_standard ?? '',
    date_submitted: r.date_submitted ? pgDateToYmd(r.date_submitted) : '',
    word_count: r.word_count,
    claim_present: r.claim_present === true,
    evidence_cited: r.evidence_cited === true,
    explanation_present: r.explanation_present === true,
    source_named: r.source_named === true,
    response_incomplete: r.response_incomplete === true,
    ai_flag: r.ai_flag === true,
    writing_sample_excerpt: r.writing_sample_excerpt ?? '',
  }));

  const emptyTagFreq = {
    claim_present: 0,
    evidence_cited: 0,
    explanation_present: 0,
    source_named: 0,
    response_incomplete: 0,
    ai_flag: 0,
  };

  return ok(res, {
    total_students: totals.rows[0]?.total_students ?? 0,
    total_entries: totalEntries,
    entries_this_week: weekRows.rows[0]?.entries_this_week ?? 0,
    periods: periodsRows.rows.map((r) => r.period),
    tag_frequencies: { ...emptyTagFreq, ...(tagAll.rows[0] || {}) },
    tag_frequencies_by_period: tagFrequenciesByPeriod,
    word_count_by_date: wordCountByDate,
    per_period: periodSummary.rows,
    entry_export_rows: entryExportRows,
  });
});

router.get('/student/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return fail(res, 'Invalid student id', 400);

  const studentResult = await db.query(
    `SELECT id, first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary
     FROM students WHERE id = $1`,
    [id]
  );
  if (!studentResult.rowCount) return fail(res, 'Student not found', 404);

  const entries = await loadStudentEntriesBundle(id);

  return ok(res, {
    student: studentResult.rows[0],
    entries,
  });
});

module.exports = router;
