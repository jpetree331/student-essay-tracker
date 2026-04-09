/**
 * Print-ready HTML for an assignment: one page per student (alphabetical),
 * writing sample + teacher notes (teacher_notes). Opens print dialog; user may Save as PDF.
 */

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockOrNotEntered(text) {
  if (text == null || String(text).trim() === '') {
    return '<p class="not-entered">Not entered</p>';
  }
  const escaped = esc(text);
  const withBreaks = escaped.replace(/\r\n/g, '\n').split('\n').join('<br/>');
  return `<div class="body-text">${withBreaks}</div>`;
}

/**
 * @param {object} data — { assignment: { name, unit, ... }, students: [{ first_name, last_name, writing_sample, teacher_notes }] }
 */
export function buildAssignmentPrintHtml(data) {
  const assignment = data.assignment || {};
  const students = Array.isArray(data.students) ? data.students : [];
  const title = esc(assignment.name || 'Assignment');

  const sections = students.map(
    (s, i) => `
    <section class="student-section" aria-label="Student ${i + 1}">
      <h1 class="student-name">${esc(s.last_name)}, ${esc(s.first_name)}</h1>
      <h2 class="block-label">Writing Sample:</h2>
      ${blockOrNotEntered(s.writing_sample)}
      <h2 class="block-label feedback-label">Feedback:</h2>
      ${blockOrNotEntered(s.teacher_notes)}
    </section>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    @page {
      size: letter;
      margin: 1in;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
      padding: 0;
    }
    .cover {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #ccc;
    }
    .cover h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
    .cover .meta { font-size: 0.95rem; color: #444; margin: 0; }
    .student-section {
      page-break-after: always;
      padding-top: 0.25rem;
    }
    .student-section:last-of-type {
      page-break-after: auto;
    }
    .student-name {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 1.25rem;
      color: #0f172a;
      border-bottom: 2px solid #334155;
      padding-bottom: 0.35rem;
    }
    .block-label {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      margin: 1.25rem 0 0.5rem;
    }
    .feedback-label { margin-top: 1.5rem; }
    .body-text {
      margin: 0;
      white-space: pre-wrap;
      border: 1px solid #ddd;
      padding: 0.75rem 1rem;
      background: #fafafa;
      min-height: 3rem;
    }
    .not-entered {
      margin: 0;
      font-style: italic;
      color: #64748b;
      border: 1px dashed #cbd5e1;
      padding: 0.75rem 1rem;
      background: #f8fafc;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header class="cover">
    <h1>${title}</h1>
    <p class="meta">${esc([assignment.unit, assignment.date_assigned].filter(Boolean).join(' · ') || 'Class writing')}</p>
  </header>
  ${sections.join('\n') || '<p class="not-entered">No student submissions for this assignment yet.</p>'}
</body>
</html>`;
}

/**
 * Opens print dialog (user can choose “Save as PDF”). Returns false if pop-up blocked.
 */
export function openAssignmentPrintInNewTab(data) {
  const html = buildAssignmentPrintHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  // Do not pass noopener in windowFeatures: many browsers return null (no WindowProxy),
  // so print() could never run. Detach opener after open instead.
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  try {
    w.opener = null;
  } catch {
    /* ignore */
  }
  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  w.addEventListener('load', () => setTimeout(runPrint, 150), { once: true });
  setTimeout(runPrint, 900);
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return true;
}
