export function abbreviateAssignment(name, maxLen = 28) {
  if (name == null || name === '') return '—';
  const s = String(name);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}
