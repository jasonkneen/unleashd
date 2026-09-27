import assert from 'node:assert/strict';
import test from 'node:test';
import { toolContentPart } from '@unleashd/shared';
import { isCompletionOnlyToolUse } from '../src/turns/tool-format';

test('shell launches normalize to a typed swarm part through wrappers and chains', () => {
  for (const command of [
    'env -u CLAUDECODE oompa swarm oompa/oompa.spark4.json',
    `bash -lc 'env FOO=1 oompa run oompa/oompa.spark4.json'`,
    'echo pre && env FOO=bar oompa swarm oompa/oompa.spark4.json',
    '/usr/local/bin/oompa run oompa/oompa.spark4.json; echo done',
    `sh -c "env -u A -u B /opt/bin/oompa swarm oompa/oompa.spark4.json"`,
  ]) {
    assert.deepEqual(toolContentPart('shell', { command }), { t: 'swarm_launch', command });
  }
});

test('status, dry-run and help commands remain ordinary tool calls', () => {
  for (const command of [
    'oompa status',
    'oompa run --dry-run --config oompa/oompa.spark4.json',
    'oompa swarm --help',
  ]) {
    assert.equal(toolContentPart('shell', { command }).t, 'tool');
  }
});

test('tool classification can use a shell displayText command', () => {
  assert.equal(toolContentPart('shell', {}, 'env -u CLAUDECODE oompa run oompa/oompa.spark4.json').t, 'swarm_launch');
});

test('Codex completion-only shell events are suppressed', () => {
  assert.equal(isCompletionOnlyToolUse('shell', { command: 'ls -la', exit_code: 0 }, undefined), true);
  assert.equal(isCompletionOnlyToolUse('shell', { exit_code: 0 }, 'ls -la'), false);
  assert.equal(isCompletionOnlyToolUse('Bash', { exit_code: 0 }, undefined), false);
});
