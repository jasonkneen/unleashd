import { execSync } from 'node:child_process';
import net from 'node:net';
import readline from 'node:readline';

export function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port);
  });
}

export function askQuestion(question: string): Promise<string> {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    prompt.question(question, (answer) => {
      prompt.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export function killProcessOnPort(port: number): boolean {
  try {
    const command = `lsof -i :${port} | grep LISTEN | awk '{print $2}'`;
    const pid = execSync(command, { stdio: 'pipe' }).toString().trim();
    if (!pid) {
      process.stdout.write('port already free\n');
      return true;
    }
    execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
    process.stdout.write(`killed PID ${pid}\n`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to kill process on port ${port}:`, (error as Error).message);
    return false;
  }
}
