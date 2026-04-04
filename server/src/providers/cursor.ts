import type { ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const cursorProvider: Provider = {
  name: 'cursor',

  listModels(): ModelInfo[] {
    return [
      { id: 'composer2', displayName: 'Composer 2', isDefault: true },
    ];
  },
};

export default cursorProvider;
