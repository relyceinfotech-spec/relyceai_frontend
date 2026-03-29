import test from 'node:test';
import assert from 'node:assert/strict';

import { parseHighStakesMetricsPayload } from '../src/features/admin/services/highStakesMetricsAdapter.js';

test('parseHighStakesMetricsPayload normalizes shape', () => {
  const payload = {
    metrics: {
      range: '7d',
      total: 10,
      domain_counts: { finance: 6 },
      source_requirement: { met: 7, failed: 3 },
      recency_requirement: { met: 9, failed: 1 },
      confidence_levels: { LOW: 2, MODERATE: 4, HIGH: 4 },
      trend_series: [{ bucket: '2026-03-10', domain: 'finance', low_confidence_rate: 0.2, source_fail_rate: 0.1 }],
      alerts: [{ code: 'LOW_CONFIDENCE_SPIKE' }],
      thresholds: { source_fail_spike: 0.33, low_confidence_spike: 0.44, recency_fail_spike: 0.22 },
      rolling_total: 15,
      rolling_domain_counts: { finance: 10 },
    },
  };

  const parsed = parseHighStakesMetricsPayload(payload);
  assert.equal(parsed.range, '7d');
  assert.equal(parsed.total, 10);
  assert.equal(parsed.domain_counts.finance, 6);
  assert.equal(parsed.source_requirement.failed, 3);
  assert.equal(parsed.confidence_levels.HIGH, 4);
  assert.equal(parsed.trend_series.length, 1);
  assert.equal(parsed.alerts[0].code, 'LOW_CONFIDENCE_SPIKE');
  assert.equal(parsed.thresholds.source_fail_spike, 0.33);
  assert.equal(parsed.rolling_total, 15);
});

test('parseHighStakesMetricsPayload falls back safely', () => {
  const parsed = parseHighStakesMetricsPayload({});
  assert.equal(parsed.range, '24h');
  assert.equal(parsed.total, 0);
  assert.deepEqual(parsed.domain_counts, {});
  assert.deepEqual(parsed.alerts, []);
  assert.equal(parsed.thresholds.low_confidence_spike, 0.40);
});
