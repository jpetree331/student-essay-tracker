import { useEffect, useMemo, useState } from 'react';
import { getClassSummary } from '../../api/client';
import { TagFrequencyChart } from './TagFrequencyChart';

const SKILL_TAGS = [
  { key: 'claim_present', label: 'Claim present' },
  { key: 'evidence_cited', label: 'Evidence cited' },
  { key: 'explanation_present', label: 'Explanation present' },
  { key: 'source_named', label: 'Source named' },
];

function computeMostCommonGap(tagFrequencies) {
  if (!tagFrequencies) return { label: '—', detail: 'No data' };
  let min = Infinity;
  const atMin = [];
  for (const { key, label: l } of SKILL_TAGS) {
    const c = Number(tagFrequencies[key]) || 0;
    if (c < min) {
      min = c;
      atMin.length = 0;
      atMin.push(l);
    } else if (c === min) {
      atMin.push(l);
    }
  }
  if (min === Infinity) return { label: '—', detail: 'No data' };
  const label = atMin.length > 1 ? 'Tied (lowest count)' : atMin[0];
  const detail =
    atMin.length > 1
      ? `${atMin.join(', ')} — ${min} entries each`
      : `${min} entries with this tag`;
  return { label, detail };
}

function MetricCard({ title, value, subtitle, valueClass = 'text-3xl' }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`mt-2 font-semibold text-white ${valueClass}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function ClassSummaryDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await getClassSummary();
        if (!cancelled) setData(summary);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const gap = useMemo(() => computeMostCommonGap(data?.tag_frequencies), [data]);

  if (loading) {
    return (
      <div className="w-full p-6">
        <p className="text-slate-400">Loading class summary…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data || typeof data !== 'object') {
    return (
      <div className="w-full p-6">
        <p className="text-slate-400">No summary data.</p>
      </div>
    );
  }

  const tf = data.tag_frequencies || {};

  return (
    <div className="w-full space-y-8 p-6">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total students" value={data.total_students ?? '—'} />
        <MetricCard title="Total entries" value={data.total_entries ?? '—'} />
        <MetricCard title="Entries this week" value={data.entries_this_week ?? '—'} />
        <MetricCard
          title="Most common gap"
          value={gap.label}
          subtitle={gap.detail}
          valueClass="text-xl leading-snug"
        />
      </div>

      <section className="w-full">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tag frequency (all entries)
        </h2>
        <div className="w-full rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <TagFrequencyChart tagFrequencies={tf} />
        </div>
      </section>

      <section className="w-full">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Per-period breakdown
        </h2>
        <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Total entries</th>
                <th className="px-4 py-3 font-medium">Avg word count</th>
              </tr>
            </thead>
            <tbody>
              {(data.per_period || []).map((row) => (
                <tr
                  key={row.period}
                  className="border-b border-slate-800/80 text-slate-200 last:border-0 hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3 tabular-nums">{row.period}</td>
                  <td className="px-4 py-3 tabular-nums">{row.student_count}</td>
                  <td className="px-4 py-3 tabular-nums">{row.entry_count}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.avg_word_count != null ? Number(row.avg_word_count).toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(data.per_period || []).length && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No period data.</p>
          )}
        </div>
      </section>
    </div>
  );
}
