import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BuddiesStore } from '@nbardy/buddies';
import type { ZodTypeAny } from 'zod';
import type { BuddyBuilderStore } from './builder';
import { createBuddyBuilderMcpServer } from './builder-mcp-server';
import type { BuddiesStorePort } from './contract';
import {
  type BuddyOperationContext,
  BuddyOperationInputSchemas,
  type BuddyOperationName,
  BuddyOperationsService,
  type PreparedBuddyDelegation,
  type PreparedBuddyReviewRequest,
} from './operations';

const TOOL_NAMES = [
  'buddy.get_current_work',
  'buddy.get_inbox',
  'buddy.get_automations',
  'buddy.set_automation',
  'buddy.new_project',
  'buddy.update_project',
  'buddy.remember',
  'buddy.compact_memory',
  'buddy.delegate',
  'buddy.request_review',
  'buddy.complete_delegation',
  'buddy.complete_assignment',
  'buddy.submit_review',
  'buddy.request_human_approval',
] as const satisfies readonly BuddyOperationName[];

const TOOL_DESCRIPTIONS: Record<BuddyOperationName, string> = {
  'buddy.get_current_work':
    'Read current open projects and todos for this employee or a declared review subject in the conversation workspace.',
  'buddy.get_inbox':
    'Read the typed team inbox: assignments, terminal outcomes and evidence, review queue/results, approvals, blocked projects, and failed automations within this employee management scope.',
  'buddy.get_automations':
    'List durable Buddy automations for this employee or one direct report in the conversation workspace.',
  'buddy.set_automation':
    'Create or update a disabled durable Buddy automation for this employee or a direct report, or disable an existing automation. This tool cannot enable or run jobs.',
  'buddy.new_project':
    'Create a bounded project owned by this employee in the conversation workspace.',
  'buddy.update_project':
    'Atomically update the selected employee project and its todos. Completing work requires evidence.',
  'buddy.remember': 'Append a durable journal or curated memory entry for this employee.',
  'buddy.compact_memory':
    'Compact this employee memory with source references, containment checks, and atomic rollback.',
  'buddy.delegate': 'Create a bounded delegation from this employee to another assigned Buddy.',
  'buddy.request_review':
    'Assign a bounded structured review, including concrete input evidence, to this employee or a direct report for another managed employee.',
  'buddy.complete_delegation': 'Settle a delegation owned by this employee with a durable outcome.',
  'buddy.complete_assignment':
    'Settle the bounded delegation assigned to this employee and conversation. Concrete evidence is required.',
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
  context: BuddyOperationContext,
  options: {
    dispatchDelegation?: (input: PreparedBuddyDelegation) => Promise<unknown>;
    dispatchReview?: (input: PreparedBuddyReviewRequest) => Promise<unknown>;
    allowedOperations?: readonly BuddyOperationName[];
  } = {}
): McpServer {
  const operations = new BuddyOperationsService(store, context);
  const server = new McpServer({
    name: 'unleashd-buddy',
    version: '1.0.0',
  });
  const toolServer = server as unknown as ToolRegistrationPort;

  for (const operation of TOOL_NAMES) {
    if (options.allowedOperations && !options.allowedOperations.includes(operation)) continue;
    toolServer.registerTool(
      publicToolName(operation),
      {
        description: TOOL_DESCRIPTIONS[operation],
        inputSchema: BuddyOperationInputSchemas[operation],
        annotations: {
          readOnlyHint:
            operation === 'buddy.get_current_work' ||
            operation === 'buddy.get_inbox' ||
            operation === 'buddy.get_automations',
          destructiveHint:
            operation === 'buddy.update_project' || operation === 'buddy.set_automation',
          idempotentHint:
            operation === 'buddy.get_current_work' ||
            operation === 'buddy.get_inbox' ||
            operation === 'buddy.get_automations',
          openWorldHint: false,
        },
      },
      async (input: unknown) => {
        try {
          let result: unknown;
          if (operation === 'buddy.delegate' && options.dispatchDelegation) {
            const prepared = operations.prepareDelegation(input);
            result = operations.recordDelegationDispatch(
              prepared,
              await options.dispatchDelegation(prepared)
            );
          } else if (operation === 'buddy.request_review' && options.dispatchReview) {
            const prepared = operations.prepareReviewRequest(input);
            result = operations.recordReviewDispatch(
              prepared,
              await options.dispatchReview(prepared)
            );
          } else {
            result = operations.execute(operation, input);
          }
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
  const store = new BuddiesStore() as unknown as BuddiesStorePort &
    BuddyBuilderStore & { close(): void };
  if (process.argv.includes('--builder')) {
    const server = createBuddyBuilderMcpServer(store, requiredArgument('--conversation'));
    const transport = new StdioServerTransport();
    const close = async () => {
      await server.close().catch(() => undefined);
      store.close();
    };
    process.once('SIGINT', () => void close().finally(() => process.exit(0)));
    process.once('SIGTERM', () => void close().finally(() => process.exit(0)));
    await server.connect(transport);
    return;
  }
  const allowedOperations = process.argv.flatMap((argument, index, argv) =>
    argument === '--allowed-operation' && argv[index + 1] ? [argv[index + 1]] : []
  );
  const context: BuddyOperationContext = {
    buddyId: requiredArgument('--buddy'),
    workspaceId: requiredArgument('--workspace'),
    conversationId: requiredArgument('--conversation'),
    buddyProjectId: process.argv.includes('--project') ? requiredArgument('--project') : undefined,
    automationRunId: process.argv.includes('--automation-run')
      ? requiredArgument('--automation-run')
      : undefined,
    allowedOperations: allowedOperations.length ? allowedOperations : undefined,
  };
  const apiBase = process.argv.includes('--api-base')
    ? requiredArgument('--api-base').replace(/\/+$/, '')
    : undefined;
  const server = createBuddyMcpServer(store, context, {
    allowedOperations: context.allowedOperations as BuddyOperationName[] | undefined,
    dispatchDelegation: apiBase
      ? async (input) => {
          const response = await fetch(`${apiBase}/api/buddies/${context.buddyId}/delegations`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              toBuddyId: input.toBuddyId,
              workspaceId: context.workspaceId,
              buddyProjectId: input.projectId,
              purpose: input.purpose,
              parentConversationId: input.parentConversationId,
              allowedOperations: input.allowedOperations,
            }),
          });
          const body = (await response.json()) as unknown;
          if (!response.ok) {
            const message =
              typeof body === 'object' &&
              body !== null &&
              'error' in body &&
              typeof (body as { error?: unknown }).error === 'string'
                ? (body as { error: string }).error
                : `Delegation dispatch failed with HTTP ${response.status}`;
            throw new Error(message);
          }
          return body;
        }
      : undefined,
    dispatchReview: apiBase
      ? async (input) => {
          const response = await fetch(
            `${apiBase}/api/buddies/${context.buddyId}/review-requests`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                reviewerBuddyId: input.reviewerBuddyId,
                subjectBuddyId: input.subjectBuddyId,
                workspaceId: context.workspaceId,
                buddyProjectId: input.projectId,
                purpose: input.purpose,
                parentConversationId: input.parentConversationId,
                evidence: input.evidence,
              }),
            }
          );
          const body = (await response.json()) as unknown;
          if (!response.ok) {
            const message =
              typeof body === 'object' &&
              body !== null &&
              'error' in body &&
              typeof (body as { error?: unknown }).error === 'string'
                ? (body as { error: string }).error
                : `Review dispatch failed with HTTP ${response.status}`;
            throw new Error(message);
          }
          return body;
        }
      : undefined,
  });
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
