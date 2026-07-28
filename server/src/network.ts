const DEFAULT_LISTEN_HOST = '127.0.0.1';

/**
 * Keep the local agent UI private by default. Network exposure must be an
 * explicit deployment choice rather than an accidental Node listen default.
 */
export function resolveListenHost(configuredHost = process.env.UNLEASHD_HOST): string {
  const trimmed = configuredHost?.trim();
  return trimmed || DEFAULT_LISTEN_HOST;
}
