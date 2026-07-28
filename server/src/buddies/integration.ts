import fs from 'node:fs';
import path from 'node:path';
import type { BuddyContext, ModelId, Provider } from '@unleashd/shared';
import type { Response } from 'express';
import { BuddyClosureService, BuddyReviewSettlementSchema } from './closure';
import type { BuddiesModule, BuddiesStorePort } from './contract';

const BUDDIES_PACKAGE_NAME: string = '@nbardy/buddies';
export const BUDDY_REVIEW_RESULT_START = '<!-- unleashd:buddy-review-result -->';
export const BUDDY_REVIEW_RESULT_END = '<!-- /unleashd:buddy-review-result -->';

/**
 * Parse only the explicitly delimited review result emitted by a Buddy review
 * conversation. JSON elsewhere in an assistant response is ordinary prose and
 * must never mutate durable review state.
 */
export function parseBuddyReviewResult(outcome: string) {
  const startCount = outcome.split(BUDDY_REVIEW_RESULT_START).length - 1;
  const endCount = outcome.split(BUDDY_REVIEW_RESULT_END).length - 1;
  if (startCount === 0 && endCount === 0) return undefined;
  if (startCount !== 1 || endCount !== 1) {
    throw new Error('Buddy review result must contain exactly one complete delimited block');
  }
  const escapedStart = BUDDY_REVIEW_RESULT_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = BUDDY_REVIEW_RESULT_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = outcome.match(
    new RegExp(`(?:^|\\n)${escapedStart}\\r?\\n([\\s\\S]*?)\\r?\\n${escapedEnd}(?=\\r?\\n|$)`)
  );
  if (!block) {
    throw new Error('Buddy review result markers must each appear on their own line');
  }
  const payload = block[1].trim();
  if (!payload) throw new Error('Buddy review result block is empty');
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    throw new Error('Buddy review result block must contain raw JSON');
  }
  return BuddyReviewSettlementSchema.parse(decoded);
}

export const BUDDY_REVIEW_RESULT_INSTRUCTIONS = [
  'End the review with exactly one structured result block using these literal marker lines:',
  BUDDY_REVIEW_RESULT_START,
  '{"verdict":"pass|needs_work|fail","score":0,"summary":"...","evidence":[{"kind":"file|conversation|project|metric","reference":"...","observation":"..."}],"requiredActions":[]}',
  BUDDY_REVIEW_RESULT_END,
  'Put raw JSON between the markers, without a Markdown code fence.',
].join('\n');

export interface BuddyConversationPort {
  id: string;
  sessionId: string;
  provider: Provider;
  buddyContext: BuddyContext | null;
}

export interface ResolvedBuddyConversation {
  context: BuddyContext;
  briefing: string;
  workingDirectory: string;
  provider: Provider;
  model?: ModelId;
  reasoningEffort?: string;
}

export interface BuddiesIntegrationDependencies {
  getConversation(id: string): BuddyConversationPort | undefined;
  loadModule?(): Promise<unknown>;
}

export class BuddiesUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      'Buddies integration is unavailable. Install the optional @nbardy/buddies package to enable it.',
      { cause }
    );
    this.name = 'BuddiesUnavailableError';
  }
}

export function createBuddiesIntegration(dependencies: BuddiesIntegrationDependencies) {
  let storePromise: Promise<BuddiesStorePort> | null = null;

  function getStore(): Promise<BuddiesStorePort> {
    const loadModule =
      dependencies.loadModule ?? (() => import(BUDDIES_PACKAGE_NAME) as Promise<unknown>);
    storePromise ??= loadModule().then(
      (loadedModule: unknown) => {
        const { BuddiesStore } = loadedModule as BuddiesModule;
        if (typeof BuddiesStore !== 'function') {
          throw new Error('The Buddies package does not export BuddiesStore');
        }
        return new BuddiesStore();
      },
      (error) => {
        throw new BuddiesUnavailableError(error);
      }
    );
    return storePromise;
  }

  function sendError(response: Response, error: unknown, fallbackStatus: number): void {
    const status = error instanceof BuddiesUnavailableError ? 503 : fallbackStatus;
    response.status(status).json({ error: error instanceof Error ? error.message : String(error) });
  }

  async function resolveConversation(requested: BuddyContext): Promise<ResolvedBuddyConversation> {
    const buddies = await getStore();
    const detail = buddies.getBuddyContext(requested.buddyId, {
      workspace: requested.workspaceId,
      project: requested.buddyProjectId ?? undefined,
    });
    if (!detail.workspace) throw new Error('Buddy workspace not found');
    if (detail.buddy.status !== 'active') {
      throw new Error(
        `Buddy is ${detail.buddy.status}; only active Buddies can start conversations`
      );
    }
    if (requested.legacyWorkItemId) {
      const legacy = buddies.getWorkItem(requested.legacyWorkItemId);
      if (
        !legacy ||
        legacy.buddy_id !== detail.buddy.id ||
        legacy.project_id !== detail.workspace.id
      ) {
        throw new Error('Legacy work item does not belong to this Buddy and workspace');
      }
    }
    if (requested.delegatedByBuddyId) {
      buddies.getBuddyContext(requested.delegatedByBuddyId, {
        workspace: detail.workspace.id,
      });
      if (requested.parentBuddyConversationId) {
        const parent = dependencies.getConversation(requested.parentBuddyConversationId);
        if (
          !parent?.buddyContext ||
          parent.buddyContext.buddyId !== requested.delegatedByBuddyId ||
          parent.buddyContext.workspaceId !== detail.workspace.id
        ) {
          throw new Error('Parent Buddy conversation does not match the delegating Buddy scope');
        }
      }
    }
    const context: BuddyContext = {
      buddyId: detail.buddy.id,
      workspaceId: detail.workspace.id,
      buddyProjectId: detail.project?.id ?? null,
      legacyWorkItemId: requested.legacyWorkItemId ?? null,
      automationRunId: requested.automationRunId ?? null,
      delegatedByBuddyId: requested.delegatedByBuddyId ?? null,
      parentBuddyConversationId: requested.parentBuddyConversationId ?? null,
    };
    const skillBriefings = detail.skills.map((skill) => {
      if (skill.mode !== 'always') {
        return `${skill.name} (on demand; instructions: ${skill.instruction_path})`;
      }
      try {
        return `${skill.name} (always)\n${fs.readFileSync(skill.instruction_path, 'utf8')}`;
      } catch {
        return `${skill.name} (always; instructions unavailable at ${skill.instruction_path})`;
      }
    });
    const briefing = [
      `You are ${detail.buddy.name}, the ${detail.buddy.role} Buddy.`,
      `Workspace: ${detail.workspace.name} (${detail.workspace.root_path})`,
      '',
      'BUDDY_SOUL.md',
      detail.soul || '(No Buddy soul has been configured.)',
      '',
      'RELATIONSHIPS AND SKILLS',
      JSON.stringify(detail.relationships, null, 2),
      ...skillBriefings,
      '',
      'BUDDY MEMORY',
      detail.memory.summary || '(No curated memory yet.)',
      ...detail.memory.recentJournal.map(
        (entry: { path: string; content: string }) =>
          `\nRecent journal ${path.basename(entry.path)}\n${entry.content}`
      ),
      '',
      'CURRENT SPRINT / OWNED WORK',
      JSON.stringify(
        {
          sprint: detail.sprint,
          selectedProject: detail.project,
          projects: detail.projects,
          legacyWorkItems: detail.legacyWorkItems,
        },
        null,
        2
      ),
      '',
      'BUDDY OPERATIONS',
      'Use the native `unleashd_buddy` tools for durable employee state whenever they are available.',
      'Those tools are already bound to this employee, workspace, and selected project.',
      'Never pass identity through prose, edit the Buddies SQLite database directly, or substitute filesystem notes for project state.',
      'Use get_current_work before choosing work; use new_project/update_project for authoritative work; use remember for durable personal handoffs.',
      'Completing work requires concrete evidence. External sends, spend, publishing, and deployment require request_human_approval first.',
      'An approval request records pending intent only. Stop after requesting it; do not treat the request itself as authorization.',
      'If this provider cannot expose the native tools, the `buddies` CLI is a compatibility fallback.',
    ].join('\n');
    return {
      context,
      briefing,
      workingDirectory: detail.workspace.root_path,
      provider: (detail.buddy.provider || 'codex') as Provider,
      model: detail.buddy.model || undefined,
      reasoningEffort: detail.buddy.reasoning_effort || undefined,
    };
  }

  function updateStatus(
    conversation: BuddyConversationPort,
    status: 'active' | 'complete' | 'failed' | 'cancelled'
  ): void {
    if (!conversation.buddyContext) return;
    void getStore()
      .then((buddies) =>
        buddies.updateConversationLink(conversation.id, {
          status,
          providerSessionId: conversation.sessionId,
        })
      )
      .catch((error) =>
        console.warn(`[buddies] Failed to update conversation ${conversation.id}:`, error)
      );
  }

  async function settleDelegation(
    conversation: BuddyConversationPort,
    status: 'complete' | 'failed' | 'cancelled',
    outcome?: string
  ): Promise<void> {
    if (!conversation.buddyContext) return;
    try {
      const buddies = await getStore();
      const normalizedOutcome =
        outcome?.trim() ||
        (status === 'complete'
          ? 'Buddy conversation completed.'
          : status === 'cancelled'
            ? 'Buddy conversation was cancelled.'
            : 'Buddy conversation failed.');
      const review = status === 'complete' ? parseBuddyReviewResult(normalizedOutcome) : undefined;
      new BuddyClosureService(buddies).settleConversation({
        conversationId: conversation.id,
        status,
        outcome: normalizedOutcome,
        review,
      });
    } catch (error) {
      console.warn(`[buddies] Failed to settle conversation ${conversation.id}:`, error);
    }
  }

  async function createLink(conversation: BuddyConversationPort): Promise<void> {
    const context = conversation.buddyContext;
    if (!context) return;
    const buddies = await getStore();
    buddies.linkConversation({
      buddy: context.buddyId,
      workspace: context.workspaceId,
      project: context.buddyProjectId ?? undefined,
      workItem: context.legacyWorkItemId ?? undefined,
      provider: conversation.provider,
      providerSessionId: conversation.sessionId,
      unleashdConversationId: conversation.id,
      status: 'active',
    });
  }

  return {
    getStore,
    sendError,
    resolveConversation,
    updateStatus,
    settleDelegation,
    createLink,
  };
}
