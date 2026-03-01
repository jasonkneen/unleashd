import type { ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const codexProvider: Provider = {
  name: 'codex',

  listModels(): ModelInfo[] {
    return [
      { id: 'gpt-5.3-codex-high', displayName: 'GPT-5.3 Codex (High Effort)', isDefault: true },
      {
        id: 'gpt-5.3-codex-medium',
        displayName: 'GPT-5.3 Codex (Medium Effort)',
        isDefault: false,
      },
      {
        id: 'gpt-5.3-codex-xhigh',
        displayName: 'GPT-5.3 Codex (Extra High Effort)',
        isDefault: false,
      },
      {
        id: 'gpt-5.3-codex-spark',
        displayName: 'GPT-5.3 Codex Spark (Ultra-Fast)',
        isDefault: false,
      },
      {
        id: 'gpt-5.3-codex-spark-high',
        displayName: 'GPT-5.3 Codex Spark (High Effort)',
        isDefault: false,
      },
      {
        id: 'gpt-5.3-codex-spark-medium',
        displayName: 'GPT-5.3 Codex Spark (Medium Effort)',
        isDefault: false,
      },
      {
        id: 'gpt-5.3-codex-spark-xhigh',
        displayName: 'GPT-5.3 Codex Spark (Extra High Effort)',
        isDefault: false,
      },
    ];
  },
};

export default codexProvider;
