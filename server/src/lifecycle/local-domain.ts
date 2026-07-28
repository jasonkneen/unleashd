import { execSync } from 'node:child_process';
import net from 'node:net';

export interface LocalDomainOptions {
  domain: string;
  setupScript: string;
  routingPort?: number;
}

function canReachLocalRouter(port: number, callback: (reachable: boolean) => void): void {
  const socket = net.connect({ host: '127.0.0.1', port });
  const finish = (result: boolean) => {
    socket.removeAllListeners();
    socket.destroy();
    callback(result);
  };
  socket.setTimeout(250);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
}

export function ensureLocalDomain(
  options: LocalDomainOptions,
  callback: (useDomain: boolean) => void
): void {
  const routingPort = options.routingPort ?? 80;
  canReachLocalRouter(routingPort, (reachable) => {
    if (reachable) {
      console.log(
        `[unleashd] Local port-${routingPort} routing active for http://${options.domain}`
      );
      callback(true);
      return;
    }
    if (process.platform !== 'darwin' || !process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(
        '[unleashd] Skipping automatic local domain setup: requires macOS + interactive TTY'
      );
      callback(false);
      return;
    }
    try {
      console.log('[unleashd] Attempting automatic local domain setup...');
      execSync(`sudo bash ${JSON.stringify(options.setupScript)}`, { stdio: 'inherit' });
    } catch {
      console.log('[unleashd] Automatic local domain setup failed or was cancelled');
      callback(false);
      return;
    }
    console.log('[unleashd] Re-checking local domain after setup');
    canReachLocalRouter(routingPort, callback);
  });
}
