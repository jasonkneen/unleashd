import { exec } from 'node:child_process';
import dns from 'node:dns';
import react from '@vitejs/plugin-react';
import { type ViteDevServer, defineConfig } from 'vite';

const DEV_CLIENT_PORT = 7489;
const API_SERVER_PORT = 7499;
const LOCAL_DOMAIN = 'unleash.dev';

function openPreferredDevUrlPlugin() {
  return {
    name: 'open-preferred-dev-url',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => {
        dns.lookup(LOCAL_DOMAIN, (err: NodeJS.ErrnoException | null, address: string) => {
          const useDomain = !err && (address === '127.0.0.1' || address === '::1');
          const startUrl = useDomain
            ? `http://${LOCAL_DOMAIN}:${DEV_CLIENT_PORT}`
            : `http://localhost:${DEV_CLIENT_PORT}`;
          const startCmd =
            process.platform === 'darwin'
              ? 'open'
              : process.platform === 'win32'
                ? 'start'
                : 'xdg-open';
          exec(`${startCmd} ${startUrl}`);
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
