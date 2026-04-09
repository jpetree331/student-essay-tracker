import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const ROWS = [
  { key: 'claim_present', name: 'Claim Present' },
  { key: 'evidence_cited', name: 'Evidence Cited' },
  { key: 'explanation_present', name: 'Explanation Present' },
  { key: 'source_named', name: 'Source Named' },
  { key: 'response_incomplete', name: 'Incomplete' },
  { key: 'ai_flag', name: 'AI Flag' },
];

export function TagFrequencyChart({ tagFrequencies }) {
  const data = ROWS.map((r) => ({
    name: r.name,
    count: Number(tagFrequencies?.[r.key]) || 0,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={56}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} width={36} />
          <Tooltip
            cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
            contentStyle={{
              background: '#020617',
              border: '1px solid #334155',
              borderRadius: '0.375rem',
              color: '#f1f5f9',
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
