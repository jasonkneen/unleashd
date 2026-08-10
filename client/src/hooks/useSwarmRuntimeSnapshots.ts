import type { OompaRuntimeSnapshot } from '@unleashd/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePolledFetch } from './usePolledFetch';

interface UseSwarmRuntimeSnapshotsOptions {
  pollMs?: number;
  enabled?: boolean;
}

const makeUnavailable = (reason: string): OompaRuntimeSnapshot => ({
  available: false,
  run: null,
  reason,
});

export function useSwarmRuntimeSnapshots(
  projectRoots: string[],
  options: UseSwarmRuntimeSnapshotsOptions = {}
): Record<string, OompaRuntimeSnapshot> {
  const { pollMs = 10_000, enabled = true } = options;
  const normalizedProjectRoots = useMemo(
    () => Array.from(new Set(projectRoots)).sort(),
    [projectRoots]
  );
  const hasRoots = normalizedProjectRoots.length > 0;

  // Multi-URL fetcher (one /api/swarm-runtime per project root, merged into a
  // single Record) — usePolledFetch's `PolledSource` accepts this in place of
  // a plain URL string. The shared AbortSignal it receives is threaded to
  // every underlying fetch, so a superseded cycle (new poll tick, unmount,
  // roots changed) aborts all in-flight requests together.
  const fetchRuntimeSnapshots = useCallback(
    async (signal: AbortSignal): Promise<Record<string, OompaRuntimeSnapshot>> => {
      const entries = await Promise.all(
        normalizedProjectRoots.map(async (projectRoot) => {
          // Server requires an absolute path. Skip relative paths (e.g. Gemini
          // sessions whose .project_root file is missing — workingDirectory
          // falls back to a directory basename, not an absolute path).
          if (!projectRoot.startsWith('/')) {
            return { projectRoot, snapshot: makeUnavailable('No project root available') };
          }
          try {
            const response = await fetch(
              `/api/swarm-runtime?dir=${encodeURIComponent(projectRoot)}`,
              { signal }
            );
            if (!response.ok) {
              return { projectRoot, snapshot: makeUnavailable(`HTTP ${response.status}`) };
            }
            const snapshot = (await response.json()) as OompaRuntimeSnapshot;
            return { projectRoot, snapshot };
          } catch (e) {
            // A superseded cycle aborts this signal — rethrow so usePolledFetch's
            // shared AbortError handling drops the whole cycle rather than us
            // reporting a spurious per-root failure for a request we cancelled.
            if (signal.aborted) throw e;
            return { projectRoot, snapshot: makeUnavailable('Failed to load runtime snapshot') };
          }
        })
      );
      const next: Record<string, OompaRuntimeSnapshot> = {};
      for (const entry of entries) next[entry.projectRoot] = entry.snapshot;
      return next;
    },
    [normalizedProjectRoots]
  );

  const { data } = usePolledFetch<Record<string, OompaRuntimeSnapshot>>(
    enabled && hasRoots ? fetchRuntimeSnapshots : null,
    pollMs,
    enabled
  );

  // usePolledFetch retains its last `data` when its source goes to null
  // (mobile relies on that to avoid a flash-to-empty on brief WS hiccups).
  // This hook's contract is stricter: disabled or no roots must present as
  // {} immediately, not the previous project's stale snapshot — so mirror
  // `data` into local state and reset it explicitly on the early-out.
  const [runtimeSnapshots, setRuntimeSnapshots] = useState<Record<string, OompaRuntimeSnapshot>>(
    {}
  );
  useEffect(() => {
    if (!enabled || !hasRoots) {
      setRuntimeSnapshots({});
      return;
    }
    if (data) setRuntimeSnapshots(data);
  }, [enabled, hasRoots, data]);

  return runtimeSnapshots;
}
