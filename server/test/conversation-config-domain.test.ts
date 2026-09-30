import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type ConversationConfig,
  ProviderCatalogSchema,
  applyConversationConfigPatch,
  resolveConversationConfig,
} from '../../shared/src/index';
import {
  createProviderCatalog,
  resolveConfigAgainstProviderCatalog,
} from '../src/providers/catalog-service';

const catalog = ProviderCatalogSchema.parse({
  revision: 'catalog-1',
  providers: [
    {
      id: 'claude',
      displayName: 'Claude',
      shortName: 'C',
      defaultModelId: 'opus',
      models: [
        {
          id: 'opus',
          displayName: 'Opus',
          reasoning: { levels: ['low', 'high'], defaultEffort: 'high' },
        },
      ],
    },
    {
      id: 'codex',
      displayName: 'Codex',
      shortName: 'X',
      defaultModelId: 'gpt-5.6-sol',
      models: [
        {
          id: 'gpt-5.6-sol',
          displayName: 'GPT-5.6 Sol',
          reasoning: {
            levels: ['low', 'xhigh', 'ultra'],
            defaultEffort: 'ultra',
          },
        },
        {
          id: 'gpt-5.6-terra',
          displayName: 'GPT-5.6 Terra',
          reasoning: {
            levels: ['low', 'xhigh'],
            defaultEffort: 'xhigh',
          },
        },
      ],
    },
  ],
});

function config(overrides: Partial<ConversationConfig> = {}): ConversationConfig {
  return {
    provider: 'codex',
    model: { mode: 'default' },
    reasoning: { mode: 'default' },
    ...overrides,
  };
}

test('application defaults retain the refreshed picker while explicit reasoning passes through', () => {
  const defaults = resolveConfigAgainstProviderCatalog(config());
  assert.equal(defaults.status, 'resolved');
  if (defaults.status === 'resolved') {
    // The model is whatever the served catalog defaults to; the effort is product policy.
    // 1444cdd once rewrote this pair to the data's literals ('gpt-6.1-sol', 'low').
    assert.equal(
      defaults.value.modelId,
      createProviderCatalog().providers.find((provider) => provider.id === 'codex')?.defaultModelId
    );
    assert.equal(defaults.value.reasoningEffort, 'medium');
  }
  const explicit = resolveConfigAgainstProviderCatalog(
    config({ reasoning: { mode: 'explicit', effort: 'ultra' } })
  );
  assert.equal(explicit.status, 'resolved');
  if (explicit.status === 'resolved') assert.equal(explicit.value.reasoningEffort, 'ultra');
});

// Regression guard (2026-09-30): gpt-6.1-sol was added with codex's own default_reasoning_level
// (`low`) and the only test pinning the default was edited to match. Medium is our policy for EVERY
// reasoning model, and an omitted default would silently hand the choice to the CLI, so assert it
// over the whole served catalog rather than one literal.
test('every reasoning model in the served catalog defaults to medium effort', () => {
  for (const provider of createProviderCatalog().providers) {
    for (const model of provider.models) {
      if (model.reasoning)
        assert.equal(model.reasoning.defaultEffort, 'medium', `${provider.id}/${model.id}`);
    }
  }
});

test('provider catalog enforces relational invariants', () => {
  for (const invalid of [
    {
      revision: 'x',
      providers: [
        {
          id: 'codex',
          displayName: 'Codex',
          shortName: 'X',
          defaultModelId: 'missing',
          models: [],
        },
      ],
    },
    {
      revision: 'x',
      providers: [
        {
          id: 'codex',
          displayName: 'Codex',
          shortName: 'X',
          defaultModelId: 'sol',
          models: [
            { id: 'sol', displayName: 'Sol' },
            { id: 'sol', displayName: 'Duplicate' },
          ],
        },
      ],
    },
    {
      revision: 'x',
      providers: [
        {
          id: 'codex',
          displayName: 'Codex',
          shortName: 'X',
          defaultModelId: 'sol',
          models: [
            {
              id: 'sol',
              displayName: 'Sol',
              reasoning: { levels: ['low'], defaultEffort: 'ultra' },
            },
          ],
        },
      ],
    },
  ]) {
    assert.equal(ProviderCatalogSchema.safeParse(invalid).success, false);
  }
});

test('default model and reasoning resolve together at the execution boundary', () => {
  assert.deepEqual(resolveConversationConfig(config(), catalog), {
    status: 'resolved',
    catalogRevision: 'catalog-1',
    value: {
      provider: 'codex',
      modelId: 'gpt-5.6-sol',
      reasoningEffort: 'ultra',
    },
  });

  assert.deepEqual(
    resolveConversationConfig(
      config({ model: { mode: 'explicit', modelId: 'gpt-5.6-terra' } }),
      catalog
    ),
    {
      status: 'resolved',
      catalogRevision: 'catalog-1',
      value: {
        provider: 'codex',
        modelId: 'gpt-5.6-terra',
        reasoningEffort: 'xhigh',
      },
    }
  );
});

test('disabled reasoning omits the CLI flag and explicit values pass through unchanged', () => {
  const disabled = resolveConversationConfig(config({ reasoning: { mode: 'disabled' } }), catalog);
  assert.equal(disabled.status, 'resolved');
  if (disabled.status === 'resolved') {
    assert.equal('reasoningEffort' in disabled.value, false);
  }

  const explicit = resolveConversationConfig(
    config({ reasoning: { mode: 'explicit', effort: 'xhigh' } }),
    catalog
  );
  assert.equal(explicit.status, 'resolved');
  if (explicit.status === 'resolved') {
    assert.equal(explicit.value.reasoningEffort, 'xhigh');
  }
});

test('unavailable explicit selections are retained and return structured errors', () => {
  const previous = {
    provider: 'codex' as const,
    modelId: 'retired-model',
    reasoningEffort: 'high',
  };
  const resolution = resolveConversationConfig(
    config({ model: { mode: 'explicit', modelId: 'retired-model' } }),
    catalog,
    previous
  );
  assert.equal(resolution.status, 'unavailable');
  if (resolution.status === 'unavailable') {
    assert.equal(resolution.error.code, 'model_unavailable');
    assert.deepEqual(resolution.lastResolved, previous);
  }
});

test('invalid explicit reasoning for a new model rejects the whole transition', () => {
  // The production path: config-service applies the patch, then resolves the candidate.
  const current = config({ reasoning: { mode: 'explicit', effort: 'ultra' } });
  const candidate = applyConversationConfigPatch(current, {
    kind: 'set_model',
    model: { mode: 'explicit', modelId: 'gpt-5.6-terra' },
  });
  const resolution = resolveConversationConfig(candidate, catalog);
  assert.equal(resolution.status, 'unavailable');
  if (resolution.status === 'unavailable') {
    assert.equal(resolution.error.code, 'reasoning_unavailable');
  }
  assert.deepEqual(current.model, { mode: 'default' });
});
