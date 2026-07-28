import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { isPathWithin } from '../src/http/path-utils';
import { resolveListenHost } from '../src/network';

test('path containment accepts a root and its actual descendants', () => {
  const root = path.resolve('/work/project');
  assert.equal(isPathWithin(root, root), true);
  assert.equal(isPathWithin(root, path.join(root, 'reports', 'result.html')), true);
  assert.equal(
    isPathWithin(`${root}${path.sep}`, path.join(root, 'nested')),
    true,
    'trailing separators do not change the boundary'
  );
});

test('path containment rejects prefix collisions and parent traversal', () => {
  const root = path.resolve('/work/project');
  assert.equal(isPathWithin(root, path.resolve('/work/project-evil/secrets.txt')), false);
  assert.equal(isPathWithin(root, path.resolve(root, '..', 'outside.txt')), false);
  assert.equal(isPathWithin(root, path.resolve('/work')), false);
});

test('path containment can reject the root for child-only storage', () => {
  const root = path.resolve('/data/uploads');
  assert.equal(isPathWithin(root, root, { allowRoot: false }), false);
  assert.equal(isPathWithin(root, path.join(root, 'conversation-id'), { allowRoot: false }), true);
});

test('server binding defaults to loopback and requires an explicit override', () => {
  assert.equal(resolveListenHost(undefined), '127.0.0.1');
  assert.equal(resolveListenHost(''), '127.0.0.1');
  assert.equal(resolveListenHost('  '), '127.0.0.1');
  assert.equal(resolveListenHost('0.0.0.0'), '0.0.0.0');
  assert.equal(resolveListenHost(' 192.168.1.10 '), '192.168.1.10');
});
