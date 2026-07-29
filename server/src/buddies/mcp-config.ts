import fs from 'node:fs';
import path from 'node:path';
import type { BuddyContext } from '@unleashd/shared';

export const BUDDY_MCP_SERVER_NAME = 'unleashd_buddy';

export interface BuddyMcpLaunch {
  command: string;
  args: string[];
  cwd?: string;
}

function buddyApiBaseUrl(): string {
  const configured = process.env.UNLEASHD_BUDDY_API_BASE?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const port = process.env.PORT?.trim() || '7489';
  return `http://127.0.0.1:${port}`;
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
      cwd: path.resolve(__dirname, '../..'),
    };
  }

  const sourceEntrypoint = path.resolve(__dirname, '../buddies/mcp-server.ts');
  return {
    command: process.execPath,
    args: ['--import', 'tsx', sourceEntrypoint],
    // The provider process runs in the Buddy workspace, which is usually a
    // different repository. Resolve the source loader from Unleashd instead
    // of asking that workspace to have `tsx` installed.
    cwd: path.resolve(__dirname, '../..'),
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
    '--api-base',
    buddyApiBaseUrl(),
  ];
  if (context.buddyProjectId) {
    args.push('--project', context.buddyProjectId);
  }
  if (context.automationRunId) {
    args.push('--automation-run', context.automationRunId);
  }
  for (const operation of context.allowedBuddyOperations ?? []) {
    args.push('--allowed-operation', operation);
  }
  const config = [
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.command=${tomlString(launch.command)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.args=${tomlStringArray(args)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.enabled=true`,
    '-c',
    // Buddy state tools are part of the employee contract. Failing the turn
    // is more truthful than silently running without the promised controls.
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.required=true`,
  ];
  if (launch.cwd) {
    config.push('-c', `mcp_servers.${BUDDY_MCP_SERVER_NAME}.cwd=${tomlString(launch.cwd)}`);
  }
  return config;
}

export function buddyBuilderCodexMcpArgs(
  conversationId: string,
  launch: BuddyMcpLaunch = resolveBuddyMcpLaunch()
): string[] {
  const args = [...launch.args, '--builder', '--conversation', conversationId];
  const config = [
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.command=${tomlString(launch.command)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.args=${tomlStringArray(args)}`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.enabled=true`,
    '-c',
    `mcp_servers.${BUDDY_MCP_SERVER_NAME}.required=true`,
  ];
  if (launch.cwd) {
    config.push('-c', `mcp_servers.${BUDDY_MCP_SERVER_NAME}.cwd=${tomlString(launch.cwd)}`);
  }
  return config;
}
