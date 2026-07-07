const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../db');
const { parseModelJson } = require('../lib/claudeJson');
const { resolveProvider } = require('../lib/ai/provider');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

// Shared with the desktop (Rust) build — keep prompt text in prompts/, not inline.
const SYSTEM_PROMPT = fs
  .readFileSync(path.join(__dirname, '../prompts/compare-progress.system.txt'), 'utf8')
  .trim();

function tagYesNo(v) {
  return v === true ? 'yes' : 'no';
}

function buildUserMessage(studentName, iepFlags, entries) {
  const n = entries.length;
  const iep = iepFlags != null && String(iepFlags).trim() ? String(iepFlags).trim() : 'None provided';
  const blocks = entries.map((e, i) => {
    const t = e.tags || {};
    return `--- Entry ${i + 1}: ${e.assignment_name} (${e.date}) ---
Word count: ${e.word_count ?? 0}
Tags: Claim: ${tagYesNo(t.claim_present)}, Evidence: ${tagYesNo(t.evidence_cited)}, Explanation: ${tagYesNo(t.explanation_present)}, Source Named: ${tagYesNo(t.source_named)}, Incomplete: ${tagYesNo(t.response_incomplete)}, AI Flag: ${tagYesNo(t.ai_flag)}

Writing sample:
${e.writing_sample || ''}
`;
  });
  return `Student: ${studentName}
IEP notes: ${iep}

I am sharing ${n} writing samples from this student in chronological order. Please analyze their growth as a writer.

${blocks.join('\n')}

Analyze the growth across all ${n} entries and return the JSON object.`;
}

function normalizeComparison(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid comparison object');
  const c = { ...raw };
  if (typeof c.overall_growth_summary !== 'string') c.overall_growth_summary = String(c.overall_growth_summary ?? '');
  if (typeof c.what_stayed_strong !== 'string') c.what_stayed_strong = String(c.what_stayed_strong ?? '');
  if (!Array.isArray(c.growth_moments)) c.growth_moments = [];
  if (!Array.isArray(c.persistent_gaps)) c.persistent_gaps = [];
  if (!Array.isArray(c.entry_by_entry)) c.entry_by_entry = [];
  if (!c.next_instructional_step || typeof c.next_instructional_step !== 'object') {
    c.next_instructional_step = {
      move: '',
      rationale: '',
      try_this: '',
      iep_connection: null,
    };
  }
  if (typeof c.conference_script !== 'string') c.conference_script = String(c.conference_script ?? '');
  return c;
}

async function runComparison(userMessage) {
  const provider = resolveProvider();
  const { text, modelUsed, provider: providerUsed } = await provider.complete({
    system: SYSTEM_PROMPT,
    user: userMessage,
    kind: 'compare',
  });
  let raw;
  try {
    raw = parseModelJson(text);
  } catch (e) {
    console.error('[compare-progress] JSON parse failed. Raw model text (truncated):', text.slice(0, 4000));
    throw new Error(`Could not parse comparison response: ${e.message}`);
  }
  return { comparison: normalizeComparison(raw), modelUsed, providerUsed };
}

router.post('/', async (req, res) => {
  const body = req.body || {};
  const studentId = Number(body.student_id);
  const studentName = body.student_name != null ? String(body.student_name).trim() : '';
  const iepFlags = body.iep_flags;
  const entries = Array.isArray(body.entries) ? body.entries : [];

  if (!Number.isInteger(studentId)) return fail(res, 'student_id is required', 400);
  if (!studentName) return fail(res, 'student_name is required', 400);
  if (entries.length < 2) return fail(res, 'At least 2 entries are required', 400);
  if (entries.length > 6) return fail(res, 'Maximum 6 entries per comparison', 400);

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || typeof e !== 'object') return fail(res, `Invalid entry at index ${i}`, 400);
    const eid = Number(e.entry_id);
    if (!Number.isInteger(eid)) return fail(res, `Invalid entry_id at index ${i}`, 400);
    if (e.writing_sample == null || String(e.writing_sample).trim().length < 1) {
      return fail(res, `Entry ${eid} is missing writing_sample`, 400);
    }
  }

  const entryIds = entries.map((e) => Number(e.entry_id));
  const unique = new Set(entryIds);
  if (unique.size !== entryIds.length) return fail(res, 'Duplicate entry_id in request', 400);

  const verify = await db.query(
    `SELECT id, date_submitted FROM entries WHERE student_id = $1 AND id = ANY($2::int[])`,
    [studentId, entryIds]
  );
  if (verify.rows.length !== entryIds.length) {
    return fail(res, 'One or more entries do not belong to this student', 400);
  }

  const byId = new Map(verify.rows.map((r) => [r.id, r]));
  const dayKey = (d) => {
    if (d == null) return '';
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  };
  let prevKey = null;
  let prevId = null;
  for (const id of entryIds) {
    const row = byId.get(id);
    const key = dayKey(row.date_submitted);
    if (prevKey != null) {
      if (key < prevKey) {
        return fail(res, 'entries must be in chronological order (oldest first)', 400);
      }
      if (key === prevKey && id <= prevId) {
        return fail(res, 'entries must be in chronological order (oldest first)', 400);
      }
    }
    prevKey = key;
    prevId = id;
  }

  const userMessage = buildUserMessage(studentName, iepFlags, entries);

  try {
    const { comparison, modelUsed, providerUsed } = await runComparison(userMessage);
    return ok(res, {
      comparison,
      student_id: studentId,
      entry_ids_compared: entryIds,
      generated_at: new Date().toISOString(),
      model_used: modelUsed,
      provider_used: providerUsed,
    });
  } catch (e) {
    const rawStatus = e.statusCode ?? (typeof e.status === 'number' ? e.status : null);
    const status =
      rawStatus === 503 || rawStatus === 401 || rawStatus === 429
        ? rawStatus
        : rawStatus >= 400 && rawStatus < 600
          ? rawStatus
          : 502;
    const msg = e.message || 'Comparison failed';
    if (status === 503) return fail(res, msg, 503);
    return fail(res, msg, status);
  }
});

module.exports = router;
