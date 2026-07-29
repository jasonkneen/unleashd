import crypto from 'node:crypto';
import {
  ProviderSchema,
  defaultReasoningEffortForProvider,
  isEffortValidForProvider,
  isModelIdValidForProvider,
  normalizeModelId,
} from '@unleashd/shared';
import { z } from 'zod';

export const BUDDY_CREATED_START = '<!-- unleashd:buddy-created -->';
export const BUDDY_CREATED_END = '<!-- /unleashd:buddy-created -->';

export const CreateBuddyInputSchema = z
  .object({
    workspaceId: z.string().min(1),
    name: z.string().min(1).max(120),
    role: z.string().min(1).max(240),
    provider: ProviderSchema.optional(),
    model: z.string().min(1).optional(),
    reasoningEffort: z.string().min(1).optional(),
  })
  .strict();

export type CreateBuddyInput = z.infer<typeof CreateBuddyInputSchema>;

export interface BuddyBuilderRecord {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  provider: string | null;
  model: string | null;
  reasoning_effort: string | null;
}

export interface BuddyBuilderWorkspace {
  id: string;
  slug: string;
  name: string;
  root_path: string;
}

export interface BuddyBuilderStore {
  listWorkspaces(): BuddyBuilderWorkspace[];
  listBuddies(workspace?: string): BuddyBuilderRecord[];
  getBuddy(idOrSlug: string, workspace?: string): BuddyBuilderRecord | null;
  createBuddy(input: {
    project: string;
    slug: string;
    name: string;
    role: string;
    status: 'active';
    provider: string;
    model?: string;
    reasoningEffort?: string;
  }): BuddyBuilderRecord;
}

export interface BuddyCreatedResult {
  type: 'buddy_created';
  buddy: BuddyBuilderRecord & {
    workspace: BuddyBuilderWorkspace;
  };
  route: string;
}

function creationSlug(conversationId: string): string {
  const suffix = crypto.createHash('sha256').update(conversationId).digest('hex').slice(0, 16);
  return `builder-${suffix}`;
}

function sameCreation(
  existing: BuddyBuilderRecord,
  requested: {
    name: string;
    role: string;
    provider: string;
    model: string | null;
    reasoningEffort: string | null;
  }
): boolean {
  return (
    existing.name === requested.name &&
    existing.role === requested.role &&
    existing.provider === requested.provider &&
    existing.model === requested.model &&
    existing.reasoning_effort === requested.reasoningEffort
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /unique constraint failed:\s*buddies\.project_id,\s*buddies\.slug/i.test(error.message)
  );
}

export function serializeBuddyCreated(result: BuddyCreatedResult): string {
  return `${BUDDY_CREATED_START}\n${JSON.stringify(result)}\n${BUDDY_CREATED_END}`;
}

/**
 * Application boundary for the Buddy Builder. The model receives three narrow
 * tools; this service owns validation, defaults, idempotency, and store writes.
 *
 * Idempotency is represented by the durable `(workspace, slug)` uniqueness
 * already owned by BuddiesStore. The persisted Builder conversation id derives
 * that slug, so a retry replays after either a process or server restart and a
 * single Builder thread cannot silently hire multiple people.
 */
export class BuddyBuilderService {
  constructor(
    private readonly store: BuddyBuilderStore,
    private readonly conversationId: string
  ) {}

  listWorkspaces(): BuddyBuilderWorkspace[] {
    return this.store.listWorkspaces();
  }

  listBuddies(workspaceId?: string): BuddyBuilderRecord[] {
    if (
      workspaceId &&
      !this.store.listWorkspaces().some((workspace) => workspace.id === workspaceId)
    ) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }
    return this.store.listBuddies(workspaceId);
  }

  createBuddy(input: unknown): BuddyCreatedResult {
    const parsed = CreateBuddyInputSchema.parse(input);
    const workspace = this.store
      .listWorkspaces()
      .find((candidate) => candidate.id === parsed.workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${parsed.workspaceId}`);

    const provider = parsed.provider ?? 'codex';
    const requestedModel = parsed.model ?? (provider === 'codex' ? 'gpt-5.6-luna' : undefined);
    const model = normalizeModelId(provider, requestedModel);
    const reasoningEffort =
      parsed.reasoningEffort ??
      (provider === 'codex' ? 'high' : defaultReasoningEffortForProvider(provider, model));
    if (!isModelIdValidForProvider(provider, model)) {
      throw new Error(`Invalid ${provider} model: ${requestedModel}`);
    }
    if (!isEffortValidForProvider(provider, reasoningEffort)) {
      throw new Error(`Invalid ${provider} reasoning effort: ${reasoningEffort}`);
    }

    const requested = {
      name: parsed.name.trim(),
      role: parsed.role.trim(),
      provider,
      model: model ?? null,
      reasoningEffort: reasoningEffort ?? null,
    };
    const slug = creationSlug(this.conversationId);
    let buddy = this.store.listBuddies().find((candidate) => candidate.slug === slug) ?? null;
    if (buddy && buddy.project_id !== workspace.id) {
      throw new Error(
        'This Buddy Builder conversation already created a Buddy in another workspace'
      );
    }
    if (!buddy) {
      try {
        buddy = this.store.createBuddy({
          project: workspace.id,
          slug,
          name: requested.name,
          role: requested.role,
          status: 'active',
          provider,
          model,
          reasoningEffort,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        buddy = this.store.getBuddy(slug, workspace.id);
        if (!buddy) throw error;
      }
    }
    if (!sameCreation(buddy, requested)) {
      throw new Error('This Buddy Builder conversation already created a different Buddy');
    }
    return {
      type: 'buddy_created',
      buddy: { ...buddy, workspace },
      route: `/buddies/${buddy.id}`,
    };
  }
}

export const BUDDY_BUILDER_BRIEFING = [
  'You are the Unleashd Buddy Builder. Help the user hire one durable Buddy through conversation.',
  'Use only the native list_workspaces, list_buddies, and create_buddy tools for Buddy state.',
  'Inspect available workspaces and existing Buddies before proposing a hire.',
  'Infer a concise name and role. Ask only when the home workspace or intended role is materially ambiguous.',
  'Creation includes identity, one home workspace, and an execution profile only.',
  'Do not create managers, automations, files, skills, projects, permissions, sends, or production changes.',
  'The server defaults new Buddies to Codex, gpt-5.6-luna, high. Omit profile fields unless the user requests an exception.',
  `After create_buddy succeeds, copy its exact ${BUDDY_CREATED_START} result block into the final response without a Markdown code fence.`,
].join('\n');
