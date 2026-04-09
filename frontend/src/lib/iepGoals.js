/**
 * IEP goals are stored in `students.iep_goals` (TEXT) as JSON stringified string[],
 * or legacy plain text (treated as a single goal).
 */
export function parseIepGoals(value) {
  if (value == null || String(value).trim() === '') return [];
  const s = String(value).trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x ?? '').trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return [s];
}

export function serializeIepGoals(rows) {
  const cleaned = rows.map((g) => String(g ?? '').trim()).filter(Boolean);
  if (!cleaned.length) return null;
  return JSON.stringify(cleaned);
}
