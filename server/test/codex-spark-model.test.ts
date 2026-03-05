import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommand } from '@nbardy/agent-cli';
import {
  CODEX_MODEL_REGISTRY,
  CodexModelSchema,
  DEFAULT_CODEX_MODEL_ID,
  NO_CODEX_THINKING,
  ModelIdSchema,
  NewConversationMessageSchema,
  SetModelMessageSchema,
} from '../../shared/src/index';
import { inferProviderFromModel } from '../src/adapters/jsonl';
import codexProvider from '../src/providers/codex';
import { isModelIdValidForProvider, modelValidationHint } from '../src/providers/model-validation';

// =============================================================================
// Schema validation: gpt-4.5 + spark base + effort variants accepted
// =============================================================================

test('CODEX_MODEL_REGISTRY splits model names from thinking options', () => {
  const gpt45 = CODEX_MODEL_REGISTRY.find((entry) => entry.modelName === 'gpt-4.5');
  const spark = CODEX_MODEL_REGISTRY.find((entry) => entry.modelName === 'gpt-5.3-codex-spark');

  assert.deepEqual(gpt45?.thinkingOptions, [NO_CODEX_THINKING]);
  assert.deepEqual(spark?.thinkingOptions, [NO_CODEX_THINKING, 'high', 'medium', 'xhigh']);
});

test('CodexModelSchema accepts gpt-4.5, spark base, and effort variants', () => {
  assert.equal(CodexModelSchema.safeParse('gpt-4.5').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-high').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-medium').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-xhigh').success, true);
});

test('ModelIdSchema accepts gpt-4.5 and all spark variants', () => {
  for (const id of [
    'gpt-4.5',
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
    'gpt-5.3-codex-spark-xhigh',
  ]) {
    assert.equal(ModelIdSchema.safeParse(id).success, true, `${id} should be valid`);
  }
});

test('NewConversationMessage accepts codex provider with gpt-4.5 and spark models', () => {
  for (const model of ['gpt-4.5', 'gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-high']) {
    const result = NewConversationMessageSchema.safeParse({
      type: 'new_conversation',
      provider: 'codex',
      model,
    });
    assert.equal(result.success, true, `${model} should be accepted`);
  }
});

test('SetModelMessage accepts gpt-4.5 and spark variants', () => {
  for (const model of ['gpt-4.5', 'gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-medium']) {
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

test('isModelIdValidForProvider accepts gpt-4.5 and spark variants for codex', () => {
  for (const id of [
    'gpt-4.5',
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

test('modelValidationHint for codex mentions gpt-4.5 and spark', () => {
  const hint = modelValidationHint('codex');
  assert.ok(hint.includes('gpt-4.5'), `Hint should mention gpt-4.5: ${hint}`);
  assert.ok(hint.includes('spark'), `Hint should mention spark: ${hint}`);
});

// =============================================================================
// Shared CLI builder: standalone base models vs spark+effort decomposition
//
// "gpt-4.5"                  → `-m gpt-4.5` (no effort)
// "gpt-5.3-codex-spark"       → `-m gpt-5.3-codex-spark` (no effort)
// "gpt-5.3-codex-spark-high"  → `-m gpt-5.3-codex-spark -c model_reasoning_effort=high`
//
// The effort-suffix logic strips the last segment matching a known effort level,
// leaving "gpt-5.3-codex-spark" as the base model. This works because "spark"
// is NOT a known effort level — only medium/high/xhigh are.
// =============================================================================

test('buildCommand: gpt-4.5 passes model directly, no effort', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-4.5',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-4.5');
  assert.ok(!spec.argv.includes('-c'));
});

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
  assert.equal(spec.argv[cIdx + 1], 'model_reasoning_effort=high');
});

test('buildCommand: spark-medium decomposes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-medium',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('model_reasoning_effort=medium'));
});

test('buildCommand: spark-xhigh decomposes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark-xhigh',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('model_reasoning_effort=xhigh'));
});

test('buildCommand: existing codex effort models still decompose correctly', () => {
  const high = buildCommand('codex', { model: 'gpt-5.3-codex-high', prompt: 'hello' });
  const medium = buildCommand('codex', { model: 'gpt-5.3-codex-medium', prompt: 'hello' });
  assert.ok(high.argv.includes('model_reasoning_effort=high'));
  assert.ok(medium.argv.includes('model_reasoning_effort=medium'));
});

// =============================================================================
// Provider: listModels includes gpt-4.5 + spark with correct metadata
// =============================================================================

test('listModels includes gpt-4.5 and spark base/effort variants', () => {
  const models = codexProvider.listModels();
  assert.ok(models.some((m) => m.id === DEFAULT_CODEX_MODEL_ID));
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
  assert.equal(defaults[0].id, DEFAULT_CODEX_MODEL_ID);
});

test('gpt-4.5 is the Codex default', () => {
  const models = codexProvider.listModels();
  const gpt45 = models.find((m) => m.id === 'gpt-4.5');
  assert.equal(gpt45?.isDefault, true);
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
// Oompa: inferProviderFromModel identifies gpt-4.5 + spark variants as codex
// =============================================================================

test('inferProviderFromModel: gpt-4.5 and spark variants map to codex', () => {
  for (const model of [
    'gpt-4.5',
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
  ]) {
    assert.equal(inferProviderFromModel(model), 'codex', `${model} should infer codex`);
  }
});
