import {
  ConversationDetailSchema,
  type ConversationDetail,
  type ConversationRow,
  type SubAgent,
} from '@unleashd/shared';
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import { isRowRunning } from '../utils/conversation-row';
import { detailOf, listField, rowFamily, transcriptFamily } from './conversations';
import { loadResource, resourceAtomFamily, type Resource, type ResourceEntry } from './resources';
import { jotaiStore } from './store';
import { sameItems, stableAtom } from './structural';

type Scope = { buddyId: string; workspaceId: string | null };
const sameScope = (a: Scope, b: Scope) =>
  a.buddyId === b.buddyId && a.workspaceId === b.workspaceId;

/** Buddy conversations plus native descendants, even when the child has no Buddy kind. */
export const buddyWorkerRowsFamily = atomFamily(
  (scope: Scope) =>
    stableAtom((get) => {
      const ids = new Set(
        get(listField('buddyEntries'))
          .filter(
            (entry) =>
              entry.buddyId === scope.buddyId &&
              (scope.workspaceId === null || entry.buddyWorkspaceId === scope.workspaceId)
          )
          .map((entry) => entry.id)
      );
      const children = get(listField('childrenOf'));
      for (const id of ids) for (const child of children.get(id) ?? []) ids.add(child);
      return [...ids].flatMap((id) => get(rowFamily(id)) ?? []);
    }, sameItems),
  sameScope
);

export type BuddyWorkerStatus =
  | 'running'
  | 'queued'
  | 'idle'
  | 'completed'
  | 'error'
  | 'interrupted'
  | 'unknown';
export type BuddyBackgroundWorker = {
  id: string;
  row: ConversationRow;
  parent: ConversationRow | null;
  agent: SubAgent | null;
  status: BuddyWorkerStatus;
  sortTime: number;
};
const ORDER: Record<BuddyWorkerStatus, number> = {
  running: 0,
  queued: 1,
  unknown: 2,
  error: 3,
  interrupted: 3,
  idle: 4,
  completed: 5,
};
const NO_DETAILS: readonly ConversationDetail[] = [];
export type WorkerDetails = { details: ConversationDetail[]; unavailableIds: string[] };

export function projectBuddyWorkers(
  rows: readonly ConversationRow[],
  details: readonly ConversationDetail[]
): BuddyBackgroundWorker[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byThread = new Map(rows.map((row) => [`${row.provider}:${row.id}`, row]));
  for (const detail of details) {
    const row = byId.get(detail.id);
    if (row) byThread.set(`${row.provider}:${detail.sessionId}`, row);
  }
  const represented = new Set<string>();
  const workers: BuddyBackgroundWorker[] = [];
  for (const detail of details) {
    const parent = byId.get(detail.id);
    if (!parent) continue;
    for (const agent of detail.subAgents) {
      const found = byThread.get(`${parent.provider}:${agent.providerThreadId ?? agent.id}`);
      const child = found?.id !== parent.id ? found : undefined;
      if (child) represented.add(child.id);
      let status: BuddyWorkerStatus = agent.status === 'pending' ? 'queued' : agent.status;
      if (
        agent.statusSource === 'inferred_parent_completion' ||
        ((status === 'running' || status === 'queued') && !isRowRunning(parent))
      )
        status = 'unknown';
      if (child && isRowRunning(child)) status = 'running';
      workers.push({
        id: `${parent.id}:${agent.id}`,
        row: child ?? parent,
        parent,
        agent,
        status,
        sortTime: new Date(agent.completedAt ?? agent.startedAt).getTime(),
      });
    }
  }
  for (const row of rows) {
    if (
      represented.has(row.id) ||
      !(
        (row.kind.t === 'buddy' && row.kind.visibility === 'background') ||
        (row.parent && byId.has(row.parent))
      )
    )
      continue;
    workers.push({
      id: row.id,
      row,
      parent: null,
      agent: null,
      status: isRowRunning(row) ? 'running' : row.run === 'queued' ? 'queued' : 'idle',
      sortTime: row.activityAt,
    });
  }
  return workers.sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.sortTime - a.sortTime);
}

const detailsKey = (rows: readonly ConversationRow[]) =>
  `buddy-workers:${rows
    .map((row) => row.id)
    .sort()
    .join(',')}`;
const valueOf = <T>(entry: ResourceEntry<T>): T | null =>
  entry.kind === 'ready' || entry.kind === 'stale' ? entry.value : null;

/** Details only, never transcript bodies. Quiet sessions reuse the keyed cache until activity changes. */
export function workerDetailsResource(rows: readonly ConversationRow[]): Resource<WorkerDetails> {
  return {
    key: detailsKey(rows),
    async load(signal) {
      const result: ConversationDetail[] = [];
      const unavailableIds: string[] = [];
      let index = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, rows.length) }, async () => {
          for (;;) {
            const row = rows[index++];
            if (!row) return;
            const url = `/api/conversations/${encodeURIComponent(row.id)}`;
            const key = `${url}?workerActivity=${row.activityAt}&run=${row.run}`;
            const cached = jotaiStore.get(resourceAtomFamily(key));
            if (isRowRunning(row) || cached.kind !== 'ready')
              await loadResource({
                key,
                async load() {
                  const response = await fetch(url, { signal });
                  if (!response.ok) throw new Error(`Worker detail HTTP ${response.status}`);
                  return ConversationDetailSchema.parse(await response.json());
                },
              });
            const entry = jotaiStore.get(
              resourceAtomFamily(key)
            ) as ResourceEntry<ConversationDetail>;
            const detail = valueOf(entry);
            if (detail) result.push(detail);
            if (entry.kind === 'failed' || entry.kind === 'stale') unavailableIds.push(row.id);
          }
        })
      );
      return { details: result, unavailableIds };
    },
  };
}

export const buddyBackgroundWorkersAtomFamily = atomFamily(
  (scope: Scope) =>
    atom((get) => {
      const rows = get(buddyWorkerRowsFamily(scope));
      const details =
        valueOf(get(resourceAtomFamily(detailsKey(rows))) as ResourceEntry<WorkerDetails>)
          ?.details ?? NO_DETAILS;
      // An open conversation's WS-patched detail is newer than the polling backstop.
      const merged = new Map(details.map((detail) => [detail.id, detail]));
      for (const row of rows) {
        const detail = detailOf(get(transcriptFamily(row.id)));
        if (detail) merged.set(row.id, detail);
      }
      return projectBuddyWorkers(rows, [...merged.values()]);
    }),
  sameScope
);

export const buddyWorkerCountsFamily = atomFamily(
  (scope: Scope) =>
    stableAtom(
      (get) => {
        const workers = get(buddyBackgroundWorkersAtomFamily(scope));
        return {
          active: workers.filter(
            (worker) => worker.status === 'running' || worker.status === 'queued'
          ).length,
          running: workers.some((worker) => worker.status === 'running'),
        };
      },
      (a, b) => a.active === b.active && a.running === b.running
    ),
  sameScope
);
