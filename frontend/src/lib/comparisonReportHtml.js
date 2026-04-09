import { formatLongDate } from './dates';

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s) {
  return esc(s).replace(/\r\n/g, '\n').split('\n').join('<br/>');
}

function rowCells(cells) {
  return cells.map((c) => `<td>${nl2br(c)}</td>`).join('');
}

/**
 * @param {object} opts
 * @param {{ first_name: string, last_name: string, period?: number }} opts.student
 * @param {object} opts.comparison — full comparison object from API
 * @param {string} opts.generatedAt — ISO string
 * @param {boolean} opts.hasIepFlags — whether student had IEP notes on file
 */
export function buildComparisonReportHtml({ student, comparison, generatedAt, hasIepFlags }) {
  const c = comparison || {};
  const next = c.next_instructional_step || {};
  const iepConn = next.iep_connection;
  const showIepBlock = hasIepFlags && iepConn != null && String(iepConn).trim() && String(iepConn).toLowerCase() !== 'null';

  const entryRows = Array.isArray(c.entry_by_entry)
    ? c.entry_by_entry
        .map(
          (r) =>
            `<tr>${rowCells([
              r.date,
              r.assignment_name,
              r.one_line_summary,
              `"${r.strongest_moment}"`,
              r.biggest_opportunity,
            ])}</tr>`
        )
        .join('')
    : '';

  const moments = Array.isArray(c.growth_moments)
    ? c.growth_moments
        .map(
          (m) => `
        <div class="block">
          <p><strong>Entry ${esc(m.from_entry)} → Entry ${esc(m.to_entry)}</strong></p>
          <p>${nl2br(m.what_changed)}</p>
          <p class="quote">“${nl2br(m.evidence).replace(/<br\/>/g, ' ')}”</p>
        </div>`
        )
        .join('')
    : '';

  const gaps = Array.isArray(c.persistent_gaps)
    ? c.persistent_gaps
        .map(
          (g) => `
        <div class="block gap">
          <p><strong>${esc(g.gap_name)}</strong></p>
          <p>${nl2br(g.description)}</p>
          <p class="muted">Entries: ${(g.present_in_entries || []).join(', ')}</p>
        </div>`
        )
        .join('')
    : '';

  const genLabel = generatedAt
    ? formatLongDate(generatedAt.slice(0, 10))
    : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(student.first_name)} ${esc(student.last_name)} — Progress comparison</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1c1917; line-height: 1.55; margin: 0; padding: 0.65in; font-size: 11pt; }
    h1 { font-size: 1.5rem; margin: 0 0 0.35rem; font-family: system-ui, sans-serif; }
    .meta { font-family: system-ui, sans-serif; font-size: 0.9rem; color: #444; margin-bottom: 1.25rem; }
    h2 { font-size: 1rem; margin: 1.35rem 0 0.5rem; font-family: system-ui, sans-serif; border-bottom: 1px solid #ccc; padding-bottom: 0.2rem; }
    .summary { border-left: 4px solid #86efac; padding: 0.75rem 1rem; background: #f0fdf4; margin: 0.75rem 0; }
    .block { border: 1px solid #ddd; padding: 0.65rem 0.85rem; margin: 0.5rem 0; background: #fafaf9; }
    .block.gap { border-color: #fcd34d; background: #fffbeb; }
    .quote { font-style: italic; color: #444; margin-top: 0.35rem; }
    .muted { color: #666; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 0.45rem 0.5rem; vertical-align: top; text-align: left; }
    th { background: #f5f5f4; font-family: system-ui, sans-serif; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .confidential { border: 2px solid #1e40af; background: #eff6ff; padding: 0.75rem; margin: 1rem 0; }
    .confidential h2 { border: none; color: #1e3a8a; font-size: 0.85rem; }
    .student-page { page-break-before: always; padding-top: 0.5rem; }
    .student-page h2 { color: #92400e; border-color: #fcd34d; }
    .student-script { font-size: 12pt; line-height: 1.6; }
    @media print { body { padding: 0.45in; } }
  </style>
</head>
<body>
  <header>
    <h1>${esc(student.first_name)} ${esc(student.last_name)} — Writing progress comparison</h1>
    <p class="meta">
      Period ${esc(student.period != null ? String(student.period) : '—')}<br/>
      Report generated: ${esc(genLabel)}
    </p>
  </header>

  <h2>Growth summary</h2>
  <div class="summary">
    <p>${nl2br(c.overall_growth_summary)}</p>
    <p><strong>What stayed strong</strong><br/>${nl2br(c.what_stayed_strong)}</p>
    <p><strong>Next instructional move</strong><br/>${nl2br(next.move)}</p>
    ${next.rationale ? `<p><strong>Rationale</strong><br/>${nl2br(next.rationale)}</p>` : ''}
  </div>

  <h2>Entry-by-entry</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Assignment</th><th>Summary</th><th>Strongest moment</th><th>Biggest opportunity</th>
      </tr>
    </thead>
    <tbody>${entryRows || '<tr><td colspan="5" class="muted">No rows.</td></tr>'}</tbody>
  </table>

  <h2>Growth moments</h2>
  ${moments || '<p class="muted">None listed.</p>'}

  <h2>Persistent gaps</h2>
  ${gaps || '<p class="muted">None listed.</p>'}

  <h2>Next step — try this with the student</h2>
  <div class="block">
    <p><strong>Move:</strong> ${nl2br(next.move)}</p>
    <p><strong>Rationale:</strong> ${nl2br(next.rationale)}</p>
    <p><strong>Try this:</strong> ${nl2br(next.try_this)}</p>
  </div>

  ${
    showIepBlock
      ? `<section class="confidential">
    <h2>TEACHER COPY — CONFIDENTIAL — IEP connection</h2>
    <p>${nl2br(iepConn)}</p>
  </section>`
      : ''
  }

  <section class="student-page">
    <h2>For student — conference script</h2>
    <p class="muted" style="font-family: system-ui, sans-serif; font-size: 0.85rem;">Written at 9th grade reading level. Edit before sharing.</p>
    <div class="student-script">${nl2br(c.conference_script)}</div>
  </section>
</body>
</html>`;
}

export function openComparisonReportInNewTab(student, comparisonData, hasIepFlags) {
  const html = buildComparisonReportHtml({
    student,
    comparison: comparisonData.comparison,
    generatedAt: comparisonData.generated_at,
    hasIepFlags,
  });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return true;
}
