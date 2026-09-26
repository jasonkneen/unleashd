import { z } from 'zod';

// GET /api/upstream/status: whether this install's checkout is behind its
// upstream `main`, and where the "update" conversation lives. The server only
// ever FETCHES; merging is the Upstream Release Manager's job, started by
// POST /api/upstream/update (server/src/upstream/).
//
//   UpstreamCheck = Current ⊕ Behind ⊕ Unavailable
//
// `pending` is the state before the first check finishes (the check runs in
// the background at start, then every 6 hours). An unavailable check names
// why, so "no remote" and "fetch failed" never read as "up to date".

const CheckedAt = z.string().min(1);

const UpstreamCurrentSchema = z.object({
  kind: z.literal('current'),
  remote: z.string().min(1),
  sha: z.string().min(1),
  checkedAt: CheckedAt,
});

const UpstreamBehindSchema = z.object({
  kind: z.literal('behind'),
  remote: z.string().min(1),
  sha: z.string().min(1),
  behind: z.number().int().positive(),
  ahead: z.number().int().nonnegative(),
  checkedAt: CheckedAt,
});

export const UpstreamUnavailableReasonSchema = z.enum([
  'not_git_checkout',
  'no_remote',
  'fetch_failed',
  'compare_failed',
]);
export type UpstreamUnavailableReason = z.infer<typeof UpstreamUnavailableReasonSchema>;

const UpstreamUnavailableSchema = z.object({
  kind: z.literal('unavailable'),
  reason: UpstreamUnavailableReasonSchema,
  detail: z.string(),
  checkedAt: CheckedAt,
});

export const UpstreamCheckSchema = z.discriminatedUnion('kind', [
  UpstreamCurrentSchema,
  UpstreamBehindSchema,
  UpstreamUnavailableSchema,
]);
export type UpstreamCheck = z.infer<typeof UpstreamCheckSchema>;

export const UpstreamCheckStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pending') }),
  UpstreamCurrentSchema,
  UpstreamBehindSchema,
  UpstreamUnavailableSchema,
]);
export type UpstreamCheckState = z.infer<typeof UpstreamCheckStateSchema>;

// The first-run "unleashd" workspace: the install's checkout, its #upstream
// channel, and the two Buddies the bootstrap guarantees.
export const UnleashdHomeStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pending') }),
  z.object({
    kind: z.literal('ready'),
    repoRoot: z.string().min(1),
    workspaceId: z.string().min(1),
    listId: z.string().min(1),
    productDevId: z.string().min(1),
    releaseManagerId: z.string().min(1),
  }),
  z.object({ kind: z.literal('failed'), detail: z.string() }),
]);
export type UnleashdHomeState = z.infer<typeof UnleashdHomeStateSchema>;

export const UpstreamStatusSchema = z.object({
  check: UpstreamCheckStateSchema,
  home: UnleashdHomeStateSchema,
});
export type UpstreamStatus = z.infer<typeof UpstreamStatusSchema>;

export const UpstreamUpdateResultSchema = z.object({
  workspaceId: z.string().min(1),
  listId: z.string().min(1),
  postId: z.string().min(1),
});
export type UpstreamUpdateResult = z.infer<typeof UpstreamUpdateResultSchema>;
