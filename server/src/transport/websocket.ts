import fs from 'node:fs';
import type {
  ConfigError,
  Conversation,
  GeneralCommandError,
  ServerMessage,
} from '@unleashd/shared';
import { WebSocket } from 'ws';

export function sendToClient(ws: WebSocket, data: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

export function sendProtocolError(ws: WebSocket, message: string): void {
  sendToClient(ws, { type: 'error', message });
}

export function validateWorkingDirectory(
  workingDirectory: string
): GeneralCommandError | undefined {
  try {
    return fs.statSync(workingDirectory).isDirectory()
      ? undefined
      : { code: 'invalid_directory', message: 'Path is not a directory' };
  } catch {
    return {
      code: 'invalid_directory',
      message: `No matching folder: ${workingDirectory}`,
    };
  }
}

export function sendCommandRejected(
  ws: WebSocket,
  input: {
    commandId: string;
    conversationId?: string;
    error: ConfigError | GeneralCommandError;
    authoritativeConversation?: Conversation;
  }
): void {
  sendToClient(ws, {
    type: 'command_rejected',
    commandId: input.commandId,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    error: input.error,
    ...(input.authoritativeConversation
      ? { authoritativeConversation: input.authoritativeConversation }
      : {}),
  });
}

export function sendCommandAccepted(
  ws: WebSocket,
  input: { commandId: string; conversationId: string }
): void {
  sendToClient(ws, { type: 'command_accepted', ...input });
}
