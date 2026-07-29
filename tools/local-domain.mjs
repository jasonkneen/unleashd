import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const LOCAL_DOMAIN = 'unleashd.localhost';
export const LOCAL_DOMAIN_ENV = 'UNLEASHD_LOCAL_DOMAIN_ENABLED';

const launchdService = 'system/com.unleashd.local-domain';
const launchdPlist = '/Library/LaunchDaemons/com.unleashd.local-domain.plist';
const installedHelper = '/Library/PrivilegedHelperTools/com.unleashd.local-port-proxy';

/**
 * Local-domain setup is an explicit machine-level operation. Dev startup only
 * detects the installed launchd service and passes one boolean to its children;
 * Vite and the server never probe, elevate, or choose their own fallback.
 */
export function isLocalDomainInstalled({
  platform = process.platform,
  readFile = readFileSync,
  fileExists = existsSync,
  run = spawnSync,
} = {}) {
  if (platform !== 'darwin' || !fileExists(installedHelper) || !fileExists(launchdPlist)) {
    return false;
  }
  try {
    if (!readFile('/etc/hosts', 'utf8').includes(`127.0.0.1 ${LOCAL_DOMAIN}`)) return false;
  } catch {
    return false;
  }
  return run('launchctl', ['print', launchdService], { stdio: 'ignore' }).status === 0;
}

export function detectLocalDomain({
  task,
  output = process.stdout,
  installed = isLocalDomainInstalled,
} = {}) {
  if (!task?.startsWith('dev')) return false;
  if (installed()) {
    output.write(`[unleashd] Using http://${LOCAL_DOMAIN}\n`);
    return true;
  }
  output.write(
    '[unleashd] Using http://localhost:7489 (run "pnpm local-domain:setup" for the local alias)\n'
  );
  return false;
}
