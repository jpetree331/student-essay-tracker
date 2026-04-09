export function formatLongDate(isoDate) {
  if (isoDate == null || isoDate === '') return '—';
  if (isoDate instanceof Date && !Number.isNaN(isoDate.getTime())) {
    return isoDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const s = typeof isoDate === 'string' ? isoDate : String(isoDate);
  const ymd = s.slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return s;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatChipDate(isoDate) {
  if (isoDate == null || isoDate === '') return '—';
  if (isoDate instanceof Date && !Number.isNaN(isoDate.getTime())) {
    return isoDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const s = typeof isoDate === 'string' ? isoDate : String(isoDate);
  const ymd = s.slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return s;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
