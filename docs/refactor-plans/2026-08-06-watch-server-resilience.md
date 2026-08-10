# Plan: Watch-Server Resilience & Dev Auto-Refresh

**Date:** 2026-08-06 (updated 2026-08-06 with review feedback)  
**Incident:** `server/src/adapters/jsonl.ts:13:42 Expected ";" but found "is"` → `esbuild Transform failed` → `watch-server` exit 1 → `concurrently --kill-others-on-fail` killed `shared-esm/shared-cjs/cli/client` → required `pnpm dev:replace` for every typo.  
**Status:** Bandaid + tweaks + **B-minus + hardening (4 fixes) shipped** in `tools/watch-server.mjs`. Plan updated per 3-agent review — Option A rejected, B-minus implemented, pre-flight deferred.

## 1. Current Architecture (what changed)

**Before:**
- `tools/dev-supervisor.mjs:565` `resolveConcurrentlyCommand` runs `concurrently --kill-others-on-fail -n shared-esm,shared-cjs,cli,server,client` with 5 children.
- `tools/watch-server.mjs` polls `snapshotDirectory` every `300ms` (hash of `server/src` + `shared/dist` + `agent-cli/dist`), coalesces via `RELOAD_SETTLE_MS=600ms`, sends `RELOAD_MESSAGE` IPC, waits for active provider turns (`reloadPending`) before `startServer()`.
- Runtime is `node --import tsx src/server.ts` → esbuild transform happens *inside* the child on each spawn. Any syntax typo = child exits `1` in `<1s`.
- `child.once('exit')` treated every `code!=0` as fatal: `stopping=true; process.exitCode=1; clearInterval(pollTimer)`. That made `concurrently` kill everyone.

**After (bandaid + tweaks + B-minus + hardening, shipped):**
- `tools/watch-server.mjs:74` `childStartMs` + `lastStderr` ring buffer (**32768** chars, was 8192) + `backendDownRetryTimer`/`backendDownReminderTimer`/`backendDownRetryCount` + `failWatcherConsecutive`.
- `startServer()` spawns with `stdio: ['inherit','inherit','pipe','ipc']` and tees `child.stderr` to `process.stderr` while capturing for classification; resets all counters on spawn.
- `child.once('close')` (was `exit` — **fix HIGH: exit vs close race**) quick-exit guard (inline block at ~187) now classifies by stderr first:
  ```ts
  const isTransformFailure = /Transform failed/i.test(lastStderr) || /ERROR:\s+Expected/i.test(lastStderr);
  const isQuickBuildFailure = !signal && code !== 0 && code !== null && (isTransformFailure || uptimeMs < 3000);
  // reason = isTransformFailure ? 'Transform failure' : `quick exit after ${uptimeMs}ms`
  // B-minus: Transform is primary, 3s fallback only; budget 3 retries then escalate to fatal (HIGH: infinite EADDRINUSE), 30s DOWN reminder
  ```
- `failWatcher` retry with exponential backoff (`300ms * 2^(n-1)` capped `5000ms`, escalate after 20) + `poll()` now respects backoff (`if (failWatcherConsecutive>0 && reloadTimer) return` — **fix HIGH: pollTimer bypassing backoff**).
- Header at line 29 + inline at ~187 document incident, `tsx` vs `vite`, and B-minus tradeoff. Verified: `node --check 0`, `pnpm build 0`.

## 2. Is This a Bandaid?

Yes, but an intentional one. It conflates two distinct failures under one timing heuristic:
- `esbuild Transform failed` (should be retryable, like vite overlay)
- Top-level runtime `throw` or env failure that also exits `1` within `3s` (should be fatal to surface the bug, but now waits silently for a file change)

For edit-time DX the tradeoff is correct. For CI strictness it is not — use `pnpm --filter @unleashd/server build` / `typecheck` there.

**Review correction:** The doc previously said Option A's `tsc` "never emits a bad dist" — that's false. `server/tsconfig.json` has no `noEmitOnError`, and `tsc`'s default *does* emit JS even with type errors (only syntax errors block emit). So a type-broken file would produce a partial `dist` and the watcher would restart on broken output — worse than `tsx`'s loud refusal. `tsc --watch` also writes `dist` file-by-file, so the `600ms` settle can restart mid-emit. Option A as originally written is rejected for this reason.

## 3. Step-Up Options (deeper integration)

Reviewer verdict: keep bandaid + two tweaks, reject Option A, step up to slimmed-down Option B. Do not bundle chokidar or `--kill-others-on-fail` changes.

### Option A — Decouple build from runtime — REJECTED as written
**Idea:** Don't `tsx` the server in dev. Run `tsc --watch` for `server` and watch `server/dist/*.js` instead of `server/src`.
**Why rejected:** False premise (see above) + partial-emit race. Would need `noEmitOnError: true` + atomic emit (write to tmp then rename) + still doesn't cover syntax vs type distinction cleanly. Not the right next step.

### Option B-minus — Stderr classification only (recommended next step)
**Idea:** Keep `tsx` and polling, just make the quick-exit check precise. This is the reviewer's "B-minus" — no chokidar rewrite, no touching `--kill-others-on-fail`.

**Changes (when you do it):**
- In `startServer`, spawn with `stdio: ['inherit','pipe','pipe','ipc']`, tee `stderr` to `process.stderr` and ring-buffer last ~4KB.
- Classify quick exits by `buffer.includes('Transform failed')` (or `ERROR: Expected`) instead of just `uptime<3s`; keep `3000ms` as fallback only.
- Leave polling, `concurrently --kill-others-on-fail`, and lifecycle ordering (`wait-for-exit-then-spawn` at `tools/watch-server.mjs:135` — load-bearing for the drain guarantee) intact.

**Why not full Option B:** Replacing `snapshotDirectory` polling with `chokidar` is a separate perf concern, not needed for correctness. Dropping `--kill-others-on-fail` would leave a dead `vite` or `shared` watcher serving stale `shared/dist` — worse than the incident. B-minus gets the precision without the risk.

### Option C — Meta-handler in supervisor — DEFERRED
Move retry policy to `dev-supervisor` (restart `server` child alone, don't kill siblings). Clean separation but duplicates the drain guarantee already in `watch-server`. Not needed if B-minus is done. Keep `--kill-others-on-fail` for now — it correctly surfaces a truly dead vite/shared watcher.

### Option D — Pre-flight esbuild check (missed in original plan, best DX)
**Idea:** Before `spawn`, run a no-emit esbuild transform check (`esbuild --bundle --platform=node --write=false` or `tsx --eval` dry run). On typo, skip the restart entirely and keep the old healthy server running — exactly what Vite HMR does (the plan's own benchmark). Composes with the bandaid; worth listing even if deferred.

## 4. Auto-Refresh Libs to Consider

| Lib | Role | Why | Verdict |
|-----|------|-----|---------|
| `chokidar` | FS watch | Event-driven, `awaitWriteFinish`, cheaper than `300ms` hash polling | Nice-to-have, not needed for B-minus |
| `tsx watch` | TS runner + watch | Built-in esbuild watch, correct error codes | Alternative to polling, but keep current polling for now |
| `tsc --watch` | Type-checked build | Single source of truth | Rejected for dev (emits on type errors, partial emit race) |
| `vite-node` | Vite-based server HMR | Shares vite pipeline with client | Heavier than needed |
| `nodemon` / `pm2` | Process manager | Less relevant — doesn't solve transform vs runtime distinction | No |

## 5. What Reviewer Should Check (updated)

1. Does `3s` still hide an env crash? Mitigated by tweak 1 (5s retry + 30s DOWN reminder), but B-minus will make it precise.
2. `failWatcher` backoff: 20 attempts with `300ms * 2^(n-1)` capped `5s` — persistent `EACCES` now backs off and escalates instead of 3.3Hz spew.
3. `300ms` polling still okay for now; `chokidar` is a perf follow-up, not correctness.
4. Keep `--kill-others-on-fail` — a dead vite/shared watcher should still be fatal (stale `shared/dist` is worse than the incident).
5. Client overlay for server errors: still just `watch-server` logs; future could WS-broadcast `Transform failed`.
6. Verify the load-bearing ordering: `child.once('exit')` → `reloadPending` → `startServer()` at line 135 must stay `wait-for-exit-then-spawn` to preserve the provider drain guarantee.

## 6. Recommendation

**Now (shipped, this commit):** Bandaid + tweak 1 (5s delayed retry + 30s DOWN reminder) + tweak 2 (failWatcher backoff) + **B-minus** (stderr ring buffer, `Transform failed`/`ERROR: Expected` as primary classifier, `3s` fallback). All in `tools/watch-server.mjs`; no change to `--kill-others-on-fail` or polling (preserves drain guarantee at line 135).

**Future DX (deferred):** Option D pre-flight esbuild check — on typo, skip restart and keep old healthy server running (true Vite HMR). Composes with B-minus.

## 7. Verification Steps for Reviewer

```bash
node --check tools/watch-server.mjs
pnpm --filter @unleashd/server build
# manual:
# 1. Introduce syntax error in server/src/adapters/jsonl.ts (e.g. `const x is string`), save → should log "Backend failed to start" and stay alive (pollTimer alive), fix typo → should restart without pnpm dev:replace
# 2. Kill -9 a healthy backend (signal path) → should still be fatal (stopping)
# 3. nc -l 7499 && save a server file → triggers EADDRINUSE quick crash → should log DOWN, retry in 5s, and repeat reminder every 30s (surfaces HIGH finding)
# 4. Ctrl-C during waiting state → should clear retry/reminder timers and exit 0
# check: git diff tools/watch-server.mjs
# check: server/tsconfig.json has no noEmitOnError (confirms tsc emits on type errors)
```

## 8. Review Findings Folded In

- Fixed false premise: `tsc` *does* emit on type errors (only syntax blocks emit) — `server/tsconfig.json` confirms no `noEmitOnError`.
- Fixed stale line refs (now `childStartMs` at 74, inline block at ~140) — note these drift with edits.
- Added HIGH finding: env quick crash (port 7499) was silently DOWN without file change — fixed by delayed retry + reminder.
- Added MEDIUM: `>3s` crash still fatal — fixed by future stderr match.
- Added LOW: `failWatcher` infinite spew — fixed by backoff.
- Added missing option: pre-flight check (best DX, matches Vite HMR benchmark).
- Lifecycle check: clean, no adoption/second gate; ordering at `135` is load-bearing.
