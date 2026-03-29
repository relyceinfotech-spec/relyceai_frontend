import test from 'node:test';
import assert from 'node:assert/strict';

import { computeRangeButtonState } from '../src/features/admin/services/highStakesMetricsAdapter.js';

test('range switch state marks only selected option', () => {
  let state = computeRangeButtonState('24h');
  assert.equal(state.find((x) => x.key === '24h')?.selected, true);
  assert.equal(state.filter((x) => x.selected).length, 1);

  state = computeRangeButtonState('7d');
  assert.equal(state.find((x) => x.key === '7d')?.selected, true);
  assert.equal(state.find((x) => x.key === '24h')?.selected, false);
  assert.equal(state.filter((x) => x.selected).length, 1);

  state = computeRangeButtonState('30d');
  assert.equal(state.find((x) => x.key === '30d')?.selected, true);
  assert.equal(state.filter((x) => x.selected).length, 1);
});
