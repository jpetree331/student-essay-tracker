import { useEffect, useState } from 'react';
import { isDesktop, getDemoMode, setDemoMode } from '../api/client';
import { SettingsPanel } from './settings/SettingsPanel';

export function HeaderBar() {
  // null = unknown/not applicable (web build renders no toggle at all).
  const [demoOn, setDemoOn] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    let cancelled = false;
    getDemoMode()
      .then((d) => {
        if (!cancelled) setDemoOn(Boolean(d.enabled));
      })
      .catch(() => {
        if (!cancelled) setDemoOn(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDemo() {
    if (switching || demoOn == null) return;
    setSwitching(true);
    try {
      await setDemoMode(!demoOn);
      // Full reload is the simplest way to refresh every view's data.
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <header className="flex h-14 w-full shrink-0 items-center border-b border-slate-800 bg-slate-950 px-4">
      <h1 className="text-lg font-semibold tracking-tight text-white">
        Science Writing Tracker
      </h1>
      {isDesktop && (
        <div className="ml-auto flex items-center gap-3">
          {demoOn && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              Viewing demo data — your real roster is safe and hidden
            </span>
          )}
          {demoOn != null && (
            <button
              type="button"
              onClick={toggleDemo}
              disabled={switching}
              className={
                demoOn
                  ? 'rounded-md border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-500/30 disabled:opacity-50'
                  : 'rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-sky-600 hover:text-sky-300 disabled:opacity-50'
              }
            >
              {switching ? 'Switching…' : demoOn ? 'Hide demo data' : 'Show demo data'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300 hover:border-sky-600 hover:text-sky-300"
          >
            ⚙
          </button>
        </div>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
