import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { type ViteDevServer, createLogger, defineConfig } from 'vite';

const DEV_CLIENT_PORT = 7489;
const API_SERVER_PORT = 7499;
const LOCAL_DOMAIN = 'unleashd.localhost';
const LOCAL_DEV_URL =
  process.env.UNLEASHD_LOCAL_DOMAIN_ENABLED === '1'
    ? `http://${LOCAL_DOMAIN}`
    : `http://localhost:${DEV_CLIENT_PORT}`;
const viteLogger = createLogger();
const logViteError = viteLogger.error.bind(viteLogger);
const logViteInfo = viteLogger.info.bind(viteLogger);
let lastHmrMessage = '';
let lastHmrAt = 0;
const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const sharedSourceEntry = path.resolve(clientRoot, '../shared/src/index.ts');

viteLogger.error = (message, options) => {
  const transientWebSocketRestart =
    message.includes('ws proxy') &&
    (message.includes('EPIPE') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED'));
  const transientHttpRestart =
    message.includes('http proxy error:') &&
    (message.includes('EPIPE') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED'));
  if (transientWebSocketRestart || transientHttpRestart) return;
  logViteError(message, options);
};

viteLogger.info = (message, options) => {
  if (message.includes('hmr update')) {
    const now = Date.now();
    if (message === lastHmrMessage && now - lastHmrAt < 1_000) return;
    lastHmrMessage = message;
    lastHmrAt = now;
  }
  logViteInfo(message, options);
};

function logUnexpectedProxyError(scope: string, error: NodeJS.ErrnoException) {
  if (error.code === 'EPIPE' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
    return;
  }
  console.error(`[${scope} proxy]`, error.message);
}

function openInBrowser(url: string) {
  const startCmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${startCmd} ${url}`);
}

function openPreferredDevUrlPlugin() {
  return {
    name: 'open-preferred-dev-url',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        console.log(`[unleashd] Opening ${LOCAL_DEV_URL}`);
        openInBrowser(LOCAL_DEV_URL);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  customLogger: viteLogger,
  plugins: [react(), openPreferredDevUrlPlugin()],
  // The shared package's ESM and CJS watch builds update dist file-by-file.
  // Reading that mutable output from Vite creates a window where index.js is
  // absent or inconsistent with its leaf modules. The browser build can
  // consume the canonical TypeScript entry directly and let Vite own HMR.
  resolve: {
    alias: {
      '@unleashd/shared': sharedSourceEntry,
    },
  },
  server: {
    host: true,
    port: DEV_CLIENT_PORT,
    open: false,
    allowedHosts: [LOCAL_DOMAIN],
    proxy: {
      '/ws': {
        target: `ws://127.0.0.1:${API_SERVER_PORT}`,
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
        target: `http://127.0.0.1:${API_SERVER_PORT}`,
        configure: (proxy) => {
          proxy.on('error', (error) => logUnexpectedProxyError('http', error));
        },
      },
    },
  },
});
