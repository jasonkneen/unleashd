import type { Message } from '@unleashd/shared';

export interface ShutdownConversation {
  id: string;
  messages: Message[];
  process: { kill(signal?: NodeJS.Signals | number): boolean } | null;
  hasActiveProcess(): boolean;
  stop(reason?: 'user_stop' | 'server_restart'): void;
}

export interface ShutdownPorts {
  conversations(): Iterable<ShutdownConversation>;
  stopScheduler(): void;
  flushState(): void | Promise<void>;
  broadcastMessage(conversationId: string, content: string): void;
  exit(code?: number): void;
}

export interface ShutdownOptions {
  drainTimeoutMs: number;
  forceExitGraceMs: number;
}

export type ShutdownState = 'idle' | 'draining' | 'forcing' | 'exiting';

export interface ShutdownController {
  readonly state: ShutdownState;
  handleSigint(): void;
  handleSigterm(): void;
  dispose(): void;
}

export function createShutdownController(
  options: ShutdownOptions,
  ports: ShutdownPorts
): ShutdownController {
  let drainInterval: NodeJS.Timeout | null = null;
  let forceTimeout: NodeJS.Timeout | null = null;
  let forceExitTimeout: NodeJS.Timeout | null = null;
  let state: ShutdownState = 'idle';
  let schedulerStopped = false;
  let exitPromise: Promise<void> | null = null;

  const activeRuns = () =>
    Array.from(ports.conversations()).filter((item) => item.hasActiveProcess());
  const clearTimers = () => {
    if (drainInterval) clearInterval(drainInterval);
    if (forceTimeout) clearTimeout(forceTimeout);
    if (forceExitTimeout) clearTimeout(forceExitTimeout);
    drainInterval = null;
    forceTimeout = null;
    forceExitTimeout = null;
  };
  const stopScheduler = () => {
    if (schedulerStopped) return;
    schedulerStopped = true;
    ports.stopScheduler();
  };
  const interrupt = (reason: string) => {
    for (const conversation of activeRuns()) {
      const content = `Server is restarting (${reason}); interrupted current turn.`;
      conversation.messages.push({ role: 'system', content, timestamp: new Date() });
      ports.broadcastMessage(conversation.id, content);
      conversation.stop('server_restart');
    }
  };
  const exitOnce = (): Promise<void> => {
    if (exitPromise) return exitPromise;
    state = 'exiting';
    clearTimers();
    let pendingFlush: void | Promise<void> = undefined;
    try {
      pendingFlush = ports.flushState();
    } catch (error: unknown) {
      console.error('Failed to flush state during shutdown:', error);
    }
    exitPromise = Promise.resolve(pendingFlush)
      .catch((error: unknown) => {
        console.error('Failed to flush state during shutdown:', error);
      })
      .then(() => {
        ports.exit();
      });
    return exitPromise;
  };
  const beginForcedExit = (reason: string) => {
    if (state === 'exiting') return;
    clearTimers();
    state = 'forcing';
    interrupt(reason);
    forceExitTimeout = setTimeout(() => void exitOnce(), options.forceExitGraceMs);
  };
  const handleSigint = () => {
    console.log('SIGINT — killing child processes and shutting down...');
    stopScheduler();
    clearTimers();
    for (const conversation of ports.conversations()) {
      if (conversation.hasActiveProcess()) conversation.stop('server_restart');
    }
    void exitOnce();
  };
  const handleSigterm = () => {
    stopScheduler();
    if (state === 'exiting') return;
    if (state === 'forcing') {
      console.warn('SIGTERM received during forced shutdown; exiting now');
      void exitOnce();
      return;
    }
    if (state === 'draining') {
      const active = activeRuns();
      console.warn(
        `SIGTERM received again with ${active.length} active turn(s); forcing shutdown now`
      );
      beginForcedExit('forced restart');
      return;
    }

    // Claim shutdown ownership before any asynchronous work. Signal handlers can
    // be re-entered while a flush is pending, so the state transition must be
    // synchronous.
    state = 'draining';
    const active = activeRuns();
    if (active.length === 0) {
      console.log('SIGTERM — no active turns, exiting for restart');
      void exitOnce();
      return;
    }
    console.warn(
      `SIGTERM deferred: waiting for ${active.length} active turn(s) to finish (timeout ${Math.round(options.drainTimeoutMs / 1000)}s)`
    );
    drainInterval = setInterval(() => {
      if (activeRuns().length !== 0) return;
      console.log('SIGTERM — active turns drained, exiting for restart');
      void exitOnce();
    }, 500);
    forceTimeout = setTimeout(() => {
      const remaining = activeRuns().length;
      if (remaining > 0) {
        console.warn(
          `SIGTERM drain timeout reached with ${remaining} active turn(s); interrupting and exiting`
        );
        beginForcedExit('hot-reload timeout');
        return;
      }
      void exitOnce();
    }, options.drainTimeoutMs);
  };

  return {
    get state() {
      return state;
    },
    handleSigint,
    handleSigterm,
    dispose: clearTimers,
  };
}

export function registerShutdownHandlers(
  options: ShutdownOptions,
  ports: ShutdownPorts
): ShutdownController {
  const controller = createShutdownController(options, ports);
  process.on('SIGINT', controller.handleSigint);
  process.on('SIGTERM', controller.handleSigterm);
  const disposeController = controller.dispose;
  return {
    get state() {
      return controller.state;
    },
    handleSigint: controller.handleSigint,
    handleSigterm: controller.handleSigterm,
    dispose() {
      process.off('SIGINT', controller.handleSigint);
      process.off('SIGTERM', controller.handleSigterm);
      disposeController();
    },
  };
}
