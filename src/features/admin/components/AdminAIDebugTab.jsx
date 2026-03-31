import React from 'react';
import { BrainCircuit, Gauge, Layers, GitBranch } from 'lucide-react';

const AdminAIDebugTab = ({ debugData = {} }) => {
  const totals = debugData?.totals || {};
  const perMode = Array.isArray(debugData?.per_mode_stats) ? debugData.per_mode_stats : [];
  const perRole = Array.isArray(debugData?.per_role_stats) ? debugData.per_role_stats : [];
  const roleFlow = debugData?.role_flow || { count: 0, recent: [] };
  const overrides = debugData?.override_insights || { count: 0, reason_counts: {} };
  const failure = debugData?.failure_analyzer || { count: 0, items: [] };
  const confidence = debugData?.confidence_distribution || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-emerald-400" />
          AI Debug (Read-only)
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Live reasoning and reliability telemetry for operators.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest">Runs</p>
          <p className="text-2xl text-white">{Number(totals.runs || 0)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest">Success Rate</p>
          <p className="text-2xl text-white">{Math.round(Number(totals.success_rate || 0) * 100)}%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest">Overrides</p>
          <p className="text-2xl text-white">{Number(overrides.count || 0)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] text-zinc-400 uppercase tracking-widest">Low Confidence</p>
          <p className="text-2xl text-amber-200">{Math.round(Number(confidence.low_pct || 0) * 100)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm text-white">Per Mode</h3>
          </div>
          <div className="space-y-2 text-xs">
            {perMode.length === 0 && <p className="text-zinc-500">No mode telemetry yet.</p>}
            {perMode.map((row) => (
              <div key={row.mode} className="rounded-lg border border-white/10 bg-black/40 p-3">
                <p className="text-zinc-200 capitalize">{row.mode}</p>
                <p className="text-zinc-400 mt-1">
                  Success {Math.round(Number(row.success_rate || 0) * 100)}% · Latency {Math.round(Number(row.avg_latency_ms || 0))} ms
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm text-white">Per Role</h3>
          </div>
          <div className="space-y-2 text-xs">
            {perRole.length === 0 && <p className="text-zinc-500">No role telemetry yet.</p>}
            {perRole.map((row) => (
              <div key={row.role} className="rounded-lg border border-white/10 bg-black/40 p-3">
                <p className="text-zinc-200 capitalize">{row.role}</p>
                <p className="text-zinc-400 mt-1">
                  Success {Math.round(Number(row.success_rate || 0) * 100)}% · Retries {Number(row.avg_retries || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm text-white">Recent Role Flow ({Number(roleFlow.count || 0)})</h3>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {(roleFlow.recent || []).length === 0 && <p className="text-sm text-zinc-500">No role flow captured yet.</p>}
          {(roleFlow.recent || []).slice(-20).map((row, idx) => (
            <div key={`${row.at || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
              <p className="text-zinc-200">
                {row.node_id || 'node'} · <span className="capitalize">{row.role || 'executor'}</span> · {row.status || 'completed'}
              </p>
              <p className="text-zinc-500 mt-1">{row.at || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="text-sm text-white mb-3">Recent Low-confidence / Failures ({Number(failure.count || 0)})</h3>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {(failure.items || []).length === 0 && <p className="text-sm text-zinc-500">No failure items in this range.</p>}
          {(failure.items || []).slice(-20).map((row, idx) => (
            <div key={`${row.timestamp || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs">
              <p className="text-zinc-200 truncate">{row.query_preview || '(empty query)'}</p>
              <p className="text-zinc-500 mt-1">
                {row.mode} · {row.confidence_level} · retries {row.retries} · {row.timestamp || '-'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminAIDebugTab;

