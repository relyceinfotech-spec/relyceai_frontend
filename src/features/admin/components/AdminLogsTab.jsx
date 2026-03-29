import React from 'react';
import { FileText } from 'lucide-react';

const levelTone = (level) => {
  const x = String(level || 'info').toLowerCase();
  if (x === 'warn') return 'text-amber-200 border-amber-500/30 bg-amber-500/10';
  if (x === 'error') return 'text-rose-200 border-rose-500/30 bg-rose-500/10';
  return 'text-blue-100 border-blue-500/30 bg-blue-500/10';
};

const AdminLogsTab = ({ opsInsights = {} }) => {
  const logs = Array.isArray(opsInsights?.logs) ? opsInsights.logs : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-400" />
          Basic Logs
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Request logs, errors, and timestamps (simple operator view).</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
          {logs.length === 0 && <p className="text-sm text-zinc-500">No log events in this range.</p>}
          {logs.map((item, idx) => (
            <div key={`${item?.timestamp || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] border ${levelTone(item?.level)}`}>
                  {String(item?.level || 'info').toUpperCase()}
                </span>
                <span className="text-[11px] text-zinc-400">{item?.source || 'system'}</span>
                <span className="text-[11px] text-zinc-500">{item?.timestamp || '-'}</span>
              </div>
              <p className="text-xs text-zinc-200">{item?.message || 'No message'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminLogsTab;

