export const DEFAULT_HS_THRESHOLDS = {
  source_fail_spike: 0.30,
  low_confidence_spike: 0.40,
  recency_fail_spike: 0.25,
};

export const parseHighStakesMetricsPayload = (raw = {}) => {
  const metrics = raw && typeof raw === 'object' && raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : raw;
  return {
    range: typeof metrics.range === 'string' ? metrics.range : '24h',
    total: Number(metrics.total || 0),
    domain_counts: metrics.domain_counts && typeof metrics.domain_counts === 'object' ? metrics.domain_counts : {},
    strict_mode_total: Number(metrics.strict_mode_total || 0),
    source_requirement: metrics.source_requirement && typeof metrics.source_requirement === 'object'
      ? { met: Number(metrics.source_requirement.met || 0), failed: Number(metrics.source_requirement.failed || 0) }
      : { met: 0, failed: 0 },
    recency_requirement: metrics.recency_requirement && typeof metrics.recency_requirement === 'object'
      ? { met: Number(metrics.recency_requirement.met || 0), failed: Number(metrics.recency_requirement.failed || 0) }
      : { met: 0, failed: 0 },
    confidence_levels: metrics.confidence_levels && typeof metrics.confidence_levels === 'object'
      ? {
          LOW: Number(metrics.confidence_levels.LOW || 0),
          MODERATE: Number(metrics.confidence_levels.MODERATE || 0),
          HIGH: Number(metrics.confidence_levels.HIGH || 0),
        }
      : { LOW: 0, MODERATE: 0, HIGH: 0 },
    domain_drilldown: Array.isArray(metrics.domain_drilldown) ? metrics.domain_drilldown : [],
    trend_series: Array.isArray(metrics.trend_series) ? metrics.trend_series : [],
    alerts: Array.isArray(metrics.alerts) ? metrics.alerts : [],
    thresholds: metrics.thresholds && typeof metrics.thresholds === 'object'
      ? {
          source_fail_spike: Number(metrics.thresholds.source_fail_spike ?? DEFAULT_HS_THRESHOLDS.source_fail_spike),
          low_confidence_spike: Number(metrics.thresholds.low_confidence_spike ?? DEFAULT_HS_THRESHOLDS.low_confidence_spike),
          recency_fail_spike: Number(metrics.thresholds.recency_fail_spike ?? DEFAULT_HS_THRESHOLDS.recency_fail_spike),
        }
      : { ...DEFAULT_HS_THRESHOLDS },
    rolling_total: Number(metrics.rolling_total || 0),
    rolling_domain_counts:
      metrics.rolling_domain_counts && typeof metrics.rolling_domain_counts === 'object'
        ? metrics.rolling_domain_counts
        : {},
  };
};

export const computeRangeButtonState = (currentRange = '24h', options = ['24h', '7d', '30d', 'all']) => {
  return options.map((opt) => ({
    key: opt,
    selected: opt === currentRange,
  }));
};
