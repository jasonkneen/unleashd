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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/swarm-projects', {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { projects: SwarmProjectEntry[] };
        setProjects(data.projects);
      } catch {
        if (!controller.signal.aborted) {
          setProjects([]);
        }
      }
    };

    void fetchProjects();
    return () => controller.abort();
  }, [tick]);

  return projects;
}
