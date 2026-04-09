import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../context/AppStateContext';
import {
  compareProgress,
  getStudentComparisons,
  getStudentEntries,
  saveComparison,
} from '../../api/client';
import { EntryCard } from './EntryCard';
import { EntryEditorPanel } from './EntryEditorPanel';
import { EntryProgressStrip } from './EntryProgressStrip';
import {
  ProgressComparisonLoading,
  ProgressComparisonPanel,
  SavedComparisonChips,
} from './ProgressComparisonPanel';
import { StudentRecordHeader } from './StudentRecordHeader';
import { parseIepGoals } from '../../lib/iepGoals';

function entrySortKey(a, b) {
  const da = String(a.date_submitted || '').slice(0, 10);
  const db = String(b.date_submitted || '').slice(0, 10);
  if (da !== db) return da.localeCompare(db);
  return (a.id || 0) - (b.id || 0);
}

function buildComparePayloadEntry(entry) {
  return {
    entry_id: entry.id,
    date: String(entry.date_submitted || '').slice(0, 10),
    assignment_name: entry.assignment_name || '',
    writing_sample: entry.writing_sample || '',
    word_count: entry.word_count ?? 0,
    tags: {
      claim_present: entry.claim_present === true,
      evidence_cited: entry.evidence_cited === true,
      explanation_present: entry.explanation_present === true,
      source_named: entry.source_named === true,
      response_incomplete: entry.response_incomplete === true,
      ai_flag: entry.ai_flag === true,
    },
  };
}

export function StudentRecordView() {
  const {
    selectedStudentId,
    selectedStudentDetail,
    detailLoading,
    detailError,
    refreshSelectedStudent,
    refreshStudents,
    pendingStudentEditId,
    clearPendingStudentEdit,
  } = useAppState();

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState(null);
  const [cardExpanded, setCardExpanded] = useState({});
  const [activeEntryId, setActiveEntryId] = useState(null);
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [entryFormMode, setEntryFormMode] = useState('new');
  const [entryFormEntry, setEntryFormEntry] = useState(null);

  const [savedComparisons, setSavedComparisons] = useState([]);
  const [compareSelectMode, setCompareSelectMode] = useState(false);
  const [compareSameAssignmentOnly, setCompareSameAssignmentOnly] = useState(false);
  const [compareSelectedIds, setCompareSelectedIds] = useState([]);
  const [compareInlineError, setCompareInlineError] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareError, setCompareError] = useState(null);
  const [saveComparisonState, setSaveComparisonState] = useState('idle');

  /** Header sees fresh entry list (e.g. last-assignment tags) without waiting for a full detail refetch. */
  const studentForHeader = useMemo(() => {
    if (!selectedStudentDetail) return null;
    return { ...selectedStudentDetail, entries };
  }, [selectedStudentDetail, entries]);

  const compareLoadingMessages = useMemo(
    () => [
      "Reading {name}'s writing samples...",
      'Looking for growth patterns…',
      'Finding the strongest moments…',
      'Building your comparison report…',
      'Almost there…',
    ],
    []
  );

  const reloadEntriesAfterSave = useCallback(
    async (entryId) => {
      if (selectedStudentId == null) return;
      setEntriesLoading(true);
      setEntriesError(null);
      try {
        const list = await getStudentEntries(selectedStudentId);
        const arr = Array.isArray(list) ? list : [];
        setEntries(arr);
        setCardExpanded((prev) => {
          const next = { ...prev };
          for (const e of arr) {
            if (next[e.id] === undefined) next[e.id] = true;
          }
          if (entryId != null) next[entryId] = true;
          return next;
        });
        if (entryId != null) {
          setActiveEntryId(entryId);
          requestAnimationFrame(() => {
            document
              .getElementById(`entry-card-${entryId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
        await refreshStudents();
      } catch (e) {
        setEntriesError(e.message || 'Failed to load entries');
        setEntries([]);
      } finally {
        setEntriesLoading(false);
      }
    },
    [selectedStudentId, refreshStudents]
  );

  useEffect(() => {
    if (selectedStudentId == null) return;
    let cancelled = false;
    setEntries([]);
    setEntriesError(null);
    (async () => {
      setEntriesLoading(true);
      try {
        const list = await getStudentEntries(selectedStudentId);
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setEntries(arr);
        const next = {};
        for (const e of arr) next[e.id] = true;
        setCardExpanded(next);
        setActiveEntryId(null);
      } catch (e) {
        if (!cancelled) {
          setEntriesError(e.message || 'Failed to load entries');
          setEntries([]);
        }
      } finally {
        if (!cancelled) setEntriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getStudentComparisons(selectedStudentId);
        if (cancelled) return;
        setSavedComparisons(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setSavedComparisons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId]);

  useEffect(() => {
    setCompareSelectMode(false);
    setCompareSameAssignmentOnly(false);
    setCompareSelectedIds([]);
    setCompareLoading(false);
    setCompareResult(null);
    setCompareError(null);
    setCompareInlineError(null);
    setSaveComparisonState('idle');
  }, [selectedStudentId]);

  useEffect(() => {
    setEntryFormOpen(false);
    setEntryFormEntry(null);
  }, [selectedStudentId]);

  const handleAfterStudentSave = useCallback(async () => {
    await refreshSelectedStudent();
    await refreshStudents();
  }, [refreshSelectedStudent, refreshStudents]);

  const handleChipClick = useCallback((entryId) => {
    setActiveEntryId(entryId);
    const el = document.getElementById(`entry-card-${entryId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const toggleCard = useCallback((entryId) => {
    setCardExpanded((prev) => {
      const wasExpanded = prev[entryId] !== false;
      return { ...prev, [entryId]: !wasExpanded };
    });
  }, []);

  const onEntryTagUpdate = useCallback(
    (entryId, patch) => {
      setEntries((prev) =>
        prev.map((en) => (en.id === entryId ? { ...en, ...patch } : en))
      );
      void refreshStudents();
    },
    [refreshStudents]
  );

  const openNewEntry = useCallback(() => {
    setEntryFormMode('new');
    setEntryFormEntry(null);
    setEntryFormOpen(true);
  }, []);

  const openEditEntry = useCallback((entry) => {
    setEntryFormMode('edit');
    setEntryFormEntry(entry);
    setEntryFormOpen(true);
  }, []);

  const closeEntryForm = useCallback(() => {
    setEntryFormOpen(false);
    setEntryFormEntry(null);
  }, []);

  const onCompareToggle = useCallback(
    (entryId, checked) => {
      setCompareInlineError(null);
      setCompareSelectedIds((prev) => {
        if (!checked) {
          return prev.filter((id) => id !== entryId);
        }
        if (compareSameAssignmentOnly && prev.length > 0) {
          const first = entries.find((en) => en.id === prev[0]);
          const cand = entries.find((en) => en.id === entryId);
          if (
            first &&
            cand &&
            Number(first.assignment_id) !== Number(cand.assignment_id)
          ) {
            return prev;
          }
        }
        return [...prev, entryId];
      });
    },
    [compareSameAssignmentOnly, entries]
  );

  const cancelCompareSelection = useCallback(() => {
    setCompareSelectMode(false);
    setCompareSameAssignmentOnly(false);
    setCompareSelectedIds([]);
    setCompareInlineError(null);
  }, []);

  const startCompareSelection = useCallback(() => {
    setCompareSelectMode(true);
    setCompareSameAssignmentOnly(false);
    setCompareSelectedIds([]);
    setCompareInlineError(null);
    setCompareError(null);
  }, []);

  const onToggleCompareSameAssignment = useCallback(
    (checked) => {
      setCompareSameAssignmentOnly(checked);
      setCompareInlineError(null);
      if (checked) {
        setCompareSelectedIds((prev) => {
          if (prev.length <= 1) return prev;
          const first = entries.find((en) => en.id === prev[0]);
          if (!first) return prev;
          const aid = Number(first.assignment_id);
          return prev.filter(
            (id) => Number(entries.find((en) => en.id === id)?.assignment_id) === aid
          );
        });
      }
    },
    [entries]
  );

  const generateComparison = useCallback(async () => {
    const student = selectedStudentDetail;
    if (!student || selectedStudentId == null) return;

    const selectedSet = new Set(compareSelectedIds);
    const selectedEntries = entries.filter((e) => selectedSet.has(e.id)).sort(entrySortKey);

    if (selectedEntries.length < 2) {
      setCompareInlineError('Please select at least 2 entries to compare.');
      return;
    }
    if (selectedEntries.length > 6) {
      setCompareInlineError('Please select at most 6 entries per comparison.');
      return;
    }
    if (compareSameAssignmentOnly) {
      const aids = new Set(
        selectedEntries.map((e) => Number(e.assignment_id)).filter(Number.isFinite)
      );
      if (aids.size > 1) {
        setCompareInlineError(
          'Same-assignment mode: all selected entries must be for one assignment.'
        );
        return;
      }
    }

    setCompareInlineError(null);
    setCompareError(null);
    setCompareLoading(true);
    setSaveComparisonState('idle');
    setCompareSelectMode(false);

    const iepParts = [];
    if (student.iep_flags?.trim()) {
      iepParts.push(`Disabilities / classification: ${student.iep_flags.trim()}`);
    }
    const goals = parseIepGoals(student.iep_goals);
    if (goals.length) {
      iepParts.push(
        `IEP goals:\n${goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`
      );
    }
    const payload = {
      student_id: student.id,
      student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
      iep_flags: iepParts.join('\n\n'),
      entries: selectedEntries.map(buildComparePayloadEntry),
    };

    try {
      const data = await compareProgress(payload);
      setCompareResult(data);
      setCompareSelectedIds([]);
    } catch (e) {
      console.error('[compare-progress]', e);
      setCompareError(
        "The comparison couldn't be generated right now. Your entries are safe — try again in a moment."
      );
      setCompareSelectMode(true);
    } finally {
      setCompareLoading(false);
    }
  }, [
    compareSameAssignmentOnly,
    compareSelectedIds,
    entries,
    selectedStudentDetail,
    selectedStudentId,
  ]);

  const backFromComparison = useCallback(() => {
    setCompareResult(null);
    setCompareError(null);
    setSaveComparisonState('idle');
  }, []);

  const handleSaveComparison = useCallback(async () => {
    if (!compareResult || selectedStudentId == null) return;
    setSaveComparisonState('saving');
    try {
      await saveComparison({
        student_id: compareResult.student_id,
        entry_ids: compareResult.entry_ids_compared,
        report_json: compareResult.comparison,
      });
      setSaveComparisonState('saved');
      const list = await getStudentComparisons(selectedStudentId);
      setSavedComparisons(Array.isArray(list) ? list : []);
    } catch (e) {
      setSaveComparisonState('idle');
      window.alert(e.message || 'Could not save comparison.');
    }
  }, [compareResult, selectedStudentId]);

  const loadSavedComparison = useCallback((row) => {
    setCompareError(null);
    setCompareInlineError(null);
    let comparison = row.report_json;
    if (typeof comparison === 'string') {
      try {
        comparison = JSON.parse(comparison);
      } catch {
        comparison = {};
      }
    }
    setCompareResult({
      comparison,
      student_id: row.student_id,
      entry_ids_compared: row.entry_ids,
      generated_at: row.generated_at,
      model_used: 'saved',
    });
    setSaveComparisonState('saved');
  }, []);

  const entriesById = useMemo(() => {
    const m = new Map();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  const compareSelectedSet = useMemo(() => new Set(compareSelectedIds), [compareSelectedIds]);
  const nCompareSelected = compareSelectedIds.length;
  const hasIepFlagsOnFile = Boolean(
    selectedStudentDetail?.iep_flags?.trim() ||
      parseIepGoals(selectedStudentDetail?.iep_goals).length > 0
  );

  if (detailLoading) {
    return (
      <div className="w-full p-6">
        <p className="text-slate-400">Loading student…</p>
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="w-full p-6">
        <p className="text-red-400">{detailError}</p>
      </div>
    );
  }

  const student = selectedStudentDetail;
  if (!student) {
    return (
      <div className="w-full p-6">
        <p className="text-slate-400">No student selected.</p>
      </div>
    );
  }

  if (student.id !== selectedStudentId) {
    return (
      <div className="w-full p-6">
        <p className="text-slate-400">Loading student…</p>
      </div>
    );
  }

  const showEntryList = !compareLoading && !compareResult;
  const canCompareProgress = entries.length >= 2 && !compareLoading && !compareResult;

  return (
    <div
      className={`w-full transition-[margin] duration-200 ease-out ${
        entryFormOpen ? 'mr-[520px]' : ''
      }`}
    >
      <div className="sticky top-0 z-30 w-full bg-slate-950">
        <StudentRecordHeader
          student={studentForHeader ?? student}
          onAfterStudentSave={handleAfterStudentSave}
          canCompareProgress={canCompareProgress}
          compareSelectMode={compareSelectMode}
          onStartCompareProgress={startCompareSelection}
          pendingOpenEditId={pendingStudentEditId}
          onConsumedPendingOpenEdit={clearPendingStudentEdit}
        />
        <EntryProgressStrip
          entries={entries}
          activeEntryId={activeEntryId}
          onSelectChip={handleChipClick}
        />
        {showEntryList && savedComparisons.length > 0 && (
          <SavedComparisonChips
            rows={savedComparisons}
            entriesById={entriesById}
            onSelect={loadSavedComparison}
          />
        )}
        {compareSelectMode && showEntryList && (
          <div className="border-b border-slate-800 bg-slate-900/95 px-4 py-3 font-sans">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-200">
                  Select 2 to 6 entries to compare (any assignments, ordered by submission date).
                  Selected: {nCompareSelected}
                </p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={compareSameAssignmentOnly}
                    onChange={(e) => onToggleCompareSameAssignment(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950 text-teal-600 focus:ring-teal-500"
                  />
                  <span>
                    Same assignment only (e.g. first attempt vs revision on one task)
                  </span>
                </label>
                {nCompareSelected > 6 && (
                  <p className="mt-1 text-sm text-amber-300">Maximum 6 entries per comparison.</p>
                )}
                {compareInlineError && (
                  <p className="mt-1 text-sm text-amber-300">{compareInlineError}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={cancelCompareSelection}
                  className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={generateComparison}
                  disabled={nCompareSelected < 2 || nCompareSelected > 6}
                  className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Generate Comparison
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full px-4 py-4">
        {compareError && showEntryList && (
          <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 font-sans">
            <p className="text-sm text-amber-100">{compareError}</p>
            <button
              type="button"
              onClick={() => {
                setCompareError(null);
                setCompareSelectMode(true);
              }}
              className="mt-2 text-sm font-medium text-teal-300 hover:text-teal-200"
            >
              Try again
            </button>
          </div>
        )}

        {showEntryList && (
          <div className="mb-4 flex w-full justify-end">
            <button
              type="button"
              onClick={openNewEntry}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/20 hover:bg-sky-500"
            >
              New entry
            </button>
          </div>
        )}

        {entriesLoading && showEntryList && (
          <p className="mb-4 text-sm text-slate-400">Loading entries…</p>
        )}
        {entriesError && showEntryList && (
          <p className="mb-4 text-sm text-red-400">{entriesError}</p>
        )}

        {compareLoading && (
          <ProgressComparisonLoading
            firstName={student.first_name}
            messages={compareLoadingMessages}
          />
        )}

        {compareResult && (
          <ProgressComparisonPanel
            student={student}
            comparisonData={compareResult}
            hasIepFlagsOnFile={hasIepFlagsOnFile}
            onBack={backFromComparison}
            onSave={handleSaveComparison}
            saveState={saveComparisonState}
          />
        )}

        {showEntryList && !entriesLoading && !entries.length && !entriesError && (
          <p className="text-sm text-slate-500">No entries yet. Add one with New entry.</p>
        )}

        {showEntryList && (
          <div className="w-full space-y-0 pb-12">
            {entries.map((e) => {
              const firstSelId = compareSelectedIds[0];
              const firstEntry =
                firstSelId != null ? entries.find((en) => en.id === firstSelId) : null;
              const compareCanSelect =
                !compareSameAssignmentOnly ||
                !firstEntry ||
                Number(firstEntry.assignment_id) === Number(e.assignment_id);
              return (
                <EntryCard
                  key={e.id}
                  entry={e}
                  expanded={cardExpanded[e.id] !== false}
                  onToggleExpanded={() => toggleCard(e.id)}
                  isActiveChip={activeEntryId === e.id}
                  onEntryTagUpdate={onEntryTagUpdate}
                  onEditEntry={openEditEntry}
                  compareSelectMode={compareSelectMode}
                  compareSelected={compareSelectedSet.has(e.id)}
                  compareCanSelect={compareCanSelect}
                  onCompareToggle={onCompareToggle}
                />
              );
            })}
          </div>
        )}
      </div>

      <EntryEditorPanel
        open={entryFormOpen}
        mode={entryFormMode}
        student={student}
        editEntry={entryFormEntry}
        onClose={closeEntryForm}
        onSaved={reloadEntriesAfterSave}
      />
    </div>
  );
}
