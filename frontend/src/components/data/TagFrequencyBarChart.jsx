import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TAG_CHART_ROWS } from '../../lib/tagChartColors';

export function TagFrequencyBarChart({ tagFrequencies }) {
  const data = TAG_CHART_ROWS.map((r) => ({
    name: r.name,
    count: Number(tagFrequencies?.[r.key]) || 0,
    fill: r.fill,
  }));

  const hasAny = data.some((d) => d.count > 0);

  if (!hasAny) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No tagged entries in this filter yet.
      </p>
    );
  }

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }}
            contentStyle={{
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#f1f5f9',
            }}
            formatter={(v) => [v, 'Entries']}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((e) => (
              <Cell key={e.name} fill={e.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
