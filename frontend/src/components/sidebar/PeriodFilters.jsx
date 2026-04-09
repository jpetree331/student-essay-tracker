export function PeriodFilters({ periodNumbers, active, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
          active === 'all'
            ? 'bg-sky-600 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        All
      </button>
      {periodNumbers.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            active === p
              ? 'bg-sky-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
