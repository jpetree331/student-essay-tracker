import { abbreviateAssignment } from '../../lib/text';
import { formatChipDate } from '../../lib/dates';

export function EntryProgressStrip({ entries, activeEntryId, onSelectChip }) {
  if (!entries?.length) return null;

  return (
    <div className="w-full border-b border-slate-800 bg-slate-950 px-2 py-2">
      <div className="flex w-full gap-2 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
        {entries.map((e) => {
          const active = activeEntryId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectChip(e.id)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition ${
                active
                  ? 'border-sky-500 bg-sky-950/60 text-sky-100 ring-1 ring-sky-500/40'
                  : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800/80'
              }`}
            >
              <div className="whitespace-nowrap font-semibold text-slate-200">
                {formatChipDate(e.date_submitted)}
              </div>
              <div className="mt-0.5 max-w-[10rem] truncate text-[11px] text-slate-400">
                {abbreviateAssignment(e.assignment_name, 32)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
