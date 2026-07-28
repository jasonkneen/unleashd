import type { ConversationConfigPatch, SetConversationConfigCommand } from '@unleashd/shared';
import { produce } from 'immer';
import { pendingConfigCommandsAtom, sendFnAtom } from './conversations';
import { jotaiStore } from './store';

export interface SetConversationConfigArgs {
  conversationId: string;
  expectedRevision: number;
  patch: ConversationConfigPatch;
}

export function setConversationConfig({
  conversationId,
  expectedRevision,
  patch,
}: SetConversationConfigArgs): string {
  const commandId = crypto.randomUUID();
  jotaiStore.set(
    pendingConfigCommandsAtom,
    produce(jotaiStore.get(pendingConfigCommandsAtom), (draft) => {
      for (const [existingId, existing] of draft) {
        if (existing.conversationId === conversationId && existing.error) {
          draft.delete(existingId);
        }
      }
      draft.set(commandId, {
        commandId,
        conversationId,
        baseRevision: expectedRevision,
        patch,
      });
    })
  );

  const command: SetConversationConfigCommand = {
    type: 'set_conversation_config',
    commandId,
    conversationId,
    expectedRevision,
    patch,
  };
  jotaiStore.get(sendFnAtom).send(command);
  return commandId;
}

export function retireConfigCommand(commandId: string, error?: string): void {
  jotaiStore.set(
    pendingConfigCommandsAtom,
    produce(jotaiStore.get(pendingConfigCommandsAtom), (draft) => {
      const pending = draft.get(commandId);
      if (!pending) return;
      if (error) {
        pending.error = error;
      } else {
        draft.delete(commandId);
      }
    })
  );
}
