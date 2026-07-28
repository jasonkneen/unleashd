import { z } from 'zod';
import type { BuddiesStorePort } from './contract';

export const BuddyOperationContextSchema = z.object({
  buddyId: z.string().min(1),
  workspaceId: z.string().min(1),
  buddyProjectId: z.string().min(1).nullable().optional(),
});

const TodoOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('add'),
    title: z.string().min(1),
    status: z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
    definitionOfDone: z.string().min(1).optional(),
    nextAction: z.string().min(1).optional(),
    blockedReason: z.string().min(1).optional(),
  }),
  z.object({
    operation: z.literal('update'),
    todoId: z.string().min(1),
    title: z.string().min(1).optional(),
    status: z.enum(['open', 'in_progress', 'blocked', 'done', 'cancelled']).optional(),
    position: z.number().int().nonnegative().optional(),
    definitionOfDone: z.string().min(1).nullable().optional(),
    nextAction: z.string().min(1).nullable().optional(),
    blockedReason: z.string().min(1).nullable().optional(),
  }),
]);

export const BuddyOperationInputSchemas = {
  'buddy.get_current_work': z.object({}).strict(),
  'buddy.new_project': z.object({
    title: z.string().min(1),
    objective: z.string().min(1).optional(),
    definitionOfDone: z.string().min(1),
    sprint: z.string().min(1).optional(),
    status: z
      .enum(['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled'])
      .optional(),
    priority: z.number().int().optional(),
    nextAction: z.string().min(1).optional(),
    blockedReason: z.string().min(1).optional(),
    sourcePath: z.string().min(1).optional(),
    externalKey: z.string().min(1).optional(),
    todos: z.array(TodoOperationSchema.options[0].omit({ operation: true })).optional(),
  }),
  'buddy.update_project': z.object({
    projectId: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    objective: z.string().nullable().optional(),
    definitionOfDone: z.string().min(1).optional(),
    status: z
      .enum(['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled'])
      .optional(),
    priority: z.number().int().optional(),
    nextAction: z.string().nullable().optional(),
    blockedReason: z.string().nullable().optional(),
    sprint: z.string().nullable().optional(),
    sourcePath: z.string().nullable().optional(),
    todoOperations: z.array(TodoOperationSchema).optional(),
    evidence: z.array(z.string().min(1)).optional(),
  }),
  'buddy.remember': z.object({
    content: z.string().min(1),
    kind: z.enum(['journal', 'curated']).optional(),
  }),
  'buddy.compact_memory': z.object({
    summary: z.string().min(1),
    retainDays: z.number().int().nonnegative().optional(),
    maxActiveCharacters: z.number().int().nonnegative().optional(),
    dryRun: z.boolean().optional(),
  }),
  'buddy.delegate': z.object({
    toBuddyId: z.string().min(1),
    purpose: z.string().min(1),
    projectId: z.string().min(1).optional(),
    parentConversationId: z.string().min(1).optional(),
  }),
  'buddy.complete_delegation': z.object({
    delegationId: z.string().min(1),
    status: z.enum(['complete', 'failed', 'cancelled']).default('complete'),
    outcome: z.string().min(1),
  }),
  'buddy.submit_review': z.object({
    reviewId: z.string().min(1),
    verdict: z.enum(['needs_work', 'pass', 'fail']),
    score: z.number().min(0).max(100).nullable().optional(),
    summary: z.string().min(1),
    evidence: z
      .array(
        z.object({
          kind: z.enum(['file', 'conversation', 'project', 'metric']),
          reference: z.string().min(1),
          observation: z.string().min(1),
        })
      )
      .min(1),
    requiredActions: z.array(z.string().min(1)).default([]),
  }),
  'buddy.request_human_approval': z.object({
    action: z.string().min(1),
    reason: z.string().min(1),
    risk: z.string().min(1),
    projectId: z.string().min(1).optional(),
  }),
} as const;

export type BuddyOperationName = keyof typeof BuddyOperationInputSchemas;
export type BuddyOperationContext = z.infer<typeof BuddyOperationContextSchema>;

export const BuddyOperationResultSchema = z.object({
  operation: z.string().min(1),
  data: z.unknown(),
  audit: z.unknown(),
});

export class BuddyOperationsService {
  readonly context: BuddyOperationContext;

  constructor(
    private readonly store: BuddiesStorePort,
    context: BuddyOperationContext
  ) {
    this.context = BuddyOperationContextSchema.parse(context);
    const buddy = this.store.getBuddy(this.context.buddyId);
    if (!buddy) throw new Error('Buddy not found');
    const workspaces = this.store.listBuddyWorkspaces(this.context.buddyId) as Array<{
      id: string;
    }>;
    if (!workspaces.some((workspace) => workspace.id === this.context.workspaceId)) {
      throw new Error('Buddy does not belong to the conversation workspace');
    }
    if (this.context.buddyProjectId) this.requireScopedProject(this.context.buddyProjectId);
  }

  execute(name: BuddyOperationName, input: unknown = {}) {
    switch (name) {
      case 'buddy.get_current_work': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        return this.result(
          name,
          this.store.listBuddyOwnedProjects({
            buddy: this.context.buddyId,
            workspace: this.context.workspaceId,
            includeClosed: false,
          }),
          parsed
        );
      }
      case 'buddy.new_project': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        const project = this.store.newProject({
          ...parsed,
          buddy: this.context.buddyId,
          workspace: this.context.workspaceId,
        });
        return this.result(name, project, parsed, (project as { id: string }).id);
      }
      case 'buddy.update_project': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        const projectId = parsed.projectId ?? this.context.buddyProjectId ?? undefined;
        if (!projectId)
          throw new Error('projectId is required outside a project-scoped conversation');
        this.requireScopedProject(projectId);
        if (parsed.status === 'done') {
          if (!parsed.evidence?.length)
            throw new Error('evidence is required to complete a project');
        }
        const { projectId: _projectId, evidence: _evidence, ...changes } = parsed;
        const project = this.store.updateProject(projectId, changes);
        return this.result(name, project, parsed, projectId);
      }
      case 'buddy.remember': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        return this.result(
          name,
          this.store.remember(this.context.buddyId, parsed),
          parsed,
          this.context.buddyProjectId ?? undefined
        );
      }
      case 'buddy.compact_memory': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        return this.result(
          name,
          this.store.compactMemory(this.context.buddyId, parsed),
          parsed,
          this.context.buddyProjectId ?? undefined
        );
      }
      case 'buddy.delegate': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        const projectId = parsed.projectId ?? this.context.buddyProjectId ?? undefined;
        if (projectId) this.requireScopedProject(projectId);
        const delegation = this.store.createDelegation({
          fromBuddy: this.context.buddyId,
          toBuddy: parsed.toBuddyId,
          workspace: this.context.workspaceId,
          project: projectId,
          purpose: parsed.purpose,
          parentConversationId: parsed.parentConversationId,
        });
        return this.result(name, delegation, parsed, projectId);
      }
      case 'buddy.complete_delegation': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        const delegation = this.store.getDelegation(parsed.delegationId);
        if (!delegation) throw new Error('Delegation not found');
        if (
          delegation.from_buddy_id !== this.context.buddyId ||
          delegation.workspace_id !== this.context.workspaceId
        ) {
          throw new Error('Delegation is outside the conversation scope');
        }
        const updated = this.store.updateDelegation(delegation.id, {
          status: parsed.status,
          outcome: parsed.outcome,
        });
        return this.result(name, updated, parsed, delegation.buddy_project_id ?? undefined);
      }
      case 'buddy.submit_review': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        const review = this.store.getReview(parsed.reviewId);
        if (!review) throw new Error('Review not found');
        if (
          review.reviewer_buddy_id !== this.context.buddyId ||
          review.workspace_id !== this.context.workspaceId
        ) {
          throw new Error('Review is outside the conversation scope');
        }
        const evidence = [
          ...parsed.evidence,
          ...parsed.requiredActions.map((action) => ({
            kind: 'required_action',
            reference: review.buddy_project_id ?? review.subject_buddy_id,
            observation: action,
          })),
        ];
        const updated = this.store.updateReview(review.id, {
          status: 'complete',
          verdict: parsed.verdict,
          score: parsed.score,
          summary: parsed.summary,
          evidence,
        });
        return this.result(name, updated, parsed, review.buddy_project_id ?? undefined, true);
      }
      case 'buddy.request_human_approval': {
        const parsed = BuddyOperationInputSchemas[name].parse(input);
        return this.result(
          name,
          { status: 'pending_human_approval', ...parsed },
          parsed,
          parsed.projectId ?? this.context.buddyProjectId ?? undefined
        );
      }
    }
  }

  private requireScopedProject(projectId: string) {
    const project = this.store.getBuddyProject(projectId);
    if (!project) throw new Error('Buddy project not found');
    if (
      project.buddy_id !== this.context.buddyId ||
      project.workspace_id !== this.context.workspaceId
    ) {
      throw new Error('Buddy project is outside the conversation scope');
    }
    return project;
  }

  private result(
    operation: BuddyOperationName,
    data: unknown,
    payload: unknown,
    project?: string,
    allowExternalProject = false
  ) {
    if (project && !allowExternalProject) this.requireScopedProject(project);
    const audit = this.store.recordAuditEvent({
      buddy: this.context.buddyId,
      workspace: this.context.workspaceId,
      project,
      operation,
      payload,
    });
    return BuddyOperationResultSchema.parse({ operation, data, audit });
  }
}
