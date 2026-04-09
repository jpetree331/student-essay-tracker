import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  analyzeWriting,
  getClassSummary,
  getUntaggedEntriesForAnalysis,
  upsertWritingTags,
} from '../../api/client';
import { downloadTextFile, rowsToCsv } from '../../lib/csv';
import { ChartSkeleton } from './ChartSkeleton';
import { TagFrequencyBarChart } from './TagFrequencyBarChart';
import { WordCountByPeriodChart } from './WordCountByPeriodChart';

const PERIOD_TABLE_HEADERS = [
  { key: 'period', label: 'Period' },
  { key: 'student_count', label: 'Students' },
  { key: 'entry_count', label: 'Total Entries' },
  { key: 'avg_word_count', label: 'Avg Word Count' },
  { key: 'pct_claim_present', label: '% Claim Present' },
  { key: 'pct_evidence_cited', label: '% Evidence Cited' },
  { key: 'pct_explanation_present', label: '% Explanation Present' },
  { key: 'pct_source_named', label: '% Source Named' },
  { key: 'pct_response_incomplete', label: '% Incomplete' },
  { key: 'pct_ai_flag', label: '% AI Flag' },
];

function formatCell(key, val) {
  if (key === 'avg_word_count') {
    return val != null ? Number(val).toFixed(1) : '0.0';
  }
  if (String(key).startsWith('pct_')) {
    return val != null ? `${Number(val).toFixed(1)}%` : '0.0%';
  }
  return val ?? '—';
}

export function ClassDataView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tagPeriodFilter, setTagPeriodFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'period', dir: 'asc' });

  const [untagged, setUntagged] = useState({ entries: [], count: 0 });
  const [untaggedLoading, setUntaggedLoading] = useState(true);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchMessage, setBatchMessage] = useState(null);

  const reloadClassSummary = useCallback(async () => {
    try {
      const summary = await getClassSummary();
      setData(summary);
    } catch {
      /* leave existing data */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await getClassSummary();
        if (!cancelled) setData(summary);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load class data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setUntaggedLoading(true);
      try {
        const r = await getUntaggedEntriesForAnalysis();
        if (!cancelled) {
          setUntagged({
            entries: Array.isArray(r.entries) ? r.entries : [],
            count: typeof r.count === 'number' ? r.count : (r.entries || []).length,
          });
        }
      } catch {
        if (!cancelled) setUntagged({ entries: [], count: 0 });
      } finally {
        if (!cancelled) setUntaggedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runBatchUntagged = useCallback(async () => {
    const entries = untagged.entries;
    if (!entries.length || batchBusy) return;
    if (
      !window.confirm(
        `Analyze ${entries.length} untagged entries with AI? This may take a moment.`
      )
    ) {
      return;
    }
    setBatchMessage(null);
    setBatchBusy(true);
    let failed = 0;
    try {
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        setBatchProgress({ current: i + 1, total: entries.length });
        try {
          const result = await analyzeWriting({
            writing_sample: e.writing_sample,
            assignment_context: e.assignment_context,
          });
          const s = result.suggestions;
          if (!s) throw new Error('No suggestions');
          await upsertWritingTags({
            entry_id: e.entry_id,
            claim_present: !!s.claim_present,
            evidence_cited: !!s.evidence_cited,
            explanation_present: !!s.explanation_present,
            source_named: !!s.source_named,
            response_incomplete: !!s.response_incomplete,
            ai_flag: !!s.ai_flag,
          });
        } catch {
          failed += 1;
        }
        if (i < entries.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      await reloadClassSummary();
      try {
        const r = await getUntaggedEntriesForAnalysis();
        setUntagged({
          entries: Array.isArray(r.entries) ? r.entries : [],
          count: typeof r.count === 'number' ? r.count : (r.entries || []).length,
        });
      } catch {
        setUntagged({ entries: [], count: 0 });
      }
      if (failed > 0) {
        setBatchMessage(`${failed} entr${failed === 1 ? 'y' : 'ies'} could not be analyzed.`);
      } else {
        setBatchMessage('Batch analysis complete.');
      }
    } finally {
      setBatchBusy(false);
      setBatchProgress(null);
    }
  }, [untagged.entries, batchBusy, reloadClassSummary]);

  const tagFrequenciesForChart = useMemo(() => {
    if (!data) return {};
    if (tagPeriodFilter === 'all') return data.tag_frequencies || {};
    const byP = data.tag_frequencies_by_period || {};
    return byP[String(tagPeriodFilter)] || {};
  }, [data, tagPeriodFilter]);

  const sortedPeriodRows = useMemo(() => {
    const rows = Array.isArray(data?.per_period) ? [...data.per_period] : [];
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * mul;
    });
    return rows;
  }, [data, sort]);

  const toggleSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }, []);

  const exportPeriodTableCsv = useCallback(() => {
    const rows = sortedPeriodRows.map((r) => ({
      period: r.period,
      student_count: r.student_count,
      entry_count: r.entry_count,
      avg_word_count: r.avg_word_count != null ? Number(r.avg_word_count).toFixed(1) : '',
      pct_claim_present: r.pct_claim_present != null ? `${Number(r.pct_claim_present).toFixed(1)}%` : '',
      pct_evidence_cited:
        r.pct_evidence_cited != null ? `${Number(r.pct_evidence_cited).toFixed(1)}%` : '',
      pct_explanation_present:
        r.pct_explanation_present != null ? `${Number(r.pct_explanation_present).toFixed(1)}%` : '',
      pct_source_named:
        r.pct_source_named != null ? `${Number(r.pct_source_named).toFixed(1)}%` : '',
      pct_response_incomplete:
        r.pct_response_incomplete != null ? `${Number(r.pct_response_incomplete).toFixed(1)}%` : '',
      pct_ai_flag: r.pct_ai_flag != null ? `${Number(r.pct_ai_flag).toFixed(1)}%` : '',
    }));
    const csv = rowsToCsv(PERIOD_TABLE_HEADERS, rows);
    downloadTextFile(`class-summary-by-period-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [sortedPeriodRows]);

  const exportEntryCsv = useCallback(() => {
    const rows = data?.entry_export_rows || [];
    const headers = [
      { key: 'student_last', label: 'student_last' },
      { key: 'student_first', label: 'student_first' },
      { key: 'period', label: 'period' },
      { key: 'assignment_name', label: 'assignment_name' },
      { key: 'unit', label: 'unit' },
      { key: 'aks_standard', label: 'aks_standard' },
      { key: 'date_submitted', label: 'date_submitted' },
      { key: 'word_count', label: 'word_count' },
      { key: 'claim_present', label: 'claim_present' },
      { key: 'evidence_cited', label: 'evidence_cited' },
      { key: 'explanation_present', label: 'explanation_present' },
      { key: 'source_named', label: 'source_named' },
      { key: 'response_incomplete', label: 'response_incomplete' },
      { key: 'ai_flag', label: 'ai_flag' },
      { key: 'writing_sample_excerpt', label: 'writing_sample_excerpt' },
    ];
    const normalized = rows.map((r) => ({
      ...r,
      claim_present: r.claim_present ? 'TRUE' : 'FALSE',
      evidence_cited: r.evidence_cited ? 'TRUE' : 'FALSE',
      explanation_present: r.explanation_present ? 'TRUE' : 'FALSE',
      source_named: r.source_named ? 'TRUE' : 'FALSE',
      response_incomplete: r.response_incomplete ? 'TRUE' : 'FALSE',
      ai_flag: r.ai_flag ? 'TRUE' : 'FALSE',
    }));
    const csv = rowsToCsv(headers, normalized);
    downloadTextFile(`class-entries-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [data]);

  if (error) {
    return (
      <div className="w-full p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const periods = Array.isArray(data?.periods) ? data.periods : [];

  return (
    <div className="w-full space-y-10 p-6">
      {!error && !untaggedLoading && untagged.count > 0 && (
        <section className="w-full rounded-lg border border-violet-900/40 bg-violet-950/15 p-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-violet-200">Batch auto-tag</p>
              <p className="mt-1 text-xs text-slate-500">
                {untagged.count} entr{untagged.count === 1 ? 'y' : 'ies'} with no writing tags
                yet (samples ≥ 50 characters). Suggestions are applied directly; review entries on
                the roster afterward.
              </p>
            </div>
            <button
              type="button"
              onClick={runBatchUntagged}
              disabled={batchBusy || loading}
              className="shrink-0 rounded-md border border-violet-700 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/40 disabled:opacity-40"
            >
              {batchBusy ? 'Analyzing…' : 'Analyze untagged entries'}
            </button>
          </div>
          {batchProgress && (
            <p className="mt-3 text-sm text-slate-400">
              Analyzing entry {batchProgress.current} of {batchProgress.total}…
            </p>
          )}
          {batchMessage && (
            <p className="mt-2 text-xs text-slate-500">{batchMessage}</p>
          )}
        </section>
      )}

      <section className="w-full rounded-lg border border-slate-800 bg-slate-900/30 p-5">
        <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-base font-semibold text-white">
            Writing move frequency — all entries
          </h2>
          <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
            <span>Period</span>
            <select
              value={tagPeriodFilter}
              onChange={(e) => setTagPeriodFilter(e.target.value)}
              disabled={loading}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            >
              <option value="all">All Periods</option>
              {periods.map((p) => (
                <option key={p} value={String(p)}>
                  Period {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <ChartSkeleton className="h-[340px]" />
        ) : (
          <TagFrequencyBarChart tagFrequencies={tagFrequenciesForChart} />
        )}
      </section>

      <section className="w-full rounded-lg border border-slate-800 bg-slate-900/30 p-5">
        <h2 className="mb-4 text-base font-semibold text-white">
          Average word count over time by period
        </h2>
        {loading ? (
          <ChartSkeleton className="h-[360px]" />
        ) : (
          <WordCountByPeriodChart wordCountByDate={data?.word_count_by_date} />
        )}
      </section>

      <section className="w-full">
        <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-white">Per-period summary</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportPeriodTableCsv}
              disabled={loading || !sortedPeriodRows.length}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
            >
              Export Class Data
            </button>
            <button
              type="button"
              onClick={exportEntryCsv}
              disabled={loading || !(data?.entry_export_rows?.length > 0)}
              className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Export Class CSV
            </button>
          </div>
        </div>
        <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
          {loading ? (
            <ChartSkeleton className="m-4 h-48" />
          ) : !sortedPeriodRows.length ? (
            <p className="p-8 text-center text-sm text-slate-500">No period rows yet.</p>
          ) : (
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                  {PERIOD_TABLE_HEADERS.map((h) => (
                    <th key={h.key} className="px-3 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort(h.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-300"
                      >
                        {h.label}
                        {sort.key === h.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPeriodRows.map((row) => (
                  <tr
                    key={row.period}
                    className="border-b border-slate-800/80 text-slate-200 last:border-0 hover:bg-slate-900/40"
                  >
                    {PERIOD_TABLE_HEADERS.map((h) => (
                      <td key={h.key} className="px-3 py-3 tabular-nums">
                        {formatCell(h.key, row[h.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
