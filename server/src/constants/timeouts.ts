function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const EXTERNAL_GRACE_MS = 30_000;
export const LOCAL_COMPLETION_SUPPRESS_MS = EXTERNAL_GRACE_MS;
export const HOT_RELOAD_FORCE_EXIT_GRACE_MS = readPositiveIntEnv(
  'CWV_HOT_RELOAD_FORCE_EXIT_GRACE_MS',
  3_000
);
export const TURN_IDLE_TIMEOUT_MS = readPositiveIntEnv('CWV_TURN_IDLE_TIMEOUT_MS', 10 * 60_000);
export const TURN_MAX_RUNTIME_MS = readPositiveIntEnv('CWV_TURN_MAX_RUNTIME_MS', 24 * 60 * 60_000);
export const TURN_TIMEOUT_KILL_GRACE_MS = readPositiveIntEnv(
  'CWV_TURN_TIMEOUT_KILL_GRACE_MS',
  5_000
);
export const SWARM_POLL_INTERVAL_MS = readPositiveIntEnv('CWV_SWARM_POLL_INTERVAL_MS', 2_000);
export const SWARM_POLL_THROTTLE_MS = readPositiveIntEnv('CWV_SWARM_POLL_THROTTLE_MS', 1_500);
export const SWARM_CONTEXT_COMMAND_TIMEOUT_MS = 8_000;
export const PALETTE_GENERATION_TIMEOUT_MS = 90_000;
export const USAGE_CACHE_TTL_MS = 60_000;
export const FILE_POLL_INTERVAL_MS = 5_000;
