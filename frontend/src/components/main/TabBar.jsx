import { useAppState } from '../../context/AppStateContext';

const TABS = [
  { id: 'roster', label: 'Roster' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'data', label: 'Data' },
];

export function TabBar() {
  const { activeTab, setActiveTab } = useAppState();

  return (
    <nav className="flex w-full shrink-0 border-b border-slate-800 bg-slate-900">
      {TABS.map((t) => {
        const on = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`relative flex-1 px-4 py-2.5 text-sm font-medium transition ${
              on ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {on && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-500" aria-hidden />
            )}
            <span className="relative">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
