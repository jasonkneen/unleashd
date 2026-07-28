import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ClientMessageSchema,
  CommandRejectedEventSchema,
  type ConversationConfig,
  ConversationCreatedEventSchema,
  ConversationUpdatedEventSchema,
  CreateConversationCommandSchema,
  InitMessageSchema,
  ProviderCatalogSchema,
  SetConversationConfigCommandSchema,
  applyConversationConfigPatch,
  decodeLegacyCodexCompositeModel,
  encodeLegacyCodexCompositeModel,
  resolveConversationConfig,
  transitionConversationConfig,
} from '../../shared/src/index';

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

test('provider transition atomically resets model and reasoning intent', () => {
  const current = config({
    model: { mode: 'explicit', modelId: 'gpt-5.6-terra' },
    reasoning: { mode: 'disabled' },
  });
  assert.deepEqual(
    applyConversationConfigPatch(current, { kind: 'set_provider', provider: 'claude' }),
    {
      provider: 'claude',
      model: { mode: 'default' },
      reasoning: { mode: 'default' },
    }
  );
});

test('invalid explicit reasoning for a new model rejects the whole transition', () => {
  const current = config({ reasoning: { mode: 'explicit', effort: 'ultra' } });
  const result = transitionConversationConfig(
    current,
    { kind: 'set_model', model: { mode: 'explicit', modelId: 'gpt-5.6-terra' } },
    catalog
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'reasoning_unavailable');
  assert.deepEqual(current.model, { mode: 'default' });
});

test('legacy Codex adapter only decomposes a supplied known combination', () => {
  const vocabulary = {
    modelIds: ['gpt-5.6-sol', 'gpt-5.3-codex-spark'],
    effortLevels: ['high', 'ultra'],
  };
  assert.deepEqual(decodeLegacyCodexCompositeModel('gpt-5.6-sol-ultra', vocabulary), {
    baseModel: 'gpt-5.6-sol',
    effort: 'ultra',
  });
  assert.deepEqual(decodeLegacyCodexCompositeModel('gpt-example-ultra', vocabulary), {
    baseModel: 'gpt-example-ultra',
    effort: null,
  });
  assert.equal(encodeLegacyCodexCompositeModel('gpt-5.6-sol', 'ultra'), 'gpt-5.6-sol-ultra');
});

test('v2 command and event schemas preserve correlation and revisions', () => {
  const conversationId = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(
    CreateConversationCommandSchema.safeParse({
      type: 'create_conversation',
      commandId: 'create-1',
      conversationId,
      workingDirectory: '/tmp',
      config: config(),
    }).success,
    true
  );
  assert.equal(
    SetConversationConfigCommandSchema.safeParse({
      type: 'set_conversation_config',
      commandId: 'update-1',
      conversationId,
      expectedRevision: 2,
      patch: { kind: 'set_reasoning', reasoning: { mode: 'disabled' } },
    }).success,
    true
  );
  assert.equal(ConversationUpdatedEventSchema.shape.reason.options.includes('catalog'), true);
  assert.equal(
    CommandRejectedEventSchema.safeParse({
      type: 'command_rejected',
      commandId: 'update-1',
      conversationId,
      error: { code: 'revision_conflict', message: 'stale revision' },
    }).success,
    true
  );
});

test('v2 client schema rejects every removed v1 command', () => {
  const conversationId = '550e8400-e29b-41d4-a716-446655440000';
  for (const message of [
    { type: 'new_conversation', id: conversationId, provider: 'codex' },
    { type: 'set_model', conversationId, model: 'gpt-5.6-sol' },
    { type: 'set_provider', conversationId, provider: 'claude' },
    { type: 'set_reasoning_effort', conversationId, value: 'high' },
  ]) {
    assert.equal(ClientMessageSchema.safeParse(message).success, false, message.type);
  }
});

test('v2 creation acknowledgement requires command correlation', () => {
  assert.equal(
    ConversationCreatedEventSchema.safeParse({
      type: 'conversation_created',
      conversation: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        messages: [],
        isRunning: false,
        createdAt: new Date(),
        workingDirectory: '/tmp',
      },
    }).success,
    false
  );
});

test('v2 init requires explicit protocol metadata', () => {
  assert.equal(
    InitMessageSchema.safeParse({
      type: 'init',
      conversations: [],
      defaultCwd: '/tmp',
    }).success,
    false
  );
});
