import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BuddiesStore } from '@nbardy/buddies';
import type { ZodTypeAny } from 'zod';
import type { BuddiesStorePort } from './contract';
import {
  type BuddyOperationContext,
  BuddyOperationInputSchemas,
  type BuddyOperationName,
  BuddyOperationsService,
} from './operations';

const TOOL_NAMES = [
  'buddy.get_current_work',
  'buddy.new_project',
  'buddy.update_project',
  'buddy.remember',
  'buddy.compact_memory',
  'buddy.delegate',
  'buddy.complete_delegation',
  'buddy.submit_review',
  'buddy.request_human_approval',
] as const satisfies readonly BuddyOperationName[];

const TOOL_DESCRIPTIONS: Record<BuddyOperationName, string> = {
  'buddy.get_current_work':
    'Read the current open projects and todos for this employee and conversation workspace.',
  'buddy.new_project':
    'Create a bounded project owned by this employee in the conversation workspace.',
  'buddy.update_project':
    'Atomically update the selected employee project and its todos. Completing work requires evidence.',
  'buddy.remember': 'Append a durable journal or curated memory entry for this employee.',
  'buddy.compact_memory':
    'Compact this employee memory with source references, containment checks, and atomic rollback.',
  'buddy.delegate': 'Create a bounded delegation from this employee to another assigned Buddy.',
  'buddy.complete_delegation': 'Settle a delegation owned by this employee with a durable outcome.',
  'buddy.submit_review':
    'Submit an evidence-backed structured employee review assigned to this reviewer.',
  'buddy.request_human_approval':
    'Record a pending human approval request for an external, risky, spending, publishing, or deployment action. This does not authorize or execute the action.',
};

function publicToolName(operation: BuddyOperationName): string {
  return operation.slice('buddy.'.length);
}

interface ToolRegistrationPort {
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: ZodTypeAny;
      annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
      };
    },
    callback: (input: unknown) => Promise<Record<string, unknown>>
  ): unknown;
}

export function createBuddyMcpServer(
  store: BuddiesStorePort,
  context: BuddyOperationContext
): McpServer {
  const operations = new BuddyOperationsService(store, context);
  const server = new McpServer({
    name: 'unleashd-buddy',
    version: '1.0.0',
  });
  const toolServer = server as unknown as ToolRegistrationPort;

  for (const operation of TOOL_NAMES) {
    toolServer.registerTool(
      publicToolName(operation),
      {
        description: TOOL_DESCRIPTIONS[operation],
        inputSchema: BuddyOperationInputSchemas[operation],
        annotations: {
          readOnlyHint: operation === 'buddy.get_current_work',
          destructiveHint: operation === 'buddy.update_project',
          idempotentHint: operation === 'buddy.get_current_work',
          openWorldHint: false,
        },
      },
      async (input: unknown) => {
        try {
          const result = operations.execute(operation, input);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
        }
      }
    );
  }
  return server;
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const store = new BuddiesStore() as unknown as BuddiesStorePort & { close(): void };
  const context: BuddyOperationContext = {
    buddyId: requiredArgument('--buddy'),
    workspaceId: requiredArgument('--workspace'),
    conversationId: requiredArgument('--conversation'),
    buddyProjectId: process.argv.includes('--project') ? requiredArgument('--project') : undefined,
    automationRunId: process.argv.includes('--automation-run')
      ? requiredArgument('--automation-run')
      : undefined,
  };
  const server = createBuddyMcpServer(store, context);
  const transport = new StdioServerTransport();
  const close = async () => {
    await server.close().catch(() => undefined);
    store.close();
  };
  process.once('SIGINT', () => void close().finally(() => process.exit(0)));
  process.once('SIGTERM', () => void close().finally(() => process.exit(0)));
  await server.connect(transport);
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(`[buddies-mcp] ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}
