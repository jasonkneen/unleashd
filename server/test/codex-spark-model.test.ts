import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommand } from '@nbardy/agent-cli';
import {
  CodexModelSchema,
  ModelIdSchema,
  NewConversationMessageSchema,
  SetModelMessageSchema,
} from '../../shared/src/index';
import { inferProviderFromModel } from '../src/adapters/jsonl';
import codexProvider from '../src/providers/codex';
import { isModelIdValidForProvider, modelValidationHint } from '../src/providers/model-validation';

// =============================================================================
// Schema validation: spark base + effort variants accepted
// =============================================================================

test('CodexModelSchema accepts spark base and effort variants', () => {
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-high').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-medium').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-xhigh').success, true);
});

test('ModelIdSchema accepts all spark variants', () => {
  for (const id of [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
    'gpt-5.3-codex-spark-xhigh',
  ]) {
    assert.equal(ModelIdSchema.safeParse(id).success, true, `${id} should be valid`);
  }
});

test('NewConversationMessage accepts codex provider with spark models', () => {
  for (const model of ['gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-high']) {
    const result = NewConversationMessageSchema.safeParse({
      type: 'new_conversation',
      provider: 'codex',
      model,
    });
    assert.equal(result.success, true, `${model} should be accepted`);
  }
});

test('SetModelMessage accepts spark variants', () => {
  for (const model of ['gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-medium']) {
    const result = SetModelMessageSchema.safeParse({
      type: 'set_model',
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      model,
    });
    assert.equal(result.success, true, `${model} should be accepted`);
  }
});

// =============================================================================
// Model validation: server-side provider/model compatibility
// =============================================================================

test('isModelIdValidForProvider accepts spark variants for codex', () => {
  for (const id of [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
    'gpt-5.3-codex-spark-xhigh',
  ]) {
    assert.equal(isModelIdValidForProvider('codex', id), true, `codex should accept ${id}`);
  }
});

test('isModelIdValidForProvider rejects spark for non-codex providers', () => {
  assert.equal(isModelIdValidForProvider('claude', 'gpt-5.3-codex-spark'), false);
  assert.equal(isModelIdValidForProvider('opencode', 'gpt-5.3-codex-spark'), false);
  assert.equal(isModelIdValidForProvider('claude', 'gpt-5.3-codex-spark-high'), false);
});

test('modelValidationHint for codex mentions spark', () => {
  const hint = modelValidationHint('codex');
  assert.ok(hint.includes('spark'), `Hint should mention spark: ${hint}`);
});

// =============================================================================
// Shared CLI builder: standalone spark vs spark+effort decomposition
//
// "gpt-5.3-codex-spark"       → `-m gpt-5.3-codex-spark` (no effort)
// "gpt-5.3-codex-spark-high"  → `-m gpt-5.3-codex-spark -c reasoning.effort=high`
//
// The effort-suffix logic strips the last segment matching a known effort level,
// leaving "gpt-5.3-codex-spark" as the base model. This works because "spark"
// is NOT a known effort level — only medium/high/xhigh are.
// =============================================================================

test('buildCommand: bare spark passes model directly, no effort', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.3-codex-spark');
  assert.ok(!spec.argv.includes('-c'));
});

test('buildCommand: spark-high decomposes to spark model + high effort', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-high',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.3-codex-spark');
  assert.ok(spec.argv.includes('-c'));
  const cIdx = spec.argv.indexOf('-c');
  assert.equal(spec.argv[cIdx + 1], 'reasoning.effort=high');
});

test('buildCommand: spark-medium decomposes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-medium',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('reasoning.effort=medium'));
});

test('buildCommand: spark-xhigh decomposes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-xhigh',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('reasoning.effort=xhigh'));
});

test('buildCommand: existing codex effort models still decompose correctly', () => {
  const high = buildCommand('codex', { model: 'gpt-5.3-codex-high', prompt: 'hello' });
  const medium = buildCommand('codex', { model: 'gpt-5.3-codex-medium', prompt: 'hello' });
  assert.ok(high.argv.includes('reasoning.effort=high'));
  assert.ok(medium.argv.includes('reasoning.effort=medium'));
});

// =============================================================================
// Provider: listModels includes spark with correct metadata
// =============================================================================

test('listModels includes spark base and effort variants', () => {
  const models = codexProvider.listModels();
  const sparkIds = models.filter((m) => m.id.includes('spark')).map((m) => m.id);
  assert.deepEqual(sparkIds.sort(), [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
    'gpt-5.3-codex-spark-xhigh',
  ]);
});

test('listModels still has exactly one default', () => {
  const models = codexProvider.listModels();
  const defaults = models.filter((m) => m.isDefault);
  assert.equal(defaults.length, 1);
});

test('spark models are not the default', () => {
  const models = codexProvider.listModels();
  for (const m of models.filter((m) => m.id.includes('spark'))) {
    assert.equal(m.isDefault, false, `${m.id} should not be default`);
  }
});

// =============================================================================
// Shared CLI builder: resume wiring and required codex safety flags
// =============================================================================

test('buildCommand: resume uses exec resume <sessionId>', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-high',
    prompt: 'continue',
    sessionId: 'thread-123',
    resume: true,
  });
  assert.equal(spec.argv[0], 'codex');
  assert.equal(spec.argv[1], 'exec');
  assert.equal(spec.argv[2], 'resume');
  assert.equal(spec.argv[3], 'thread-123');
});

test('buildCommand: codex includes --skip-git-repo-check', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('--skip-git-repo-check'));
});

// =============================================================================
// Oompa: inferProviderFromModel identifies spark variants as codex
// =============================================================================

test('inferProviderFromModel: spark variants map to codex', () => {
  for (const model of [
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
  ]) {
    assert.equal(inferProviderFromModel(model), 'codex', `${model} should infer codex`);
  }
});
