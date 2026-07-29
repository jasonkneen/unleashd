import assert from 'node:assert/strict';
import test from 'node:test';
import { runServerStartup } from '../src/lifecycle/startup';

test('startup exposes one authoritative hydration barrier before polling', async () => {
  const events: string[] = [];

  await runServerStartup(
    {
      port: 0,
      host: '127.0.0.1',
      development: true,
      developmentClientPort: 7489,
    },
    {
      server: {
        listen: (_port: number, _host: string, callback: () => void) => {
          events.push('listen');
          callback();
        },
      } as never,
      initialize: async () => {
        events.push('initialize');
      },
      startOptionalScheduler: async () => {
        events.push('scheduler');
      },
      pauseOptionalScheduler: () => {
        events.push('pause-scheduler');
      },
      isStartupActive: () => true,
      markReady: () => {
        events.push('ready');
        return true;
      },
      abortStartup: () => {
        events.push('abort');
      },
      loadConversations: async () => {
        events.push('hydrate');
      },
      startPolling: () => {
        events.push('poll');
      },
    }
  );

  assert.deepEqual(events, ['initialize', 'listen', 'hydrate', 'scheduler', 'ready', 'poll']);
});

test('startup does not release readiness or background work after hydration fails', async () => {
  const events: string[] = [];

  await assert.rejects(
    runServerStartup(
      {
        port: 0,
        host: '127.0.0.1',
        development: true,
        developmentClientPort: 7489,
      },
      {
        server: {
          listen: (_port: number, _host: string, callback: () => void) => {
            events.push('listen');
            callback();
          },
        } as never,
        initialize: async () => {
          events.push('initialize');
        },
        loadConversations: async () => {
          events.push('hydrate');
          throw new Error('hydrate failed');
        },
        startOptionalScheduler: async () => {
          events.push('scheduler');
        },
        pauseOptionalScheduler: () => {
          events.push('pause-scheduler');
        },
        isStartupActive: () => true,
        markReady: () => {
          events.push('ready');
          return true;
        },
        abortStartup: () => {
          events.push('abort');
        },
        startPolling: () => {
          events.push('poll');
        },
      }
    ),
    /hydrate failed/
  );

  assert.deepEqual(events, ['initialize', 'listen', 'hydrate']);
});
