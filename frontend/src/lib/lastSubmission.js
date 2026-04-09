/**
 * Most recent entry by date_submitted then id (matches server ordering).
 * @param {Array<{ id?: number, date_submitted?: string }>} entries
 */
export function getLastSubmissionFromEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  let best = entries[0];
  for (let i = 1; i < entries.length; i += 1) {
    const e = entries[i];
    const ds = String(e?.date_submitted || '').slice(0, 10);
    const bs = String(best?.date_submitted || '').slice(0, 10);
    if (ds > bs) {
      best = e;
    } else if (ds === bs && Number(e?.id || 0) > Number(best?.id || 0)) {
      best = e;
    }
  }
  if (!best || best.id == null) return null;
  return {
    entry_id: best.id,
    date_submitted: best.date_submitted,
    assignment_name: best.assignment_name != null ? String(best.assignment_name) : '',
    tags: {
      claim_present: best.claim_present === true,
      evidence_cited: best.evidence_cited === true,
      explanation_present: best.explanation_present === true,
      source_named: best.source_named === true,
      response_incomplete: best.response_incomplete === true,
      ai_flag: best.ai_flag === true,
    },
  };
}
