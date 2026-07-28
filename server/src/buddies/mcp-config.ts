import fs from 'node:fs';
import path from 'node:path';
import type { BuddyContext } from '@unleashd/shared';

export const BUDDY_MCP_SERVER_NAME = 'unleashd_buddy';

export interface BuddyMcpLaunch {
  command: string;
  args: string[];
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlStringArray(values: string[]): string {
  return `[${values.map(tomlString).join(',')}]`;
}

export function resolveBuddyMcpLaunch(): BuddyMcpLaunch {
  const compiledEntrypoint = path.resolve(__dirname, '../buddies/mcp-server.js');
  if (fs.existsSync(compiledEntrypoint)) {
    return {
      command: process.execPath,
      args: [compiledEntrypoint],
    };
  }

  const sourceEntrypoint = path.resolve(__dirname, '../buddies/mcp-server.ts');
  return {
    command: process.execPath,
    args: ['--import', 'tsx', sourceEntrypoint],
  };
}

export function buddyCodexMcpArgs(
  context: BuddyContext,
  conversationId: string,
  launch: BuddyMcpLaunch = resolveBuddyMcpLaunch()
): string[] {
  const args = [
    ...launch.args,
    '--buddy',
    context.buddyId,
    '--workspace',
    context.workspaceId,
    '--conversation',
    conversationId,
  ];
  if (context.buddyProjectId) {
    args.push('--project', context.buddyProjectId);
  }
  if (context.automationRunId) {
    args.push('--automation-run', context.automationRunId);
  }
  return [
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.command=${tomlString(launch.command)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.args=${tomlStringArray(args)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.enabled=true`,
  ];
}
