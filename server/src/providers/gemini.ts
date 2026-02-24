import type { ModelInfo } from '@claude-web-view/shared';
import type { Provider } from './index';

const geminiProvider: Provider = {
  name: 'gemini',

  listModels(): ModelInfo[] {
    return [
      { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview', isDefault: true },
      { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5-pro', isDefault: false },
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5-flash', isDefault: false },
      { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0-flash', isDefault: false },
    ];
  },
};

export default geminiProvider;
