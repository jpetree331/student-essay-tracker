const CHIP = {
  claim: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
  evidence: 'border-blue-700 bg-blue-950/60 text-blue-200',
  explanation: 'border-teal-700 bg-teal-950/60 text-teal-200',
  source: 'border-slate-600 bg-slate-800/80 text-slate-300',
  incomplete: 'border-amber-700 bg-amber-950/60 text-amber-200',
  ai: 'border-red-700 bg-red-950/60 text-red-200',
};

function isTrue(v) {
  return v === true;
}

export function TagChipsRow({ entry }) {
  const chips = [];
  if (isTrue(entry.claim_present)) chips.push({ key: 'c', label: 'Claim', cls: CHIP.claim });
  if (isTrue(entry.evidence_cited)) chips.push({ key: 'e', label: 'Evidence', cls: CHIP.evidence });
  if (isTrue(entry.explanation_present))
    chips.push({ key: 'x', label: 'Explanation', cls: CHIP.explanation });
  if (isTrue(entry.source_named)) chips.push({ key: 's', label: 'Source Named', cls: CHIP.source });
  if (isTrue(entry.response_incomplete))
    chips.push({ key: 'i', label: 'Incomplete', cls: CHIP.incomplete });
  if (isTrue(entry.ai_flag)) chips.push({ key: 'a', label: 'AI Flag', cls: CHIP.ai });

  if (!chips.length) {
    return <span className="text-xs text-slate-500">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.key}
          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.cls}`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
