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
  forceExitGraceMs: number;
}

export type ShutdownState = 'idle' | 'reloading' | 'shutting_down' | 'exiting';

export interface ShutdownController {
  readonly state: ShutdownState;
  handleReload(): void;
  handleSigint(): void;
  handleSigterm(): void;
  dispose(): void;
}

export function createShutdownController(
  options: ShutdownOptions,
  ports: ShutdownPorts
): ShutdownController {
  let drainInterval: NodeJS.Timeout | null = null;
  let forceExitTimeout: NodeJS.Timeout | null = null;
  let state: ShutdownState = 'idle';
  let schedulerStopped = false;
  let exitPromise: Promise<void> | null = null;

  const activeRuns = () =>
    Array.from(ports.conversations()).filter((item) => item.hasActiveProcess());
  const clearTimers = () => {
    if (drainInterval) clearInterval(drainInterval);
    if (forceExitTimeout) clearTimeout(forceExitTimeout);
    drainInterval = null;
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
  const waitForActiveTurns = (onWaiting: () => void) => {
    if (activeRuns().length === 0) {
      void exitOnce();
      return;
    }
    onWaiting();
    drainInterval = setInterval(() => {
      if (activeRuns().length === 0) void exitOnce();
    }, 500);
  };
  const handleReload = () => {
    if (state !== 'idle') return;
    stopScheduler();
    state = 'reloading';
    // A live provider turn cannot be handed to a replacement server because
    // this process owns its event stream and in-memory buffers. Keep that
    // ownership until the turn completes; the dev watcher coalesces further
    // file changes and starts one replacement process afterward.
    waitForActiveTurns(() => {
      console.warn(
        `Backend reload queued: waiting for ${activeRuns().length} active turn(s) to finish`
      );
    });
  };
  const handleShutdown = (signal: 'SIGINT' | 'SIGTERM') => {
    if (state === 'exiting' || state === 'shutting_down') return;
    stopScheduler();
    clearTimers();
    state = 'shutting_down';
    console.log(`${signal} — stopping active turns and shutting down`);
    interrupt('explicit shutdown');
    if (activeRuns().length === 0) {
      void exitOnce();
    } else {
      waitForActiveTurns(() => undefined);
      forceExitTimeout = setTimeout(() => void exitOnce(), options.forceExitGraceMs);
    }
  };
  const handleSigint = () => handleShutdown('SIGINT');
  const handleSigterm = () => handleShutdown('SIGTERM');

  return {
    get state() {
      return state;
    },
    handleReload,
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
  const handleProcessMessage = (message: unknown) => {
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'unleashd:dev-reload'
    ) {
      controller.handleReload();
    }
  };
  process.on('message', handleProcessMessage);
  const disposeController = controller.dispose;
  return {
    get state() {
      return controller.state;
    },
    handleSigint: controller.handleSigint,
    handleSigterm: controller.handleSigterm,
    handleReload: controller.handleReload,
    dispose() {
      process.off('SIGINT', controller.handleSigint);
      process.off('SIGTERM', controller.handleSigterm);
      process.off('message', handleProcessMessage);
      disposeController();
    },
  };
}
