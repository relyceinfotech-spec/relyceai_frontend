import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  AlertTriangle,
  Save,
  Play,
  GitCompare,
  Camera,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const RANGE_OPTIONS = ['24h', '7d', '30d', 'all'];

const AnalyticsTab = ({
  tabVariants,
  statistics = {},
  users = [],
  highStakesMetrics = {},
  agentDebugInsights = {},
  hsRange = '24h',
  onHsRangeChange,
  hsThresholds = { source_fail_spike: 0.30, low_confidence_spike: 0.40, recency_fail_spike: 0.25 },
  onHsThresholdsSave,
  onAgentDebugConfigSave,
  onAgentModeCheck,
  onAdaptiveSnapshot,
  onAdaptiveRollback,
}) => {
  const [draftThresholds, setDraftThresholds] = useState(hsThresholds);
  const [draftAgentConfig, setDraftAgentConfig] = useState(agentDebugInsights?.config || {});
  const [selectedTrendDomain, setSelectedTrendDomain] = useState('all');
  const [modeCheckInput, setModeCheckInput] = useState('');
  const [modeCheckMode, setModeCheckMode] = useState('smart');
  const [modeCheckLoading, setModeCheckLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [modeCheckResult, setModeCheckResult] = useState(null);
  const [compareResults, setCompareResults] = useState([]);
  const [modeCheckError, setModeCheckError] = useState('');
  const [showModeDebug, setShowModeDebug] = useState(false);
  const [adaptiveActionBusy, setAdaptiveActionBusy] = useState(false);
  const [rolloutActionBusy, setRolloutActionBusy] = useState(false);

  useEffect(() => {
    setDraftThresholds(hsThresholds || { source_fail_spike: 0.30, low_confidence_spike: 0.40, recency_fail_spike: 0.25 });
  }, [hsThresholds]);

  useEffect(() => {
    setDraftAgentConfig(agentDebugInsights?.config || {});
  }, [agentDebugInsights]);

  const totalUsers = users.length || statistics.totalUsers || 0;
  const activeThisMonth = statistics.activeUsersThisMonth || Math.round(totalUsers * 0.7);
  const newThisWeek = statistics.newUsersThisWeek || Math.round((statistics.newUsersThisMonth || 0) / 4) || 0;
  const avgSessionDuration = statistics.avgSessionDuration || '12 min';

  const planCounts = users.reduce((acc, user) => {
    const plan = user.membership?.plan || 'free';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {});

  const hs = {
    range: highStakesMetrics.range || hsRange,
    total: highStakesMetrics.total || 0,
    strictModeTotal: highStakesMetrics.strict_mode_total || 0,
    sourceMet: highStakesMetrics.source_requirement?.met || 0,
    sourceFailed: highStakesMetrics.source_requirement?.failed || 0,
    recencyMet: highStakesMetrics.recency_requirement?.met || 0,
    recencyFailed: highStakesMetrics.recency_requirement?.failed || 0,
    confidence: highStakesMetrics.confidence_levels || { LOW: 0, MODERATE: 0, HIGH: 0 },
    domains: highStakesMetrics.domain_counts || {},
    drilldown: highStakesMetrics.domain_drilldown || [],
    trend: highStakesMetrics.trend_series || [],
    alerts: highStakesMetrics.alerts || [],
  };

  const debug = {
    totals: agentDebugInsights?.totals || { runs: 0, successes: 0, success_rate: 0 },
    perModeStats: agentDebugInsights?.per_mode_stats || [],
    perRoleStats: agentDebugInsights?.per_role_stats || [],
    roleFlow: agentDebugInsights?.role_flow || { count: 0, recent: [] },
    overrideInsights: agentDebugInsights?.override_insights || { count: 0, reason_counts: {}, recent: [] },
    confidenceDistribution: agentDebugInsights?.confidence_distribution || {
      high: 0,
      medium: 0,
      low: 0,
      high_pct: 0,
      medium_pct: 0,
      low_pct: 0,
    },
    failureAnalyzer: agentDebugInsights?.failure_analyzer || { count: 0, items: [] },
    autoTuning: agentDebugInsights?.auto_tuning || { enabled: true, state: {}, recent_events: [] },
    autoRemediation: agentDebugInsights?.auto_remediation || { enabled: true, state: {}, recent_events: [] },
    adaptiveLearning: agentDebugInsights?.adaptive_learning || {
      enabled: true,
      state_size: 0,
      top_failing_buckets: [],
      low_confidence_clusters: [],
      high_retry_queries: [],
      recent_cases: [],
      rule_events_recent: [],
      canary_compare: {
        baseline: { runs: 0, success_rate: 0, avg_latency_ms: 0, avg_retries: 0, parallel_exception_rate: 0 },
        adaptive: { runs: 0, success_rate: 0, avg_latency_ms: 0, avg_retries: 0, parallel_exception_rate: 0 },
        delta: { success_rate: 0, avg_latency_ms: 0, avg_retries: 0, parallel_exception_rate: 0 },
      },
    },
    toolReliability: agentDebugInsights?.tool_reliability || { count: 0, top_tools: [], weak_tools: [] },
    slo: agentDebugInsights?.slo || {
      targets: {
        p95_latency_ms_max: 25000,
        low_conf_rate_max: 0.35,
        avg_retries_max: 1.5,
        parallel_exception_rate_max: 0.3,
      },
      current: {
        p95_latency_ms: 0,
        low_conf_rate: 0,
        avg_retries: 0,
        parallel_exception_rate: 0,
      },
      status: {
        p95_latency_ok: true,
        low_conf_rate_ok: true,
        avg_retries_ok: true,
        parallel_exception_rate_ok: true,
      },
    },
  };

  const trendDomains = useMemo(() => {
    const set = new Set(hs.trend.map((x) => x.domain).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [hs.trend]);

  const trendRows = useMemo(() => {
    const rows = hs.trend
      .filter((x) => selectedTrendDomain === 'all' || x.domain === selectedTrendDomain)
      .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
    return rows;
  }, [hs.trend, selectedTrendDomain]);

  const StatCard = ({ title, value, change, positive, icon: Icon }) => (
    <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl p-6 hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-emerald-500/10">
          <Icon className="h-5 w-5 text-emerald-500" />
        </div>
        {change && (
          <span className={`flex items-center text-xs font-medium ${positive ? 'text-emerald-500' : 'text-red-400'}`}>
            {positive ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
            {change}
          </span>
        )}
      </div>
      <p className="text-sm font-light text-zinc-400 mb-1">{title}</p>
      <p className="text-2xl font-light text-white">{value}</p>
    </div>
  );

  const PlanBar = ({ label, count, total, color }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400 font-light">{label}</span>
          <span className="font-light text-zinc-200">{count} users</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full rounded-full ${color}`}
          />
        </div>
      </div>
    );
  };

  const DrilldownBar = ({ domain, count, percentage }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-300">
        <span className="truncate max-w-[70%]">{domain}</span>
        <span>{count} ({percentage}%)</span>
      </div>
      <div className="h-2 w-full rounded bg-white/10">
        <div className="h-full rounded bg-emerald-400" style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );

  const TrendBar = ({ rate, color }) => (
    <div className="h-2 w-full rounded bg-white/10">
      <div className={`h-full rounded ${color}`} style={{ width: `${Math.min(Math.max(rate * 100, 0), 100)}%` }} />
    </div>
  );

  const handleThresholdInput = (key, value) => {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
    setDraftThresholds((prev) => ({ ...prev, [key]: normalized }));
  };

  const saveThresholds = async () => {
    await onHsThresholdsSave?.(draftThresholds);
  };

  const handleAgentConfigInput = (key, value, { float = false } = {}) => {
    const parsed = float ? Number(value) : parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    setDraftAgentConfig((prev) => ({ ...prev, [key]: parsed }));
  };

  const saveAgentConfig = async () => {
    await onAgentDebugConfigSave?.(draftAgentConfig);
  };

  const runAdaptiveSnapshot = async () => {
    if (!onAdaptiveSnapshot) return;
    try {
      setAdaptiveActionBusy(true);
      await onAdaptiveSnapshot('manual_admin_snapshot');
    } finally {
      setAdaptiveActionBusy(false);
    }
  };

  const runAdaptiveRollback = async () => {
    if (!onAdaptiveRollback) return;
    try {
      setAdaptiveActionBusy(true);
      await onAdaptiveRollback();
    } finally {
      setAdaptiveActionBusy(false);
    }
  };

  const applyRolloutRatio = async (nextRatio) => {
    if (!onAgentDebugConfigSave) return;
    const normalized = Math.min(1, Math.max(0.1, Number(nextRatio || 1)));
    try {
      setRolloutActionBusy(true);
      const nextConfig = { ...(draftAgentConfig || {}), adaptive_apply_ratio: normalized };
      await onAgentDebugConfigSave(nextConfig);
      setDraftAgentConfig(nextConfig);
    } finally {
      setRolloutActionBusy(false);
    }
  };

  const promoteAdaptive = async () => {
    await applyRolloutRatio(1.0);
  };

  const reduceRollout = async () => {
    const current = Number(draftAgentConfig?.adaptive_apply_ratio ?? 1);
    await applyRolloutRatio(Math.max(0.1, current - 0.1));
  };

  const runModeCheck = async () => {
    const trimmed = String(modeCheckInput || '').trim();
    if (!trimmed || !onAgentModeCheck) return;
    setModeCheckError('');
    setModeCheckLoading(true);
    try {
      const result = await onAgentModeCheck(trimmed, modeCheckMode || 'smart');
      setModeCheckResult(result || null);
    } catch (error) {
      setModeCheckError(error?.message || 'Failed to run mode check');
    } finally {
      setModeCheckLoading(false);
    }
  };

  const runCompareModes = async () => {
    const trimmed = String(modeCheckInput || '').trim();
    if (!trimmed || !onAgentModeCheck) return;
    setModeCheckError('');
    setCompareLoading(true);
    try {
      const modes = ['smart', 'agent', 'research_pro'];
      const rows = await Promise.all(
        modes.map(async (m) => {
          const result = await onAgentModeCheck(trimmed, m);
          return { mode: m, ...(result || {}) };
        })
      );
      setCompareResults(rows);
    } catch (error) {
      setModeCheckError(error?.message || 'Failed to compare modes');
    } finally {
      setCompareLoading(false);
    }
  };

  const confidenceTone = (value) => {
    const v = String(value || '').toLowerCase();
    if (v === 'high') return 'text-emerald-300 border-emerald-400/35 bg-emerald-500/10';
    if (v === 'medium') return 'text-amber-200 border-amber-400/35 bg-amber-500/10';
    if (v === 'low') return 'text-rose-200 border-rose-400/35 bg-rose-500/10';
    return 'text-zinc-300 border-white/10 bg-white/5';
  };

  const outcomeTone = (success) => {
    if (success === true) return 'text-emerald-300 border-emerald-400/35 bg-emerald-500/10';
    if (success === false) return 'text-rose-200 border-rose-400/35 bg-rose-500/10';
    return 'text-zinc-300 border-white/10 bg-white/5';
  };

  return (
    <motion.div
      key="analytics"
      variants={tabVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-light text-white tracking-tight">Analytics Overview</h2>
        <p className="text-zinc-400 font-light mt-1">Track user engagement and reliability policy metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={totalUsers} change="+12%" positive={true} icon={Users} />
        <StatCard title="Active This Month" value={activeThisMonth} change="+8%" positive={true} icon={Activity} />
        <StatCard title="New This Week" value={newThisWeek} change="+23%" positive={true} icon={TrendingUp} />
        <StatCard title="Avg. Session" value={avgSessionDuration} icon={Calendar} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-light text-white">User Distribution by Plan</h3>
        </div>
        <div className="space-y-5">
          <PlanBar label="Free" count={planCounts.free || 0} total={totalUsers} color="bg-zinc-500" />
          <PlanBar label="Student" count={planCounts.student || 0} total={totalUsers} color="bg-emerald-500" />
          <PlanBar label="Plus" count={planCounts.plus || 0} total={totalUsers} color="bg-blue-500" />
          <PlanBar label="Pro" count={planCounts.pro || 0} total={totalUsers} color="bg-violet-500" />
          <PlanBar label="Business" count={planCounts.business || 0} total={totalUsers} color="bg-amber-500" />
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-light text-white">High-Stakes Policy Metrics</h3>
          </div>
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onHsRangeChange?.(opt)}
                className={`px-3 py-1 rounded-md text-xs border transition ${
                  hsRange === opt
                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100'
                    : 'bg-black/20 border-white/10 text-zinc-300 hover:border-white/20'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {hs.alerts.length > 0 && (
          <div className="space-y-2">
            {hs.alerts.map((a) => (
              <div key={a.code} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-1">Range</p>
            <p className="text-xl text-white">{hs.range}</p>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-1">Total Evaluations</p>
            <p className="text-xl text-white">{hs.total}</p>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-1">Strict Mode Runs</p>
            <p className="text-xl text-white">{hs.strictModeTotal}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-2">Source Requirement</p>
            <p className="text-sm text-zinc-200">Met: <span className="text-emerald-400">{hs.sourceMet}</span></p>
            <p className="text-sm text-zinc-200">Failed: <span className="text-red-400">{hs.sourceFailed}</span></p>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-2">Recency Requirement</p>
            <p className="text-sm text-zinc-200">Met: <span className="text-emerald-400">{hs.recencyMet}</span></p>
            <p className="text-sm text-zinc-200">Failed: <span className="text-red-400">{hs.recencyFailed}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-2">Confidence Distribution (H/M/L)</p>
            <p className="text-sm text-zinc-200">
              <span className="text-emerald-300">{hs.confidence.HIGH || 0}</span> /
              <span className="text-amber-300"> {hs.confidence.MODERATE || 0}</span> /
              <span className="text-red-300"> {hs.confidence.LOW || 0}</span>
            </p>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-4">
            <p className="text-xs text-zinc-400 mb-2">Domain Counts</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(hs.domains).length === 0 && <span className="text-xs text-zinc-500">No high-stakes traffic yet</span>}
              {Object.entries(hs.domains).map(([domain, count]) => (
                <span key={domain} className="px-2 py-1 rounded-md bg-black/30 border border-white/10 text-xs text-zinc-200">
                  {domain}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-black/20 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <p className="text-xs text-zinc-400">Per-Domain Drilldown</p>
          </div>
          <div className="space-y-3">
            {hs.drilldown.length === 0 && <p className="text-sm text-zinc-500">No drilldown data in this range.</p>}
            {hs.drilldown.map((row) => (
              <DrilldownBar key={row.domain} domain={row.domain} count={row.count} percentage={row.percentage} />
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-black/20 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <p className="text-xs text-zinc-400">Trend Chart (Low Confidence + Source Fail)</p>
            <select
              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-zinc-200"
              value={selectedTrendDomain}
              onChange={(e) => setSelectedTrendDomain(e.target.value)}
            >
              {trendDomains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3 max-h-72 overflow-auto pr-1">
            {trendRows.length === 0 && <p className="text-sm text-zinc-500">No trend data in this range.</p>}
            {trendRows.map((row) => (
              <div key={`${row.bucket}-${row.domain}`} className="border border-white/10 rounded-lg p-3 bg-black/20">
                <div className="flex justify-between text-xs text-zinc-300 mb-2">
                  <span>{row.bucket}</span>
                  <span>{row.domain}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400"><span>Low Confidence</span><span>{Math.round((row.low_confidence_rate || 0) * 100)}%</span></div>
                    <TrendBar rate={row.low_confidence_rate || 0} color="bg-red-400" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-400"><span>Source Fail</span><span>{Math.round((row.source_fail_rate || 0) * 100)}%</span></div>
                    <TrendBar rate={row.source_fail_rate || 0} color="bg-amber-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-black/20 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-400">Alert Threshold Settings</p>
            <button
              type="button"
              onClick={saveThresholds}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/30 border border-emerald-400/50 text-emerald-100 text-xs"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Source Fail Spike
              <input type="number" min="0" max="1" step="0.01" value={draftThresholds.source_fail_spike}
                onChange={(e) => handleThresholdInput('source_fail_spike', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100" />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Low Confidence Spike
              <input type="number" min="0" max="1" step="0.01" value={draftThresholds.low_confidence_spike}
                onChange={(e) => handleThresholdInput('low_confidence_spike', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100" />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Recency Fail Spike
              <input type="number" min="0" max="1" step="0.01" value={draftThresholds.recency_fail_spike}
                onChange={(e) => handleThresholdInput('recency_fail_spike', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100" />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-light text-white">Hybrid Agent Debug Panel</h3>
            <p className="text-xs text-zinc-400">Mode quality, overrides, confidence health, and failure review</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
            <p className="text-[11px] text-zinc-400">Runs</p>
            <p className="text-sm text-zinc-100">{debug.totals.runs} total / {Math.round((debug.totals.success_rate || 0) * 100)}% success</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {debug.perModeStats.map((row) => (
            <div key={row.mode} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <p className="text-xs uppercase tracking-wide text-cyan-200">{row.mode}</p>
              <p className="text-[12px] text-zinc-300">Avg latency: <span className="text-zinc-100">{Math.round(row.avg_latency_ms || 0)} ms</span></p>
              <p className="text-[12px] text-zinc-300">Success: <span className="text-zinc-100">{Math.round((row.success_rate || 0) * 100)}%</span></p>
              <p className="text-[12px] text-zinc-300">Avg retries: <span className="text-zinc-100">{row.avg_retries ?? 0}</span></p>
              <p className="text-[12px] text-zinc-300">Tool usage: <span className="text-zinc-100">{Math.round((row.tool_usage_rate || 0) * 100)}%</span></p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <p className="text-xs text-zinc-400">Per-Role Stats</p>
          <div className="overflow-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[11px] text-zinc-400 border-b border-white/10">
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Runs</th>
                  <th className="py-2 pr-3">Avg Latency</th>
                  <th className="py-2 pr-3">Success</th>
                  <th className="py-2 pr-3">Avg Retries</th>
                  <th className="py-2 pr-3">Avg Tool Calls</th>
                  <th className="py-2 pr-3">Parallel Exceptions</th>
                  <th className="py-2 pr-3">Parallel Exception Rate</th>
                </tr>
              </thead>
              <tbody>
                {(debug.perRoleStats || []).map((row) => (
                  <tr key={row.role} className="border-b border-white/5 text-[11px] text-zinc-200">
                    <td className="py-2 pr-3 capitalize">{row.role}</td>
                    <td className="py-2 pr-3">{row.runs ?? 0}</td>
                    <td className="py-2 pr-3">{Math.round(row.avg_latency_ms || 0)} ms</td>
                    <td className="py-2 pr-3">{Math.round((row.success_rate || 0) * 100)}%</td>
                    <td className="py-2 pr-3">{row.avg_retries ?? 0}</td>
                    <td className="py-2 pr-3">{row.avg_tool_calls ?? 0}</td>
                    <td className="py-2 pr-3">{row.parallel_exception_count ?? 0}</td>
                    <td className="py-2 pr-3">{Math.round(((row.parallel_exception_rate ?? 0) * 100) * 100) / 100}%</td>
                  </tr>
                ))}
                {(debug.perRoleStats || []).length === 0 && (
                  <tr>
                    <td className="py-2 pr-3 text-[11px] text-zinc-500" colSpan={8}>No role telemetry yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <p className="text-xs text-zinc-400">Override Insights</p>
            <p className="text-sm text-zinc-200">{debug.overrideInsights.count || 0} overrides in selected window</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(debug.overrideInsights.reason_counts || {}).map(([reason, count]) => (
                <span key={reason} className="px-2 py-1 rounded-md border border-white/10 text-[11px] text-zinc-200 bg-black/30">
                  {reason}: {count}
                </span>
              ))}
              {Object.keys(debug.overrideInsights.reason_counts || {}).length === 0 && (
                <span className="text-[11px] text-zinc-500">No override reasons captured yet.</span>
              )}
            </div>
            <div className="max-h-36 overflow-auto pr-1 space-y-1">
              {(debug.overrideInsights.recent || []).slice(-6).map((row, idx) => (
                <div key={`${row.at}-${idx}`} className="text-[11px] text-zinc-300 border border-white/10 rounded px-2 py-1 bg-black/30">
                  {row.auto_selected} → {row.overridden_to} ({row.reason || 'n/a'})
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <p className="text-xs text-zinc-400">Confidence Distribution</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-emerald-500/10 border border-emerald-400/20 p-2">
                <p className="text-[11px] text-emerald-300">High</p>
                <p className="text-sm text-emerald-100">{debug.confidenceDistribution.high || 0}</p>
              </div>
              <div className="rounded bg-amber-500/10 border border-amber-400/20 p-2">
                <p className="text-[11px] text-amber-300">Medium</p>
                <p className="text-sm text-amber-100">{debug.confidenceDistribution.medium || 0}</p>
              </div>
              <div className="rounded bg-red-500/10 border border-red-400/20 p-2">
                <p className="text-[11px] text-red-300">Low</p>
                <p className="text-sm text-red-100">{debug.confidenceDistribution.low || 0}</p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              High {Math.round((debug.confidenceDistribution.high_pct || 0) * 100)}% ·
              Medium {Math.round((debug.confidenceDistribution.medium_pct || 0) * 100)}% ·
              Low {Math.round((debug.confidenceDistribution.low_pct || 0) * 100)}%
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <p className="text-xs text-zinc-400">Failure Analyzer ({debug.failureAnalyzer.count || 0})</p>
          <div className="max-h-56 overflow-auto pr-1 space-y-2">
            {(debug.failureAnalyzer.items || []).slice(-8).map((item, idx) => (
              <div key={`${item.timestamp}-${idx}`} className="rounded border border-white/10 bg-black/30 p-2 space-y-1">
                <p className="text-[11px] text-zinc-400">{item.mode} · {item.confidence_level} · retries {item.retries || 0}</p>
                <p className="text-[12px] text-zinc-200 truncate">{item.query || 'n/a'}</p>
                <p className="text-[11px] text-zinc-500 line-clamp-2">{item.answer_preview || ''}</p>
              </div>
            ))}
            {(debug.failureAnalyzer.items || []).length === 0 && (
              <p className="text-[12px] text-zinc-500">No low-confidence runs in this range.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
          <p className="text-xs text-zinc-400">Role Flow ({debug.roleFlow.count || 0})</p>
          <div className="max-h-56 overflow-auto pr-1">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[11px] text-zinc-400 border-b border-white/10">
                  <th className="py-2 pr-3">Node</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(debug.roleFlow.recent || []).slice(-20).map((row, idx) => (
                  <tr key={`${row.node_id || 'node'}-${row.at || idx}-${idx}`} className="border-b border-white/5 text-[11px] text-zinc-200">
                    <td className="py-2 pr-3">{row.node_id || '-'}</td>
                    <td className="py-2 pr-3 capitalize">{row.role || '-'}</td>
                    <td className="py-2 pr-3">{row.mode || '-'}</td>
                    <td className="py-2 pr-3">{row.status || '-'}</td>
                  </tr>
                ))}
                {(debug.roleFlow.recent || []).length === 0 && (
                  <tr>
                    <td className="py-2 pr-3 text-[11px] text-zinc-500" colSpan={4}>No role flow captured yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Auto Self-Improvement Hooks</p>
            <button
              type="button"
              onClick={saveAgentConfig}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-xs"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Success Threshold
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.auto_tuning_success_threshold ?? 0.72}
                onChange={(e) => handleAgentConfigInput('auto_tuning_success_threshold', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Min Runs
              <input
                type="number"
                min="3"
                max="100"
                step="1"
                value={draftAgentConfig.auto_tuning_min_runs ?? 12}
                onChange={(e) => handleAgentConfigInput('auto_tuning_min_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Failure Confidence Cutoff
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.failure_confidence_threshold ?? 0.45}
                onChange={(e) => handleAgentConfigInput('failure_confidence_threshold', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              EMA Alpha
              <input
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                value={draftAgentConfig.adaptive_ema_alpha ?? 0.2}
                onChange={(e) => handleAgentConfigInput('adaptive_ema_alpha', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Adaptive Min Runs
              <input
                type="number"
                min="1"
                max="200"
                step="1"
                value={draftAgentConfig.adaptive_min_cluster_runs ?? 8}
                onChange={(e) => handleAgentConfigInput('adaptive_min_cluster_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Adaptive Cooldown
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={draftAgentConfig.adaptive_cooldown_runs ?? 6}
                onChange={(e) => handleAgentConfigInput('adaptive_cooldown_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Max Bias Delta
              <input
                type="number"
                min="0.01"
                max="0.5"
                step="0.01"
                value={draftAgentConfig.adaptive_max_bias_delta ?? 0.1}
                onChange={(e) => handleAgentConfigInput('adaptive_max_bias_delta', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Adaptive Apply Ratio
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draftAgentConfig.adaptive_apply_ratio ?? 1}
                onChange={(e) => handleAgentConfigInput('adaptive_apply_ratio', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              State Cache TTL (sec)
              <input
                type="number"
                min="0"
                max="600"
                step="1"
                value={draftAgentConfig.adaptive_state_cache_ttl_sec ?? 90}
                onChange={(e) => handleAgentConfigInput('adaptive_state_cache_ttl_sec', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              State Write Every N Runs
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={draftAgentConfig.adaptive_state_write_every_runs ?? 3}
                onChange={(e) => handleAgentConfigInput('adaptive_state_write_every_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              SLO P95 Latency Max (ms)
              <input
                type="number"
                min="1000"
                max="120000"
                step="100"
                value={draftAgentConfig.slo_p95_latency_ms_max ?? 25000}
                onChange={(e) => handleAgentConfigInput('slo_p95_latency_ms_max', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              SLO Low-Confidence Max
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.slo_low_conf_rate_max ?? 0.35}
                onChange={(e) => handleAgentConfigInput('slo_low_conf_rate_max', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              SLO Avg Retries Max
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={draftAgentConfig.slo_avg_retries_max ?? 1.5}
                onChange={(e) => handleAgentConfigInput('slo_avg_retries_max', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              SLO Parallel Exception Rate Max
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.slo_parallel_exception_rate_max ?? 0.3}
                onChange={(e) => handleAgentConfigInput('slo_parallel_exception_rate_max', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(draftAgentConfig.auto_tuning_enabled ?? true)}
              onChange={(e) => setDraftAgentConfig((prev) => ({ ...prev, auto_tuning_enabled: e.target.checked }))}
            />
            Enable adaptive mode tuning
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(draftAgentConfig.adaptive_enabled ?? true)}
              onChange={(e) => setDraftAgentConfig((prev) => ({ ...prev, adaptive_enabled: e.target.checked }))}
            />
            Enable adaptive learning (EMA + cooldown)
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean(draftAgentConfig.auto_remediation_enabled ?? true)}
              onChange={(e) => setDraftAgentConfig((prev) => ({ ...prev, auto_remediation_enabled: e.target.checked }))}
            />
            Enable auto-remediation (SLO to action)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Cooldown (runs)
              <input
                type="number"
                min="1"
                max="500"
                step="1"
                value={draftAgentConfig.auto_remediation_cooldown_runs ?? 10}
                onChange={(e) => handleAgentConfigInput('auto_remediation_cooldown_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Step
              <input
                type="number"
                min="0.01"
                max="0.5"
                step="0.01"
                value={draftAgentConfig.auto_remediation_step ?? 0.1}
                onChange={(e) => handleAgentConfigInput('auto_remediation_step', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Low-Conf Trigger
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.auto_remediation_low_conf_trigger ?? 0.4}
                onChange={(e) => handleAgentConfigInput('auto_remediation_low_conf_trigger', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Min Adaptive Apply Ratio
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={draftAgentConfig.auto_remediation_min_apply_ratio ?? 0.1}
                onChange={(e) => handleAgentConfigInput('auto_remediation_min_apply_ratio', e.target.value, { float: true })}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Min Runs
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={draftAgentConfig.auto_remediation_min_runs ?? 20}
                onChange={(e) => handleAgentConfigInput('auto_remediation_min_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Retry Step Cap
              <input
                type="number"
                min="1"
                max="10"
                step="1"
                value={draftAgentConfig.auto_remediation_retry_step_cap ?? 2}
                onChange={(e) => handleAgentConfigInput('auto_remediation_retry_step_cap', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
            <label className="text-xs text-zinc-300 flex flex-col gap-1">
              Remediation Window (runs)
              <input
                type="number"
                min="20"
                max="5000"
                step="1"
                value={draftAgentConfig.auto_remediation_window_runs ?? 200}
                onChange={(e) => handleAgentConfigInput('auto_remediation_window_runs', e.target.value)}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-zinc-100"
              />
            </label>
          </div>
          <div className="max-h-32 overflow-auto pr-1 space-y-1">
            {(debug.autoTuning.recent_events || []).slice(-5).map((evt, idx) => (
              <div key={`${evt.timestamp}-${idx}`} className="text-[11px] text-zinc-300 border border-white/10 rounded px-2 py-1 bg-black/30">
                {evt.mode}: success {Math.round((evt.success_rate || 0) * 100)}%,
                budget +{evt.budget_delta_ms_after || 0}ms,
                retry +{evt.retry_delta_after || 0}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runAdaptiveSnapshot}
              disabled={adaptiveActionBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-xs disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" />
              Snapshot
            </button>
            <button
              type="button"
              onClick={runAdaptiveRollback}
              disabled={adaptiveActionBusy}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-100 text-xs disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rollback Latest
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Adaptive Learning</p>
            <span className="text-[11px] text-zinc-500">
              {debug.adaptiveLearning.enabled ? 'Enabled' : 'Disabled'} · {debug.adaptiveLearning.state_size || 0} buckets
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded border border-white/10 bg-black/30 p-2">
              <p className="text-[11px] text-zinc-400 mb-1">Top failing buckets</p>
              <div className="space-y-1 max-h-28 overflow-auto pr-1">
                {(debug.adaptiveLearning.top_failing_buckets || []).slice(0, 20).map((row, idx) => (
                  <div key={`${row.bucket_key || idx}-${idx}`} className="text-[11px] text-zinc-200">
                    {row.bucket_key} · impact {Number(row.impact_score || 0).toFixed(2)}
                  </div>
                ))}
                {(debug.adaptiveLearning.top_failing_buckets || []).length === 0 && (
                  <p className="text-[11px] text-zinc-500">No buckets yet.</p>
                )}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-black/30 p-2">
              <p className="text-[11px] text-zinc-400 mb-1">Low-confidence clusters</p>
              <div className="space-y-1 max-h-28 overflow-auto pr-1">
                {(debug.adaptiveLearning.low_confidence_clusters || []).slice(0, 6).map((row, idx) => (
                  <div key={`${row.bucket_key || idx}-${idx}`} className="text-[11px] text-zinc-200">
                    {row.intent} · {row.mode} · {Math.round((row.ema_low_conf || 0) * 100)}%
                  </div>
                ))}
                {(debug.adaptiveLearning.low_confidence_clusters || []).length === 0 && (
                  <p className="text-[11px] text-zinc-500">No low-confidence clusters.</p>
                )}
              </div>
            </div>
            <div className="rounded border border-white/10 bg-black/30 p-2">
              <p className="text-[11px] text-zinc-400 mb-1">High-retry queries</p>
              <div className="space-y-1 max-h-28 overflow-auto pr-1">
                {(debug.adaptiveLearning.high_retry_queries || []).slice(0, 6).map((row, idx) => (
                  <div key={`${row.bucket_key || idx}-${idx}`} className="text-[11px] text-zinc-200">
                    {row.bucket_key} · retry {Math.round((row.ema_retry_rate || 0) * 100)}%
                  </div>
                ))}
                {(debug.adaptiveLearning.high_retry_queries || []).length === 0 && (
                  <p className="text-[11px] text-zinc-500">No retry hotspots.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
              <p className="text-[11px] text-zinc-400 mb-1">Top failing prompts</p>
              <div className="space-y-1 max-h-24 overflow-auto pr-1">
              {(debug.adaptiveLearning.top_failing_prompts || []).slice(0, 20).map((row, idx) => (
                <div key={`${row.query || idx}-${idx}`} className="text-[11px] text-zinc-200">
                  {row.query} · {row.count}
                </div>
              ))}
              {(debug.adaptiveLearning.top_failing_prompts || []).length === 0 && (
                <p className="text-[11px] text-zinc-500">No recurring failing prompts.</p>
              )}
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">Recent adaptive rule events</p>
            <div className="space-y-1 max-h-24 overflow-auto pr-1">
              {(debug.adaptiveLearning.rule_events_recent || []).slice(-5).map((evt, idx) => (
                <div key={`${evt.timestamp || idx}-${idx}`} className="text-[11px] text-zinc-200">
                  {evt.bucket_key} · bias {evt.bias_delta_before} → {evt.bias_delta_after}
                </div>
              ))}
              {(debug.adaptiveLearning.rule_events_recent || []).length === 0 && (
                <p className="text-[11px] text-zinc-500">No adaptive events yet.</p>
              )}
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">Rollout + Snapshot</p>
            <div className="space-y-1 text-[11px] text-zinc-200">
              <div>Apply ratio: {Number(debug.adaptiveLearning?.rollout?.adaptive_apply_ratio ?? 1).toFixed(2)}</div>
              <div>Applied rate: {Math.round((debug.adaptiveLearning?.rollout?.adaptive_applied_rate ?? 0) * 100)}%</div>
              <div>Snapshots: {debug.adaptiveLearning?.snapshot_status?.count ?? 0}</div>
              <div>Latest: {debug.adaptiveLearning?.snapshot_status?.latest_id || 'none'}</div>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">SLO Status</p>
            <div className="space-y-1 text-[11px] text-zinc-200">
              <div>
                P95 latency: {Math.round(debug?.slo?.current?.p95_latency_ms ?? 0)}ms / {Math.round(debug?.slo?.targets?.p95_latency_ms_max ?? 0)}ms
              </div>
              <div>
                Low-conf rate: {Math.round((debug?.slo?.current?.low_conf_rate ?? 0) * 100)}% / {Math.round((debug?.slo?.targets?.low_conf_rate_max ?? 0) * 100)}%
              </div>
              <div>
                Avg retries: {Number(debug?.slo?.current?.avg_retries ?? 0).toFixed(2)} / {Number(debug?.slo?.targets?.avg_retries_max ?? 0).toFixed(2)}
              </div>
              <div>
                Parallel exceptions: {Math.round((debug?.slo?.current?.parallel_exception_rate ?? 0) * 10000) / 100}% / {Math.round((debug?.slo?.targets?.parallel_exception_rate_max ?? 0) * 10000) / 100}%
              </div>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">Canary Compare (Baseline vs Adaptive)</p>
            <div className="overflow-auto">
              <table className="w-full text-[11px] text-left text-zinc-200">
                <thead className="text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="py-1 pr-2">Metric</th>
                    <th className="py-1 pr-2">Baseline</th>
                    <th className="py-1 pr-2">Adaptive</th>
                    <th className="py-1 pr-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5">
                    <td className="py-1 pr-2">Runs</td>
                    <td className="py-1 pr-2">{debug?.adaptiveLearning?.canary_compare?.baseline?.runs ?? 0}</td>
                    <td className="py-1 pr-2">{debug?.adaptiveLearning?.canary_compare?.adaptive?.runs ?? 0}</td>
                    <td className="py-1 pr-2">-</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-1 pr-2">Success Rate</td>
                    <td className="py-1 pr-2">{Math.round((debug?.adaptiveLearning?.canary_compare?.baseline?.success_rate ?? 0) * 10000) / 100}%</td>
                    <td className="py-1 pr-2">{Math.round((debug?.adaptiveLearning?.canary_compare?.adaptive?.success_rate ?? 0) * 10000) / 100}%</td>
                    <td className={`py-1 pr-2 ${(debug?.adaptiveLearning?.canary_compare?.delta?.success_rate ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {Math.round((debug?.adaptiveLearning?.canary_compare?.delta?.success_rate ?? 0) * 10000) / 100}%
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-1 pr-2">Avg Latency</td>
                    <td className="py-1 pr-2">{Math.round(debug?.adaptiveLearning?.canary_compare?.baseline?.avg_latency_ms ?? 0)} ms</td>
                    <td className="py-1 pr-2">{Math.round(debug?.adaptiveLearning?.canary_compare?.adaptive?.avg_latency_ms ?? 0)} ms</td>
                    <td className={`py-1 pr-2 ${(debug?.adaptiveLearning?.canary_compare?.delta?.avg_latency_ms ?? 0) <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {Math.round(debug?.adaptiveLearning?.canary_compare?.delta?.avg_latency_ms ?? 0)} ms
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-1 pr-2">Avg Retries</td>
                    <td className="py-1 pr-2">{Number(debug?.adaptiveLearning?.canary_compare?.baseline?.avg_retries ?? 0).toFixed(3)}</td>
                    <td className="py-1 pr-2">{Number(debug?.adaptiveLearning?.canary_compare?.adaptive?.avg_retries ?? 0).toFixed(3)}</td>
                    <td className={`py-1 pr-2 ${(debug?.adaptiveLearning?.canary_compare?.delta?.avg_retries ?? 0) <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {Number(debug?.adaptiveLearning?.canary_compare?.delta?.avg_retries ?? 0).toFixed(3)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2">Parallel Exception Rate</td>
                    <td className="py-1 pr-2">{Math.round((debug?.adaptiveLearning?.canary_compare?.baseline?.parallel_exception_rate ?? 0) * 10000) / 100}%</td>
                    <td className="py-1 pr-2">{Math.round((debug?.adaptiveLearning?.canary_compare?.adaptive?.parallel_exception_rate ?? 0) * 10000) / 100}%</td>
                    <td className={`py-1 pr-2 ${(debug?.adaptiveLearning?.canary_compare?.delta?.parallel_exception_rate ?? 0) <= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {Math.round((debug?.adaptiveLearning?.canary_compare?.delta?.parallel_exception_rate ?? 0) * 10000) / 100}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={promoteAdaptive}
                disabled={rolloutActionBusy}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-[11px] disabled:opacity-50"
              >
                Promote Adaptive 100%
              </button>
              <button
                type="button"
                onClick={reduceRollout}
                disabled={rolloutActionBusy}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-100 text-[11px] disabled:opacity-50"
              >
                Reduce Rollout by 10%
              </button>
              <button
                type="button"
                onClick={runAdaptiveRollback}
                disabled={rolloutActionBusy || adaptiveActionBusy}
                className="inline-flex items-center px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[11px] disabled:opacity-50"
              >
                Rollback Snapshot
              </button>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">Tool Reliability (Selection Signals)</p>
            <div className="max-h-32 overflow-auto pr-1">
              <table className="w-full text-[11px] text-left text-zinc-200">
                <thead className="text-zinc-400 border-b border-white/10">
                  <tr>
                    <th className="py-1 pr-2">Tool</th>
                    <th className="py-1 pr-2">Score</th>
                    <th className="py-1 pr-2">Success</th>
                    <th className="py-1 pr-2">Error</th>
                    <th className="py-1 pr-2">Latency</th>
                    <th className="py-1 pr-2">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {(debug?.toolReliability?.top_tools || []).slice(0, 10).map((row, idx) => (
                    <tr key={`${row.tool || idx}-${idx}`} className="border-b border-white/5">
                      <td className="py-1 pr-2">{row.tool}</td>
                      <td className="py-1 pr-2">{Number(row.score || 0).toFixed(3)}</td>
                      <td className="py-1 pr-2">{Math.round((row.success_rate || 0) * 10000) / 100}%</td>
                      <td className="py-1 pr-2">{Math.round((row.error_rate || 0) * 10000) / 100}%</td>
                      <td className="py-1 pr-2">{Math.round(row.latency_ema_ms || 0)} ms</td>
                      <td className="py-1 pr-2">{row.samples || 0}</td>
                    </tr>
                  ))}
                  {(debug?.toolReliability?.top_tools || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-2 text-zinc-500">No tool reliability samples yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-zinc-400 mb-1">Auto-Remediation</p>
            <div className="space-y-1 text-[11px] text-zinc-200">
              <div>Enabled: {debug?.autoRemediation?.enabled ? 'Yes' : 'No'}</div>
              <div>Last action run: {debug?.autoRemediation?.state?.last_action_run ?? '-'}</div>
              <div>Events: {(debug?.autoRemediation?.recent_events || []).length}</div>
              {(debug?.autoRemediation?.recent_events || []).slice(-2).map((evt, idx) => (
                <div key={`${evt.timestamp || idx}-${idx}`} className="text-[10px] text-zinc-300 border border-white/10 rounded px-2 py-1">
                  {evt.timestamp || 'n/a'} · actions: {(evt.actions || []).length}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/20 bg-black/30 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-cyan-100 tracking-wide">Mode Check Lab</p>
              <p className="text-[11px] text-zinc-400">Requested → Auto → Final → Lane with override and policy snapshot</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={runModeCheck}
                disabled={modeCheckLoading || !String(modeCheckInput || '').trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-medium disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {modeCheckLoading ? 'Running...' : 'Run Mode Check'}
              </button>
              <button
                type="button"
                onClick={runCompareModes}
                disabled={compareLoading || !String(modeCheckInput || '').trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-xs font-medium disabled:opacity-50"
              >
                <GitCompare className="h-3.5 w-3.5" />
                {compareLoading ? 'Comparing...' : 'Compare Modes'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-4">
              <input
                type="text"
                value={modeCheckInput}
                onChange={(e) => setModeCheckInput(e.target.value)}
                placeholder="Enter query (example: latest AI chip news with sources)"
                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-zinc-100 text-sm"
              />
            </div>
            <div>
              <select
                value={modeCheckMode}
                onChange={(e) => setModeCheckMode(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-zinc-100 text-sm"
              >
                <option value="auto">Auto</option>
                <option value="smart">Smart</option>
                <option value="agent">Agent</option>
                <option value="research_pro">Research Pro</option>
              </select>
            </div>
          </div>

          {modeCheckError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {modeCheckError}
            </div>
          )}

          {modeCheckResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[11px] text-zinc-400 mb-1">Mode Flow</p>
                  <p className="text-xs font-medium text-zinc-100 leading-5">
                    {modeCheckResult.requested_mode_raw && modeCheckResult.requested_mode_raw !== modeCheckResult.requested_mode
                      ? `${modeCheckResult.requested_mode_raw} (${modeCheckResult.requested_mode})`
                      : modeCheckResult.requested_mode}
                    {' '}→ {modeCheckResult.auto_selected_mode} → {modeCheckResult.final_mode} → {modeCheckResult.lane}
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[11px] text-zinc-400 mb-1">Override Info</p>
                  <p className="text-xs font-medium text-zinc-100">Override: {modeCheckResult.override_applied ? 'Yes' : 'No'}</p>
                  <p className="text-[11px] text-zinc-400">Reason: {modeCheckResult.override_reason || 'none'}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-[11px] text-zinc-400 mb-1">Outcome</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${confidenceTone(modeCheckResult.confidence)}`}>
                      {String(modeCheckResult.confidence || 'unknown').toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${outcomeTone(modeCheckResult.success)}`}>
                      {modeCheckResult.success === true ? 'SUCCESS' : modeCheckResult.success === false ? 'FAIL' : 'N/A'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Retries: {modeCheckResult.retries ?? '-'} · Tool Calls: {modeCheckResult.tool_calls ?? '-'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Parallel Exceptions: {modeCheckResult.parallel_exception_count ?? 0} · Rate: {Math.round(((modeCheckResult.parallel_exception_rate ?? 0) * 100) * 100) / 100}%
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Outcome Source: {modeCheckResult.outcome_source || 'estimated'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Latency Budget: {modeCheckResult.expected_latency_ms ?? '-'} ms
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Adaptive Bucket: {modeCheckResult.adaptive_bucket_key || '-'}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Adaptive Rollout: {modeCheckResult?.adaptive_rollout?.rollout_applied ? 'In cohort' : 'Holdout'} · ratio {Number(modeCheckResult?.adaptive_rollout?.apply_ratio ?? 1).toFixed(2)}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Final Clamp: {modeCheckResult?.final_clamp?.clamp_applied ? 'Applied' : 'Not applied'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModeDebug((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white"
              >
                {showModeDebug ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Debug Details
              </button>

              {showModeDebug && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                    <p className="text-[11px] text-zinc-400 mb-2">dynamic_context</p>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words">
{JSON.stringify(modeCheckResult.dynamic_context || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                    <p className="text-[11px] text-zinc-400 mb-2">policy_snapshot</p>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words">
{JSON.stringify(modeCheckResult.policy_snapshot || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                    <p className="text-[11px] text-zinc-400 mb-2">role_flow</p>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words max-h-64 overflow-auto">
{JSON.stringify(modeCheckResult.role_flow || [], null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                    <p className="text-[11px] text-zinc-400 mb-2">adaptive_snapshot</p>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words max-h-64 overflow-auto">
{JSON.stringify(modeCheckResult.adaptive_snapshot || {}, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/35 p-3">
                    <p className="text-[11px] text-zinc-400 mb-2">final_clamp</p>
                    <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words">
{JSON.stringify(modeCheckResult.final_clamp || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {compareResults.length > 0 && (
            <div className="rounded-lg border border-white/10 bg-black/35 p-3 space-y-2">
              <p className="text-xs font-medium text-zinc-300">Compare Modes</p>
              <div className="overflow-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-[11px] text-zinc-400 border-b border-white/10">
                      <th className="py-2 pr-3">Mode</th>
                      <th className="py-2 pr-3">Confidence</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Latency</th>
                      <th className="py-2 pr-3">Tools</th>
                      <th className="py-2 pr-3">Parallel Exceptions</th>
                      <th className="py-2 pr-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResults.map((row, idx) => (
                      <tr key={`${row.mode}-${idx}`} className="border-b border-white/5 text-[11px] text-zinc-200">
                        <td className="py-2 pr-3 uppercase font-medium">{row.mode}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${confidenceTone(row.confidence)}`}>
                            {String(row.confidence || 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{row.outcome_source || 'estimated'}</td>
                        <td className="py-2 pr-3">{row.expected_latency_ms ?? row.policy_snapshot?.min_budget_ms ?? '-'} ms</td>
                        <td className="py-2 pr-3">{row.tool_calls ?? '-'} ({row.tools_expected ? 'expected' : 'optional'})</td>
                        <td className="py-2 pr-3">{row.parallel_exception_count ?? 0}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${outcomeTone(row.success)}`}>
                            {row.success === true ? 'SUCCESS' : row.success === false ? 'FAIL' : 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AnalyticsTab;

