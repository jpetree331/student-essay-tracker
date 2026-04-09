import { formatLongDate } from './dates';
import { parseAssignmentSources } from './assignmentSources';
import { parseIepGoals } from './iepGoals';

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

/** Only allow http(s) and mailto: in printable report links (avoid javascript: etc.). */
function isSafeHref(url) {
  if (url == null || typeof url !== 'string') return false;
  const t = url.trim();
  return /^https?:\/\//i.test(t) || /^mailto:/i.test(t);
}

function tagSummary(entry) {
  const parts = [];
  if (entry.claim_present === true) parts.push('Claim present');
  if (entry.evidence_cited === true) parts.push('Evidence cited');
  if (entry.explanation_present === true) parts.push('Explanation present');
  if (entry.source_named === true) parts.push('Source named');
  if (entry.response_incomplete === true) parts.push('Incomplete');
  if (entry.ai_flag === true) parts.push('AI flag');
  return parts.length ? parts.join(' · ') : 'No tags recorded';
}

/**
 * @param {object} student — { first_name, last_name, period, iep_flags, iep_goals, entries: [...] }
 */
export function buildStudentReportHtml(student) {
  const entries = Array.isArray(student.entries) ? [...student.entries] : [];
  entries.sort((a, b) => {
    const da = String(a.date_submitted || '').slice(0, 10);
    const db = String(b.date_submitted || '').slice(0, 10);
    if (da !== db) return da.localeCompare(db);
    return (a.id || 0) - (b.id || 0);
  });

  const iepGoalLines = parseIepGoals(student.iep_goals);
  const iepGoalsPrint =
    iepGoalLines.length === 0
      ? 'None on file.'
      : iepGoalLines.map((g, i) => `${i + 1}. ${esc(g)}`).join('<br/>');

  const blocks = entries.map((en) => {
    const assignDocs = parseAssignmentSources(en.assignment_source_documents);
    return `
    <article class="entry">
      <h2>${esc(formatLongDate(en.date_submitted))} — ${esc(en.assignment_name || 'Assignment')}</h2>
      <section>
        <h3>AKS standard</h3>
        <p class="box">${nl2br(en.assignment_aks_standard || '—')}</p>
      </section>
      <section>
        <h3>Assignment source materials</h3>
        ${
          assignDocs.length
            ? `<ul>${assignDocs
                .map((l) => {
                  const u = l.url;
                  const label = esc(l.label || l.url || 'Link');
                  if (isSafeHref(u)) {
                    return `<li><a href="${esc(u.trim())}">${label}</a></li>`;
                  }
                  return `<li><span class="muted">${label}</span> <code>${esc(u || '')}</code></li>`;
                })
                .join('')}</ul>`
            : '<p class="muted">None listed for this assignment.</p>'
        }
      </section>
      <section>
        <h3>Source documents (this entry)</h3>
        ${
          (en.source_links || []).length
            ? `<ul>${(en.source_links || [])
                .map((l) => {
                  const u = l.url;
                  const label = esc(l.label || l.url || 'Link');
                  if (isSafeHref(u)) {
                    return `<li><a href="${esc(u.trim())}">${label}</a></li>`;
                  }
                  return `<li><span class="muted">${label}</span> <code>${esc(u || '')}</code></li>`;
                })
                .join('')}</ul>`
            : '<p class="muted">None listed.</p>'
        }
      </section>
      <section>
        <h3>Writing sample</h3>
        <p class="box sample">${nl2br(en.writing_sample || '—')}</p>
      </section>
      <section>
        <h3>Student feedback</h3>
        <p class="box">${nl2br(en.student_feedback || '—')}</p>
      </section>
      <section class="confidential">
        <h3>Teacher notes — TEACHER COPY - CONFIDENTIAL</h3>
        <p class="box">${nl2br(en.teacher_notes || '—')}</p>
      </section>
      <section>
        <h3>Writing move tags</h3>
        <p>${esc(tagSummary(en))}</p>
      </section>
    </article>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(student.first_name)} ${esc(student.last_name)} — Writing report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.5; margin: 0; padding: 0.75in; }
    h1 { font-size: 1.75rem; margin: 0 0 0.25rem; font-family: system-ui, sans-serif; }
    .meta { font-family: system-ui, sans-serif; font-size: 0.9rem; color: #444; margin-bottom: 2rem; }
    .entry { page-break-after: always; }
    .entry:last-child { page-break-after: auto; }
    h2 { font-size: 1.2rem; margin: 1.5rem 0 0.75rem; font-family: system-ui, sans-serif; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: #555; margin: 1rem 0 0.35rem; font-family: system-ui, sans-serif; }
    .box { margin: 0; white-space: pre-wrap; border: 1px solid #ddd; padding: 0.75rem; background: #fafafa; }
    .sample { min-height: 4rem; }
    .muted { color: #666; font-style: italic; }
    ul { margin: 0.25rem 0; padding-left: 1.25rem; }
    a { color: #0369a1; }
    .confidential h3 { color: #7f1d1d; }
    @media print { body { padding: 0.5in; } }
  </style>
</head>
<body>
  <header>
    <h1>${esc(student.first_name)} ${esc(student.last_name)}</h1>
    <p class="meta">
      Period ${esc(student.period != null ? String(student.period) : '—')}<br/>
      Disabilities / classification: ${nl2br(student.iep_flags?.trim() ? student.iep_flags : 'None on file.')}<br/>
      IEP goals:<br/>${iepGoalsPrint}
    </p>
  </header>
  ${blocks.join('\n') || '<p class="muted">No entries yet.</p>'}
</body>
</html>`;
}

export function openStudentReportInNewTab(student) {
  const html = buildStudentReportHtml(student);
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
