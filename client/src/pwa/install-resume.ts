import { FOREGROUND_SETTLE_MS, createResumeTracker } from './resume';

declare global {
  var __unleashdKeepOnResume: (() => boolean) | undefined;
}

/** Dev only: tell the patched Vite client not to reload a page that was backgrounded. */
export function installKeepOnResume(): void {
  if (import.meta.env?.DEV !== true || typeof document === 'undefined') return;
  const tracker = createResumeTracker(FOREGROUND_SETTLE_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      tracker.noteHidden();
      return;
    }
    tracker.noteVisible((afterMs, callback) => {
      window.setTimeout(callback, afterMs);
    });
  });
  globalThis.__unleashdKeepOnResume = () => tracker.keep();
}
