import assert from 'node:assert/strict';
import test from 'node:test';
import { applyStableSnapshot } from '../src/atoms/detail-loader';

test('detail loading retries rather than replacing a newer live value', async () => {
  const initial = { value: 'summary' };
  const live = { value: 'live update' };
  let current = initial;
  let attempts = 0;

  let applied: { value: string } | null = null;
  const didApply = await applyStableSnapshot(
    () => current,
    async () => {
      attempts += 1;
      if (attempts === 1) {
        current = live;
        return { value: 'stale detail' };
      }
      return { value: 'fresh detail' };
    },
    (snapshot) => {
      applied = snapshot;
    }
  );

  assert.equal(attempts, 2);
  assert.equal(didApply, true);
  assert.equal(current, live);
  assert.deepEqual(applied, { value: 'fresh detail' });
});
