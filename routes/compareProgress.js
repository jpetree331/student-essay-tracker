const express = require('express');
const db = require('../db');
const { parseModelJson } = require('../lib/claudeJson');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

const MODEL = process.env.ANTHROPIC_COMPARE_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are an expert special education science writing coach analyzing the writing development of a 9th grade biology student in a resource (IRR) class. You are reviewing multiple writing samples from the same student taken at different points in time.

Your job is to identify genuine growth, persistent gaps, and the most actionable next instructional step for this specific student. You know this student may have IEP goals related to written expression, reading comprehension, or executive function. Your tone is always warm, specific, and evidence-based — you name exact things from the writing, you do not generalize.

Return ONLY a JSON object with no other text, no markdown, no explanation outside the JSON. The structure must be exactly:

{
  "overall_growth_summary": "A 3-4 sentence summary of how this student has grown as a writer across these samples. Be specific — name exact moves they have added, exact vocabulary that has appeared, exact structural changes. Do not be vague.",
  "what_stayed_strong": "One to two sentences naming something this student did consistently well across ALL samples. Find the through-line of their strength.",
  "growth_moments": [
    {
      "from_entry": <number, entry_id of earlier entry>,
      "to_entry": <number, entry_id of later entry>,
      "what_changed": "Specific description of one writing move that appeared or improved between these two entries",
      "evidence": "Direct quote or close paraphrase from the later entry that demonstrates this growth"
    }
  ],
  "persistent_gaps": [
    {
      "gap_name": "short label e.g. Evidence citation",
      "description": "One sentence describing what is still missing and why it matters for argument writing",
      "present_in_entries": [<array of entry_ids where this gap appears>]
    }
  ],
  "next_instructional_step": {
    "move": "The single most important writing move to teach this student next — be specific, not generic",
    "rationale": "One sentence explaining why this is the right next step given the growth pattern",
    "try_this": "A concrete sentence stem or micro-strategy the teacher can give directly to the student at their next conference. Write it as if speaking to the student.",
    "iep_connection": "If IEP flags were provided, one sentence connecting this next step to the relevant IEP goal. If no IEP flags were provided, use null."
  },
  "entry_by_entry": [
    {
      "entry_id": <number>,
      "date": "date string",
      "assignment_name": "name",
      "one_line_summary": "One sentence capturing where this student was as a writer at this moment in time",
      "strongest_moment": "The best sentence or phrase from this specific sample — direct quote",
      "biggest_opportunity": "The one thing that would have made this specific sample stronger"
    }
  ],
  "conference_script": "A short paragraph (5-7 sentences) the teacher could actually say out loud to this student when returning their work. Written in second person directly to the student. Warm, specific, honest. Names their growth explicitly. Ends with one concrete challenge for next time. Appropriate for a 9th grade reading level."
}

Remember: this student is in a special education resource class. Many of these students have been told their writing is bad for years. Your analysis must find and name real growth even when progress is small. Small growth is still growth and it matters.`;

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

async function callCompareClaude(userMessage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: String(apiKey).trim() });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  const blocks = message.content || [];
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  let raw;
  try {
    raw = parseModelJson(text);
  } catch (e) {
    console.error('[compare-progress] JSON parse failed. Raw model text (truncated):', text.slice(0, 4000));
    throw new Error(`Could not parse comparison response: ${e.message}`);
  }
  return { comparison: normalizeComparison(raw), message, rawText: text };
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
    const { comparison } = await callCompareClaude(userMessage);
    return ok(res, {
      comparison,
      student_id: studentId,
      entry_ids_compared: entryIds,
      generated_at: new Date().toISOString(),
      model_used: MODEL,
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
