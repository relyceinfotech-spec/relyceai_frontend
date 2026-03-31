import React from 'react';
import { CheckCircle2, XCircle, Shield, Crown } from 'lucide-react';

const ROWS = [
  { feature: 'Usage Dashboard', admin: true, superadmin: true },
  { feature: 'Chat Monitoring', admin: true, superadmin: true },
  { feature: 'Alerts Panel', admin: true, superadmin: true },
  { feature: 'AI Debug (Read-only)', admin: true, superadmin: true },
  { feature: 'User Management', admin: true, superadmin: true },
  { feature: 'Bulk Ops & Export', admin: true, superadmin: true },
  { feature: 'Audit Timeline', admin: true, superadmin: true },
  { feature: 'Basic Logs', admin: true, superadmin: true },
  { feature: 'Adaptive Learning Control', admin: false, superadmin: true },
  { feature: 'Mode + Role Tuning', admin: false, superadmin: true },
  { feature: 'System Configuration', admin: false, superadmin: true },
  { feature: 'Debug / Mode Check', admin: false, superadmin: true },
  { feature: 'Safety & Guard Controls', admin: false, superadmin: true },
  { feature: 'Experiment Panel (A/B)', admin: false, superadmin: true },
];

const Cell = ({ enabled }) =>
  enabled ? (
    <span className="inline-flex items-center gap-1 text-emerald-300 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-zinc-500 text-xs">
      <XCircle className="h-3.5 w-3.5" />
      Restricted
    </span>
  );

const AdminCapabilityMatrix = ({ currentRole = 'admin' }) => {
  const isSuperAdmin = String(currentRole).toLowerCase() === 'superadmin';
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[12px] font-mono tracking-widest uppercase text-white">Role Capability Matrix</h3>
          <p className="text-xs text-zinc-500 mt-1">Clear boundary between operator controls and intelligence controls.</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] ${
            isSuperAdmin
              ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
              : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {isSuperAdmin ? <Crown className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
          {isSuperAdmin ? 'Super Admin View' : 'Admin View'}
        </span>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 text-[11px] text-zinc-400 font-mono tracking-widest uppercase">Feature</th>
              <th className="py-2 text-[11px] text-zinc-400 font-mono tracking-widest uppercase">Admin</th>
              <th className="py-2 text-[11px] text-zinc-400 font-mono tracking-widest uppercase">Super Admin</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature} className="border-b border-white/5">
                <td className="py-2.5 text-sm text-zinc-200">{row.feature}</td>
                <td className="py-2.5"><Cell enabled={row.admin} /></td>
                <td className="py-2.5"><Cell enabled={row.superadmin} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCapabilityMatrix;
