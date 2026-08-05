import { CURSOR_MODEL_REGISTRY, type ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const cursorProvider: Provider = {
  name: 'cursor',

  listModels(): ModelInfo[] {
    return CURSOR_MODEL_REGISTRY.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      isDefault: entry.isDefault,
    }));
  },
};

export default cursorProvider;
