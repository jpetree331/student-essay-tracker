export function ChartSkeleton({ className = '' }) {
  return (
    <div
      className={`w-full animate-pulse rounded-lg bg-slate-800/40 ${className}`}
      aria-hidden
    />
  );
}
