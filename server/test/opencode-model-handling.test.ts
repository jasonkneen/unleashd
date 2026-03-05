import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommand } from '@nbardy/agent-cli';
import {
  ModelIdSchema,
  NewConversationMessageSchema,
  SetModelMessageSchema,
} from '../../shared/src/index';
import { isModelIdValidForProvider } from '../src/providers/model-validation';
import opencodeProvider from '../src/providers/opencode';

const conversationId = '550e8400-e29b-41d4-a716-446655440000';

test('shared model schemas accept practical OpenCode ids', () => {
  assert.equal(ModelIdSchema.safeParse('opencode/big-pickle').success, true);
  assert.equal(
    NewConversationMessageSchema.safeParse({
      type: 'new_conversation',
      provider: 'opencode',
      model: 'opencode/big-pickle',
    }).success,
    true
  );
  assert.equal(
    SetModelMessageSchema.safeParse({
      type: 'set_model',
      conversationId,
      model: 'opencode/big-pickle',
    }).success,
    true
  );
});

test('shared model schema keeps claude/codex ids strict', () => {
  assert.equal(ModelIdSchema.safeParse('opus').success, true);
  assert.equal(ModelIdSchema.safeParse('gpt-4.5').success, true);
  assert.equal(ModelIdSchema.safeParse('gpt-5.3-codex-high').success, true);

  // Missing provider/model separator should still be rejected.
  assert.equal(ModelIdSchema.safeParse('openai').success, false);
  assert.equal(ModelIdSchema.safeParse('gpt-5.3-codex-ultra').success, false);
});

test('server provider/model compatibility validation works per provider', () => {
  assert.equal(isModelIdValidForProvider('claude', 'opus'), true);
  assert.equal(isModelIdValidForProvider('claude', 'opencode/gpt-5'), false);

  assert.equal(isModelIdValidForProvider('codex', 'gpt-4.5'), true);
  assert.equal(isModelIdValidForProvider('codex', 'gpt-5.3-codex-medium'), true);
  assert.equal(isModelIdValidForProvider('codex', 'opencode/gpt-5'), false);

  assert.equal(isModelIdValidForProvider('opencode', 'opencode/gpt-5'), true);
  assert.equal(isModelIdValidForProvider('opencode', 'openai/gpt-5'), true);
  assert.equal(isModelIdValidForProvider('opencode', 'opus'), false);
});

test('OpenCode shared CLI builder normalizes model IDs', () => {
  const legacy = buildCommand('opencode', { model: 'openai/gpt-5', prompt: 'hi' });
  const native = buildCommand('opencode', { model: 'opencode/gpt-5', prompt: 'hi' });
  const custom = buildCommand('opencode', { model: 'opencode/big-pickle', prompt: 'hi' });
  const lmLegacy = legacy.argv[legacy.argv.indexOf('-m') + 1];
  const lmNative = native.argv[native.argv.indexOf('-m') + 1];
  const lmCustom = custom.argv[custom.argv.indexOf('-m') + 1];
  assert.equal(lmLegacy, 'opencode/gpt-5');
  assert.equal(lmNative, 'opencode/gpt-5');
  assert.equal(lmCustom, 'opencode/big-pickle');
});

test('OpenCode listModels remains dropdown-friendly with one default', () => {
  const models = opencodeProvider.listModels();
  const defaults = models.filter((m) => m.isDefault);

  assert.equal(
    models.some((m) => m.id === 'opencode/big-pickle'),
    true
  );
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, 'opencode/big-pickle');
});

test('OpenCode shared CLI builder uses --session + --continue only for valid resume IDs', () => {
  const resumeSpec = buildCommand('opencode', {
    sessionId: 'ses_abc123',
    resume: true,
    model: 'opencode/big-pickle',
    prompt: 'continue',
  });
  assert.ok(resumeSpec.argv.includes('--session'));
  assert.ok(resumeSpec.argv.includes('ses_abc123'));
  assert.ok(resumeSpec.argv.includes('--continue'));

  const freshSpec = buildCommand('opencode', {
    sessionId: 'temporary-client-id',
    resume: true,
    model: 'opencode/big-pickle',
    prompt: 'continue',
  });
  assert.ok(!freshSpec.argv.includes('--session'));
  assert.ok(!freshSpec.argv.includes('--continue'));
});
