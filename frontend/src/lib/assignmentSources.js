/**
 * Assignment source documents stored in `assignments.source_documents` (TEXT) as JSON {label,url}[].
 */
export function parseAssignmentSources(value) {
  if (value == null || String(value).trim() === '') return [];
  try {
    const arr = JSON.parse(String(value).trim());
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        label: String(x?.label ?? '').trim(),
        url: String(x?.url ?? '').trim(),
      }))
      .filter((x) => x.label || x.url);
  } catch {
    return [];
  }
}

export function serializeAssignmentSources(rows) {
  const cleaned = rows
    .map((r) => ({
      label: String(r?.label ?? '').trim(),
      url: String(r?.url ?? '').trim(),
    }))
    .filter((r) => r.label && r.url);
  if (!cleaned.length) return null;
  return JSON.stringify(cleaned);
}

export function formatAssignmentSourcesForContext(rows) {
  if (!rows.length) return '';
  const lines = rows.map((r, i) => `${i + 1}. ${r.label}: ${r.url}`);
  return `Assignment source documents:\n${lines.join('\n')}`;
}
