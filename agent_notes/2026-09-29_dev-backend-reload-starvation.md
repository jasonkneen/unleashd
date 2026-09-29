# Dev backend reload starvation (2026-09-29)

Owner: "Why isn't this hot reloading anymore? we are running pnpm dev"

Client (Vite) hot reloads fine. The BACKEND reload starves:
- `tools/watch-server.mjs` only asks the backend to reload; `server/src/lifecycle/shutdown.ts`
  `handleReload` queues it with deliberately no deadline and exits only at an instant with
  `activeWorkCount() === 0`.
- While queued, the backend keeps admitting work: `enterReloadingAtIdleBoundary` pauses the
  Buddy scheduler only for the instant of each check and resumes it; `beginMutation` still
  accepts sends because state stays `idle`.
- Evidence: backend started 13:44 local; catalog commits dd69b92 (13:46) and 1bbb554 (13:51)
  were not served until a restart at 13:53. 25 Buddy runs started 05:44–05:53Z and overlapped
  continuously (Product Dev running since 05:44Z, Wave Simulation Lead, this turn).
- Side effect: the 13:53 restart dropped this turn's Buddy MCP connection, so the reply to
  the owner could not be posted.

Proposed fix (not started, needs owner go): once a reload is queued, stop STARTING new turns
(keep the scheduler paused; sends get the existing retryable `server_draining` 503; Buddy runs
stay queued in the DB for the new backend). The reload then happens when already-running turns
finish, nothing killed. Log which operation holds the drain.
Workaround now: `pnpm dev:replace` (interrupts running turns).
