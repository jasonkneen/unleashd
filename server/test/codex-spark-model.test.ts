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
// Schema validation: gpt-5.4 + spark base + effort variants accepted
// =============================================================================

test('CODEX_MODEL_REGISTRY splits model names from thinking options', () => {
  const gpt54 = CODEX_MODEL_REGISTRY.find((entry) => entry.modelName === 'gpt-5.4');
  const spark = CODEX_MODEL_REGISTRY.find((entry) => entry.modelName === 'gpt-5.3-codex-spark');

  assert.deepEqual(gpt54?.thinkingOptions, [NO_CODEX_THINKING, 'high', 'medium', 'xhigh']);
  assert.deepEqual(spark?.thinkingOptions, [NO_CODEX_THINKING, 'high', 'medium', 'xhigh']);
});

test('CodexModelSchema accepts gpt-5.4, spark base, and effort variants', () => {
  assert.equal(CodexModelSchema.safeParse('gpt-5.4').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.4-high').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.4-medium').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.4-xhigh').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-high').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-medium').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-xhigh').success, true);
});

test('ModelIdSchema accepts gpt-5.4 and all spark variants', () => {
  for (const id of [
    'gpt-5.4',
    'gpt-5.4-high',
    'gpt-5.4-medium',
    'gpt-5.4-xhigh',
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
    'gpt-5.3-codex-spark-xhigh',
  ]) {
    assert.equal(ModelIdSchema.safeParse(id).success, true, `${id} should be valid`);
  }
});

test('NewConversationMessage accepts codex provider with gpt-5.4 and spark models', () => {
  for (const model of ['gpt-5.4', 'gpt-5.4-high', 'gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-high']) {
    const result = NewConversationMessageSchema.safeParse({
      type: 'new_conversation',
      provider: 'codex',
      model,
    });
    assert.equal(result.success, true, `${model} should be accepted`);
  }
});

test('SetModelMessage accepts gpt-5.4 and spark variants', () => {
  for (const model of ['gpt-5.4-high', 'gpt-5.3-codex-spark', 'gpt-5.3-codex-spark-medium']) {
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

test('isModelIdValidForProvider accepts gpt-5.4 and spark variants for codex', () => {
  for (const id of [
    'gpt-5.4',
    'gpt-5.4-high',
    'gpt-5.4-medium',
    'gpt-5.4-xhigh',
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

test('modelValidationHint for codex mentions gpt-5.4 and spark', () => {
  const hint = modelValidationHint('codex');
  assert.ok(hint.includes('gpt-5.4'), `Hint should mention gpt-5.4: ${hint}`);
  assert.ok(hint.includes('spark'), `Hint should mention spark: ${hint}`);
});

// =============================================================================
// Shared CLI builder: standalone base models vs spark+effort decomposition
//
// "gpt-5.4"                  → `-m gpt-5.4` (no effort)
// "gpt-5.4-high"             → `-m gpt-5.4 -c model_reasoning_effort=high`
// "gpt-5.3-codex-spark"       → `-m gpt-5.3-codex-spark` (no effort)
// "gpt-5.3-codex-spark-high"  → `-m gpt-5.3-codex-spark -c model_reasoning_effort=high`
//
// The effort-suffix logic strips the last segment matching a known effort level,
// leaving "gpt-5.3-codex-spark" as the base model. This works because "spark"
// is NOT a known effort level — only medium/high/xhigh are.
// =============================================================================

test('buildCommand: gpt-5.4 passes model directly, no effort', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.4',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.4');
  assert.ok(!spec.argv.includes('-c'));
});

test('buildCommand: gpt-5.4-high decomposes to base model + high effort', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.4-high',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.4');
  const cIdx = spec.argv.indexOf('-c');
  assert.equal(spec.argv[cIdx + 1], 'model_reasoning_effort=high');
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

// =============================================================================
// Provider: listModels includes gpt-5.4 + spark with correct metadata
// =============================================================================

test('listModels includes gpt-5.4 and spark base/effort variants', () => {
  const models = codexProvider.listModels();
  assert.ok(models.some((m) => m.id === DEFAULT_CODEX_MODEL_ID));
  const gpt54Ids = models.filter((m) => m.id.startsWith('gpt-5.4')).map((m) => m.id);
  assert.deepEqual(gpt54Ids.sort(), ['gpt-5.4', 'gpt-5.4-high', 'gpt-5.4-medium', 'gpt-5.4-xhigh']);
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

test('gpt-5.4-high is the Codex default', () => {
  const models = codexProvider.listModels();
  const defaultModel = models.find((m) => m.id === 'gpt-5.4-high');
  assert.equal(defaultModel?.isDefault, true);
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
// Oompa: inferProviderFromModel identifies gpt-5.4 + spark variants as codex
// =============================================================================

test('inferProviderFromModel: gpt-5.4 and spark variants map to codex', () => {
  for (const model of [
    'gpt-5.4',
    'gpt-5.4-high',
    'gpt-5.3-codex-spark',
    'gpt-5.3-codex-spark-high',
    'gpt-5.3-codex-spark-medium',
  ]) {
    assert.equal(inferProviderFromModel(model), 'codex', `${model} should infer codex`);
  }
});
