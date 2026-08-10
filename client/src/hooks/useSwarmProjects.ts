import type { OompaRuntimeSnapshot } from '@unleashd/shared';
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
  const { data } = usePolledFetch<{ projects: SwarmProjectEntry[] }>('/api/swarm-projects', pollMs);
  return data?.projects ?? [];
}
