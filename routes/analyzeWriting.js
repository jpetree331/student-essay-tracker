/**
 * LLM auto-tagging (Phase 6). Uses Anthropic Claude API.
 *
 * PRODUCTION: Do not expose GET /test in production. It is registered only when
 * NODE_ENV !== "production". Remove or set NODE_ENV=production before deploy.
 */
const express = require('express');
const db = require('../db');
const { parseModelJson } = require('../lib/claudeJson');
const { ok, fail } = require('../middleware/responses');

const router = express.Router();

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are an expert special education science writing coach analyzing 9th grade biology student writing samples. Your job is to identify which writing moves are present in a student's response.

Analyze the writing sample and return ONLY a JSON object with no other text, no markdown, no explanation outside the JSON. The JSON must have exactly this structure:

{
  "claim_present": true or false,
  "claim_reasoning": "one sentence explaining why you marked this true or false",
  "evidence_cited": true or false,
  "evidence_reasoning": "one sentence explaining why",
  "explanation_present": true or false,
  "explanation_reasoning": "one sentence explaining why",
  "source_named": true or false,
  "source_named_reasoning": "one sentence explaining why",
  "response_incomplete": true or false,
  "response_incomplete_reasoning": "one sentence explaining why",
  "ai_flag": true or false,
  "ai_flag_reasoning": "one sentence explaining why — flag if writing is unusually polished, uses technical vocabulary not present in typical 9th grade IRR writing, has no spelling or grammatical errors, or contains terminology unlikely to appear in provided source materials",
  "overall_note": "2-3 sentences max summarizing the student's current writing level and the single most important next step"
}

Definitions for your analysis:
- claim_present: The writing contains a clear argumentative statement about what the evidence proves, not just a description of facts
- evidence_cited: The writing references specific data, numbers, or named sources (e.g. 'According to Source 1', 'the graph shows 78%')
- explanation_present: The writing explains WHY the evidence supports the claim — not just what happened but what it means
- source_named: The writing explicitly names or labels a source (Source 1, Source 2, the graph, the article, etc.)
- response_incomplete: The writing appears cut off mid-sentence, answers only part of the prompt, or is too brief to constitute an attempt
- ai_flag: The writing contains signals inconsistent with authentic 9th grade IRR student writing`;

const TAG_KEYS = [
  'claim_present',
  'evidence_cited',
  'explanation_present',
  'source_named',
  'response_incomplete',
  'ai_flag',
];

function normalizeBool(v) {
  if (v === true || v === 'true') return true;
  if (v === false || v === 'false') return false;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  throw new Error('Invalid boolean in model output');
}

function validateAndShapeSuggestions(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Model returned invalid object');
  const out = {};
  for (const key of TAG_KEYS) {
    if (!(key in raw)) throw new Error(`Missing key: ${key}`);
    out[key] = normalizeBool(raw[key]);
  }
  const reasoningKeys = [
    'claim_reasoning',
    'evidence_reasoning',
    'explanation_reasoning',
    'source_named_reasoning',
    'response_incomplete_reasoning',
    'ai_flag_reasoning',
  ];
  for (const rk of reasoningKeys) {
    if (!(rk in raw)) throw new Error(`Missing key: ${rk}`);
    const rv = raw[rk];
    if (rv == null) throw new Error(`Missing or invalid: ${rk}`);
    out[rk] = String(rv).trim();
    if (!out[rk]) throw new Error(`Missing or invalid: ${rk}`);
  }
  if (raw.overall_note == null) {
    throw new Error('Missing or invalid: overall_note');
  }
  out.overall_note = String(raw.overall_note).trim();
  if (!out.overall_note) {
    throw new Error('Missing or invalid: overall_note');
  }
  return out;
}

async function callClaude(writingSample, assignmentContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error('ANTHROPIC_API_KEY is not configured');
    err.statusCode = 503;
    throw err;
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: String(apiKey).trim() });

  const ctx =
    assignmentContext != null && String(assignmentContext).trim()
      ? String(assignmentContext).trim()
      : 'Not provided';

  const userMessage = `Assignment context: ${ctx}

Student writing sample:
${writingSample}

Analyze this writing sample and return the JSON object.`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const blocks = message.content || [];
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const raw = parseModelJson(text);
  const suggestions = validateAndShapeSuggestions(raw);
  return { suggestions, message };
}

router.post('/', async (req, res) => {
  const { writing_sample, assignment_context } = req.body || {};
  const sample =
    writing_sample != null && typeof writing_sample === 'string' ? writing_sample.trim() : '';

  if (sample.length < 50) {
    return fail(res, 'writing_sample must be at least 50 characters', 400);
  }

  try {
    const { suggestions } = await callClaude(sample, assignment_context);
    return ok(res, {
      suggestions,
      model_used: MODEL,
      analyzed_at: new Date().toISOString(),
    });
  } catch (e) {
    const rawStatus = e.statusCode ?? (typeof e.status === 'number' ? e.status : null);
    const status =
      rawStatus === 503 || rawStatus === 401 || rawStatus === 429 ? rawStatus : rawStatus >= 400 && rawStatus < 600 ? rawStatus : 502;
    const msg =
      e.message ||
      (e.error && typeof e.error === 'object' && e.error.message) ||
      'Analysis failed';
    if (status === 503) return fail(res, msg, 503);
    return fail(res, `Auto-tag failed: ${msg}`, status);
  }
});

router.get('/untagged-entries', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id AS entry_id,
              e.writing_sample,
              a.name AS assignment_name,
              a.unit AS assignment_unit,
              a.prompt_text AS assignment_prompt
       FROM entries e
       JOIN assignments a ON a.id = e.assignment_id
       LEFT JOIN writing_tags wt ON wt.entry_id = e.id
       WHERE wt.id IS NULL
         AND e.writing_sample IS NOT NULL
         AND LENGTH(TRIM(e.writing_sample)) >= 50
       ORDER BY e.id ASC`
    );
    const entries = rows.map((r) => {
      const parts = [r.assignment_name, r.assignment_unit].filter(Boolean).join(' — ');
      const prompt = r.assignment_prompt ? String(r.assignment_prompt).trim() : '';
      const assignment_context = prompt ? `${parts}\n\nPrompt:\n${prompt}` : parts || 'Not provided';
      return {
        entry_id: r.entry_id,
        writing_sample: r.writing_sample,
        assignment_context,
      };
    });
    return ok(res, { entries, count: entries.length });
  } catch (e) {
    return fail(res, e.message || 'Failed to list untagged entries', 500);
  }
});

if (process.env.NODE_ENV !== 'production') {
  router.get('/test', async (req, res) => {
    const snippet = `According to Source 1, the moth population changed by 78% over time. This proves that natural selection caused the darker moths to survive better because the trees became polluted and darker moths blended in.`;

    try {
      const { suggestions, message } = await callClaude(snippet, 'Unit 3 — Evolution (sample test)');
      return ok(res, {
        test_snippet: snippet,
        suggestions,
        model_used: MODEL,
        raw_stop_reason: message.stop_reason,
        usage: message.usage,
        analyzed_at: new Date().toISOString(),
      });
    } catch (e) {
      const rawStatus = e.statusCode ?? (typeof e.status === 'number' ? e.status : null);
      const status =
        rawStatus === 503 || rawStatus === 401 || rawStatus === 429
          ? rawStatus
          : rawStatus >= 400 && rawStatus < 600
            ? rawStatus
            : 502;
      const msg = e.message || 'Test call failed';
      if (status === 503) return fail(res, msg, 503);
      return fail(res, `Test failed: ${msg}`, status);
    }
  });
}

module.exports = router;
