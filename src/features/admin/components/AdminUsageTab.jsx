import React from 'react';
import { Activity, Users, MessageSquare, Timer, AlertCircle } from 'lucide-react';

const UsageCard = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-[11px] font-mono tracking-widest uppercase text-zinc-400">{label}</p>
      <Icon className="h-4 w-4 text-emerald-400" />
    </div>
    <p className="text-2xl text-white font-light">{value}</p>
    <p className="text-xs text-zinc-500 mt-1">{hint}</p>
  </div>
);

const AdminUsageTab = ({ statistics = {}, opsInsights = {} }) => {
  const usage = opsInsights?.usage || {};
  const totalUsers = Number(statistics?.totalUsers || 0);
  const totalChats = Number(usage?.total_chats || 0);
  const activeUsers = Number(statistics?.activeUsersThisMonth || statistics?.premiumUsers || 0);
  const responseLatency = Number(usage?.response_latency_ms || 0);
  const errorRate = Number(usage?.error_rate || 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-mono tracking-widest uppercase text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          Usage Dashboard
        </h2>
        <p className="text-sm text-zinc-500 mt-2">Clean operational stats for admins.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <UsageCard icon={MessageSquare} label="Total Chats" value={totalChats} hint="all chat runs in selected window" />
        <UsageCard icon={Users} label="Active Users" value={activeUsers} hint="active this month" />
        <UsageCard icon={Activity} label="API Usage" value={totalChats} hint="request volume" />
        <UsageCard icon={Timer} label="Response Latency" value={`${Math.round(responseLatency)} ms`} hint="average response latency" />
        <UsageCard icon={AlertCircle} label="Error Rate" value={`${Math.round(errorRate * 100)}%`} hint="failed runs ratio" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-sm font-medium text-white mb-3">Quick Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="text-zinc-400">Total Users</p>
            <p className="text-white text-lg font-light">{totalUsers}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="text-zinc-400">Premium Users</p>
            <p className="text-white text-lg font-light">{Number(statistics?.premiumUsers || 0)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 p-3">
            <p className="text-zinc-400">Monthly Revenue</p>
            <p className="text-white text-lg font-light">INR {Number(statistics?.monthlyRevenue || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsageTab;

