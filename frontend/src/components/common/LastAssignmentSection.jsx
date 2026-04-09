import { formatChipDate } from '../../lib/dates';
import { WritingMoveTagStrip } from './WritingMoveTagStrip';

/**
 * @param {object} props
 * @param {object | null} props.lastSubmission — { date_submitted, assignment_name, tags }
 * @param {boolean} [props.compact]
 */
export function LastAssignmentSection({ lastSubmission, compact = false }) {
  const hasEntry = lastSubmission != null && lastSubmission.entry_id != null;

  const dateLabel = hasEntry ? formatChipDate(lastSubmission.date_submitted) : '';
  const lineTitle = [dateLabel, lastSubmission?.assignment_name]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Last assignment
      </p>
      {!hasEntry ? (
        <p className="mt-0.5 text-[11px] text-slate-500">No submissions yet</p>
      ) : (
        <>
          <p className="mt-0.5 truncate text-[11px] text-slate-400" title={lineTitle || undefined}>
            <span className="tabular-nums text-slate-500">{dateLabel}</span>
            {lastSubmission.assignment_name ? (
              <>
                <span className="text-slate-600"> · </span>
                {lastSubmission.assignment_name}
              </>
            ) : null}
          </p>
          <div className="mt-1">
            <WritingMoveTagStrip
              tags={lastSubmission.tags && typeof lastSubmission.tags === 'object' ? lastSubmission.tags : {}}
              compact={compact}
            />
          </div>
        </>
      )}
    </div>
  );
}
