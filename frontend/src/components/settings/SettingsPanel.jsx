import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../../api/client';

/**
 * Desktop-only settings modal: AI provider choice + API keys. Keys are
 * write-only — the backend reports only whether one is saved, never the key.
 */
export function SettingsPanel({ onClose }) {
  const [loaded, setLoaded] = useState(null); // { ai_provider, has_anthropic_key, has_openai_key }
  const [provider, setProvider] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [status, setStatus] = useState(null); // { kind: 'ok' | 'error', message }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (cancelled) return;
        setLoaded(s);
        setProvider(s.ai_provider || '');
      })
      .catch((e) => {
        if (!cancelled) setStatus({ kind: 'error', message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const payload = { ai_provider: provider };
      if (anthropicKey.trim()) payload.anthropic_api_key = anthropicKey.trim();
      if (openaiKey.trim()) payload.openai_api_key = openaiKey.trim();
      const s = await updateSettings(payload);
      setLoaded(s);
      setAnthropicKey('');
      setOpenaiKey('');
      setStatus({ kind: 'ok', message: 'Settings saved.' });
    } catch (e) {
      setStatus({ kind: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(field) {
    setSaving(true);
    setStatus(null);
    try {
      const s = await updateSettings({ [field]: '' });
      setLoaded(s);
      setStatus({ kind: 'ok', message: 'Key removed.' });
    } catch (e) {
      setStatus({ kind: 'error', message: e.message });
    } finally {
      setSaving(false);
    }
  }

  function keyRow(label, hasKey, value, setValue, field) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">{label}</label>
          {hasKey && (
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              key saved
              <button
                type="button"
                onClick={() => clearKey(field)}
                disabled={saving}
                className="text-slate-500 underline hover:text-red-400 disabled:opacity-50"
              >
                remove
              </button>
            </span>
          )}
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hasKey ? 'Enter a new key to replace the saved one' : 'Paste your API key'}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-600 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          AI features (auto-tagging and progress comparison) need an API key from{' '}
          <span className="text-slate-300">Anthropic</span> or{' '}
          <span className="text-slate-300">OpenAI</span>. Keys are stored only on this computer.
          Everything else in the app works without one.
        </p>

        {loaded == null && status == null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">AI provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-sky-600 focus:outline-none"
              >
                <option value="">Automatic (use whichever key is saved)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            {keyRow(
              'Anthropic API key',
              loaded?.has_anthropic_key,
              anthropicKey,
              setAnthropicKey,
              'anthropic_api_key'
            )}
            {keyRow('OpenAI API key', loaded?.has_openai_key, openaiKey, setOpenaiKey, 'openai_api_key')}

            {status && (
              <p className={status.kind === 'ok' ? 'text-sm text-emerald-400' : 'text-sm text-red-400'}>
                {status.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
              >
                Close
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loaded == null}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
