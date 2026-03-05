import { CODEX_MODEL_INFOS, type ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const codexProvider: Provider = {
  name: 'codex',

  listModels(): ModelInfo[] {
    return CODEX_MODEL_INFOS.map((model) => ({ ...model }));
  },
};

export default codexProvider;
