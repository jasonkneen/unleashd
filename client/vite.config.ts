import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
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
        target: 'http://localhost:3000',
      },
    },
  },
});
