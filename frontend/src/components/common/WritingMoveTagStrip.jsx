const ACTIVE = {
  claim_present: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
  evidence_cited: 'border-blue-700 bg-blue-950/60 text-blue-200',
  explanation_present: 'border-teal-700 bg-teal-950/60 text-teal-200',
  source_named: 'border-slate-500 bg-slate-800/80 text-slate-200',
  response_incomplete: 'border-amber-700 bg-amber-950/60 text-amber-200',
  ai_flag: 'border-red-700 bg-red-950/60 text-red-200',
};

const INACTIVE = 'border-slate-700/50 bg-slate-900/25 text-slate-600';

const DEFS = [
  { key: 'claim_present', title: 'Claim present' },
  { key: 'evidence_cited', title: 'Evidence cited' },
  { key: 'explanation_present', title: 'Explanation present' },
  { key: 'source_named', title: 'Source named' },
  { key: 'response_incomplete', title: 'Response incomplete' },
  { key: 'ai_flag', title: 'AI flag' },
];

/**
 * @param {object} props
 * @param {Record<string, boolean>} [props.tags]
 * @param {boolean} [props.compact] — tighter spacing in narrow sidebars
 */
export function WritingMoveTagStrip({ tags = {}, compact = false }) {
  return (
    <div
      className={`flex flex-wrap items-center ${compact ? 'gap-0.5' : 'gap-1'}`}
      role="list"
      aria-label="Writing move tags"
    >
      {DEFS.map(({ key, title }) => {
        const on = tags[key] === true;
        return (
          <span
            key={key}
            role="listitem"
            title={title}
            className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none ${
              on ? ACTIVE[key] : INACTIVE
            } ${on ? '' : 'opacity-55'}`}
            aria-label={`${title}: ${on ? 'yes' : 'no'}`}
          >
            {on ? '✓' : ''}
          </span>
        );
      })}
    </div>
  );
}
