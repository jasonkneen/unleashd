import assert from 'node:assert/strict';
import test from 'node:test';
import { BuddiesUnavailableError, createBuddiesIntegration } from '../src/buddies/integration';

test('optional Buddies loading is lazy, memoized, and classifies package failures', async () => {
  let loadCount = 0;
  const integration = createBuddiesIntegration({
    getConversation: () => undefined,
    loadModule: async () => {
      loadCount += 1;
      throw new Error('package missing');
    },
  });

  await assert.rejects(integration.getStore(), BuddiesUnavailableError);
  await assert.rejects(integration.getStore(), BuddiesUnavailableError);
  assert.equal(loadCount, 1);
});
