import { type ClaudeModel, ClaudeModelSchema, type ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const CLAUDE_MODEL_NAMES: Record<ClaudeModel, string> = {
  fable: 'Claude Fable 5',
  opus: 'Claude Opus 5',
  sonnet: 'Claude Sonnet',
  haiku: 'Claude Haiku',
};

const claudeProvider: Provider = {
  name: 'claude',

  listModels(): ModelInfo[] {
    return ClaudeModelSchema.options.map((id) => ({
      id,
      displayName: CLAUDE_MODEL_NAMES[id],
      isDefault: id === 'opus',
    }));
  },
};

export default claudeProvider;
