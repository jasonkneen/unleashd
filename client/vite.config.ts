import { exec, execSync } from 'node:child_process';
import net from 'node:net';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { type ViteDevServer, defineConfig } from 'vite';

const DEV_CLIENT_PORT = 7489;
const API_SERVER_PORT = 7499;
const LOCAL_DOMAIN = 'unleashd.localhost';
const LOCAL_HTTP_PORT = 80;
const SETUP_SCRIPT = fileURLToPath(new URL('../tools/setup-domain.sh', import.meta.url));

function openInBrowser(url: string) {
  const startCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  exec(`${startCmd} ${url}`);
}

function canReachBareLocalDomain(callback: (useBareDomain: boolean) => void) {
  const socket = net.connect({ host: '127.0.0.1', port: LOCAL_HTTP_PORT });
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

function ensureBareLocalDomain(callback: (startUrl: string) => void) {
  const fallbackUrl = `http://localhost:${DEV_CLIENT_PORT}`;
  const bareUrl = `http://${LOCAL_DOMAIN}`;

  const finish = (useBareDomain: boolean) => {
    callback(useBareDomain ? bareUrl : fallbackUrl);
  };

  canReachBareLocalDomain((useBareDomain) => {
    if (useBareDomain) {
      finish(true);
      return;
    }

    if (process.platform !== 'darwin' || !process.stdin.isTTY || !process.stdout.isTTY) {
      finish(false);
      return;
    }

    try {
      execSync(`sudo bash ${JSON.stringify(SETUP_SCRIPT)}`, { stdio: 'inherit' });
    } catch {
      finish(false);
      return;
    }

    canReachBareLocalDomain(finish);
  });
}

function openPreferredDevUrlPlugin() {
  return {
    name: 'open-preferred-dev-url',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        ensureBareLocalDomain((startUrl) => {
          openInBrowser(startUrl);
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), openPreferredDevUrlPlugin()],
  server: {
    host: true,
    port: DEV_CLIENT_PORT,
    open: false,
    allowedHosts: [LOCAL_DOMAIN],
    proxy: {
      '/ws': {
        target: `ws://localhost:${API_SERVER_PORT}`,
        ws: true,
        // Suppress EPIPE/ECONNRESET noise during backend restarts.
        // Vite reconnects automatically — these errors are expected and transient.
        configure: (proxy) => {
          const silence = (err: NodeJS.ErrnoException) => {
            if (err.code === 'EPIPE' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')
              return;
            console.error('[ws proxy]', err.message);
          };
          proxy.on('error', silence);
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', silence);
          });
        },
      },
      '/api': {
        target: `http://localhost:${API_SERVER_PORT}`,
      },
    },
  },
});
