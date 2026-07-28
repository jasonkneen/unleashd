const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const repositoryRoot = path.resolve(__dirname, '..');
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unleashd-package-install-'));
const artifactRoot = path.join(installRoot, 'artifacts');
fs.mkdirSync(artifactRoot, { recursive: true });

const packed = spawnSync('npm', ['pack', '--silent', '--pack-destination', artifactRoot], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
if (packed.status !== 0) {
  throw new Error(`npm pack failed:\n${packed.stdout}\n${packed.stderr}`);
}
const tarballName = packed.stdout.trim().split('\n').at(-1);
if (!tarballName) throw new Error('npm pack did not report a tarball');

fs.writeFileSync(
  path.join(installRoot, 'package.json'),
  JSON.stringify({ name: 'unleashd-package-smoke', private: true }),
  'utf8'
);
const installed = spawnSync(
  'npm',
  [
    'install',
    '--ignore-scripts',
    '--omit=optional',
    '--no-audit',
    '--no-fund',
    path.join(artifactRoot, tarballName),
  ],
  { cwd: installRoot, encoding: 'utf8' }
);
if (installed.status !== 0) {
  throw new Error(`clean npm install failed:\n${installed.stdout}\n${installed.stderr}`);
}

const installedPackageRoot = path.join(installRoot, 'node_modules', 'unleashd');
const installedRequire = createRequire(path.join(installedPackageRoot, 'package.json'));
const shared = installedRequire('@unleashd/shared');
const cli = installedRequire('@nbardy/agent-cli');

if (!shared.ConversationConfigSchema || !cli.executeCommand) {
  throw new Error('Compiled package exports are missing');
}

const tarballPath = path.join(artifactRoot, tarballName);
const tarballSize = fs.statSync(tarballPath).size;
if (tarballSize > 3_000_000) {
  throw new Error(`Packed artifact unexpectedly exceeds 3 MB: ${tarballSize} bytes`);
}
for (const unwantedPath of [
  'shared',
  path.join('node_modules', '@unleashd', 'shared', 'src'),
  path.join('server', 'dist', 'providers', 'model-validation.js'),
  path.join('client', 'dist', 'icons', 'save-prompt.png'),
]) {
  if (fs.existsSync(path.join(installedPackageRoot, unwantedPath))) {
    throw new Error(`Packed artifact contains obsolete or source-only path: ${unwantedPath}`);
  }
}

const appDataRoot = path.join(installRoot, 'app-data');
let output = '';
let finished = false;
let child = null;
let timer = null;

function finish(error) {
  if (finished) return;
  finished = true;
  if (timer) clearTimeout(timer);
  child?.kill('SIGTERM');
  fs.rmSync(installRoot, { recursive: true, force: true });
  if (error) {
    console.error(error);
    process.exitCode = 1;
  } else {
    console.log('Compiled package and plain-node server smoke passed');
  }
}

function requestJson(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: requestPath }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve({
            status: response.statusCode,
            body: body ? JSON.parse(body) : null,
          });
        } catch (error) {
          reject(new Error(`Invalid JSON from ${requestPath}: ${body}`, { cause: error }));
        }
      });
    });
    request.on('error', reject);
  });
}

async function verifyInstalledServer(port) {
  const catalog = await requestJson(port, '/api/provider-catalog');
  if (
    catalog.status !== 200 ||
    typeof catalog.body?.revision !== 'string' ||
    !Array.isArray(catalog.body?.providers)
  ) {
    throw new Error(`Packed provider catalog is invalid: ${JSON.stringify(catalog)}`);
  }

  const buddies = await requestJson(port, '/api/buddies');
  if (
    buddies.status !== 503 ||
    !String(buddies.body?.error).includes('Buddies integration is unavailable')
  ) {
    throw new Error(
      `Missing optional Buddies package did not return 503: ${JSON.stringify(buddies)}`
    );
  }
}

function startInstalledServer(port) {
  child = spawn(process.execPath, ['server/dist/server.js'], {
    cwd: installedPackageRoot,
    env: {
      ...process.env,
      HOME: appDataRoot,
      UNLEASHD_DATA_DIR: appDataRoot,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  timer = setTimeout(
    () => finish(new Error(`Compiled server startup timed out:\n${output}`)),
    10_000
  );

  let verifying = false;
  child.stdout.on('data', (chunk) => {
    output += chunk;
    if (!verifying && output.includes('Server running')) {
      verifying = true;
      void verifyInstalledServer(port).then(() => finish(), finish);
    }
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  child.on('exit', (code) => {
    if (!finished) finish(new Error(`Compiled server exited with ${code}:\n${output}`));
  });
}

const portProbe = net.createServer();
portProbe.on('error', finish);
portProbe.listen(0, '127.0.0.1', () => {
  const address = portProbe.address();
  if (!address || typeof address === 'string') {
    finish(new Error('Could not allocate a test port'));
    return;
  }
  portProbe.close(() => startInstalledServer(address.port));
});
