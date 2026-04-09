import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAssignments, getAssignmentPrintSubmissions } from '../../api/client';
import { parseAssignmentSources } from '../../lib/assignmentSources';
import { openAssignmentPrintInNewTab } from '../../lib/assignmentPrintPdf';
import { AssignmentSlideIn } from './AssignmentSlideIn';

function formatDate(d) {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export function AssignmentsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [doubleClickToEditAssignment, setDoubleClickToEditAssignment] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [exportingAssignmentId, setExportingAssignmentId] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAssignments();
      if (!mountedRef.current) return false;
      setRows(Array.isArray(data) ? data : []);
      return true;
    } catch (e) {
      if (!mountedRef.current) return false;
      setError(e.message || 'Failed to load assignments');
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = formatDate(a.date_assigned);
      const db = formatDate(b.date_assigned);
      return db.localeCompare(da);
    });
  }, [rows]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setEditingAssignment(null);
  }, []);

  const handleSaved = useCallback(async () => {
    const ok = await load();
    if (ok && mountedRef.current) closePanel();
  }, [load, closePanel]);

  const openNew = useCallback(() => {
    setEditingAssignment(null);
    setPanelOpen(true);
  }, []);

  const onRowDoubleClick = useCallback(
    (a) => {
      if (!doubleClickToEditAssignment) return;
      setEditingAssignment(a);
      setPanelOpen(true);
    },
    [doubleClickToEditAssignment]
  );

  const handleExportPdf = useCallback(async (e, a) => {
    e.preventDefault();
    e.stopPropagation();
    setExportingAssignmentId(a.id);
    try {
      const data = await getAssignmentPrintSubmissions(a.id);
      const ok = openAssignmentPrintInNewTab(data);
      if (!ok && mountedRef.current) {
        window.alert('Allow pop-ups to open the print window, then use Print → Save as PDF.');
      }
    } catch (err) {
      if (mountedRef.current) {
        window.alert(err?.message || 'Could not load data for PDF export.');
      }
    } finally {
      if (mountedRef.current) setExportingAssignmentId(null);
    }
  }, []);

  return (
    <div className="relative w-full min-h-full p-6">
      <div className="mb-4 flex w-full flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="order-2 flex w-full cursor-pointer items-center gap-2 text-xs text-slate-400 sm:order-1 sm:mr-auto sm:w-auto">
          <input
            type="checkbox"
            checked={doubleClickToEditAssignment}
            onChange={(e) => setDoubleClickToEditAssignment(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-sky-600 focus:ring-sky-500"
          />
          <span>Double-click an assignment to edit it</span>
        </label>
        <button
          type="button"
          onClick={openNew}
          className="order-1 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 sm:order-2"
        >
          New Assignment
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading assignments…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="w-full overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Unit</th>
                <th className="px-4 py-3 font-medium">AKS standard</th>
                <th className="px-4 py-3 font-medium">Sources</th>
                <th className="px-4 py-3 font-medium">Date assigned</th>
                <th className="px-4 py-3 font-medium">Export</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const nSources = parseAssignmentSources(a.source_documents).length;
                return (
                  <tr
                    key={a.id}
                    onDoubleClick={() => onRowDoubleClick(a)}
                    className={`border-b border-slate-800/80 text-slate-200 last:border-0 ${
                      doubleClickToEditAssignment
                        ? 'cursor-pointer hover:bg-slate-900/40'
                        : 'hover:bg-slate-900/40'
                    }`}
                    title={
                      doubleClickToEditAssignment
                        ? 'Double-click to edit'
                        : undefined
                    }
                  >
                    <td className="px-4 py-3 align-top font-medium text-white">{a.name}</td>
                    <td className="px-4 py-3 align-top text-slate-300">{a.unit}</td>
                    <td className="max-w-md px-4 py-3 align-top text-slate-400 whitespace-pre-wrap">
                      {a.aks_standard || '—'}
                    </td>
                    <td className="px-4 py-3 align-top tabular-nums text-slate-400">
                      {nSources ? `${nSources} link${nSources === 1 ? '' : 's'}` : '—'}
                    </td>
                    <td className="px-4 py-3 align-top tabular-nums text-slate-300">
                      {formatDate(a.date_assigned)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={(ev) => handleExportPdf(ev, a)}
                        onDoubleClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                        }}
                        disabled={exportingAssignmentId === a.id}
                        className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-700 hover:bg-sky-950/50 hover:text-sky-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {exportingAssignmentId === a.id ? 'Preparing…' : 'Export to PDF'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!sorted.length && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No assignments yet.</p>
          )}
        </div>
      )}

      <AssignmentSlideIn
        open={panelOpen}
        onClose={closePanel}
        onSaved={handleSaved}
        assignmentToEdit={editingAssignment}
      />
    </div>
  );
}
