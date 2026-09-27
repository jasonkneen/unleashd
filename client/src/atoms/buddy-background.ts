import type { Conversation, SubAgent } from '@unleashd/shared';
import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import { conversationAtomFamily, conversationListAtom } from './conversations';
import { sameItems, stableAtom } from './structural';

type BuddyScope = { buddyId: string; workspaceId: string | null };

// Include session workers launched from a DM/channel seat as well as durable
// background conversations. Descendants inherit the owning Buddy's scope;
// provider-native child transcripts often have no Buddy kind of their own.
const workerScopeIdsAtomFamily = atomFamily(
  ({ buddyId, workspaceId }: BuddyScope) =>
    stableAtom((get) => {
      const entries = get(conversationListAtom);
      const ids = new Set(
        entries
          .filter(
            (entry) =>
              entry.buddyId === buddyId &&
              (workspaceId === null || entry.buddyWorkspaceId === workspaceId)
          )
          .map((entry) => entry.id)
      );
      const children = new Map<string, string[]>();
      for (const entry of entries) {
        if (!entry.parentConversationId) continue;
        const siblings = children.get(entry.parentConversationId) ?? [];
        siblings.push(entry.id);
        children.set(entry.parentConversationId, siblings);
      }
      // Set iteration visits additions; the membership check also breaks cycles.
      for (const id of ids) for (const child of children.get(id) ?? []) ids.add(child);
      return [...ids];
    }, sameItems),
  (a, b) => a.buddyId === b.buddyId && a.workspaceId === b.workspaceId
);

export type BuddyWorkerStatus =
  | 'running'
  | 'queued'
  | 'idle'
  | 'completed'
  | 'error'
  | 'interrupted'
  | 'unknown';

export interface BuddyBackgroundWorker {
  id: string;
  conversation: Conversation;
  // A native worker may have its own transcript; otherwise open its parent.
  parent: Conversation | null;
  agent: SubAgent | null;
  status: BuddyWorkerStatus;
  sortTime: number;
}

const STATUS_ORDER: Record<BuddyWorkerStatus, number> = {
  running: 0,
  queued: 1,
  unknown: 2,
  error: 3,
  interrupted: 3,
  idle: 4,
  completed: 5,
};

function conversationStatus(conversation: Conversation): BuddyWorkerStatus {
  if (conversation.isRunning) return 'running';
  if (conversation.queue?.length) return 'queued';
  const reason = conversation.messages.at(-1)?.completionReason;
  if (reason === 'killed') return 'interrupted';
  return reason === 'error' || reason === 'out_of_tokens' ? 'error' : 'idle';
}

export const buddyBackgroundWorkersAtomFamily = atomFamily(
  (scope: BuddyScope) =>
    atom((get) => {
      const conversations = get(workerScopeIdsAtomFamily(scope)).flatMap((id) => {
        const conversation = get(conversationAtomFamily(id));
        return conversation ? [conversation] : [];
      });
      const ids = new Set(conversations.map((conversation) => conversation.id));
      const byThread = new Map<string, Conversation>();
      for (const conversation of conversations) {
        byThread.set(`${conversation.provider}:${conversation.id}`, conversation);
        if (conversation.sessionId)
          byThread.set(`${conversation.provider}:${conversation.sessionId}`, conversation);
      }
      const represented = new Set<string>();
      const workers: BuddyBackgroundWorker[] = [];
      for (const parent of conversations) {
        for (const agent of parent.subAgents ?? []) {
          const child = byThread.get(`${parent.provider}:${agent.providerThreadId ?? agent.id}`);
          const transcript = child && child.id !== parent.id ? child : null;
          if (transcript) represented.add(transcript.id);
          const active = agent.status === 'running' || agent.status === 'pending';
          let status: BuddyWorkerStatus = agent.status === 'pending' ? 'queued' : agent.status;
          if (agent.statusSource === 'inferred_parent_completion' || (active && !parent.isRunning))
            status = 'unknown';
          if (transcript?.isRunning) status = 'running';
          workers.push({
            id: `${parent.id}:${agent.id}`,
            conversation: transcript ?? parent,
            parent,
            agent,
            status,
            sortTime: new Date(agent.completedAt ?? agent.startedAt).getTime(),
          });
        }
      }
      for (const conversation of conversations) {
        if (represented.has(conversation.id)) continue;
        if (
          conversation.placement !== 'background' &&
          !(conversation.parentConversationId && ids.has(conversation.parentConversationId))
        )
          continue;
        workers.push({
          id: conversation.id,
          conversation,
          parent: null,
          agent: null,
          status: conversationStatus(conversation),
          sortTime: new Date(
            conversation.messages.at(-1)?.timestamp ?? conversation.createdAt
          ).getTime(),
        });
      }
      workers.sort(
        (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.sortTime - a.sortTime
      );
      return workers;
    }),
  (a, b) => a.buddyId === b.buddyId && a.workspaceId === b.workspaceId
);

// The rail subscribes only to a scalar, not every worker's changing activity.
export const buddyActiveWorkerCountAtomFamily = atomFamily(
  (scope: BuddyScope) =>
    atom(
      (get) =>
        get(buddyBackgroundWorkersAtomFamily(scope)).filter(
          (worker) => worker.status === 'running' || worker.status === 'queued'
        ).length
    ),
  (a, b) => a.buddyId === b.buddyId && a.workspaceId === b.workspaceId
);

export const buddyHasRunningWorkersAtomFamily = atomFamily(
  (scope: BuddyScope) =>
    atom((get) =>
      get(buddyBackgroundWorkersAtomFamily(scope)).some((worker) => worker.status === 'running')
    ),
  (a, b) => a.buddyId === b.buddyId && a.workspaceId === b.workspaceId
);
