export interface LoadProgress {
  loaded: number;
  total: number;
}

export interface ProgressiveLoadResult {
  mtimes: Map<string, number>;
}

export interface ProgressiveLoadOptions {
  limit: number;
  concurrency: number;
  batchSize: number;
  initialBatchSize?: number;
  logEveryFiles: number;
}

export interface ProgressiveLoaderPorts<TSource, THydrated, TBroadcast> {
  load(options: {
    limit: number;
    concurrency: number;
    batchSize: number;
    initialBatchSize: number;
    onProgress(batch: TSource[], progress: LoadProgress): Promise<void>;
  }): Promise<ProgressiveLoadResult>;
  hydrate(source: TSource): Promise<THydrated | null>;
  /** Returns false when a live value won the same identity during hydration. */
  store(hydrated: THydrated): boolean;
  serialize(hydrated: THydrated): TBroadcast;
  broadcast(batch: TBroadcast[]): void;
  count(): number;
}

export async function loadProgressively<TSource, THydrated, TBroadcast>(
  options: ProgressiveLoadOptions,
  ports: ProgressiveLoaderPorts<TSource, THydrated, TBroadcast>
): Promise<Map<string, number>> {
  const result = await ports.load({
    limit: options.limit,
    concurrency: options.concurrency,
    batchSize: options.batchSize,
    initialBatchSize: options.initialBatchSize ?? Math.min(20, options.batchSize),
    onProgress: async (batch, progress) => {
      const broadcastBatch: TBroadcast[] = [];
      for (const source of batch) {
        const hydrated = await ports.hydrate(source);
        if (!hydrated) continue;
        if (!ports.store(hydrated)) continue;
        broadcastBatch.push(ports.serialize(hydrated));
      }
      if (broadcastBatch.length > 0) ports.broadcast(broadcastBatch);
      if (progress.loaded % options.logEveryFiles === 0 || progress.loaded === progress.total) {
        console.log(
          `[startup] Parsed ${progress.loaded}/${progress.total} files (${ports.count()} conversations)...`
        );
      }
    },
  });
  return result.mtimes;
}
