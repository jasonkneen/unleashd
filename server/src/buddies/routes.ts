import type { BuddyContext } from '@unleashd/shared';
import type { Express, Request, Response } from 'express';
import type { BuddiesStorePort, BuddyAutomation, BuddyAutomationRun } from './contract';

export interface BuddyConversationView {
  id: string;
  toJSON(): unknown;
}

export interface BuddyRouteDependencies {
  getStore(): Promise<BuddiesStorePort>;
  getScheduler(): {
    runNow(automationId: string): Promise<BuddyAutomationRun>;
    cancel(runId: string): BuddyAutomationRun;
    health(): { running: boolean; pollIntervalMs: number; activeRunIds: string[] };
  } | null;
  createConversation(input: {
    context: BuddyContext;
    initialMessage: string;
    commandId: string;
    conversationId?: string;
  }): Promise<BuddyConversationView>;
  sendError(response: Response, error: unknown, fallbackStatus: number): void;
  getNextAutomationRunAt(automation: BuddyAutomation, after: Date): string;
  createId(): string;
}

export function registerBuddyRoutes(app: Express, dependencies: BuddyRouteDependencies): void {
  const {
    getStore,
    getScheduler,
    createConversation,
    sendError,
    getNextAutomationRunAt,
    createId,
  } = dependencies;

  app.get('/api/buddies', async (_req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.dashboard());
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.get('/api/buddies/overview', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(
        buddies.overview({
          recentSince:
            typeof req.query.recentSince === 'string' ? req.query.recentSince : undefined,
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/:buddyId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      const buddy = buddies.getBuddy(req.params.buddyId);
      if (!buddy) {
        res.status(404).json({ error: 'Buddy not found' });
        return;
      }
      res.json({
        buddy,
        workspaces: buddies.listBuddyWorkspaces(buddy.id),
        projects: buddies.listBuddyOwnedProjects({ buddy: buddy.id, includeClosed: true }),
        legacyWorkItems: buddies.listWorkItems({ buddy: buddy.id, includeClosed: true }),
        conversations: buddies.listConversationLinks(buddy.id),
        automations: buddies.listAutomations({ buddy: buddy.id }),
        relationships: buddies.listBuddyRelationships(buddy.id),
        skills: buddies.listBuddySkills(buddy.id),
        delegations: buddies.listDelegations({ buddy: buddy.id }),
        reviews: buddies.listReviews({ buddy: buddy.id }),
      });
    } catch (error) {
      sendError(res, error, 500);
    }
  });

  app.get('/api/buddies/:buddyId/context', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(
        buddies.getBuddyContext(req.params.buddyId, {
          workspace: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
          project: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        })
      );
    } catch (error) {
      sendError(res, error, 404);
    }
  });

  app.post('/api/buddies/:buddyId/relationships', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.status(201).json(
        buddies.setBuddyRelationship({
          fromBuddy: req.params.buddyId,
          toBuddy: req.body?.toBuddyId,
          kind: req.body?.kind,
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/:buddyId/skills', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.status(201).json(
        buddies.assignBuddySkill({
          buddy: req.params.buddyId,
          name: req.body?.name,
          instructionPath: req.body?.instructionPath,
          mode: req.body?.mode,
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/:buddyId/delegations', async (req: Request, res: Response) => {
    const { toBuddyId, workspaceId, buddyProjectId, purpose, parentConversationId } =
      req.body ?? {};
    if (
      typeof toBuddyId !== 'string' ||
      typeof workspaceId !== 'string' ||
      typeof purpose !== 'string'
    ) {
      res.status(400).json({ error: 'toBuddyId, workspaceId, and purpose are required' });
      return;
    }
    let delegationId: string | null = null;
    try {
      const buddies = await getStore();
      const delegation = buddies.createDelegation({
        fromBuddy: req.params.buddyId,
        toBuddy: toBuddyId,
        workspace: workspaceId,
        project: typeof buddyProjectId === 'string' ? buddyProjectId : undefined,
        purpose,
        parentConversationId:
          typeof parentConversationId === 'string' ? parentConversationId : undefined,
      });
      delegationId = delegation.id;
      const conversation = await createConversation({
        context: {
          buddyId: toBuddyId,
          workspaceId,
          buddyProjectId: typeof buddyProjectId === 'string' ? buddyProjectId : null,
          delegatedByBuddyId: req.params.buddyId,
          parentBuddyConversationId:
            typeof parentConversationId === 'string' ? parentConversationId : null,
        },
        commandId: `buddy-delegation-${delegation.id}`,
        initialMessage: [
          `Delegated by Buddy ${req.params.buddyId}.`,
          `Purpose: ${purpose}`,
          'Own this bounded assignment, update durable project/todo state, and report the outcome.',
        ].join('\n'),
      });
      const active = buddies.updateDelegation(delegation.id, {
        status: 'active',
        childConversationId: conversation.id,
      });
      res.status(201).json({ delegation: active, conversation: conversation.toJSON() });
    } catch (error) {
      if (delegationId) {
        void getStore().then((store) =>
          store.updateDelegation(delegationId!, {
            status: 'failed',
            outcome: error instanceof Error ? error.message : String(error),
          })
        );
      }
      sendError(res, error, 400);
    }
  });

  app.patch('/api/buddies/delegations/:delegationId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.updateDelegation(req.params.delegationId, req.body ?? {}));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/:buddyId/reviews', async (req: Request, res: Response) => {
    const {
      subjectBuddyId,
      workspaceId,
      buddyProjectId,
      purpose = 'Review employee work',
    } = req.body ?? {};
    if (typeof subjectBuddyId !== 'string' || typeof workspaceId !== 'string') {
      res.status(400).json({ error: 'subjectBuddyId and workspaceId are required' });
      return;
    }
    try {
      const buddies = await getStore();
      const conversationId = createId();
      const review = buddies.createReview({
        reviewer: req.params.buddyId,
        subject: subjectBuddyId,
        workspace: workspaceId,
        project: typeof buddyProjectId === 'string' ? buddyProjectId : undefined,
        conversationId,
      });
      const conversation = await createConversation({
        conversationId,
        context: {
          buddyId: req.params.buddyId,
          workspaceId,
          buddyProjectId: typeof buddyProjectId === 'string' ? buddyProjectId : null,
        },
        commandId: `buddy-review-${review.id}`,
        initialMessage: [
          `Review Buddy ${subjectBuddyId}.`,
          `Review purpose: ${purpose}`,
          'Return a structured verdict, score, summary, and concrete evidence.',
        ].join('\n'),
      });
      res.status(201).json({ review, conversation: conversation.toJSON() });
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.patch('/api/buddies/reviews/:reviewId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.updateReview(req.params.reviewId, req.body ?? {}));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/:buddyId/memory', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.readBuddyMemory(req.params.buddyId));
    } catch (error) {
      sendError(res, error, 404);
    }
  });

  app.post('/api/buddies/:buddyId/memory', async (req: Request, res: Response) => {
    try {
      const { content, kind = 'journal' } = req.body ?? {};
      if (typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'content is required' });
        return;
      }
      const buddies = await getStore();
      res.status(201).json(
        buddies.remember(req.params.buddyId, {
          content,
          kind: kind === 'curated' ? 'curated' : 'journal',
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/:buddyId/projects', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(
        buddies.listBuddyOwnedProjects({
          buddy: req.params.buddyId,
          workspace: typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined,
          includeClosed: req.query.includeClosed === 'true',
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/:buddyId/projects', async (req: Request, res: Response) => {
    try {
      const { workspaceId, title, definitionOfDone, ...optional } = req.body ?? {};
      if (
        typeof workspaceId !== 'string' ||
        typeof title !== 'string' ||
        typeof definitionOfDone !== 'string'
      ) {
        res.status(400).json({ error: 'workspaceId, title, and definitionOfDone are required' });
        return;
      }
      const buddies = await getStore();
      res.status(201).json(
        buddies.newProject({
          ...optional,
          buddy: req.params.buddyId,
          workspace: workspaceId,
          title,
          definitionOfDone,
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.patch('/api/buddies/projects/:projectId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.updateProject(req.params.projectId, req.body ?? {}));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/:buddyId/automations', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.listAutomations({ buddy: req.params.buddyId }));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/automations/health', (_req: Request, res: Response) => {
    const scheduler = getScheduler();
    if (!scheduler) {
      res.status(503).json({ error: 'Buddy scheduler is not ready' });
      return;
    }
    res.json(scheduler.health());
  });

  app.post('/api/buddies/:buddyId/automations', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      let automation = buddies.createAutomation({
        ...req.body,
        buddy: req.params.buddyId,
        workspace: req.body?.workspaceId,
        project: req.body?.projectId,
      });
      if (!automation.next_run_at) {
        automation = buddies.updateAutomation(automation.id, {
          nextRunAt: getNextAutomationRunAt(automation, new Date()),
        });
      }
      res.status(201).json(automation);
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.patch('/api/buddies/automations/:automationId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      let automation = buddies.updateAutomation(req.params.automationId, req.body ?? {});
      if (
        req.body?.nextRunAt === undefined &&
        (req.body?.scheduleKind !== undefined ||
          req.body?.scheduleExpression !== undefined ||
          req.body?.timezone !== undefined)
      ) {
        automation = buddies.updateAutomation(automation.id, {
          nextRunAt: getNextAutomationRunAt(automation, new Date()),
        });
      }
      res.json(automation);
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.delete('/api/buddies/automations/:automationId', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(buddies.deleteAutomation(req.params.automationId));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/automations/:automationId/run', async (req: Request, res: Response) => {
    try {
      const scheduler = getScheduler();
      if (!scheduler) {
        res.status(503).json({ error: 'Buddy scheduler is not ready' });
        return;
      }
      res.status(202).json(await scheduler.runNow(req.params.automationId));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.get('/api/buddies/automations/:automationId/runs', async (req: Request, res: Response) => {
    try {
      const buddies = await getStore();
      res.json(
        buddies.listAutomationRuns(req.params.automationId, {
          limit:
            typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined,
        })
      );
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  app.post('/api/buddies/automation-runs/:runId/cancel', (req: Request, res: Response) => {
    try {
      const scheduler = getScheduler();
      if (!scheduler) {
        res.status(503).json({ error: 'Buddy scheduler is not ready' });
        return;
      }
      res.json(scheduler.cancel(req.params.runId));
    } catch (error) {
      sendError(res, error, 400);
    }
  });

  // Legacy imported campaign status remains writable during the v1 transition.
  app.patch('/api/buddies/work-items/:id', async (req: Request, res: Response) => {
    try {
      const { status, blockedReason, nextAction } = req.body ?? {};
      if (typeof status !== 'string') {
        res.status(400).json({ error: 'status is required' });
        return;
      }
      const buddies = await getStore();
      const workItem = buddies.updateWorkItemStatus(req.params.id, status as never, {
        blockedReason: typeof blockedReason === 'string' ? blockedReason : undefined,
        nextAction: typeof nextAction === 'string' ? nextAction : undefined,
      });
      res.json(workItem);
    } catch (error) {
      sendError(res, error, 400);
    }
  });
}
