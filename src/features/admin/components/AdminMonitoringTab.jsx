import React from 'react';
import { MessageSquareWarning, ShieldAlert } from 'lucide-react';

const AdminMonitoringTab = ({ opsInsights = {} }) => {
  const chatMonitoring = opsInsights?.chat_monitoring || {};
  const recentChats = Array.isArray(chatMonitoring?.recent_chats) ? chatMonitoring.recent_chats : [];
  const lowConfidenceOutputs = Array.isArray(chatMonitoring?.low_confidence_outputs)
    ? chatMonitoring.low_confidence_outputs
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-emerald-400" />
          Chat Monitoring
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Track recent chats, flagged responses, and low-confidence outputs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">Recent Chats</p>
          <p className="text-2xl text-white font-light mt-1">{recentChats.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">Flagged Responses</p>
          <p className="text-2xl text-amber-300 font-light mt-1">{Number(chatMonitoring?.flagged_responses || 0)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">Low-Confidence Outputs</p>
          <p className="text-2xl text-rose-300 font-light mt-1">{lowConfidenceOutputs.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h3 className="text-sm text-white mb-3">Recent Chats</h3>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {recentChats.length === 0 && <p className="text-sm text-zinc-500">No chat activity yet.</p>}
          {recentChats.slice().reverse().slice(0, 20).map((item, idx) => (
            <div key={`${item.timestamp || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-300 truncate">{item.query || '(empty query)'}</p>
                <span className={`text-[11px] px-2 py-0.5 rounded border ${item.success ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10' : 'text-rose-200 border-rose-400/40 bg-rose-500/10'}`}>
                  {item.success ? 'ok' : 'issue'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {item.mode} · {item.confidence_level} · {item.timestamp || '-'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm text-amber-100">Low-Confidence Outputs</h3>
        </div>
        <div className="space-y-2 max-h-60 overflow-auto pr-1">
          {lowConfidenceOutputs.length === 0 && <p className="text-sm text-zinc-400">No low-confidence outputs in this window.</p>}
          {lowConfidenceOutputs.slice().reverse().slice(0, 15).map((item, idx) => (
            <div key={`${item.timestamp || idx}-${idx}`} className="rounded-lg border border-white/10 bg-black/40 p-3">
              <p className="text-xs text-zinc-200 truncate">{item.query || '(empty query)'}</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                {item.mode} · {item.confidence_level} · retries {item.retries} · {item.timestamp || '-'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminMonitoringTab;

