# iOS PWA refresh on app switch — 2026-09-28

Owner report in #bugfixes: leaving the installed app and coming back reloads the whole page, and the reload is slow. Asked whether that is inherent.

## What reloads the page

The phone is on the Vite dev server (`pnpm dev`, port 7489). Vite's hot-reload client (`vite/dist/client/client.mjs`, `vite:ws:disconnect`) treats any dropped socket as a server restart: it waits until the document is visible, pings, then calls `location.reload()`. iOS drops that socket whenever the installed app is backgrounded. The following load re-transforms the dev client. `client/index.html` already records that cold path at over 45s when the machine is busy.

That reload is not iOS reclaiming the process. The page is still alive; Vite navigates it.

A separate case is inherent. If iOS kills the web app to free memory, the next open is a cold start. Nothing in the page can stop that. It is not the every-switch path, and a built client (`pnpm start`, hashed assets cached) is much faster than the dev server when it does happen.

## Change

- Dev only: `keepPageOnResumePlugin` in `client/vite.config.ts` wraps that one `location.reload()` so a backgrounded page stays. File-change reloads are untouched. The page reports itself backgrounded via `installKeepOnResume` (`client/src/pwa/install-resume.ts`) for 15s after it becomes visible, long enough for iOS to bring the network back and for Vite's ping to finish.
- App socket: `useWebSocket` connects on resume when the socket is already closed. An open socket is left alone; replacing it during the iOS resume transition fails.

The page that is open on the phone still has the old Vite client, so the next return can refresh once. The load after that has the guard.

Edits made while the phone is in another app do not hot-update it. A refresh is required to pick those up. That is the tradeoff for not reloading on every return.

## Check

- `client/test/keep-on-resume.test.ts` (6 tests), including the installed Vite client's disconnect reload.
- Client `tsc -b` and `tsc -p tsconfig.test.json` passed.
- The running dev server's `/@vite/client` contains `__unleashdKeepOnResume` around the disconnect reload.
- Headless Chrome, 390×844, `http://127.0.0.1:7489/`: guard was absent before boot and present after; `keep()` was false while visible, true while hidden, and still true immediately after becoming visible. Navigation type stayed `navigate`. The shell rendered the workspace list (Chats, Buddies, unleashd, wave_sim). Not exercised on a physical iPhone app switch.
