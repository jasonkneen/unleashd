import type { Conversation } from '@unleashd/shared';
import type { Express } from 'express';

export interface ConversationDetail {
  toJSON(): Conversation;
}

export function registerConversationRoutes(
  app: Express,
  getConversation: (id: string) => ConversationDetail | undefined
): void {
  app.get('/api/conversations/:conversationId', (request, response) => {
    const conversation = getConversation(request.params.conversationId);
    if (!conversation) {
      response.status(404).json({ error: 'Conversation not found' });
      return;
    }
    response.json(conversation.toJSON());
  });
}
