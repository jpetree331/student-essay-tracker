import { useState } from 'react';
import { createStudent } from '../../api/client';
import { IepGoalsEditor } from '../common/IepGoalsEditor';
import { serializeIepGoals } from '../../lib/iepGoals';

export function AddStudentPanel({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [period, setPeriod] = useState('1');
  const [iepFlags, setIepFlags] = useState('');
  const [iepGoalRows, setIepGoalRows] = useState(['']);
  const [writingGoal, setWritingGoal] = useState(false);
  const [writingGoalSummary, setWritingGoalSummary] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPeriod('1');
    setIepFlags('');
    setIepGoalRows(['']);
    setWritingGoal(false);
    setWritingGoalSummary('');
    setErr(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    const p = Number(period);
    if (!firstName.trim() || !lastName.trim() || !Number.isInteger(p)) {
      setErr('First name, last name, and a whole-number period are required.');
      return;
    }
    setSaving(true);
    try {
      const row = await createStudent({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        period: p,
        iep_flags: iepFlags.trim() || null,
        iep_goals: serializeIepGoals(iepGoalRows),
        writing_goal: writingGoal,
        writing_goal_summary: writingGoalSummary.trim() || null,
      });
      reset();
      setOpen(false);
      await onCreated?.(row);
    } catch (ex) {
      setErr(ex.message || 'Could not add student');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-slate-800 p-3">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOpen(true);
          }}
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-sky-500"
        >
          Add student
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <p className="text-xs font-medium text-slate-400">New student</p>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            autoComplete="given-name"
          />
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            autoComplete="family-name"
          />
          <input
            type="number"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="Period"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <textarea
            value={iepFlags}
            onChange={(e) => setIepFlags(e.target.value)}
            placeholder="Primary / secondary disabilities (optional)"
            rows={2}
            className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <IepGoalsEditor
            rows={iepGoalRows}
            onChange={setIepGoalRows}
            label="IEP goals (optional)"
            compact
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={writingGoal}
              onChange={(e) => setWritingGoal(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-teal-600 focus:ring-teal-500"
            />
            Writing goal
          </label>
          <input
            value={writingGoalSummary}
            onChange={(e) => setWritingGoalSummary(e.target.value.slice(0, 500))}
            placeholder="Writing goal summary (optional)"
            maxLength={500}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={saving}
              className="flex-1 rounded-md border border-slate-600 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-sky-600 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
