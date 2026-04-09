import { useCallback, useEffect, useState } from 'react';
import { openComparisonReportInNewTab } from '../../lib/comparisonReportHtml';

function ClockIcon({ className }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressComparisonLoading({ firstName, messages }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [firstName, messages]);

  useEffect(() => {
    if (!messages?.length) return undefined;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(id);
  }, [messages]);

  const safeName = firstName?.trim() || 'this student';
  const resolved = (messages || []).map((m) => m.replace(/\{name\}/g, safeName));
  const line = resolved[idx] ?? resolved[0] ?? 'Working on your comparison…';

  return (
    <div className="w-full rounded-2xl border border-amber-900/40 bg-gradient-to-b from-amber-950/50 to-stone-950 px-6 py-16 text-center shadow-inner">
      <div className="mx-auto max-w-md">
        <div
          className="mx-auto mb-8 h-12 w-12 animate-pulse rounded-full bg-amber-500/20 ring-2 ring-amber-400/30"
          aria-hidden
        />
        <p className="font-serif text-lg leading-relaxed text-amber-50/95">{line}</p>
        <p className="mt-6 text-sm text-amber-200/60">This usually takes a little patience — your entries are safe.</p>
      </div>
    </div>
  );
}

export function ProgressComparisonPanel({
  student,
  comparisonData,
  hasIepFlagsOnFile,
  onBack,
  onSave,
  saveState,
}) {
  const [copied, setCopied] = useState(false);
  const c = comparisonData?.comparison || {};
  const next = c.next_instructional_step || {};
  const first = student?.first_name?.trim() || 'your student';

  const iepText = next.iep_connection;
  const fromSavedRecord = comparisonData?.model_used === 'saved';
  const showIepUi =
    hasIepFlagsOnFile &&
    iepText != null &&
    String(iepText).trim() &&
    String(iepText).toLowerCase() !== 'null';

  const copyScript = useCallback(async () => {
    const text = c.conference_script || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.alert('Could not copy — select the text manually.');
    }
  }, [c.conference_script]);

  const handleExport = useCallback(() => {
    const ok = openComparisonReportInNewTab(student, comparisonData, hasIepFlagsOnFile);
    if (!ok) window.alert('Allow pop-ups to open the printable report.');
  }, [student, comparisonData, hasIepFlagsOnFile]);

  return (
    <div className="w-full space-y-6 pb-16 font-serif text-stone-100">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-sans font-medium text-teal-300 hover:text-teal-200"
        >
          ← Back to entries
        </button>
      </div>

      {/* Section 1 — Growth summary */}
      <section className="rounded-2xl border border-stone-700/80 bg-stone-900/60 p-6 shadow-lg">
        <div className="border-l-4 border-emerald-400/90 pl-5">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
            Growth across samples
          </h3>
          <p className="mt-3 text-lg leading-relaxed text-stone-100">{c.overall_growth_summary}</p>
        </div>
        <div className="mt-6 grid gap-6 border-t border-stone-700/60 pt-6 md:grid-cols-2">
          <div>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-wide text-stone-400">
              What stayed strong
            </h4>
            <p className="mt-2 text-base leading-relaxed text-stone-200">{c.what_stayed_strong}</p>
          </div>
          <div>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-wide text-stone-400">
              Next step
            </h4>
            <p className="mt-2 text-base font-medium leading-relaxed text-amber-100/95">{next.move}</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">{next.rationale}</p>
            {next.try_this ? (
              <p className="mt-3 border-t border-stone-700/60 pt-3 text-sm italic leading-relaxed text-stone-400">
                Try this: {next.try_this}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Section 2 — Conference script */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-800/50 bg-gradient-to-br from-amber-950/80 to-stone-900 p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-sans text-sm font-semibold text-amber-100">
              Conference script — read this to {first}
            </h3>
            <p className="mt-1 font-sans text-xs text-amber-200/70">
              Written at 9th grade reading level. Edit freely before using.
            </p>
          </div>
          <button
            type="button"
            onClick={copyScript}
            className="shrink-0 rounded-md border border-amber-600/50 bg-amber-950/50 px-3 py-1.5 font-sans text-xs font-medium text-amber-50 hover:bg-amber-900/50"
          >
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
        </div>
        <p className="mt-5 text-lg leading-relaxed text-amber-50/95">{c.conference_script}</p>
      </section>

      {/* Section 3 — Growth moments */}
      {Array.isArray(c.growth_moments) && c.growth_moments.length > 0 && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-teal-300/90">
            Growth moments
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {c.growth_moments.map((m, i) => (
              <article
                key={i}
                className="min-w-[260px] max-w-sm shrink-0 rounded-xl border border-teal-800/40 bg-teal-950/35 p-4 shadow-md"
              >
                <p className="font-sans text-xs font-semibold text-teal-200/90">
                  Entry {m.from_entry} → Entry {m.to_entry}
                </p>
                <p className="mt-2 text-sm font-semibold text-stone-100">{m.what_changed}</p>
                <p className="mt-2 text-sm italic text-teal-100/85">“{m.evidence}”</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Section 4 — Persistent gaps */}
      {Array.isArray(c.persistent_gaps) && c.persistent_gaps.length > 0 && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-amber-200/80">
            Persistent gaps
          </h3>
          <div className="flex flex-wrap gap-3">
            {c.persistent_gaps.map((g, i) => (
              <article
                key={i}
                className="min-w-[200px] flex-1 rounded-xl border border-amber-800/45 bg-amber-950/25 p-4"
              >
                <h4 className="font-sans text-sm font-semibold text-amber-100">{g.gap_name}</h4>
                <p className="mt-2 text-sm leading-relaxed text-stone-200">{g.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(g.present_in_entries || []).map((eid) => (
                    <span
                      key={eid}
                      className="rounded-full border border-amber-700/40 bg-amber-950/50 px-2 py-0.5 font-sans text-[10px] font-medium text-amber-100/90"
                    >
                      Entry {eid}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Section 5 — Entry table */}
      {Array.isArray(c.entry_by_entry) && c.entry_by_entry.length > 0 && (
        <section>
          <h3 className="mb-3 font-sans text-xs font-semibold uppercase tracking-widest text-stone-400">
            Entry-by-entry breakdown
          </h3>
          <div className="overflow-x-auto rounded-xl border border-stone-700 bg-stone-950/40">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-700 font-sans text-[10px] uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Assignment</th>
                  <th className="px-3 py-2">Summary</th>
                  <th className="px-3 py-2">Strongest moment</th>
                  <th className="px-3 py-2">Biggest opportunity</th>
                </tr>
              </thead>
              <tbody>
                {c.entry_by_entry.map((row, i) => (
                  <tr key={i} className="border-b border-stone-800/80 align-top text-stone-200">
                    <td className="whitespace-nowrap px-3 py-2 font-sans text-xs text-stone-400">
                      {row.date}
                    </td>
                    <td className="px-3 py-2">{row.assignment_name}</td>
                    <td className="px-3 py-2">{row.one_line_summary}</td>
                    <td className="px-3 py-2 italic text-stone-300">“{row.strongest_moment}”</td>
                    <td className="px-3 py-2">{row.biggest_opportunity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 6 — IEP */}
      {showIepUi && (
        <section className="rounded-xl border border-sky-900/50 bg-sky-950/30 px-4 py-4">
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-sky-300/90">
            IEP connection
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-sky-100/90">{iepText}</p>
        </section>
      )}

      {/* Save & export */}
      <div className="flex flex-wrap items-center gap-3 border-t border-stone-800 pt-6 font-sans">
        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving' || fromSavedRecord || saveState === 'saved'}
          className="rounded-md bg-emerald-800/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {fromSavedRecord
            ? 'Already saved to record'
            : saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved ✓'
                : 'Save this comparison'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-stone-600 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800/80"
        >
          Export comparison report
        </button>
        {saveState === 'saved' && (
          <span className="text-sm text-emerald-300/90">Saved to this student&apos;s record.</span>
        )}
      </div>
    </div>
  );
}

export function SavedComparisonChips({ rows, entriesById, onSelect }) {
  if (!rows?.length) return null;

  function toYmd(v) {
    if (v == null) return '';
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }

  function labelForSaved(row) {
    const ids = Array.isArray(row.entry_ids) ? row.entry_ids : [];
    const dates = ids
      .map((id) => entriesById.get(id)?.date_submitted)
      .filter((d) => d != null && String(d).trim() !== '')
      .map(toYmd)
      .filter(Boolean)
      .sort();
    if (dates.length >= 2) {
      const a = dates[0];
      const b = dates[dates.length - 1];
      const fmt = (ymd) => {
        const [y, m, d] = ymd.split('-').map(Number);
        if (!y) return ymd;
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };
      return `${fmt(a)} → ${fmt(b)}`;
    }
    return ids.length ? `${ids.length} entries` : 'Comparison';
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 font-sans">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Saved comparisons
      </span>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelect(row)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-200 hover:border-teal-600/50 hover:bg-slate-800"
        >
          <ClockIcon className="text-slate-400" />
          {labelForSaved(row)}
        </button>
      ))}
    </div>
  );
}
