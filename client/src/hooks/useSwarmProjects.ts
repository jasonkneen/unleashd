import type { OompaRuntimeSnapshot } from '@unleashd/shared';
import { useCallback, useEffect, useRef } from 'react';
import { usePolledFetch } from './usePolledFetch';

export interface SwarmProjectEntry {
  projectRoot: string;
  projectName: string;
  runtime: OompaRuntimeSnapshot;
}

/**
 * Fetches projects that have oompa runs/ directories on disk.
 * This discovers swarms regardless of worker harness (gemini, codex, claude, etc.)
 * by reading oompa's own event-sourced run data directly.
 */
export function useSwarmProjects(pollMs = 15_000): SwarmProjectEntry[] {
  // Prior behavior split fetch failures in two: a non-2xx response silently
  // kept the last-known project list (assumed transient), while a network
  // exception (fetch itself throwing, e.g. offline) reset to []. usePolledFetch's
  // own error path can't express "keep prior data" for one case and "reset" for
  // another, so this fetcher resolves both outcomes itself (never throws except
  // on abort) and usePolledFetch's `error` is unused here — same as before,
  // this hook never surfaced a distinct error state to its caller.
  const prevProjectsRef = useRef<SwarmProjectEntry[]>([]);

  const fetchProjects = useCallback(async (signal: AbortSignal): Promise<SwarmProjectEntry[]> => {
    try {
      const response = await fetch('/api/swarm-projects', { signal });
      if (!response.ok) return prevProjectsRef.current;
      const data = (await response.json()) as { projects: SwarmProjectEntry[] };
      return data.projects;
    } catch (e) {
      if (signal.aborted) throw e;
      return [];
    }
  }, []);

  const { data } = usePolledFetch<SwarmProjectEntry[]>(fetchProjects, pollMs);

  useEffect(() => {
    if (data) prevProjectsRef.current = data;
  }, [data]);

  return data ?? [];
}
