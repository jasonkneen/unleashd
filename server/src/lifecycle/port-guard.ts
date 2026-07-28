export interface PortGuardPorts {
  checkPort(port: number): Promise<boolean>;
  askQuestion(prompt: string): Promise<string>;
  killProcessOnPort(port: number): boolean;
  wait(milliseconds: number): Promise<void>;
  exit(code: number): never;
}

export async function ensureAvailablePort(port: number, ports: PortGuardPorts): Promise<void> {
  if (await ports.checkPort(port)) return;

  console.log(`\nPort ${port} is already in use.`);
  const answer = await ports.askQuestion(`Kill the process using port ${port}? [y/N] `);
  if (answer !== 'y' && answer !== 'yes') {
    console.log('\nAlternatives:');
    console.log(
      `  1. Kill manually: lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`
    );
    console.log('  2. Use different port: PORT=3001 pnpm dev:server\n');
    ports.exit(1);
  }

  process.stdout.write('Killing... ');
  if (!ports.killProcessOnPort(port)) ports.exit(1);
  await ports.wait(500);
  if (!(await ports.checkPort(port))) {
    console.error(`\n✗ Port ${port} still in use. Try manually or use a different port.`);
    ports.exit(1);
  }
  console.log('✓ Done\n');
}
