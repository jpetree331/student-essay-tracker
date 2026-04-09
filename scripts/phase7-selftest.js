/**
 * Phase 7 sanity checks (no API, no DB).
 * Run from repo root: node scripts/phase7-selftest.js
 */
const { parseModelJson } = require('../lib/claudeJson');

function assertChronologicalEntryOrder(entryIds, rowsById) {
  const dayKey = (d) => {
    if (d == null) return '';
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  };
  let prevKey = null;
  let prevId = null;
  for (const id of entryIds) {
    const row = rowsById.get(id);
    if (!row) throw new Error(`missing row for id ${id}`);
    const key = dayKey(row.date_submitted);
    if (prevKey != null) {
      if (key < prevKey) return false;
      if (key === prevKey && id <= prevId) return false;
    }
    prevKey = key;
    prevId = id;
  }
  return true;
}

// —— parseModelJson (shared lib) ——
const o1 = parseModelJson('Sure. Here you go: {"overall_growth_summary":"x","n":1} thanks.');
if (o1.overall_growth_summary !== 'x' || o1.n !== 1) throw new Error('embedded json fail');

const o2 = parseModelJson('```json\n{"what_stayed_strong":"ok"}\n```');
if (o2.what_stayed_strong !== 'ok') throw new Error('fence fail');

// —— chronological order (mirrors compare route) ——
const rows = new Map([
  [1, { date_submitted: '2026-01-10' }],
  [2, { date_submitted: '2026-02-01' }],
  [3, { date_submitted: '2026-02-01' }],
]);
if (!assertChronologicalEntryOrder([1, 2, 3], rows)) throw new Error('valid order should pass');
if (assertChronologicalEntryOrder([2, 1], rows)) throw new Error('wrong date order should fail');
if (assertChronologicalEntryOrder([3, 2], rows)) throw new Error('same-day non-increasing id should fail');

console.log('phase7-selftest: ok');
