import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClientMessage } from '@unleashd/shared';
import { handleMessage, queueMessage, setSendFn } from '../src/atoms/actions';

const conversationId = '07e0146f-95c6-43a0-a506-bd48e5e8156b';

test('queued composer text waits for an exact server acknowledgement', async () => {
  let sent: ClientMessage | null = null;
  setSendFn((message) => {
    sent = message;
  });

  const accepted = queueMessage(conversationId, 'cont');
  assert.equal(sent?.type, 'queue_message');
  if (sent?.type !== 'queue_message') throw new Error('queue command was not sent');

  handleMessage({
    type: 'command_accepted',
    commandId: sent.commandId,
    conversationId,
  });
  await accepted;
});

test('draining rejection rejects the exact queued command so the composer can retain text', async () => {
  let sent: ClientMessage | null = null;
  setSendFn((message) => {
    sent = message;
  });

  const rejected = queueMessage(conversationId, 'cont');
  assert.equal(sent?.type, 'queue_message');
  if (sent?.type !== 'queue_message') throw new Error('queue command was not sent');

  handleMessage({
    type: 'command_rejected',
    commandId: sent.commandId,
    conversationId,
    error: {
      code: 'server_draining',
      message: 'Backend reload is draining active turns; try again after reconnecting',
    },
  });

  await assert.rejects(rejected, /Backend reload is draining active turns/);
});

test('legacy uncorrelated server errors release pending composers without losing their draft', async () => {
  setSendFn(() => undefined);
  const rejected = queueMessage(conversationId, 'cont');

  handleMessage({
    type: 'error',
    message: 'Backend reload is draining active turns; try again after reconnecting',
  });

  await assert.rejects(rejected, /Backend reload is draining active turns/);
});
