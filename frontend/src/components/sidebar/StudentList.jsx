import { useRef } from 'react';
import { LastAssignmentSection } from '../common/LastAssignmentSection';

const CLICK_DELAY_MS = 280;

function WritingGoalIndicator({ firstName, lastName }) {
  return (
    <span
      className="pointer-events-none h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.75)] ring-2 ring-emerald-400/40"
      title="Active writing goal"
      role="img"
      aria-label={`${firstName} ${lastName} has an active writing goal`}
    />
  );
}

function StudentListRow({
  student: s,
  selected,
  onSelect,
  doubleClickToEdit,
  onOpenStudentForEdit,
  showRosterDetails,
}) {
  const clickTimerRef = useRef(null);

  const clearTimer = () => {
    if (clickTimerRef.current != null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  };

  const handleNameClick = () => {
    if (!doubleClickToEdit) {
      onSelect(s.id);
      return;
    }
    clearTimer();
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onSelect(s.id);
    }, CLICK_DELAY_MS);
  };

  const handleNameDoubleClick = () => {
    if (!doubleClickToEdit || !onOpenStudentForEdit) return;
    clearTimer();
    onOpenStudentForEdit(s.id);
  };

  const hasWritingGoal = s.writing_goal === true;

  return (
    <li
      className={`border-b border-slate-800/80 px-2 ${
        showRosterDetails ? 'py-2' : 'py-1.5'
      } ${
        selected
          ? 'bg-sky-950/80 ring-1 ring-inset ring-sky-600/50'
          : 'hover:bg-slate-800/80'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleNameClick}
          onDoubleClick={handleNameDoubleClick}
          title={
            doubleClickToEdit
              ? 'Click to select · Double-click to edit name and IEP info'
              : undefined
          }
          className={`min-w-0 flex-1 text-left text-sm transition ${
            selected ? 'text-sky-100' : 'text-slate-200'
          }`}
        >
          {s.last_name}, {s.first_name}
        </button>
        {hasWritingGoal && (
          <WritingGoalIndicator firstName={s.first_name} lastName={s.last_name} />
        )}
      </div>
      {showRosterDetails && (
        <LastAssignmentSection lastSubmission={s.last_submission ?? null} compact />
      )}
    </li>
  );
}

export function StudentList({
  grouped,
  selectedStudentId,
  onSelect,
  doubleClickToEdit,
  onOpenStudentForEdit,
  showRosterDetails = false,
}) {
  if (!grouped.length) {
    return <p className="px-3 py-2 text-sm text-slate-500">No students match.</p>;
  }

  return (
    <ul className="pb-3">
      {grouped.map(({ period, students }) => (
        <li key={period}>
          <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur-sm">
            Period {period}
          </div>
          <ul>
            {students.map((s) => (
              <StudentListRow
                key={s.id}
                student={s}
                selected={selectedStudentId === s.id}
                onSelect={onSelect}
                doubleClickToEdit={doubleClickToEdit}
                onOpenStudentForEdit={onOpenStudentForEdit}
                showRosterDetails={showRosterDetails}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
