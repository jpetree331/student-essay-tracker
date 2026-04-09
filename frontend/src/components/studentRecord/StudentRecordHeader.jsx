import { useEffect, useState } from 'react';
import { updateStudent } from '../../api/client';
import { openStudentReportInNewTab } from '../../lib/studentReportHtml';
import { parseIepGoals, serializeIepGoals } from '../../lib/iepGoals';
import { LastAssignmentSection } from '../common/LastAssignmentSection';
import { IepGoalsEditor } from '../common/IepGoalsEditor';
import { getLastSubmissionFromEntries } from '../../lib/lastSubmission';

export function StudentRecordHeader({
  student,
  onAfterStudentSave,
  canCompareProgress,
  compareSelectMode,
  onStartCompareProgress,
  pendingOpenEditId,
  onConsumedPendingOpenEdit,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    period: '',
    iep_flags: '',
    writing_goal: false,
    writing_goal_summary: '',
  });
  const [iepGoalRows, setIepGoalRows] = useState(['']);

  useEffect(() => {
    if (!student) return;
    setForm({
      first_name: student.first_name ?? '',
      last_name: student.last_name ?? '',
      period: student.period != null ? String(student.period) : '',
      iep_flags: student.iep_flags ?? '',
      writing_goal: student.writing_goal === true,
      writing_goal_summary: student.writing_goal_summary ?? '',
    });
    const goals = parseIepGoals(student.iep_goals);
    setIepGoalRows(goals.length ? goals : ['']);
  }, [student]);

  useEffect(() => {
    if (
      pendingOpenEditId == null ||
      !student ||
      pendingOpenEditId !== student.id
    ) {
      return;
    }
    setEditing(true);
    onConsumedPendingOpenEdit?.();
  }, [pendingOpenEditId, student, onConsumedPendingOpenEdit]);

  const cancelEdit = () => {
    setEditing(false);
    setErr(null);
    if (student) {
      setForm({
        first_name: student.first_name ?? '',
        last_name: student.last_name ?? '',
        period: student.period != null ? String(student.period) : '',
        iep_flags: student.iep_flags ?? '',
        writing_goal: student.writing_goal === true,
        writing_goal_summary: student.writing_goal_summary ?? '',
      });
      const goals = parseIepGoals(student.iep_goals);
      setIepGoalRows(goals.length ? goals : ['']);
    }
  };

  const save = async () => {
    if (!student) return;
    setErr(null);
    const p = Number(form.period);
    if (!form.first_name.trim() || !form.last_name.trim() || !Number.isInteger(p)) {
      setErr('First name, last name, and a valid period are required.');
      return;
    }
    setSaving(true);
    try {
      await updateStudent(student.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        period: p,
        iep_flags: form.iep_flags.trim() || null,
        iep_goals: serializeIepGoals(iepGoalRows),
        writing_goal: form.writing_goal === true,
        writing_goal_summary: form.writing_goal_summary.trim() || null,
      });
      await onAfterStudentSave?.();
      setEditing(false);
    } catch (e) {
      setErr(e.message || 'Could not save student');
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  const displayGoals = parseIepGoals(student.iep_goals);
  const lastSubmission = getLastSubmissionFromEntries(
    Array.isArray(student.entries) ? student.entries : []
  );

  return (
    <div className="w-full border-b border-slate-800 bg-slate-950 px-4 py-4">
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {!editing ? (
            <>
              <div className="flex flex-wrap items-center gap-2 gap-y-2">
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {student.first_name} {student.last_name}
                </h2>
                <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                  Period {student.period}
                </span>
              </div>
              <div className="mt-2 space-y-2 text-sm text-slate-500">
                <p>
                  <span className="font-medium text-slate-400">
                    Disabilities / classification:{' '}
                  </span>
                  {student.iep_flags?.trim()
                    ? student.iep_flags
                    : 'None on file.'}
                </p>
                <div>
                  <span className="font-medium text-slate-400">IEP goals</span>
                  {displayGoals.length ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-500">
                      {displayGoals.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-slate-500">None on file.</p>
                  )}
                </div>
                <p>
                  <span className="font-medium text-slate-400">Writing goal: </span>
                  {student.writing_goal === true ? 'Yes' : 'No'}
                </p>
                <p>
                  <span className="font-medium text-slate-400">Writing goal summary: </span>
                  {student.writing_goal_summary?.trim()
                    ? student.writing_goal_summary
                    : '—'}
                </p>
                <LastAssignmentSection lastSubmission={lastSubmission} />
              </div>
            </>
          ) : (
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-slate-500">
                First name
                <input
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Last name
                <input
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="block text-xs font-medium text-slate-500">
                Period
                <input
                  type="number"
                  value={form.period}
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
                Primary / secondary disabilities (IEP flags)
                <textarea
                  value={form.iep_flags}
                  onChange={(e) => setForm((f) => ({ ...f, iep_flags: e.target.value }))}
                  rows={3}
                  placeholder="e.g. SLD in reading, ADHD"
                  className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <IepGoalsEditor
                rows={iepGoalRows}
                onChange={setIepGoalRows}
                label="IEP goals"
                placeholderPrefix="Goal"
              />
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.writing_goal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, writing_goal: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-600 focus:ring-teal-500"
                />
                Writing goal (active)
              </label>
              <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
                Writing goal summary
                <input
                  type="text"
                  value={form.writing_goal_summary}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      writing_goal_summary: e.target.value.slice(0, 500),
                    }))
                  }
                  placeholder="Brief writing goal for roster view"
                  maxLength={500}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <div className="sm:col-span-2">
                <LastAssignmentSection lastSubmission={lastSubmission} />
              </div>
            </div>
          )}
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Edit
              </button>
              {canCompareProgress && !compareSelectMode && (
                <button
                  type="button"
                  onClick={onStartCompareProgress}
                  className="rounded-md border border-teal-700/60 bg-teal-950/50 px-3 py-2 text-sm font-medium text-teal-100 hover:bg-teal-900/40"
                >
                  Compare Progress
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const ok = openStudentReportInNewTab(student);
                  if (!ok) window.alert('Allow pop-ups to open the printable report.');
                }}
                disabled={!Array.isArray(student.entries) || student.entries.length === 0}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export Student Report
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
