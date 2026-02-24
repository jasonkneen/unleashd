import type { ModelInfo } from '@claude-web-view/shared';
import type { Provider } from './index';

const claudeProvider: Provider = {
  name: 'claude',

  listModels(): ModelInfo[] {
    return [
      { id: 'sonnet', displayName: 'Claude Sonnet', isDefault: false },
      { id: 'opus', displayName: 'Claude Opus', isDefault: true },
      { id: 'haiku', displayName: 'Claude Haiku', isDefault: false },
    ];
  },
};

export default claudeProvider;
