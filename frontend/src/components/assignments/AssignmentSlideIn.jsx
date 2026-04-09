import { useEffect, useState } from 'react';
import { createAssignment, updateAssignment } from '../../api/client';
import {
  parseAssignmentSources,
  serializeAssignmentSources,
} from '../../lib/assignmentSources';

const emptyForm = {
  name: '',
  unit: '',
  aks_standard: '',
  prompt_text: '',
  date_assigned: '',
};

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M10 11v6M14 11v6" />
      <path d="M19 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.nested] — If true, no backdrop/body lock; sits left of a 520px entry panel.
 * @param {object | null} [props.assignmentToEdit] — When set, panel is in edit mode for this row.
 */
export function AssignmentSlideIn({
  open,
  onClose,
  onSaved,
  nested = false,
  assignmentToEdit = null,
}) {
  const [form, setForm] = useState(emptyForm);
  const [sourceRows, setSourceRows] = useState([{ label: '', url: '' }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const isEdit = assignmentToEdit != null && Number.isInteger(Number(assignmentToEdit.id));

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (isEdit) {
      const a = assignmentToEdit;
      setForm({
        name: a.name ?? '',
        unit: a.unit ?? '',
        aks_standard: a.aks_standard ?? '',
        prompt_text: a.prompt_text ?? '',
        date_assigned:
          a.date_assigned != null ? String(a.date_assigned).slice(0, 10) : '',
      });
      const parsed = parseAssignmentSources(a.source_documents);
      setSourceRows(parsed.length ? parsed : [{ label: '', url: '' }]);
    } else {
      setForm(emptyForm);
      setSourceRows([{ label: '', url: '' }]);
    }
  }, [open, assignmentToEdit]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || nested) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, nested]);

  if (!open) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const addSourceRow = () => setSourceRows((r) => [...r, { label: '', url: '' }]);
  const removeSourceRow = (idx) => {
    setSourceRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== idx)));
  };
  const updateSourceRow = (idx, key, value) => {
    setSourceRows((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim() || !form.unit.trim() || !form.date_assigned) {
      setErr('Name, unit, and date assigned are required.');
      return;
    }
    for (const row of sourceRows) {
      const L = row.label.trim();
      const U = row.url.trim();
      if ((L && !U) || (!L && U)) {
        setErr('Each source row needs both a label and a URL, or leave both empty.');
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim(),
      aks_standard: form.aks_standard.trim() || null,
      prompt_text: form.prompt_text.trim() || null,
      source_documents: serializeAssignmentSources(sourceRows),
      date_assigned: form.date_assigned,
    };

    setSaving(true);
    try {
      const row = isEdit
        ? await updateAssignment(Number(assignmentToEdit.id), payload)
        : await createAssignment(payload);
      await onSaved?.(row);
    } catch (e2) {
      setErr(e2.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const aside = (
    <aside
      className={`fixed bottom-0 top-14 z-[45] flex w-[400px] shrink-0 flex-col border-l border-slate-800 bg-slate-900 shadow-2xl ${
        nested ? 'right-[520px]' : 'right-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-form-title"
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 id="assignment-form-title" className="text-sm font-semibold text-white">
          {isEdit ? 'Edit assignment' : 'New assignment'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          ✕
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
      >
        <label className="block text-xs font-medium text-slate-400">
          Assignment name
          <input
            required
            value={form.name}
            onChange={update('name')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Unit
          <input
            required
            value={form.unit}
            onChange={update('unit')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          AKS standard
          <textarea
            value={form.aks_standard}
            onChange={update('aks_standard')}
            rows={4}
            className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>
        <label className="block text-xs font-medium text-slate-400">
          Prompt text
          <textarea
            value={form.prompt_text}
            onChange={update('prompt_text')}
            rows={5}
            className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>

        <div>
          <p className="text-xs font-medium text-slate-400">
            Source documents (e.g. Google Docs)
          </p>
          <div className="mt-2 space-y-2">
            {sourceRows.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={row.label}
                  onChange={(e) => updateSourceRow(idx, 'label', e.target.value)}
                  placeholder='Label (e.g. "Article — Peppered moths")'
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <input
                  value={row.url}
                  onChange={(e) => updateSourceRow(idx, 'url', e.target.value)}
                  placeholder="https://docs.google.com/..."
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => removeSourceRow(idx)}
                  className="shrink-0 rounded-md border border-slate-700 p-2 text-slate-400 hover:border-red-900 hover:bg-red-950/40 hover:text-red-300"
                  aria-label="Remove source row"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSourceRow}
            className="mt-2 text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            + Add source
          </button>
        </div>

        <label className="block text-xs font-medium text-slate-400">
          Date assigned
          <input
            required
            type="date"
            value={form.date_assigned}
            onChange={update('date_assigned')}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </label>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="mt-auto flex gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border border-slate-600 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-md bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save'}
          </button>
        </div>
      </form>
    </aside>
  );

  if (nested) return aside;

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 top-14 z-40 bg-black/50"
        onClick={onClose}
      />
      {aside}
    </>
  );
}
