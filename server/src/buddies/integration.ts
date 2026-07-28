import fs from 'node:fs';
import path from 'node:path';
import type { BuddyContext, ModelId, Provider } from '@unleashd/shared';
import type { Response } from 'express';
import type { BuddiesModule, BuddiesStorePort } from './contract';

const BUDDIES_PACKAGE_NAME: string = '@nbardy/buddies';

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
      'Use the `buddies` CLI for durable employee state; never edit its SQLite database directly.',
      'The public operations are new_project, update_project, and remember.',
      'Close, cancel, block, or reopen project todos through an atomic `buddies project update` call.',
      'Write durable personal handoffs through `buddies remember`.',
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

  function settleDelegation(
    conversation: BuddyConversationPort,
    status: 'complete' | 'failed' | 'cancelled',
    outcome?: string
  ): void {
    if (!conversation.buddyContext?.delegatedByBuddyId) return;
    void getStore()
      .then((buddies) => {
        const delegation = buddies
          .listDelegations({ buddy: conversation.buddyContext!.buddyId })
          .find((item) => item.child_conversation_id === conversation.id);
        if (!delegation) return;
        buddies.updateDelegation(delegation.id, { status, outcome });
      })
      .catch((error) =>
        console.warn(`[buddies] Failed to settle delegation for ${conversation.id}:`, error)
      );
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
