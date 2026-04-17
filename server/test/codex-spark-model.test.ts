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
  fromCodexModelId,
  toCodexModelId,
} from '../../shared/src/index';
import { inferProviderFromModel } from '../src/adapters/jsonl';
import codexProvider from '../src/providers/codex';
import { isModelIdValidForProvider, modelValidationHint } from '../src/providers/model-validation';

// =============================================================================
// Canonical schema: base IDs only. Effort is a separate reasoningEffort field.
// =============================================================================

test('CODEX_MODEL_REGISTRY is three base entries with shared thinking options', () => {
  const names = CODEX_MODEL_REGISTRY.map((entry) => entry.modelName).sort();
  assert.deepEqual(names, ['gpt-5.3-codex-spark', 'gpt-5.4', 'gpt-5.4-mini']);
  for (const entry of CODEX_MODEL_REGISTRY) {
    assert.deepEqual(entry.thinkingOptions, [NO_CODEX_THINKING, 'high', 'medium', 'xhigh']);
  }
});

test('CodexModelSchema accepts only the three base IDs (no composites)', () => {
  assert.equal(CodexModelSchema.safeParse('gpt-5.4').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.4-mini').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark').success, true);
  assert.equal(CodexModelSchema.safeParse('gpt-5.4-high').success, false);
  assert.equal(CodexModelSchema.safeParse('gpt-5.3-codex-spark-xhigh').success, false);
});

test('ModelIdSchema accepts base codex IDs and rejects legacy composites', () => {
  for (const id of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    assert.equal(ModelIdSchema.safeParse(id).success, true, `${id} should be valid`);
  }
  for (const id of ['gpt-5.4-high', 'gpt-5.3-codex-spark-xhigh']) {
    assert.equal(ModelIdSchema.safeParse(id).success, false, `${id} should be rejected`);
  }
});

test('NewConversationMessage canonical codex shape: base model + separate reasoningEffort', () => {
  for (const model of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    for (const reasoningEffort of ['medium', 'high', 'xhigh'] as const) {
      const result = NewConversationMessageSchema.safeParse({
        type: 'new_conversation',
        provider: 'codex',
        model,
        reasoningEffort,
      });
      assert.equal(result.success, true, `${model}+${reasoningEffort} should be accepted`);
    }
  }
});

test('SetModelMessage accepts base codex IDs only', () => {
  for (const model of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    const result = SetModelMessageSchema.safeParse({
      type: 'set_model',
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      model,
    });
    assert.equal(result.success, true, `${model} should be accepted`);
  }
});

// =============================================================================
// Server-side provider/model validation
// =============================================================================

test('isModelIdValidForProvider accepts base IDs for codex, rejects composites', () => {
  for (const id of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    assert.equal(isModelIdValidForProvider('codex', id), true, `codex should accept ${id}`);
  }
  assert.equal(isModelIdValidForProvider('codex', 'gpt-5.4-high'), false);
});

test('isModelIdValidForProvider rejects codex IDs for other providers', () => {
  assert.equal(isModelIdValidForProvider('claude', 'gpt-5.3-codex-spark'), false);
  assert.equal(isModelIdValidForProvider('opencode', 'gpt-5.4'), false);
});

test('modelValidationHint for codex mentions gpt-5.4 and spark', () => {
  const hint = modelValidationHint('codex');
  assert.ok(hint.includes('gpt-5.4'), `Hint should mention gpt-5.4: ${hint}`);
  assert.ok(hint.includes('spark'), `Hint should mention spark: ${hint}`);
});

// =============================================================================
// Canonical command build: agent-cli owns composition.
// Caller passes {model: base, reasoning: effort}; agent-cli emits
//   -m <base> -c model_reasoning_effort=<effort>
// =============================================================================

test('buildCommand: base model + reasoning composes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.4',
    reasoning: 'high',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.4');
  assert.ok(spec.argv.includes('-c'));
  assert.ok(spec.argv.includes('model_reasoning_effort=high'));
});

test('buildCommand: base model without reasoning emits no effort flag', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.4',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.4');
  assert.ok(!spec.argv.includes('-c'));
});

test('buildCommand: spark + reasoning composes correctly', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark',
    reasoning: 'xhigh',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.3-codex-spark');
  assert.ok(spec.argv.includes('model_reasoning_effort=xhigh'));
});

test('buildCommand: legacy composite still decomposes via agent-cli decomposeModel', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.4-high',
    prompt: 'hello',
  });
  const mIdx = spec.argv.indexOf('-m');
  assert.equal(spec.argv[mIdx + 1], 'gpt-5.4');
  assert.ok(spec.argv.includes('model_reasoning_effort=high'));
});

// =============================================================================
// listModels returns base IDs only (effort is a separate UI control)
// =============================================================================

test('listModels returns exactly the three base IDs', () => {
  const models = codexProvider.listModels();
  const ids = models.map((m) => m.id).sort();
  assert.deepEqual(ids, ['gpt-5.3-codex-spark', 'gpt-5.4', 'gpt-5.4-mini']);
});

test('listModels has exactly one default and it matches DEFAULT_CODEX_MODEL_ID', () => {
  const models = codexProvider.listModels();
  const defaults = models.filter((m) => m.isDefault);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, DEFAULT_CODEX_MODEL_ID);
});

// =============================================================================
// Migration helpers: fromCodexModelId / toCodexModelId round-trip
// =============================================================================

test('fromCodexModelId decomposes legacy composites', () => {
  assert.deepEqual(fromCodexModelId('gpt-5.4-high'), { baseModel: 'gpt-5.4', effort: 'high' });
  assert.deepEqual(fromCodexModelId('gpt-5.4-xhigh'), { baseModel: 'gpt-5.4', effort: 'xhigh' });
  assert.deepEqual(fromCodexModelId('gpt-5.3-codex-spark-medium'), {
    baseModel: 'gpt-5.3-codex-spark',
    effort: 'medium',
  });
});

test('fromCodexModelId returns base as-is when no effort suffix present', () => {
  assert.deepEqual(fromCodexModelId('gpt-5.4'), { baseModel: 'gpt-5.4', effort: null });
  assert.deepEqual(fromCodexModelId('gpt-5.3-codex-spark'), {
    baseModel: 'gpt-5.3-codex-spark',
    effort: null,
  });
});

test('to/fromCodexModelId round-trips through composite strings', () => {
  for (const base of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    for (const effort of ['medium', 'high', 'xhigh'] as const) {
      const composite = toCodexModelId(base, effort);
      const decomposed = fromCodexModelId(composite);
      assert.equal(decomposed.baseModel, base);
      assert.equal(decomposed.effort, effort);
    }
  }
});

// =============================================================================
// Resume wiring + required codex safety flags (unchanged by refactor)
// =============================================================================

test('buildCommand: resume uses exec resume <sessionId>', () => {
  const spec = buildCommand('codex', {
    model: 'gpt-5.3-codex-spark',
    reasoning: 'high',
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
    model: 'gpt-5.4',
    prompt: 'hello',
  });
  assert.ok(spec.argv.includes('--skip-git-repo-check'));
});

// =============================================================================
// Oompa: inferProviderFromModel identifies base codex IDs as codex
// =============================================================================

test('inferProviderFromModel maps base codex IDs to codex', () => {
  for (const model of ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex-spark']) {
    assert.equal(inferProviderFromModel(model), 'codex', `${model} should infer codex`);
  }
});
