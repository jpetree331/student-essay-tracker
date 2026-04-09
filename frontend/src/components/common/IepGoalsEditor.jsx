/**
 * Multiple single-line goal boxes + Add goal / Remove per row.
 */
export function IepGoalsEditor({
  rows,
  onChange,
  label = 'IEP goals',
  placeholderPrefix = 'Goal',
  compact = false,
}) {
  const updateRow = (index, value) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, '']);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(rows.filter((_, j) => j !== index));
  };

  const inputClass = compact
    ? 'min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500'
    : 'min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

  return (
    <div className={compact ? '' : 'sm:col-span-2'}>
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1 space-y-2">
        {rows.map((text, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={`${placeholderPrefix} ${i + 1}`}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded border border-slate-600 px-2 py-1.5 text-sm text-slate-400 hover:border-red-800/60 hover:bg-red-950/30 hover:text-red-200"
              aria-label={`Remove goal ${i + 1}`}
              title="Remove this goal"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          + Add goal
        </button>
      </div>
    </div>
  );
}
