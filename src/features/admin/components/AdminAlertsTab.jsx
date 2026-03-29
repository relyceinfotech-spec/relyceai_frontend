import React from 'react';
import { AlertTriangle, Siren, Wrench } from 'lucide-react';

const AlertRow = ({ item }) => {
  const severity = String(item?.severity || 'low').toLowerCase();
  const tone =
    severity === 'high'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
      : severity === 'medium'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : 'border-blue-500/30 bg-blue-500/10 text-blue-100';
  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{item?.code || 'alert'}</p>
        <span className="text-[11px] uppercase tracking-wider">{severity}</span>
      </div>
      <p className="text-xs mt-1 opacity-90">{item?.message || 'No details'}</p>
    </div>
  );
};

const AdminAlertsTab = ({ opsInsights = {} }) => {
  const alerts = Array.isArray(opsInsights?.alerts) ? opsInsights.alerts : [];
  const high = alerts.filter((a) => String(a?.severity || '').toLowerCase() === 'high').length;
  const medium = alerts.filter((a) => String(a?.severity || '').toLowerCase() === 'medium').length;
  const low = alerts.filter((a) => String(a?.severity || '').toLowerCase() === 'low').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <Siren className="h-5 w-5 text-emerald-400" />
          Alerts Panel
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Track high failure rate, slow responses, and tool failures.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-rose-200">High Severity</p>
          <p className="text-2xl font-light text-white mt-1">{high}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-amber-100">Medium Severity</p>
          <p className="text-2xl font-light text-white mt-1">{medium}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <p className="text-[11px] font-mono tracking-widest uppercase text-blue-100">Low Severity</p>
          <p className="text-2xl font-light text-white mt-1">{low}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm text-white">Active Alerts</h3>
        </div>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {alerts.length === 0 && <p className="text-sm text-zinc-500">No active alerts.</p>}
          {alerts.map((item, idx) => (
            <AlertRow key={`${item?.code || idx}-${idx}`} item={item} />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-zinc-300" />
          <h3 className="text-sm text-white">Operator Note</h3>
        </div>
        <p className="text-xs text-zinc-400">
          Keep this panel simple for day-to-day operations. Deep configuration belongs in Super Admin only.
        </p>
      </div>
    </div>
  );
};

export default AdminAlertsTab;

