import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationLoadCompleteAtom, wsStatusAtom } from '../atoms/conversations';

export interface UsePolledFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Generic polling helper for live swarm / catalog data.
 *
 * Provides the polling primitive for mobile (SwarmsMobile, SwarmDetailMobile, SearchMobile)
 * and is available for desktop. Desktop hooks useSwarmRuntimeSnapshots (10s) and
 * useSwarmProjects (15s) are not yet migrated — follow-up to replace their
 * hand-rolled setInterval with this helper. Adds the two mobile-critical
 * behaviors those hooks
 * lacked:
 *   1) pause/resume on document.visibilitychange (backgrounded PWA)
 *   2) immediate refetch on WS reconnect (post-drain, after init snapshot)
 *
 * NOT tanstack-query — just useEffect + setInterval + visibilitychange (PLANNING §7 #8).
 *
 * @param url - fetch URL or null to disable
 * @param intervalMs - polling interval in ms
 * @param enabled - when false, no fetch and no interval (default true)
 */
export function usePolledFetch<T>(
  url: string | null,
  intervalMs: number,
  enabled = true,
): UsePolledFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled && url !== null);
  const [error, setError] = useState<Error | null>(null);

  const wsStatus = useAtomValue(wsStatusAtom);
  const loadComplete = useAtomValue(conversationLoadCompleteAtom);

  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(url);
  urlRef.current = url;

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!enabled || !currentUrl) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(currentUrl, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (controller.signal.aborted) return;
      setData(json);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e as Error);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [enabled]);

  // Initial fetch + interval + visibilitychange pause/resume
  useEffect(() => {
    if (!enabled || !url) {
      setLoading(false);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    void fetchData();

    const startInterval = () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (typeof document !== 'undefined' && document.hidden) return;
      intervalRef.current = window.setInterval(() => void fetchData(), intervalMs);
    };

    startInterval();

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        void fetchData();
        startInterval();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [url, intervalMs, enabled, fetchData]);

  // Immediate refetch on WS reconnect (post-drain)
  const prevWsRef = useRef(wsStatus);
  useEffect(() => {
    const wasConnected = prevWsRef.current === 'connected';
    const nowConnected = wsStatus === 'connected';
    prevWsRef.current = wsStatus;
    if (!wasConnected && nowConnected && loadComplete) {
      void fetchData();
    }
  }, [wsStatus, loadComplete, fetchData]);

  const refetch = useCallback(() => void fetchData(), [fetchData]);

  return { data, loading, error, refetch };
}
