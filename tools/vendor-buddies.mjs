import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.env.BUDDIES_SOURCE_DIR ?? join(repositoryRoot, '..', 'buddies'));
const allowUncommitted = process.argv.includes('--allow-uncommitted');

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`
    );
  }
  return result.stdout.trim();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const packageJson = JSON.parse(readFileSync(join(sourceRoot, 'package.json'), 'utf8'));
if (packageJson.name !== '@nbardy/buddies') {
  throw new Error(
    `Expected @nbardy/buddies source, found ${packageJson.name ?? 'unnamed package'}`
  );
}

const gitStatus = run('git', ['status', '--porcelain'], sourceRoot);
const sourceDirty = gitStatus.length > 0;
const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], {
  cwd: sourceRoot,
  encoding: 'utf8',
});
const sourceCommit = commitResult.status === 0 ? commitResult.stdout.trim() : null;

if ((!sourceCommit || sourceDirty) && !allowUncommitted) {
  throw new Error(
    'Buddies source must have a clean commit before release packaging. ' +
      'Use --allow-uncommitted only for an explicitly non-release local snapshot.'
  );
}

const firstPackRoot = mkdtempSync(join(tmpdir(), 'unleashd-buddies-pack-a-'));
const secondPackRoot = mkdtempSync(join(tmpdir(), 'unleashd-buddies-pack-b-'));

try {
  const firstName = run(
    'npm',
    ['pack', '--silent', '--pack-destination', firstPackRoot],
    sourceRoot
  )
    .split('\n')
    .at(-1);
  const secondName = run(
    'npm',
    ['pack', '--silent', '--pack-destination', secondPackRoot],
    sourceRoot
  )
    .split('\n')
    .at(-1);
  if (!firstName || !secondName || firstName !== secondName) {
    throw new Error('npm pack did not produce one stable archive name');
  }

  const firstArchive = join(firstPackRoot, firstName);
  const secondArchive = join(secondPackRoot, secondName);
  const firstHash = sha256(firstArchive);
  const secondHash = sha256(secondArchive);
  if (firstHash !== secondHash) {
    throw new Error(`Buddies package is not reproducible: ${firstHash} != ${secondHash}`);
  }

  const destination = join(repositoryRoot, 'vendor', firstName);
  copyFileSync(firstArchive, destination);
  const provenancePath = join(
    repositoryRoot,
    'vendor',
    `${basename(firstName, '.tgz')}.provenance.json`
  );
  writeFileSync(
    provenancePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        package: packageJson.name,
        version: packageJson.version,
        archive: `vendor/${firstName}`,
        sha256: firstHash,
        reproduciblePack: true,
        sourceCommit,
        sourceDirty,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        archive: destination,
        sha256: firstHash,
        sourceCommit,
        sourceDirty,
        releaseReady: Boolean(sourceCommit) && !sourceDirty,
      },
      null,
      2
    )
  );
} finally {
  rmSync(firstPackRoot, { recursive: true, force: true });
  rmSync(secondPackRoot, { recursive: true, force: true });
}
