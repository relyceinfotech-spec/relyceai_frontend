import React, { useMemo, useState } from 'react';
import { Download, Layers, UploadCloud } from 'lucide-react';

const AdminBulkExportTab = ({
  onBulkMembershipUpdate,
  onExportUsersCsv,
  onExportUsersJson,
}) => {
  const [uidInput, setUidInput] = useState('');
  const [plan, setPlan] = useState('free');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const parsedUids = useMemo(() => {
    return Array.from(
      new Set(
        String(uidInput || '')
          .split(/[\n,\s]+/)
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )
    );
  }, [uidInput]);

  const runBulkUpdate = async () => {
    if (!onBulkMembershipUpdate) return;
    setError('');
    if (parsedUids.length === 0) {
      setError('Add at least one user ID');
      return;
    }
    try {
      setBusy(true);
      const data = await onBulkMembershipUpdate({
        target_uids: parsedUids,
        plan,
        billing_cycle: billingCycle,
      });
      setResult(data || null);
    } catch (e) {
      setError(e?.message || 'Bulk update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-400" />
          Bulk Ops & Export Center
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Run bulk plan updates and export user datasets.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4">
        <h3 className="text-sm text-white">Bulk Membership Update</h3>
        <textarea
          value={uidInput}
          onChange={(e) => setUidInput(e.target.value)}
          rows={6}
          placeholder="Paste user IDs (comma, newline, or space separated)"
          className="w-full rounded-lg bg-black/40 border border-white/10 text-zinc-200 text-xs p-3 outline-none focus:border-emerald-500/40"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/10 text-zinc-200 text-xs px-3 py-2"
          >
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
            <option value="student">Student</option>
            <option value="premium">Premium</option>
          </select>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/10 text-zinc-200 text-xs px-3 py-2"
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={runBulkUpdate}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {busy ? 'Applying...' : `Apply to ${parsedUids.length} users`}
          </button>
        </div>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {result?.summary && (
          <p className="text-xs text-zinc-300">
            Requested {result.summary.requested} · Success {result.summary.success} · Failed {result.summary.failed}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
        <h3 className="text-sm text-white">Export Center</h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onExportUsersCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export Users (CSV)
          </button>
          <button
            type="button"
            onClick={onExportUsersJson}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-zinc-200 hover:bg-white/10"
          >
            <Download className="h-4 w-4" />
            Export Users (JSON)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBulkExportTab;

