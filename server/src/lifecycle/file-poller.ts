export interface PollCycleResult<TUpdate> {
  updated: Map<string, TUpdate>;
  mtimes: Map<string, number>;
}

export interface ExternalActivityPort {
  entries(): IterableIterator<[string, number]>;
  has(sessionId: string): boolean;
  set(sessionId: string, lastSeen: number): void;
  delete(sessionId: string): void;
}

export interface FilePollerPorts<TUpdate, TBroadcast> {
  getMtimes(): Map<string, number>;
  setMtimes(mtimes: Map<string, number>): void;
  collectActiveIds(): Set<string>;
  poll(mtimes: Map<string, number>, activeIds: Set<string>): Promise<PollCycleResult<TUpdate>>;
  pruneCompletionSuppressions(now: number): void;
  isCompletionSuppressed(sessionId: string, now: number): boolean;
  externalActivity: ExternalActivityPort;
  findConversationId(sessionId: string): string | undefined;
  broadcastStatus(conversationId: string, isRunning: boolean): void;
  applyUpdate(sessionId: string, update: TUpdate): Promise<TBroadcast | null>;
  broadcastUpdates(updates: TBroadcast[]): void;
  pruneTracking(): void;
}

export interface FilePollerOptions {
  intervalMs: number;
  externalGraceMs: number;
  verbose: boolean;
}

export interface FilePoller {
  runOnce(): Promise<void>;
  start(): NodeJS.Timeout;
}

export function createFilePoller<TUpdate, TBroadcast>(
  options: FilePollerOptions,
  ports: FilePollerPorts<TUpdate, TBroadcast>
): FilePoller {
  async function pollOnce(): Promise<void> {
    try {
      const activeIdsAtPollStart = ports.collectActiveIds();
      const { updated, mtimes } = await ports.poll(ports.getMtimes(), activeIdsAtPollStart);
      ports.setMtimes(mtimes);

      const activeIds = ports.collectActiveIds();
      for (const activeId of activeIdsAtPollStart) activeIds.add(activeId);

      const now = Date.now();
      ports.pruneCompletionSuppressions(now);
      for (const sessionId of updated.keys()) {
        if (activeIds.has(sessionId) || ports.isCompletionSuppressed(sessionId, now)) continue;
        if (!ports.externalActivity.has(sessionId)) {
          if (options.verbose) {
            console.log(`[Poll] External activity detected: ${sessionId.substring(0, 8)}`);
          }
          const conversationId = ports.findConversationId(sessionId);
          if (conversationId) ports.broadcastStatus(conversationId, true);
        }
        ports.externalActivity.set(sessionId, now);
      }

      for (const [sessionId, lastSeen] of ports.externalActivity.entries()) {
        if (ports.isCompletionSuppressed(sessionId, now)) {
          ports.externalActivity.delete(sessionId);
          continue;
        }
        if (now - lastSeen < options.externalGraceMs) continue;
        ports.externalActivity.delete(sessionId);
        if (options.verbose) {
          console.log(`[Poll] External activity stopped: ${sessionId.substring(0, 8)}`);
        }
        const conversationId = ports.findConversationId(sessionId);
        if (conversationId) ports.broadcastStatus(conversationId, false);
      }

      if (updated.size === 0) return;
      if (options.verbose) console.log(`[Poll] ${updated.size} conversation(s) changed`);

      const changed: TBroadcast[] = [];
      for (const [sessionId, update] of updated) {
        if (activeIds.has(sessionId)) continue;
        const broadcast = await ports.applyUpdate(sessionId, update);
        if (broadcast) changed.push(broadcast);
      }
      if (changed.length > 0) ports.broadcastUpdates(changed);
      ports.pruneTracking();
    } catch (error) {
      console.error('[Poll] Error during file polling:', error);
    }
  }

  return {
    runOnce: pollOnce,
    start() {
      return setInterval(() => void pollOnce(), options.intervalMs);
    },
  };
}
