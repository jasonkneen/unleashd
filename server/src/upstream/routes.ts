import type {
  UnleashdHomeState,
  UpstreamCheck,
  UpstreamCheckState,
  UpstreamStatus,
  UpstreamUpdateResult,
} from '@unleashd/shared';
import type { Express, Request, Response } from 'express';
import type { ChannelResponder } from '../buddies/channel-responder';
import { publishListPost } from '../buddies/channel-routes';
import type { BuddiesStorePort } from '../buddies/contract';
import { type Checkout, UPSTREAM_BRANCH, checkUpstream, resolveCheckout } from './git-upstream';
import { type UnleashdHome, type UnleashdHomeStore, bootstrapUnleashdHome } from './unleashd-home';

// The install's upstream loop, server side:
//   start()  — bootstrap the "unleashd" workspace (unleashd-home.ts) and run
//              the fetch-only check now and every 6 hours. Neither blocks
//              startup; a bootstrap failure is logged (and so journaled).
//   GET  /api/upstream/status — the cached check plus where #upstream lives.
//   POST /api/upstream/update — an owner post in #upstream @mentioning the
//              Upstream Release Manager, which starts its merge turn.

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface UpstreamServiceDependencies {
  /** Where this server's code lives; the checkout is resolved from here, never process.cwd(). */
  serverDirectory: string;
  getStore(): Promise<BuddiesStorePort>;
  responder: ChannelResponder;
  uploadsRoot: string;
  sendError(response: Response, error: unknown, fallbackStatus: number): void;
}

type UpdateOutcome =
  | { kind: 'posted'; result: UpstreamUpdateResult }
  | { kind: 'refused'; reason: string };

function updateBody(input: {
  releaseManager: { id: string; name: string };
  repoRoot: string;
  remote: string;
}): string {
  const mention = `[@${input.releaseManager.name.replace(/[[\]]/g, '')}](buddy:${input.releaseManager.id})`;
  return `${mention} For folder ${input.repoRoot}: fetch upstream ${input.remote}/${UPSTREAM_BRANCH} and merge in our changes. Commit any local edits first, merge (never reset or rebase), resolve conflicts, run pnpm install && pnpm build, then report what changed.`;
}

export function createUpstreamService(dependencies: UpstreamServiceDependencies) {
  const { serverDirectory, getStore, responder, uploadsRoot, sendError } = dependencies;
  let check: UpstreamCheckState = { kind: 'pending' };
  let home: UnleashdHomeState = { kind: 'pending' };
  let timer: NodeJS.Timeout | null = null;

  async function refresh(): Promise<UpstreamCheck> {
    const latest = await checkUpstream(await resolveCheckout(serverDirectory));
    check = latest;
    if (latest.kind === 'unavailable') {
      // Offline or no remote is ordinary for a local install: the status
      // route reports it, and it is not an operational failure to journal.
      console.log(`[upstream] check unavailable (${latest.reason}): ${latest.detail}`);
    }
    return latest;
  }

  async function bootstrapCheckout(checkout: Checkout): Promise<UnleashdHomeState> {
    switch (checkout.kind) {
      case 'not_checkout':
        console.log(`[upstream] not a git checkout; no unleashd workspace: ${checkout.detail}`);
        return { kind: 'failed', detail: checkout.detail };
      case 'checkout': {
        const store = (await getStore()) as unknown as UnleashdHomeStore;
        const ready: UnleashdHome = bootstrapUnleashdHome(store, checkout.root);
        return { kind: 'ready', ...ready };
      }
    }
  }

  async function bootstrap(): Promise<void> {
    try {
      home = await bootstrapCheckout(await resolveCheckout(serverDirectory));
    } catch (error) {
      console.error('[upstream] Could not bootstrap the unleashd workspace:', error);
      home = { kind: 'failed', detail: error instanceof Error ? error.message : String(error) };
    }
  }

  async function requestUpdate(): Promise<UpdateOutcome> {
    if (home.kind !== 'ready')
      return { kind: 'refused', reason: `The unleashd workspace is ${home.kind}` };
    if (check.kind !== 'behind')
      return { kind: 'refused', reason: `Upstream is not ahead of this checkout (${check.kind})` };
    const { workspaceId, listId, releaseManagerId, repoRoot } = home;
    const { remote, sha } = check;
    const buddies = await getStore();
    const list = buddies.getList(listId);
    const releaseManager = buddies.getBuddy(releaseManagerId);
    if (!list) return { kind: 'refused', reason: 'The #upstream channel no longer exists' };
    if (!releaseManager)
      return { kind: 'refused', reason: 'The Upstream Release Manager no longer exists' };
    const marker = `upstream ${remote}/${UPSTREAM_BRANCH} ${sha}`;
    // One request per upstream sha. The command key alone would only stop a
    // second POST; the replayed post would still start a second merge turn.
    // No await between this read and publishListPost's write (see there).
    const asked = buddies
      .listPosts({ list: list.id, limit: 50 })
      .find((post) => post.author.kind === 'owner' && post.evidence.includes(marker));
    if (asked) {
      return { kind: 'posted', result: { workspaceId, listId, postId: asked.id } };
    }
    const { post, mentions } = await publishListPost({ buddies, responder, uploadsRoot }, list, {
      author: { kind: 'owner' },
      key: `upstream-update:${remote}:${sha}`,
      purpose: 'message',
      body: updateBody({ releaseManager, repoRoot, remote }),
      evidence: [marker],
      projectId: null,
      threadRootId: null,
      mentionConfigs: new Map(),
    });
    for (const mention of mentions) {
      if (mention.status === 'rejected')
        console.warn(`[upstream] update request started no turn: ${mention.reason}`);
    }
    return { kind: 'posted', result: { workspaceId, listId, postId: post.id } };
  }

  return {
    start(): void {
      void bootstrap();
      void refresh();
      timer = setInterval(() => void refresh(), CHECK_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = null;
    },
    refresh,
    bootstrap,
    status(): UpstreamStatus {
      return { check, home };
    },
    requestUpdate,
    registerRoutes(app: Express): void {
      app.get('/api/upstream/status', (_req: Request, res: Response) => {
        res.json({ check, home } satisfies UpstreamStatus);
      });
      app.post('/api/upstream/update', (_req: Request, res: Response) => {
        requestUpdate()
          .then((outcome) => {
            switch (outcome.kind) {
              case 'posted':
                res.status(201).json(outcome.result);
                return;
              case 'refused':
                res.status(409).json({ error: outcome.reason });
                return;
            }
          })
          .catch((error: unknown) => sendError(res, error, 500));
      });
    },
  };
}

export type UpstreamService = ReturnType<typeof createUpstreamService>;
