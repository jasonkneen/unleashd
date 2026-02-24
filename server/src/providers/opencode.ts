import type { ModelInfo } from '@claude-web-view/shared';
import type { Provider } from './index';

const opencodeProvider: Provider = {
  name: 'opencode',

  listModels(): ModelInfo[] {
    return [
      { id: 'opencode/big-pickle', displayName: 'OpenCode Big Pickle (Free)', isDefault: true },
      { id: 'opencode/gpt-5-nano', displayName: 'OpenCode GPT-5 Nano (Free)', isDefault: false },
      { id: 'opencode/kimi-k2.5-free', displayName: 'OpenCode Kimi K2.5 Free', isDefault: false },
      {
        id: 'opencode/minimax-m2.5-free',
        displayName: 'OpenCode MiniMax M2.5 Free',
        isDefault: false,
      },
    ];
  },
};

export default opencodeProvider;
