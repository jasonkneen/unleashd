import type { Message } from '@unleashd/shared';

export interface ShutdownConversation {
  id: string;
  messages: Message[];
  process: { kill(signal?: NodeJS.Signals | number): boolean } | null;
  hasActiveProcess(): boolean;
  stop(): void;
}

export interface ShutdownPorts {
  conversations(): Iterable<ShutdownConversation>;
  stopScheduler(): void;
  flushState(): void;
  broadcastMessage(conversationId: string, content: string): void;
  exit(code?: number): never;
}

export interface ShutdownOptions {
  drainTimeoutMs: number;
  forceExitGraceMs: number;
}

export function registerShutdownHandlers(options: ShutdownOptions, ports: ShutdownPorts): void {
  let drainInterval: NodeJS.Timeout | null = null;
  let forceTimeout: NodeJS.Timeout | null = null;
  let draining = false;

  const activeRuns = () =>
    Array.from(ports.conversations()).filter((item) => item.hasActiveProcess());
  const clearTimers = () => {
    if (drainInterval) clearInterval(drainInterval);
    if (forceTimeout) clearTimeout(forceTimeout);
    drainInterval = null;
    forceTimeout = null;
  };
  const interrupt = (reason: string) => {
    for (const conversation of activeRuns()) {
      const content = `Server is restarting (${reason}); interrupted current turn.`;
      conversation.messages.push({ role: 'system', content, timestamp: new Date() });
      ports.broadcastMessage(conversation.id, content);
      conversation.stop();
    }
  };

  process.on('SIGINT', () => {
    console.log('SIGINT — killing child processes and shutting down...');
    ports.stopScheduler();
    for (const conversation of ports.conversations()) {
      conversation.process?.kill('SIGKILL');
    }
    ports.flushState();
    ports.exit();
  });

  process.on('SIGTERM', () => {
    ports.stopScheduler();
    ports.flushState();
    const active = activeRuns();
    if (active.length === 0) {
      console.log('SIGTERM — no active turns, exiting for restart');
      ports.exit();
    }
    if (draining) {
      console.warn(
        `SIGTERM received again with ${active.length} active turn(s); forcing shutdown now`
      );
      clearTimers();
      interrupt('forced restart');
      setTimeout(() => ports.exit(), options.forceExitGraceMs);
      return;
    }
    draining = true;
    console.warn(
      `SIGTERM deferred: waiting for ${active.length} active turn(s) to finish (timeout ${Math.round(options.drainTimeoutMs / 1000)}s)`
    );
    drainInterval = setInterval(() => {
      if (activeRuns().length !== 0) return;
      clearTimers();
      console.log('SIGTERM — active turns drained, exiting for restart');
      ports.exit();
    }, 500);
    forceTimeout = setTimeout(() => {
      const remaining = activeRuns().length;
      if (remaining > 0) {
        console.warn(
          `SIGTERM drain timeout reached with ${remaining} active turn(s); interrupting and exiting`
        );
        interrupt('hot-reload timeout');
      }
      clearTimers();
      setTimeout(() => ports.exit(), options.forceExitGraceMs);
    }, options.drainTimeoutMs);
  });
}
