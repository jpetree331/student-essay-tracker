import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeWriting,
  createEntry,
  createSourceLink,
  deleteSourceLink,
  getAssignments,
  getEntry,
  updateEntry,
  upsertWritingTags,
} from '../../api/client';
import { wordCount } from '../../lib/words';
import {
  formatAssignmentSourcesForContext,
  parseAssignmentSources,
} from '../../lib/assignmentSources';
import { AssignmentSlideIn } from '../assignments/AssignmentSlideIn';

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TAG_FIELDS = [
  {
    key: 'claim_present',
    label: 'Claim Present',
    hint: 'The writing states a clear claim or position.',
  },
  {
    key: 'evidence_cited',
    label: 'Evidence Cited',
    hint: 'Uses data, quotes, or examples from class sources.',
  },
  {
    key: 'explanation_present',
    label: 'Explanation Present',
    hint: 'Connects evidence to the claim with reasoning.',
  },
  {
    key: 'source_named',
    label: 'Source Named',
    hint: 'Names or cites a specific source.',
  },
  {
    key: 'response_incomplete',
    label: 'Incomplete',
    hint: 'Missing required parts of the prompt or rubric.',
  },
  {
    key: 'ai_flag',
    label: 'AI Flag',
    hint: 'Suspicion or confirmation of AI-generated text.',
  },
];

const emptyTags = () => ({
  claim_present: false,
  evidence_cited: false,
  explanation_present: false,
  source_named: false,
  response_incomplete: false,
  ai_flag: false,
});

const REASONING_BY_TAG = {
  claim_present: 'claim_reasoning',
  evidence_cited: 'evidence_reasoning',
  explanation_present: 'explanation_reasoning',
  source_named: 'source_named_reasoning',
  response_incomplete: 'response_incomplete_reasoning',
  ai_flag: 'ai_flag_reasoning',
};

function SparklesIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 2h2v3H9V2zm0 17h2v3H9v-3zM2 9h3v2H2V9zm17 0h3v2h-3V9zM4.9 4.9l1.4 1.4L5 7.8 3.6 6.4 4.9 4.9zm12.7 12.7 1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zM19.1 4.9 17.7 6.3 16.3 4.9l1.4-1.4 1.4 1.4zM6.3 17.7l1.4 1.4-1.4 1.4-1.4-1.4 1.4-1.4zM12 8a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

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

function buildSnapshot(state) {
  return JSON.stringify({
    assignmentId: state.assignmentId,
    dateSubmitted: state.dateSubmitted,
    sourceRows: state.sourceRows.map((r) => ({ label: r.label.trim(), url: r.url.trim() })),
    writingSample: state.writingSample,
    studentFeedback: state.studentFeedback,
    teacherNotes: state.teacherNotes,
    tags: state.tags,
    flagged: state.flaggedForFollowup,
  });
}

export function EntryEditorPanel({ open, mode, student, editEntry, onClose, onSaved }) {
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [assignmentId, setAssignmentId] = useState('');
  const [dateSubmitted, setDateSubmitted] = useState(todayLocal());
  const [sourceRows, setSourceRows] = useState([{ label: '', url: '' }]);
  const [writingSample, setWritingSample] = useState('');
  const [studentFeedback, setStudentFeedback] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [tags, setTags] = useState(emptyTags());
  const [flaggedForFollowup, setFlaggedForFollowup] = useState(false);

  const [sampleError, setSampleError] = useState(null);
  const [sourceError, setSourceError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  /** Full API suggestions (booleans + reasoning) for "Accept all". */
  const [aiSuggestionsRaw, setAiSuggestionsRaw] = useState(null);
  /** Editable boolean draft while panel open. */
  const [aiDraft, setAiDraft] = useState(null);

  const [assignmentPanelOpen, setAssignmentPanelOpen] = useState(false);
  /** When editing, assignment row from entry if not yet in GET /assignments list (timing or edge case). */
  const [editAssignmentFallback, setEditAssignmentFallback] = useState(null);

  const initialSnapshotRef = useRef('');
  const editingEntryIdRef = useRef(null);
  const newFormInitializedRef = useRef(false);
  const writingSampleRef = useRef('');

  useEffect(() => {
    writingSampleRef.current = writingSample;
  }, [writingSample]);

  const wc = useMemo(() => wordCount(writingSample), [writingSample]);

  const selectedAssignment = useMemo(() => {
    const id = Number(assignmentId);
    if (!Number.isInteger(id)) return null;
    return assignments.find((a) => Number(a.id) === id) ?? null;
  }, [assignments, assignmentId]);

  const aksDisplay = useMemo(() => {
    const fromList = selectedAssignment?.aks_standard?.trim();
    if (fromList) return fromList;
    const id = Number(assignmentId);
    if (
      editAssignmentFallback &&
      Number(editAssignmentFallback.id) === id &&
      editAssignmentFallback.aks_standard
    ) {
      return String(editAssignmentFallback.aks_standard).trim();
    }
    return '';
  }, [selectedAssignment, assignmentId, editAssignmentFallback]);

  const showEditAssignmentOption =
    assignmentId &&
    !selectedAssignment &&
    editAssignmentFallback &&
    Number(editAssignmentFallback.id) === Number(assignmentId);

  const assignmentDocsPreview = useMemo(() => {
    const raw =
      selectedAssignment?.source_documents ??
      (editAssignmentFallback &&
      Number(editAssignmentFallback.id) === Number(assignmentId)
        ? editAssignmentFallback.source_documents
        : null);
    return parseAssignmentSources(raw);
  }, [selectedAssignment, editAssignmentFallback, assignmentId]);

  const assignmentContextForAi = useMemo(() => {
    const parts = [];
    const a = selectedAssignment;
    const sourcesRaw =
      a?.source_documents ??
      (editAssignmentFallback &&
      Number(editAssignmentFallback.id) === Number(assignmentId)
        ? editAssignmentFallback.source_documents
        : null);
    const sources = parseAssignmentSources(sourcesRaw);
    const srcBlock = formatAssignmentSourcesForContext(sources);

    if (a) {
      const head = [a.name, a.unit].filter(Boolean).join(' — ');
      if (head) parts.push(head);
      const prompt = a.prompt_text?.trim();
      if (prompt) parts.push(`Prompt:\n${prompt}`);
    } else if (
      editAssignmentFallback &&
      Number(editAssignmentFallback.id) === Number(assignmentId)
    ) {
      const head = [editAssignmentFallback.name, editAssignmentFallback.unit]
        .filter(Boolean)
        .join(' — ');
      if (head) parts.push(head);
      const prompt = editAssignmentFallback.prompt_text?.trim();
      if (prompt) parts.push(`Prompt:\n${prompt}`);
    }
    if (srcBlock) parts.push(srcBlock);
    return parts.join('\n\n');
  }, [selectedAssignment, editAssignmentFallback, assignmentId]);

  const closeAiSuggestions = useCallback(() => {
    setAiSuggestionsRaw(null);
    setAiDraft(null);
    setAiError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setAiAnalyzing(false);
      closeAiSuggestions();
    }
  }, [open, closeAiSuggestions]);

  useEffect(() => {
    if (writingSample.trim().length < 50 && !aiAnalyzing) {
      closeAiSuggestions();
    }
  }, [writingSample, aiAnalyzing, closeAiSuggestions]);

  const handleAutoTag = useCallback(async () => {
    const sample = writingSample.trim();
    if (sample.length < 50) return;
    setAiError(null);
    setAiAnalyzing(true);
    try {
      const data = await analyzeWriting({
        writing_sample: sample,
        assignment_context: assignmentContextForAi || undefined,
      });
      if (writingSampleRef.current.trim() !== sample) {
        return;
      }
      const s = data.suggestions;
      if (!s) throw new Error('No suggestions in response');
      setAiSuggestionsRaw(s);
      setAiDraft({
        claim_present: !!s.claim_present,
        evidence_cited: !!s.evidence_cited,
        explanation_present: !!s.explanation_present,
        source_named: !!s.source_named,
        response_incomplete: !!s.response_incomplete,
        ai_flag: !!s.ai_flag,
      });
    } catch (e) {
      setAiError(e.message || 'Analysis failed');
      setAiSuggestionsRaw(null);
      setAiDraft(null);
    } finally {
      setAiAnalyzing(false);
    }
  }, [writingSample, assignmentContextForAi]);

  const acceptAllAiSuggestions = useCallback(() => {
    if (!aiSuggestionsRaw) return;
    setTags({
      claim_present: !!aiSuggestionsRaw.claim_present,
      evidence_cited: !!aiSuggestionsRaw.evidence_cited,
      explanation_present: !!aiSuggestionsRaw.explanation_present,
      source_named: !!aiSuggestionsRaw.source_named,
      response_incomplete: !!aiSuggestionsRaw.response_incomplete,
      ai_flag: !!aiSuggestionsRaw.ai_flag,
    });
    closeAiSuggestions();
  }, [aiSuggestionsRaw, closeAiSuggestions]);

  const acceptEditedAiSuggestions = useCallback(() => {
    if (!aiDraft) return;
    setTags({ ...aiDraft });
    closeAiSuggestions();
  }, [aiDraft, closeAiSuggestions]);

  useEffect(() => {
    if (!editAssignmentFallback || !assignmentId) return;
    const id = Number(assignmentId);
    if (!Number.isInteger(id)) return;
    if (assignments.some((a) => Number(a.id) === id)) {
      setEditAssignmentFallback(null);
    }
  }, [assignments, assignmentId, editAssignmentFallback]);

  const tryClose = useCallback(() => {
    const snap = buildSnapshot({
      assignmentId,
      dateSubmitted,
      sourceRows,
      writingSample,
      studentFeedback,
      teacherNotes,
      tags,
      flaggedForFollowup,
    });
    if (snap !== initialSnapshotRef.current) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose();
  }, [
    assignmentId,
    dateSubmitted,
    sourceRows,
    writingSample,
    studentFeedback,
    teacherNotes,
    tags,
    flaggedForFollowup,
    onClose,
  ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !assignmentPanelOpen) tryClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, assignmentPanelOpen, tryClose]);

  useEffect(() => {
    if (!open) {
      newFormInitializedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingAssignments(true);
      try {
        const list = await getAssignments();
        if (cancelled) return;
        setAssignments(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setAssignments([]);
      } finally {
        if (!cancelled) setLoadingAssignments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      newFormInitializedRef.current = false;
      return;
    }
    if (mode !== 'new') return;
    newFormInitializedRef.current = false;
    editingEntryIdRef.current = null;
    setDateSubmitted(todayLocal());
    setSourceRows([{ label: '', url: '' }]);
    setWritingSample('');
    setStudentFeedback('');
    setTeacherNotes('');
    setTags(emptyTags());
    setFlaggedForFollowup(false);
    setAssignmentId('');
    setEditAssignmentFallback(null);
    setSampleError(null);
    setSourceError(null);
    setSaveError(null);
    setLoadingEntry(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== 'new' || loadingAssignments || newFormInitializedRef.current) return;
    const arr = assignments;
    const d = todayLocal();
    setDateSubmitted(d);
    if (!arr.length) {
      setAssignmentId('');
      initialSnapshotRef.current = buildSnapshot({
        assignmentId: '',
        dateSubmitted: d,
        sourceRows: [{ label: '', url: '' }],
        writingSample: '',
        studentFeedback: '',
        teacherNotes: '',
        tags: emptyTags(),
        flaggedForFollowup: false,
      });
    } else {
      const aid = String(arr[0].id);
      setAssignmentId(aid);
      initialSnapshotRef.current = buildSnapshot({
        assignmentId: aid,
        dateSubmitted: d,
        sourceRows: [{ label: '', url: '' }],
        writingSample: '',
        studentFeedback: '',
        teacherNotes: '',
        tags: emptyTags(),
        flaggedForFollowup: false,
      });
    }
    newFormInitializedRef.current = true;
  }, [open, mode, loadingAssignments, assignments]);

  useEffect(() => {
    if (!open || mode !== 'edit' || !editEntry?.id) return;
    newFormInitializedRef.current = false;
    let cancelled = false;
    (async () => {
      setLoadingEntry(true);
      setSaveError(null);
      setSampleError(null);
      setSourceError(null);
      try {
        const full = await getEntry(editEntry.id);
        if (cancelled) return;
        editingEntryIdRef.current = full.id;
        setAssignmentId(String(full.assignment_id));
        setEditAssignmentFallback({
          id: full.assignment_id,
          label: [full.assignment_name, full.assignment_unit].filter(Boolean).join(' — ') || null,
          name: full.assignment_name ?? '',
          unit: full.assignment_unit ?? '',
          aks_standard: full.aks_standard ?? '',
          prompt_text: full.prompt_text ?? '',
          source_documents: full.assignment_source_documents ?? null,
        });
        const dateNorm =
          full.date_submitted != null ? String(full.date_submitted).slice(0, 10) : todayLocal();
        setDateSubmitted(dateNorm);
        const links = full.source_links || [];
        setSourceRows(
          links.length ? links.map((l) => ({ label: l.label || '', url: l.url || '' })) : [{ label: '', url: '' }]
        );
        setWritingSample(full.writing_sample ?? '');
        setStudentFeedback(full.student_feedback ?? '');
        setTeacherNotes(full.teacher_notes ?? '');
        const wt = full.writing_tags;
        setTags({
          claim_present: wt?.claim_present === true,
          evidence_cited: wt?.evidence_cited === true,
          explanation_present: wt?.explanation_present === true,
          source_named: wt?.source_named === true,
          response_incomplete: wt?.response_incomplete === true,
          ai_flag: wt?.ai_flag === true,
        });
        setFlaggedForFollowup(full.flagged_for_followup === true);
        initialSnapshotRef.current = buildSnapshot({
          assignmentId: String(full.assignment_id),
          dateSubmitted: dateNorm,
          sourceRows:
            links.length > 0
              ? links.map((l) => ({ label: (l.label || '').trim(), url: (l.url || '').trim() }))
              : [{ label: '', url: '' }],
          writingSample: full.writing_sample ?? '',
          studentFeedback: full.student_feedback ?? '',
          teacherNotes: full.teacher_notes ?? '',
          tags: {
            claim_present: wt?.claim_present === true,
            evidence_cited: wt?.evidence_cited === true,
            explanation_present: wt?.explanation_present === true,
            source_named: wt?.source_named === true,
            response_incomplete: wt?.response_incomplete === true,
            ai_flag: wt?.ai_flag === true,
          },
          flaggedForFollowup: full.flagged_for_followup === true,
        });
      } catch (e) {
        if (!cancelled) setSaveError(e.message || 'Failed to load entry');
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, editEntry?.id]);

  const addSourceRow = () => setSourceRows((r) => [...r, { label: '', url: '' }]);
  const removeSourceRow = (idx) => {
    setSourceRows((r) => (r.length <= 1 ? r : r.filter((_, i) => i !== idx)));
  };
  const updateSourceRow = (idx, key, value) => {
    setSourceRows((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  };

  const handleNestedAssignmentSaved = useCallback(async (created) => {
    try {
      const list = await getAssignments();
      setAssignments(Array.isArray(list) ? list : []);
    } catch {
      setAssignments([]);
    }
    if (created?.id) setAssignmentId(String(created.id));
    setAssignmentPanelOpen(false);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSampleError(null);
    setSourceError(null);
    setSaveError(null);

    if (!writingSample.trim()) {
      setSampleError('Writing sample is required.');
      return;
    }

    const aid = Number(assignmentId);
    if (!Number.isInteger(aid)) {
      setSaveError('Please select an assignment.');
      return;
    }

    for (const row of sourceRows) {
      const L = row.label.trim();
      const U = row.url.trim();
      if ((L && !U) || (!L && U)) {
        setSourceError('Each source row needs both a label and a URL, or leave both empty.');
        return;
      }
    }

    const linksToSave = sourceRows.filter((r) => r.label.trim() && r.url.trim());

    setSaving(true);
    try {
      let entryId = editingEntryIdRef.current;
      const entryPayload = {
        assignment_id: aid,
        date_submitted: dateSubmitted,
        writing_sample: writingSample,
        student_feedback: studentFeedback.trim() || null,
        teacher_notes: teacherNotes.trim() || null,
        flagged_for_followup: flaggedForFollowup,
      };

      if (mode === 'new') {
        if (!entryId) {
          const row = await createEntry({
            student_id: student.id,
            ...entryPayload,
          });
          entryId = row.id;
          editingEntryIdRef.current = entryId;
        } else {
          await updateEntry(entryId, entryPayload);
        }
      } else {
        if (!entryId) {
          setSaveError('Entry id missing.');
          setSaving(false);
          return;
        }
        await updateEntry(entryId, entryPayload);
      }

      const fresh = await getEntry(entryId);
      const existingLinkIds = (fresh.source_links || []).map((l) => l.id);
      for (const lid of existingLinkIds) {
        try {
          await deleteSourceLink(lid);
        } catch {
          /* ignore */
        }
      }

      for (const r of linksToSave) {
        await createSourceLink({
          entry_id: entryId,
          label: r.label.trim(),
          url: r.url.trim(),
        });
      }

      await upsertWritingTags({
        entry_id: entryId,
        claim_present: tags.claim_present,
        evidence_cited: tags.evidence_cited,
        explanation_present: tags.explanation_present,
        source_named: tags.source_named,
        response_incomplete: tags.response_incomplete,
        ai_flag: tags.ai_flag,
      });

      onSaved(entryId);
      onClose();
    } catch (err) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  if (!student?.id) return null;

  const title = mode === 'edit' ? 'Edit Entry' : 'New Entry';
  const studentLabel = `${student.first_name} ${student.last_name}`;

  return (
    <>
      <aside
        className="fixed bottom-0 right-0 top-14 z-40 flex w-[520px] shrink-0 flex-col border-l border-slate-800 bg-slate-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-editor-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <h2 id="entry-editor-title" className="text-base font-semibold text-white">
              {title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">{studentLabel}</p>
          </div>
          <button
            type="button"
            onClick={tryClose}
            className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loadingEntry ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">
            Loading entry…
          </div>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave}>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <section>
                <label className="block text-xs font-medium text-slate-400">
                  Assignment
                  <select
                    value={assignmentId}
                    onChange={(e) => setAssignmentId(e.target.value)}
                    disabled={loadingAssignments}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">Select assignment…</option>
                    {showEditAssignmentOption && (
                      <option value={String(editAssignmentFallback.id)}>
                        {editAssignmentFallback.label || `Assignment #${editAssignmentFallback.id}`}
                      </option>
                    )}
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                  <span className="font-semibold text-slate-500">AKS standard</span>
                  <p className="mt-1 whitespace-pre-wrap text-slate-300">
                    {aksDisplay || '—'}
                  </p>
                </div>
                {assignmentDocsPreview.length > 0 && (
                  <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <span className="font-semibold text-slate-500">
                      Assignment source documents
                    </span>
                    <ul className="mt-2 space-y-1.5">
                      {assignmentDocsPreview.map((l, i) => (
                        <li key={i}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:text-sky-300"
                          >
                            {l.label || l.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAssignmentPanelOpen(true)}
                  className="mt-2 text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  + New Assignment
                </button>
              </section>

              <section>
                <label className="block text-xs font-medium text-slate-400">
                  Date submitted
                  <input
                    type="date"
                    value={dateSubmitted}
                    onChange={(e) => setDateSubmitted(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source Documents (Google Drive Links)
                </p>
                <div className="mt-2 space-y-2">
                  {sourceRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={row.label}
                        onChange={(e) => updateSourceRow(idx, 'label', e.target.value)}
                        placeholder='Label (e.g. "Source 1 — Peppered Moth Graph")'
                        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <input
                        value={row.url}
                        onChange={(e) => updateSourceRow(idx, 'url', e.target.value)}
                        placeholder="https://..."
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
                {sourceError && <p className="mt-2 text-xs text-red-400">{sourceError}</p>}
                <button
                  type="button"
                  onClick={addSourceRow}
                  className="mt-2 text-sm font-medium text-sky-400 hover:text-sky-300"
                >
                  + Add Source
                </button>
              </section>

              <section>
                <label className="block text-xs font-medium text-slate-400">
                  Student Writing Sample
                  <textarea
                    value={writingSample}
                    onChange={(e) => setWritingSample(e.target.value)}
                    rows={8}
                    className="mt-1 min-h-[200px] w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white [field-sizing:content] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-500">Word count: {wc}</p>
                {sampleError && <p className="mt-1 text-xs text-red-400">{sampleError}</p>}
                {writingSample.trim().length >= 50 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={handleAutoTag}
                      disabled={aiAnalyzing || loadingEntry}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 disabled:opacity-50"
                    >
                      {aiAnalyzing ? (
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        <SparklesIcon className="h-4 w-4 shrink-0 text-violet-400" />
                      )}
                      Auto-tag with AI
                    </button>
                    {aiError && (
                      <p className="mt-2 text-xs text-red-400">{aiError}</p>
                    )}
                  </div>
                )}
                {aiSuggestionsRaw && aiDraft && (
                  <div className="mt-4 rounded-lg border border-violet-900/60 bg-violet-950/20 p-4">
                    <h3 className="text-sm font-semibold text-violet-200">
                      AI tag suggestions — review before saving
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      These are suggestions only. Edit any tag before accepting.
                    </p>
                    {aiSuggestionsRaw.overall_note && (
                      <div className="mt-3 rounded-md border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
                        {aiSuggestionsRaw.overall_note}
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      {TAG_FIELDS.map((tf) => {
                        const rk = REASONING_BY_TAG[tf.key];
                        const reason = rk ? aiSuggestionsRaw[rk] : '';
                        return (
                          <div
                            key={tf.key}
                            className="flex flex-col gap-2 border-b border-slate-800/80 pb-3 last:border-0 sm:flex-row sm:items-center sm:gap-4"
                          >
                            <span className="w-40 shrink-0 text-sm font-medium text-slate-200">
                              {tf.label}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setAiDraft((d) =>
                                  d ? { ...d, [tf.key]: !d[tf.key] } : d
                                )
                              }
                              className={`flex h-9 w-20 shrink-0 items-center justify-center rounded-md border text-base font-semibold transition ${
                                aiDraft[tf.key]
                                  ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                                  : 'border-slate-600 bg-slate-900 text-slate-500'
                              }`}
                              aria-label={`${tf.label} ${aiDraft[tf.key] ? 'true' : 'false'}`}
                            >
                              {aiDraft[tf.key] ? '✓' : '✕'}
                            </button>
                            <p className="min-w-0 flex-1 text-xs leading-snug text-slate-500">
                              {reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                      <button
                        type="button"
                        onClick={acceptAllAiSuggestions}
                        className="rounded-md bg-emerald-900/50 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/70"
                      >
                        Accept all suggestions
                      </button>
                      <button
                        type="button"
                        onClick={acceptEditedAiSuggestions}
                        className="rounded-md bg-sky-900/40 px-3 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/60"
                      >
                        Accept with edits
                      </button>
                      <button
                        type="button"
                        onClick={closeAiSuggestions}
                        className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800"
                      >
                        Reject all
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section>
                <label className="block text-xs font-medium text-slate-400">
                  Student Feedback (Glow/Grow)
                  <textarea
                    value={studentFeedback}
                    onChange={(e) => setStudentFeedback(e.target.value)}
                    placeholder="Write the feedback the student will see..."
                    className="mt-1 min-h-[150px] w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              </section>

              <section>
                <label className="block text-xs font-medium text-slate-400">
                  Teacher Notes (Private)
                  <textarea
                    value={teacherNotes}
                    onChange={(e) => setTeacherNotes(e.target.value)}
                    placeholder="Private coaching notes, IEP observations, patterns to watch..."
                    className="mt-1 min-h-[150px] w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </label>
              </section>

              <section>
                <p className="text-xs font-semibold text-slate-400">Writing Move Tags</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {TAG_FIELDS.map((tf) => (
                    <label
                      key={tf.key}
                      className="flex cursor-pointer gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-600"
                        checked={tags[tf.key]}
                        onChange={(e) =>
                          setTags((t) => ({ ...t, [tf.key]: e.target.checked }))
                        }
                      />
                      <span className="text-sm text-slate-200">
                        <span className="font-medium">{tf.label}</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {tf.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-600"
                    checked={flaggedForFollowup}
                    onChange={(e) => setFlaggedForFollowup(e.target.checked)}
                  />
                  Flag this student for follow-up
                </label>
              </section>

              {saveError && <p className="text-sm text-red-400">{saveError}</p>}

              <button
                type="button"
                onClick={tryClose}
                className="text-sm text-slate-500 underline hover:text-slate-300"
              >
                Cancel
              </button>
            </div>

            <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-4">
              <button
                type="submit"
                disabled={saving || loadingAssignments}
                className="w-full rounded-md bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </form>
        )}
      </aside>

      <AssignmentSlideIn
        nested
        open={assignmentPanelOpen}
        onClose={() => setAssignmentPanelOpen(false)}
        onSaved={handleNestedAssignmentSaved}
      />
    </>
  );
}
