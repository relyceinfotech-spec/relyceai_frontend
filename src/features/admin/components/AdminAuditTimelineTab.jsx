import React, { useMemo, useState } from 'react';
import { History, RefreshCcw } from 'lucide-react';

const AdminAuditTimelineTab = ({ rows = [], onRefresh }) => {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = String(filter || '').trim().toLowerCase();
    if (!q) return rows;
    return (rows || []).filter((r) =>
      String(r.action || '').toLowerCase().includes(q) ||
      String(r.by || '').toLowerCase().includes(q) ||
      String(r.target || '').toLowerCase().includes(q)
    );
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
            <History className="h-5 w-5 text-emerald-400" />
            Audit Timeline
          </h2>
          <p className="text-sm text-zinc-500 mt-2">Immutable trail of role, membership, and admin operations.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action / actor / target"
          className="w-full rounded-lg bg-black/40 border border-white/10 text-zinc-200 text-xs p-3 outline-none focus:border-emerald-500/40"
        />
        <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
          {filtered.length === 0 && <p className="text-sm text-zinc-500">No audit logs found.</p>}
          {filtered.map((row, idx) => (
            <div key={`${row.id || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded border border-emerald-400/40 bg-emerald-500/10 text-emerald-100 text-[11px]">
                  {row.action || 'ACTION'}
                </span>
                <span className="text-[11px] text-zinc-400">{row.timestamp || '-'}</span>
              </div>
              <p className="text-xs text-zinc-300 mt-1">
                by <span className="text-white">{row.by || '-'}</span> → target <span className="text-white">{row.target || '-'}</span>
              </p>
              {row.details && Object.keys(row.details).length > 0 && (
                <pre className="mt-2 text-[11px] text-zinc-400 bg-black/40 border border-white/5 rounded p-2 overflow-auto">
{JSON.stringify(row.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminAuditTimelineTab;

