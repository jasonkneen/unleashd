import { ProviderCatalogSchema } from '@unleashd/shared';
import type { ProviderCatalog } from '@unleashd/shared';
import { useCallback, useEffect, useState } from 'react';

type CatalogSnapshot = {
  catalog: ProviderCatalog | null;
  error: Error | null;
  promise: Promise<ProviderCatalog> | null;
};

const snapshot: CatalogSnapshot = {
  catalog: null,
  error: null,
  promise: null,
};
const listeners = new Set<() => void>();
let activeController: AbortController | null = null;

function publish(): void {
  for (const listener of listeners) listener();
}

async function fetchCatalog(signal: AbortSignal): Promise<ProviderCatalog> {
  const response = await fetch('/api/provider-catalog', { signal });
  if (!response.ok) throw new Error(`Failed to load provider catalog (HTTP ${response.status})`);
  return ProviderCatalogSchema.parse(await response.json());
}

function loadCatalog(force = false): Promise<ProviderCatalog> {
  if (!force && snapshot.catalog) return Promise.resolve(snapshot.catalog);
  if (!force && snapshot.promise) return snapshot.promise;

  if (force) activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const request = fetchCatalog(controller.signal)
    .then((catalog) => {
      // Revision is the cache identity. Equal revisions retain the stable object
      // reference so every picker does not re-render after a retry/refetch.
      if (snapshot.catalog?.revision !== catalog.revision) snapshot.catalog = catalog;
      snapshot.error = null;
      return snapshot.catalog;
    })
    .catch((error: unknown) => {
      if ((error as Error).name !== 'AbortError') snapshot.error = error as Error;
      throw error;
    })
    .finally(() => {
      if (snapshot.promise === request) snapshot.promise = null;
      if (activeController === controller) activeController = null;
      publish();
    });
  snapshot.promise = request;
  publish();
  return request;
}

export interface ProviderCatalogState {
  catalog: ProviderCatalog | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * Shared catalog resource for every configuration surface. The module cache
 * deduplicates requests. A forced retry aborts the stale in-flight request.
 */
export function useProviderCatalog(): ProviderCatalogState {
  const [, render] = useState(0);

  useEffect(() => {
    const listener = () => render((value) => value + 1);
    listeners.add(listener);
    void loadCatalog(false).catch(() => {});
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const retry = useCallback(() => {
    void loadCatalog(true).catch(() => {});
  }, []);

  return {
    catalog: snapshot.catalog,
    isLoading: snapshot.promise !== null,
    error: snapshot.error,
    retry,
  };
}
