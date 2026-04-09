import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { getStudentAnalytics } from '../../api/client';
import { useAppState } from '../../context/AppStateContext';
import { formatChipDate } from '../../lib/dates';
import { openStudentReportInNewTab } from '../../lib/studentReportHtml';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartSkeleton } from './ChartSkeleton';

function BoolCell({ v }) {
  if (v === true) return <span className="text-emerald-400">✓</span>;
  if (v === false) return <span className="text-slate-600">✕</span>;
  return <span className="text-slate-600">—</span>;
}

export function StudentDataView() {
  const { selectedStudentId } = useAppState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (selectedStudentId == null) {
      setData(null);
      setError(null);
      setLoading(false);
      setExpandedId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setExpandedId(null);
      try {
        const res = await getStudentAnalytics(selectedStudentId);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load student analytics');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  const wordLineData = useMemo(() => {
    const entries = data?.entries || [];
    return entries.map((e) => ({
      date: e.date_submitted ? String(e.date_submitted).slice(0, 10) : '',
      word_count: e.word_count != null ? Number(e.word_count) : 0,
      id: e.id,
    }));
  }, [data]);

  const exportReport = useCallback(() => {
    if (!data?.student || !data?.entries) return;
    const ok = openStudentReportInNewTab({
      ...data.student,
      entries: data.entries,
    });
    if (!ok) {
      window.alert('Allow pop-ups to open the printable report.');
    }
  }, [data]);

  if (selectedStudentId == null) {
    return (
      <div className="w-full p-8 text-center">
        <p className="text-slate-400">
          Select a student in the sidebar to see their analytics and export options.
        </p>
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

  const student = data?.student;
  const entries = data?.entries || [];

  return (
    <div className="w-full space-y-8 p-6">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            {loading ? 'Loading…' : `${student?.first_name ?? ''} ${student?.last_name ?? ''}`}
          </h2>
          {!loading && student && (
            <p className="mt-1 text-sm text-slate-500">Period {student.period}</p>
          )}
        </div>
        <button
          type="button"
          onClick={exportReport}
          disabled={loading || !entries.length}
          className="shrink-0 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          Export Student Report
        </button>
      </div>

      <section className="w-full rounded-lg border border-slate-800 bg-slate-900/30 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Word count over time
        </h3>
        {loading ? (
          <ChartSkeleton className="h-[300px]" />
        ) : !wordLineData.length ? (
          <p className="py-10 text-center text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wordLineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  angle={-18}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    color: '#f1f5f9',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="word_count"
                  name="Word count"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="w-full">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tag history by entry
        </h3>
        {loading ? (
          <ChartSkeleton className="h-56" />
        ) : !entries.length ? (
          <p className="py-8 text-center text-sm text-slate-500">No entries to show.</p>
        ) : (
          <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Assignment</th>
                  <th className="px-3 py-3 font-medium text-center">Claim</th>
                  <th className="px-3 py-3 font-medium text-center">Evidence</th>
                  <th className="px-3 py-3 font-medium text-center">Explanation</th>
                  <th className="px-3 py-3 font-medium text-center">Source Named</th>
                  <th className="px-3 py-3 font-medium text-center">Incomplete</th>
                  <th className="px-3 py-3 font-medium text-center">AI Flag</th>
                  <th className="px-3 py-3 font-medium text-right">Words</th>
                  <th className="px-3 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((en) => {
                  const open = expandedId === en.id;
                  return (
                    <Fragment key={en.id}>
                      <tr className="border-b border-slate-800/80 text-slate-200 hover:bg-slate-900/40">
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatChipDate(en.date_submitted)}
                        </td>
                        <td className="max-w-[220px] px-3 py-3">
                          <span className="line-clamp-2">{en.assignment_name || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.claim_present} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.evidence_cited} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.explanation_present} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.source_named} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.response_incomplete} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <BoolCell v={en.ai_flag} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{en.word_count ?? '—'}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(open ? null : en.id)}
                            className="text-xs font-medium text-sky-400 hover:text-sky-300"
                          >
                            {open ? 'Hide sample' : 'Show sample'}
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-slate-800 bg-slate-950/80">
                          <td colSpan={10} className="px-4 py-4">
                            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                              Writing sample
                            </p>
                            <p className="whitespace-pre-wrap text-sm text-slate-300">
                              {en.writing_sample?.trim() || '—'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
