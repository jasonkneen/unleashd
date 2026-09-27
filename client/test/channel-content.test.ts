import assert from 'node:assert/strict';
import test from 'node:test';
import { channelPostBody } from '../src/components/buddies/channel-data';

test('owner-authored channel prose remains literal even when it resembles an old marker', () => {
  const marker = '<!--buddy_team_configuration:%7B%7D-->';
  const post = {
    author: { kind: 'owner' },
    body: marker,
    conversationId: 'conversation',
  } as Parameters<typeof channelPostBody>[0];
  assert.deepEqual(channelPostBody(post), { t: 'text', text: marker });
});

test('generated historical Buddy posts decode retired markers at channel ingress', () => {
  const post = {
    author: { kind: 'buddy', id: 'buddy' },
    body: 'Before\n<!--buddy_team_configuration:%7B%7D-->\nAfter',
    conversationId: 'conversation',
  } as Parameters<typeof channelPostBody>[0];
  assert.deepEqual(channelPostBody(post), {
    t: 'parts',
    parts: [
      { t: 'text', text: 'Before\n' },
      { t: 'text', text: '\nAfter' },
    ],
  });
});
