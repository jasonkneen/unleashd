import type { OompaRuntimeSnapshot } from '@unleashd/shared';
import { useEffect, useState } from 'react';

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
  const [projects, setProjects] = useState<SwarmProjectEntry[]>([]);

  useEffect(() => {
    let controller: AbortController | null = null;
    const fetchProjects = async (): Promise<void> => {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      try {
        const response = await fetch('/api/swarm-projects', {
          signal: requestController.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { projects: SwarmProjectEntry[] };
        if (requestController.signal.aborted) return;
        setProjects(data.projects);
      } catch {
        if (!requestController.signal.aborted) {
          setProjects([]);
        }
      }
    };

    void fetchProjects();
    const intervalId = setInterval(() => void fetchProjects(), pollMs);
    return () => {
      clearInterval(intervalId);
      controller?.abort();
    };
  }, [pollMs]);

  return projects;
}
