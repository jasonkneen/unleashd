import { type GeminiModel, GeminiModelSchema, type ModelInfo } from '@unleashd/shared';
import type { Provider } from './index';

const GEMINI_MODEL_NAMES: Record<GeminiModel, string> = {
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
};

const geminiProvider: Provider = {
  name: 'gemini',

  listModels(): ModelInfo[] {
    return GeminiModelSchema.options.map((id) => ({
      id,
      displayName: GEMINI_MODEL_NAMES[id],
      isDefault: id === 'gemini-3.1-pro-preview',
    }));
  },
};

export default geminiProvider;
