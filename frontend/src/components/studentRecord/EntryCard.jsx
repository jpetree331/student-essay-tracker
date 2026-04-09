import { useCallback, useState } from 'react';
import { upsertWritingTags } from '../../api/client';
import { parseAssignmentSources } from '../../lib/assignmentSources';
import { formatLongDate } from '../../lib/dates';
import { entryHasWritingTagsRow } from '../../lib/entryTags';
import { LinkIcon } from './LinkIcon';
import { TagChipsRow } from './TagChipsRow';

function SubCollapsible({ title, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-200 hover:bg-slate-800/40"
      >
        <span>{title}</span>
        <span
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>
      {open && <div className="border-t border-slate-800">{children}</div>}
    </div>
  );
}

const TAG_FIELDS = [
  { key: 'claim_present', label: 'Claim Present' },
  { key: 'evidence_cited', label: 'Evidence Cited' },
  { key: 'explanation_present', label: 'Explanation Present' },
  { key: 'source_named', label: 'Source Named' },
  { key: 'response_incomplete', label: 'Incomplete' },
  { key: 'ai_flag', label: 'AI Flag' },
];

export function EntryCard({
  entry,
  expanded,
  onToggleExpanded,
  isActiveChip,
  onEntryTagUpdate,
  onEditEntry,
  compareSelectMode,
  compareSelected,
  compareCanSelect = true,
  onCompareToggle,
}) {
  const [writingOpen, setWritingOpen] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [tagSaving, setTagSaving] = useState(null);
  const [tagErr, setTagErr] = useState(null);

  const aks = entry.assignment_aks_standard || '';
  const assignmentDocLinks = parseAssignmentSources(entry.assignment_source_documents);

  const handleTagChange = useCallback(
    async (field, checked) => {
      setTagErr(null);
      setTagSaving(field);
      try {
        const row = await upsertWritingTags({
          entry_id: entry.id,
          [field]: checked,
        });
        onEntryTagUpdate(entry.id, {
          claim_present: row.claim_present,
          evidence_cited: row.evidence_cited,
          explanation_present: row.explanation_present,
          source_named: row.source_named,
          response_incomplete: row.response_incomplete,
          ai_flag: row.ai_flag,
          tag_notes: row.notes,
        });
      } catch (e) {
        setTagErr(e.message || 'Could not save tags');
      } finally {
        setTagSaving(null);
      }
    },
    [entry.id, onEntryTagUpdate]
  );

  const boolVal = (v) => v === true;

  const compareOn = compareSelectMode === true;
  const selectedForCompare = compareOn && compareSelected === true;
  const compareCheckboxDisabled =
    compareOn && compareCanSelect === false && !selectedForCompare;

  return (
    <article
      id={`entry-card-${entry.id}`}
      className={`mb-4 w-full scroll-mt-36 rounded-xl border bg-slate-900/50 ${
        selectedForCompare
          ? 'border-blue-500 ring-2 ring-blue-500/35'
          : isActiveChip
            ? 'border-sky-600 ring-1 ring-sky-600/40'
            : 'border-slate-800'
      }`}
    >
      <div className="flex w-full items-start gap-2">
        {compareOn && (
          <label
            className="mt-3.5 ml-3 flex shrink-0 cursor-pointer items-center"
            onClick={(ev) => ev.stopPropagation()}
            onKeyDown={(ev) => ev.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selectedForCompare}
              disabled={compareCheckboxDisabled}
              onChange={(ev) => onCompareToggle?.(entry.id, ev.target.checked)}
              title={
                compareCheckboxDisabled
                  ? 'Turn off “Same assignment only” or pick entries for the same assignment.'
                  : undefined
              }
              className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Select entry for comparison: ${entry.assignment_name || entry.id}`}
            />
          </label>
        )}
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/30"
        >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-white">
              {formatLongDate(entry.date_submitted)}
            </span>
            <span className="text-sm text-sky-300">{entry.assignment_name}</span>
          </div>
          <p className="line-clamp-1 text-xs text-slate-500">{aks || '—'}</p>
          <p className="text-xs font-medium text-slate-400">
            {entry.word_count ?? 0} words
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {entryHasWritingTagsRow(entry) && (
              <span className="inline-flex rounded-full border border-slate-600 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Tagged
              </span>
            )}
            {entry.ai_flag === true && (
              <span className="inline-flex rounded-full border border-amber-700 bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                AI Flag
              </span>
            )}
          </div>
          <TagChipsRow entry={entry} />
        </div>
        <span
          className={`mt-1 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▼
        </span>
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-800 px-4 pb-4 pt-3">
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LinkIcon className="h-3.5 w-3.5 text-slate-400" />
              Sources
            </div>
            {assignmentDocLinks.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  From assignment
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignmentDocLinks.map((l, i) => (
                    <a
                      key={`a-${i}`}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full rounded-full border border-emerald-900/60 bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-900/40"
                    >
                      <span className="truncate">{l.label || l.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {entry.source_links?.length ? (
              <div className="flex flex-wrap gap-2">
                {entry.source_links.map((l) => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full rounded-full border border-sky-800 bg-sky-950/40 px-3 py-1 text-xs font-medium text-sky-200 hover:bg-sky-900/50"
                  >
                    <span className="truncate">{l.label}</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No sources linked.</p>
            )}
          </section>

          <SubCollapsible
            title="Student Writing Sample"
            open={writingOpen}
            onToggle={() => setWritingOpen((o) => !o)}
          >
            <div className="p-3">
              <div className="rounded-md bg-slate-800/60 p-4 font-serif text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                {entry.writing_sample || (
                  <span className="text-slate-500 italic">No writing sample.</span>
                )}
              </div>
            </div>
          </SubCollapsible>

          <SubCollapsible
            title="Student Feedback (Glow/Grow)"
            open={feedbackOpen}
            onToggle={() => setFeedbackOpen((o) => !o)}
          >
            <div className="grid gap-3 p-3 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student Feedback (Glow/Grow)
                </p>
                {entry.student_feedback ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {entry.student_feedback}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Teacher Notes (Private)
                </p>
                {entry.teacher_notes ? (
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {entry.teacher_notes}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">—</p>
                )}
              </div>
            </div>
          </SubCollapsible>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Writing tags
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {TAG_FIELDS.map((tf) => (
                <label
                  key={tf.key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-600 focus:ring-sky-500"
                    checked={boolVal(entry[tf.key])}
                    disabled={tagSaving === tf.key}
                    onChange={(e) => handleTagChange(tf.key, e.target.checked)}
                  />
                  <span>{tf.label}</span>
                </label>
              ))}
            </div>
            {tagErr && <p className="mt-2 text-xs text-red-400">{tagErr}</p>}
          </section>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => onEditEntry(entry)}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Edit entry
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
