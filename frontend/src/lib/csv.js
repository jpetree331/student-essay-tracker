function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers, rows) {
  const line = (cells) => cells.map(csvEscape).join(',');
  const out = [line(headers.map((h) => h.label))];
  for (const row of rows) {
    out.push(line(headers.map((h) => row[h.key])));
  }
  return out.join('\r\n');
}

export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([`\uFEFF${text}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
