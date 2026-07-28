import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'unleashd-buddy-ui-'));
const output = path.join(temporaryDirectory, 'buddy-ui.test.mjs');

try {
  await build({
    entryPoints: [path.resolve('test/buddy-ui.test.ts')],
    outfile: output,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: 'inline',
  });
  const result = spawnSync(process.execPath, ['--test', output], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
