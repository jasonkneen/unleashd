import { exec } from 'node:child_process';
import type { Server } from 'node:http';
import { ensureAvailablePort } from './port-guard';
import { askQuestion, checkPort, killProcessOnPort } from './system-ports';

export interface StartupOptions {
  port: number;
  host: string;
  development: boolean;
  developmentClientPort: number;
  localDomain: string;
}

export interface StartupPorts {
  server: Server;
  initialize(): Promise<void>;
  startOptionalScheduler(): Promise<void>;
  ensureLocalDomain(callback: (enabled: boolean) => void): void;
  markReady(): void;
  loadConversations(): Promise<void>;
  startPolling(): void;
}

export async function runServerStartup(
  options: StartupOptions,
  ports: StartupPorts
): Promise<void> {
  await ports.initialize();
  await ports.startOptionalScheduler();
  await ensureAvailablePort(options.port, {
    checkPort,
    askQuestion,
    killProcessOnPort,
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    exit: (code) => process.exit(code),
  });

  ports.server.listen(options.port, options.host, () => {
    const domainUrl = `http://${options.localDomain}`;
    const fallbackUrl = options.development
      ? `http://localhost:${options.developmentClientPort}`
      : `http://localhost:${options.port}`;
    ports.ensureLocalDomain((useDomain) => {
      const startUrl = useDomain ? domainUrl : fallbackUrl;
      if (options.development) {
        console.log(`Server running on http://localhost:${options.port} (frontend on ${startUrl})`);
        return;
      }
      console.log(`Server running on ${startUrl} (backend on ${options.host}:${options.port})`);
      const command =
        process.platform === 'darwin'
          ? 'open'
          : process.platform === 'win32'
            ? 'start'
            : 'xdg-open';
      exec(`${command} ${startUrl}`);
    });
  });

  ports.markReady();
  console.log('WebSocket handlers unblocked, loading conversations progressively...');
  await ports.loadConversations();
  console.log('Initial load complete');
  ports.startPolling();
  console.log('File polling started (5s interval)');
}
