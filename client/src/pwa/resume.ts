// iOS suspends an installed app and drops Vite's hot-reload socket. On resume
// the dev client treats that as a server restart and calls location.reload()
// after its ping (`vite:ws:disconnect` in vite/dist/client/client.mjs), which
// is a full dev-server refresh — the slow "whole page reloaded" return.
// Guard: client/test/keep-on-resume.test.ts

/** How long a just-resumed page still counts as a background drop. */
export const FOREGROUND_SETTLE_MS = 15_000;

export type ResumeClock = (afterMs: number, callback: () => void) => void;

/**
 * True while the page has been in the background more recently than it has
 * been sitting in the foreground. The Vite disconnect reload consults this;
 * a crash while the page is actually on screen still reloads.
 */
export function createResumeTracker(windowMs: number): {
  noteHidden: () => void;
  noteVisible: (schedule: ResumeClock) => void;
  keep: () => boolean;
} {
  let away = false;
  let generation = 0;
  return {
    noteHidden() {
      away = true;
      generation += 1;
    },
    noteVisible(schedule) {
      const seen = generation;
      schedule(windowMs, () => {
        if (seen === generation) away = false;
      });
    },
    keep() {
      return away;
    },
  };
}

/** WebSocket.CONNECTING and WebSocket.OPEN, as numbers so this file stays DOM-free. */
const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;

/** A resume with no live socket should connect now; iOS has frozen the reconnect timer. */
export function resumeNeedsSocketReconnect(readyState: number | undefined): boolean {
  return readyState !== SOCKET_CONNECTING && readyState !== SOCKET_OPEN;
}

const DISCONNECT_RELOAD = /await waitForSuccessfulPing\(([^)]*)\);\s*location\.reload\(\);/;

export function isViteClientModule(id: string): boolean {
  const path = id.split('?')[0] ?? id;
  return path.includes('/vite/') && path.endsWith('/dist/client/client.mjs');
}

/**
 * The disconnect path is the only `location.reload()` that follows
 * `waitForSuccessfulPing`. File-change reloads stay as they are.
 * A second pass (Vite can transform a module twice) leaves the patch in place.
 */
export function patchViteResumeReload(source: string): string {
  if (source.includes('__unleashdKeepOnResume')) return source;
  if (!DISCONNECT_RELOAD.test(source)) {
    throw new Error(
      'patchViteResumeReload: Vite client no longer reloads after waitForSuccessfulPing; update the dev resume guard'
    );
  }
  return source.replace(
    DISCONNECT_RELOAD,
    `await waitForSuccessfulPing($1);
					if (globalThis.__unleashdKeepOnResume?.()) {
						console.info('[unleashd] kept this page; the dev socket dropped while it was in the background');
					} else location.reload();`
  );
}
