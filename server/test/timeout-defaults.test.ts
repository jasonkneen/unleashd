import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TURN_BRIDGE_TIMEOUT_MS,
  DEFAULT_TURN_IDLE_TIMEOUT_MS,
  DEFAULT_TURN_PROVIDER_IDLE_TIMEOUT_MS,
  TURN_BRIDGE_TIMEOUT_MS,
  TURN_IDLE_TIMEOUT_MS,
  TURN_MAX_RUNTIME_MS,
  TURN_PROVIDER_IDLE_TIMEOUT_MS,
} from '../src/constants/timeouts';

test('plain server startup separates bridge failure from provider inactivity', () => {
  assert.equal(DEFAULT_TURN_BRIDGE_TIMEOUT_MS, 2 * 60_000);
  if (!process.env.CWV_TURN_BRIDGE_TIMEOUT_MS) {
    assert.equal(TURN_BRIDGE_TIMEOUT_MS, DEFAULT_TURN_BRIDGE_TIMEOUT_MS);
  }
  assert.equal(DEFAULT_TURN_PROVIDER_IDLE_TIMEOUT_MS, 60 * 60_000);
  assert.equal(DEFAULT_TURN_IDLE_TIMEOUT_MS, 60 * 60_000);
  if (!process.env.CWV_TURN_PROVIDER_IDLE_TIMEOUT_MS && !process.env.CWV_TURN_IDLE_TIMEOUT_MS) {
    assert.equal(TURN_PROVIDER_IDLE_TIMEOUT_MS, DEFAULT_TURN_PROVIDER_IDLE_TIMEOUT_MS);
    assert.equal(TURN_IDLE_TIMEOUT_MS, DEFAULT_TURN_IDLE_TIMEOUT_MS);
  }
});

test('the independent hard turn cap remains 24 hours', () => {
  if (!process.env.CWV_TURN_MAX_RUNTIME_MS) {
    assert.equal(TURN_MAX_RUNTIME_MS, 24 * 60 * 60_000);
  }
});
