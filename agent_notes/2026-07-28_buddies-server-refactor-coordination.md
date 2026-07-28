# Buddies / `server.ts` Refactor Coordination

**Date:** 2026-07-28
**Constraint:** Another agent is actively refactoring `server.ts`.

**Status:** Historical coordination record. The server/runtime integration is
complete; current status is maintained in
`agent_notes/2026-07-28_buddies-completion-audit-and-forward-plan.md`.

## Purpose

Prevent Buddy work from colliding with the general server decomposition while
still allowing meaningful implementation progress.

## No-touch area during the active refactor

Do not make broad edits to:

- `server/src/server.ts`;
- WebSocket routing inside `server.ts`;
- conversation configuration construction;
- startup/shutdown orchestration;
- provider event dispatch;
- disk-loader merge behavior.

Tiny Buddy integration edits should also wait unless the refactor owner confirms
the relevant section is stable.

## Safe independent areas

- sibling `buddies/src/*`;
- sibling `buddies/test/*`;
- sibling profiles, scripts, and documentation;
- `server/src/buddies/contract.ts`;
- `server/src/buddies/routes.ts`;
- `server/src/buddies/scheduler.ts`;
- new Buddy-specific server modules;
- Buddy-specific server tests;
- `client/src/components/BuddiesDashboard.tsx`;
- `client/src/components/buddies/*`;
- a new pure Buddy overview/projection module;
- Buddy-specific agent notes.

## Existing integration points that must survive the refactor

The refactor must preserve equivalent behavior for:

1. `resolveBuddyConversation`
   - validates Buddy/workspace/project scope;
   - resolves soul, memory, skills, team, and work;
   - returns provider/config and working directory.
2. `createBuddyConversationLink`
   - creates the durable link exactly once.
3. Conversation fields
   - `buddyContext`;
   - private Buddy briefing.
4. First-turn briefing injection
   - only on the first actual user message;
   - hidden from visible prompt after hydration.
5. Conversation serialization
   - emits typed `buddyContext`.
6. Disk hydration
   - restores context and rebuilds current briefing.
7. Lifecycle updates
   - updates conversation link status;
   - settles delegation.
8. Scheduler startup and shutdown
   - starts once;
   - stops on shutdown;
   - does not duplicate timers on hot reload.
9. Route registration
   - `registerBuddyRoutes`.

## Preferred post-refactor shape

Move remaining Buddy-specific orchestration out of `server.ts`:

```text
server/src/buddies/
  contract.ts
  context-service.ts
  conversation-service.ts
  lifecycle-service.ts
  operations-service.ts
  overview-service.ts
  routes.ts
  scheduler.ts
```

`server.ts` should depend on a small façade:

```ts
const buddiesRuntime = await createBuddiesRuntime({
  conversationRuntime,
  providerCatalog,
  logger,
});

buddiesRuntime.registerRoutes(app);
buddiesRuntime.start();
```

## Merge/rebase checklist

After the general refactor lands:

- [ ] Search for every `buddyContext` read/write.
- [ ] Confirm no creation path drops the field.
- [ ] Confirm optimistic client stubs still contain it.
- [ ] Confirm first empty conversation does not spawn a provider process.
- [ ] Confirm first user message injects the briefing once.
- [ ] Confirm resumed turns do not inject it again.
- [ ] Confirm disk reload preserves context.
- [ ] Confirm Buddy links are not duplicated.
- [ ] Confirm delegation settles once.
- [ ] Confirm scheduler has one timer.
- [ ] Run focused Buddy tests.
- [ ] Run the full server suite.
- [ ] Run a browser restart scenario.

## Known overlap risk

The current Unleashd commit combines a large general protocol/server refactor
and the initial Buddies integration in one commit. This makes regression
attribution difficult.

Future Buddy changes should be isolated into small commits organized by:

1. library/domain;
2. route/projection;
3. client;
4. tests;
5. final server integration.

## Coordination rule

If the server refactor changes an integration seam, update this note and the
Buddy tests first. Do not patch around the new architecture inside `server.ts`
without confirming the intended ownership boundary.
