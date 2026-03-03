import assert from 'node:assert/strict';
import test from 'node:test';
import { formatToolUse, isCompletionOnlyToolUse } from '../src/adapters/tool-format';

test('formatToolUse normalizes codex shell oompa launch with env prefix', () => {
  const line = formatToolUse('shell', {
    command: 'env -u CLAUDECODE -u CLAUDECODE_SESSION_ID oompa swarm oompa/oompa.spark4.json',
  });
  assert.ok(line.startsWith('⚡ shell '), `Unexpected shell prefix: ${line}`);
  assert.ok(line.includes('oompa swarm'), `Expected canonical oompa swarm marker: ${line}`);
});

test('formatToolUse detects oompa launch through bash -c wrapper', () => {
  const line = formatToolUse('run_shell_command', {
    command: `bash -lc 'env FOO=1 oompa run oompa/oompa.spark4.json'`,
  });
  assert.ok(line.includes('oompa run'), `Expected oompa run marker: ${line}`);
});

test('formatToolUse detects oompa launch across command chains and paths', () => {
  const cases = [
    `echo pre && env FOO=bar oompa swarm oompa/oompa.spark4.json`,
    `/usr/local/bin/oompa run oompa/oompa.spark4.json; echo done`,
    `sh -c "env -u A -u B /opt/bin/oompa swarm oompa/oompa.spark4.json"`,
  ];

  for (const command of cases) {
    const line = formatToolUse('shell', { command });
    assert.ok(
      line.includes('oompa run') || line.includes('oompa swarm'),
      `Expected oompa marker for command: ${command}\nGot: ${line}`
    );
  }
});

test('formatToolUse does not mark non-launch oompa commands as launch', () => {
  const line = formatToolUse('shell', { command: 'oompa status' });
  assert.ok(!line.includes('oompa run ::'), `Should not classify as oompa run launch: ${line}`);
  assert.ok(
    !line.includes('oompa swarm ::'),
    `Should not classify as oompa swarm launch: ${line}`
  );
});

test('formatToolUse does not mark oompa dry-run or help commands as launch', () => {
  const dryRunLine = formatToolUse('shell', {
    command: 'oompa run --dry-run --config oompa/oompa.spark4.json',
  });
  assert.ok(
    !dryRunLine.includes('oompa run ::'),
    `Should not classify oompa dry-run as launch: ${dryRunLine}`
  );

  const helpLine = formatToolUse('shell', {
    command: 'oompa swarm --help',
  });
  assert.ok(
    !helpLine.includes('oompa swarm ::'),
    `Should not classify oompa help as launch: ${helpLine}`
  );
});

test('formatToolUse falls back to displayText command for shell tools', () => {
  const line = formatToolUse('shell', {}, 'env -u CLAUDECODE oompa run oompa/oompa.spark4.json');
  assert.ok(line.includes('oompa run'), `Expected oompa run marker from displayText: ${line}`);
});

test('isCompletionOnlyToolUse suppresses codex completion-only shell events', () => {
  assert.equal(
    isCompletionOnlyToolUse('shell', { command: 'ls -la', exit_code: 0 }, undefined),
    true
  );
  assert.equal(isCompletionOnlyToolUse('shell', { exit_code: 0 }, 'ls -la'), false);
  assert.equal(isCompletionOnlyToolUse('Bash', { exit_code: 0 }, undefined), false);
});
