import fs from 'node:fs';
import path from 'node:path';
import type { BuddyContext, ModelId, Provider } from '@unleashd/shared';
import type { Response } from 'express';
import { BuddyClosureService, BuddyReviewSettlementSchema } from './closure';
import type { BuddiesModule, BuddiesStorePort } from './contract';

const BUDDIES_PACKAGE_NAME: string = '@nbardy/buddies';
const BUDDY_BRIEFING_MAX_CHARACTERS = 40_000;
const BUDDY_SOUL_MAX_CHARACTERS = 12_000;
const BUDDY_SKILLS_MAX_CHARACTERS = 12_000;
const BUDDY_MEMORY_MAX_CHARACTERS = 6_000;
const BUDDY_MEMORY_SUMMARY_MAX_CHARACTERS = 4_200;
const BUDDY_MEMORY_JOURNAL_MAX_CHARACTERS = 1_800;
const BUDDY_WORK_MAX_CHARACTERS = 8_000;
export const BUDDY_REVIEW_RESULT_START = '<!-- unleashd:buddy-review-result -->';
export const BUDDY_REVIEW_RESULT_END = '<!-- /unleashd:buddy-review-result -->';

function boundedText(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value;
  return `${value.slice(0, Math.max(0, maxCharacters - 80))}\n… [truncated; use native reads or the referenced file for current detail]`;
}

function compactProject(project: unknown): unknown {
  if (!project || typeof project !== 'object') return project;
  const source = project as Record<string, unknown>;
  return {
    id: source.id,
    title: source.title,
    status: source.status,
    priority: source.priority,
    definition_of_done: source.definition_of_done,
    next_action: source.next_action,
    blocked_reason: source.blocked_reason,
    source_path: source.source_path,
    todos: Array.isArray(source.todos)
      ? source.todos.slice(0, 12).map((todo) => {
          if (!todo || typeof todo !== 'object') return todo;
          const item = todo as Record<string, unknown>;
          return {
            id: item.id,
            title: item.title,
            status: item.status,
            definition_of_done: item.definition_of_done,
            next_action: item.next_action,
            blocked_reason: item.blocked_reason,
          };
        })
      : undefined,
  };
}

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
      allowedBuddyOperations: requested.allowedBuddyOperations,
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
    const prefix = [
      `You are ${detail.buddy.name}, the ${detail.buddy.role} Buddy.`,
      `Workspace: ${detail.workspace.name} (${detail.workspace.root_path})`,
      requested.delegatedByBuddyId
        ? `This conversation is delegated by Buddy ${requested.delegatedByBuddyId}.`
        : '',
      requested.allowedBuddyOperations?.length
        ? `Allowed Buddy operations: ${requested.allowedBuddyOperations.join(', ')}.`
        : 'Buddy operations are scoped by the trusted conversation context.',
      requested.automationRunId
        ? 'AUTOMATION AUTHORITY: the allowed Buddy operations are an absolute boundary. Do not invoke the buddies CLI, HTTP routes, direct database access, or filesystem edits to Buddy state. If a needed operation is absent or denied, record the exact blocker and stop that state transition.'
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const middle = [
      '',
      'BUDDY_SOUL.md',
      boundedText(
        detail.soul || '(No Buddy soul has been configured.)',
        BUDDY_SOUL_MAX_CHARACTERS
      ),
      '',
      'RELATIONSHIPS AND SKILLS',
      boundedText(JSON.stringify(detail.relationships, null, 2), 4_000),
      boundedText(skillBriefings.join('\n\n'), BUDDY_SKILLS_MAX_CHARACTERS),
      '',
      'BUDDY MEMORY',
      boundedText(
        detail.memory.summary || '(No curated memory yet.)',
        Math.min(BUDDY_MEMORY_SUMMARY_MAX_CHARACTERS, BUDDY_MEMORY_MAX_CHARACTERS)
      ),
      detail.memory.recentJournal.length
        ? boundedText(
            `Recent journal excerpts:\n${detail.memory.recentJournal
              .slice(0, 3)
              .map(
                (entry: { path: string; content: string }) =>
                  `\n### ${path.basename(entry.path)}\n${entry.content.trim()}`
              )
              .join('\n')}`,
            BUDDY_MEMORY_JOURNAL_MAX_CHARACTERS
          )
        : 'No recent journal entries.',
      '',
      'CURRENT SPRINT / OWNED WORK',
      boundedText(
        JSON.stringify(
          {
            sprint: detail.sprint,
            selectedProject: compactProject(detail.project),
            attentionProjects: detail.projects.slice(0, 8).map(compactProject),
            legacyWorkItemCount: detail.legacyWorkItems.length,
          },
          null,
          2
        ),
        BUDDY_WORK_MAX_CHARACTERS
      ),
    ].join('\n');
    const suffix = [
      '',
      'BUDDY OPERATIONS',
      'Use the native `unleashd_buddy` tools for durable employee state whenever they are available.',
      'Those tools are already bound to this employee, workspace, and selected project.',
      'Never pass identity through prose, edit the Buddies SQLite database directly, or substitute filesystem notes for project state.',
      'Use get_inbox and get_current_work before choosing work; use new_project/update_project for authoritative work; use remember for durable personal handoffs.',
      'Use remember(kind="journal") after material work, a failed attempt, a durable decision, or a lesson that should change the next run. Record the outcome, evidence pointer, lesson, and next attempt; do not copy the transcript or large evidence.',
      'Use remember(kind="curated") only for stable facts, owner preferences, durable decisions, and repeated lessons likely to matter across future conversations.',
      'Use compact_memory when journal history becomes repetitive, stale, or contradictory; preserve source references and prefer a dry run before replacement.',
      'BUDDY_SOUL.md is a stable behavior and authority contract, not self-editing memory. Do not rewrite it. If repeated evidence suggests a change, record a journal entry beginning SOUL_CHANGE_PROPOSAL for Lead or owner review.',
      'Completing work requires concrete evidence. External sends, spend, publishing, and deployment require request_human_approval first.',
      'An approval request records pending intent only. Stop after requesting it; do not treat the request itself as authorization.',
      'If native Buddy tools are present, a missing or denied operation is an authority boundary; never use the CLI, HTTP, database, or files to bypass it.',
      requested.automationRunId
        ? 'CLI compatibility fallback is prohibited for this automation run.'
        : 'If this provider cannot expose any native Buddy tools, the `buddies` CLI is a compatibility fallback only for operations already authorized by the conversation scope.',
    ].join('\n');
    const middleBudget = Math.max(
      0,
      BUDDY_BRIEFING_MAX_CHARACTERS - prefix.length - suffix.length - 2
    );
    const briefing = [prefix, boundedText(middle, middleBudget), suffix].join('\n');
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
