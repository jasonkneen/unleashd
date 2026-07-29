import assert from 'node:assert/strict';
import test from 'node:test';
import { detectLocalDomain, isLocalDomainInstalled } from './local-domain.mjs';

test('installation detection requires the host mapping, helper, and running launchd service', () => {
  const readFile = (filename) => {
    if (filename === '/etc/hosts') return '127.0.0.1 unleashd.localhost\n';
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  };
  const options = {
    platform: 'darwin',
    readFile,
    fileExists: () => true,
    run: () => ({ status: 0 }),
  };
  assert.equal(isLocalDomainInstalled(options), true);
  assert.equal(isLocalDomainInstalled({ ...options, platform: 'linux' }), false);
  assert.equal(isLocalDomainInstalled({ ...options, fileExists: () => false }), false);
  assert.equal(isLocalDomainInstalled({ ...options, run: () => ({ status: 1 }) }), false);
});

test('dev startup only detects the external service and reports its selected URL', () => {
  let text = '';
  const output = {
    write(value) {
      text += value;
    },
  };
  assert.equal(detectLocalDomain({ task: 'build', output, installed: () => true }), false);
  assert.equal(text, '');
  assert.equal(detectLocalDomain({ task: 'dev', output, installed: () => true }), true);
  assert.match(text, /unleashd\.localhost/);
  text = '';
  assert.equal(detectLocalDomain({ task: 'dev-client', output, installed: () => false }), false);
  assert.match(text, /local-domain:setup/);
});
