import { useCallback, useMemo, useState } from 'react';
import { useAppState } from '../../context/AppStateContext';

const ROSTER_DETAILS_STORAGE_KEY = 'essayOrganizer_rosterDetails';
import { AddStudentPanel } from './AddStudentPanel';
import { PeriodFilters } from './PeriodFilters';
import { StudentSearch } from './StudentSearch';
import { StudentList } from './StudentList';

export function Sidebar() {
  const {
    students,
    studentsLoading,
    studentsError,
    activePeriodFilter,
    setActivePeriodFilter,
    searchQuery,
    setSearchQuery,
    selectedStudentId,
    selectStudent,
    periodNumbers,
    refreshStudents,
    refreshSelectedStudent,
    openStudentForEdit,
  } = useAppState();

  const [doubleClickToEdit, setDoubleClickToEdit] = useState(false);
  const [showRosterDetails, setShowRosterDetails] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(ROSTER_DETAILS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setRosterDetails = useCallback((checked) => {
    setShowRosterDetails(checked);
    try {
      localStorage.setItem(ROSTER_DETAILS_STORAGE_KEY, checked ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = students.filter((s) => {
      if (activePeriodFilter !== 'all') {
        const p = Number(s.period);
        const f = Number(activePeriodFilter);
        if (!Number.isFinite(p) || p !== f) return false;
      }
      if (!q) return true;
      return (
        (s.first_name && s.first_name.toLowerCase().includes(q)) ||
        (s.last_name && s.last_name.toLowerCase().includes(q))
      );
    });
    const byPeriod = new Map();
    for (const s of filtered) {
      if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
      byPeriod.get(s.period).push(s);
    }
    for (const list of byPeriod.values()) {
      list.sort((a, b) => {
        const ln = (a.last_name || '').localeCompare(b.last_name || '');
        if (ln !== 0) return ln;
        return (a.first_name || '').localeCompare(b.first_name || '');
      });
    }
    const periods = [...byPeriod.keys()].sort((a, b) => a - b);
    return periods.map((p) => ({ period: p, students: byPeriod.get(p) }));
  }, [students, activePeriodFilter, searchQuery]);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-slate-900">
      <div className="shrink-0 border-b border-slate-800 p-3">
        <PeriodFilters
          periodNumbers={periodNumbers}
          active={activePeriodFilter}
          onChange={setActivePeriodFilter}
        />
        <StudentSearch value={searchQuery} onChange={setSearchQuery} />
        <label
          className="mt-2 flex cursor-pointer items-center gap-2 px-0.5 text-xs text-slate-400"
          title="Green dot = active writing goal (set when adding or editing a student). Checked: also show last assignment tags under each name."
        >
          <input
            type="checkbox"
            checked={showRosterDetails}
            onChange={(e) => setRosterDetails(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-teal-600 focus:ring-teal-500"
          />
          <span>Show writing goals and last submission</span>
        </label>
        <label className="mt-2 flex cursor-pointer items-center gap-2 px-0.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={doubleClickToEdit}
            onChange={(e) => setDoubleClickToEdit(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-sky-600 focus:ring-sky-500"
          />
          <span>Double-click a student to edit their info</span>
        </label>
        <AddStudentPanel
          onCreated={async (row) => {
            await refreshStudents();
            selectStudent(row.id);
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {studentsLoading && (
          <p className="px-3 py-2 text-sm text-slate-400">Loading students…</p>
        )}
        {studentsError && (
          <p className="px-3 py-2 text-sm text-red-400">{studentsError}</p>
        )}
        {!studentsLoading && !studentsError && (
          <StudentList
            grouped={grouped}
            selectedStudentId={selectedStudentId}
            onSelect={selectStudent}
            doubleClickToEdit={doubleClickToEdit}
            onOpenStudentForEdit={openStudentForEdit}
            showRosterDetails={showRosterDetails}
          />
        )}
      </div>
    </aside>
  );
}
