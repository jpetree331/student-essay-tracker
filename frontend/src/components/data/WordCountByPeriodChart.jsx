import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const STROKES = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#2dd4bf', '#fb923c'];

export function WordCountByPeriodChart({ wordCountByDate }) {
  const { chartData, periods } = useMemo(() => {
    if (!Array.isArray(wordCountByDate) || !wordCountByDate.length) {
      return { chartData: [], periods: [] };
    }
    const dates = [
      ...new Set(wordCountByDate.map((r) => r.date).filter(Boolean)),
    ].sort();
    const periods = [...new Set(wordCountByDate.map((r) => r.period))].sort(
      (a, b) => Number(a) - Number(b)
    );
    const map = new Map();
    for (const r of wordCountByDate) {
      if (r.date == null) continue;
      map.set(`${r.date}|${r.period}`, Number(r.avg_word_count) || 0);
    }
    const chartData = dates.map((date) => {
      const row = { date };
      for (const p of periods) {
        const k = `period_${p}`;
        row[k] = map.has(`${date}|${p}`) ? Number(map.get(`${date}|${p}`).toFixed(1)) : null;
      }
      return row;
    });
    return { chartData, periods };
  }, [wordCountByDate]);

  if (!chartData.length || !periods.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No entry dates yet — chart will appear once students submit writing.
      </p>
    );
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            angle={-20}
            textAnchor="end"
            height={52}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{
              value: 'Avg words',
              angle: -90,
              position: 'insideLeft',
              fill: '#64748b',
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={{
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#f1f5f9',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {periods.map((p, i) => (
            <Line
              key={p}
              type="monotone"
              dataKey={`period_${p}`}
              name={`Period ${p}`}
              stroke={STROKES[i % STROKES.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
