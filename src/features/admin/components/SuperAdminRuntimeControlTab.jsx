import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, Save, Camera, RotateCcw } from 'lucide-react';

const SuperAdminRuntimeControlTab = ({
  config = {},
  onSaveConfig,
  onSnapshot,
  onRollback,
}) => {
  const [draft, setDraft] = useState(config || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(config || {});
  }, [config]);

  const setBool = (key, value) => setDraft((prev) => ({ ...prev, [key]: Boolean(value) }));
  const setNum = (key, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setDraft((prev) => ({ ...prev, [key]: n }));
  };

  const save = async () => {
    if (!onSaveConfig) return;
    try {
      setBusy(true);
      await onSaveConfig(draft);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
          Live Runtime Control
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Real-time control for adaptive rollout, remediation, and safety knobs.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Adaptive Enabled
            <input type="checkbox" checked={Boolean(draft.adaptive_enabled)} onChange={(e) => setBool('adaptive_enabled', e.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Auto Remediation Enabled
            <input type="checkbox" checked={Boolean(draft.auto_remediation_enabled)} onChange={(e) => setBool('auto_remediation_enabled', e.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Auto Tuning Enabled
            <input type="checkbox" checked={Boolean(draft.auto_tuning_enabled)} onChange={(e) => setBool('auto_tuning_enabled', e.target.checked)} />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Apply Ratio
            <input
              type="number"
              min="0.1"
              max="1"
              step="0.1"
              value={Number(draft.adaptive_apply_ratio ?? 1)}
              onChange={(e) => setNum('adaptive_apply_ratio', e.target.value)}
              className="w-20 rounded bg-black/60 border border-white/10 px-2 py-1 text-right"
            />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Low-Conf Trigger
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={Number(draft.auto_remediation_low_conf_trigger ?? 0.4)}
              onChange={(e) => setNum('auto_remediation_low_conf_trigger', e.target.value)}
              className="w-20 rounded bg-black/60 border border-white/10 px-2 py-1 text-right"
            />
          </label>
          <label className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-200 flex items-center justify-between">
            Cooldown Runs
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              value={Number(draft.adaptive_cooldown_runs ?? 6)}
              onChange={(e) => setNum('adaptive_cooldown_runs', e.target.value)}
              className="w-20 rounded bg-black/60 border border-white/10 px-2 py-1 text-right"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {busy ? 'Saving...' : 'Save Runtime Config'}
          </button>
          <button
            type="button"
            onClick={() => onSnapshot?.('runtime-control')}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
          >
            <Camera className="h-4 w-4" />
            Create Snapshot
          </button>
          <button
            type="button"
            onClick={() => onRollback?.()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            Rollback Snapshot
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminRuntimeControlTab;

