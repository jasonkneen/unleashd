import type { Conversation } from '@unleashd/shared';

const PREVIEW_CONTENT_LENGTH = 500;

export function summarizeConversation(conversation: Conversation): Conversation {
  const lastMessage = conversation.messages.at(-1);
  return {
    ...conversation,
    messageCount: conversation.messageCount ?? conversation.messages.length,
    messages: lastMessage
      ? [{ ...lastMessage, content: lastMessage.content.slice(0, PREVIEW_CONTENT_LENGTH) }]
      : [],
  };
}
