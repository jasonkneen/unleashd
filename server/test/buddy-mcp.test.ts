import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BuddiesStore } from '@nbardy/buddies';
import type { BuddiesStorePort } from '../src/buddies/contract';
import { buddyCodexMcpArgs } from '../src/buddies/mcp-config';
import { createBuddyMcpServer } from '../src/buddies/mcp-server';

test('Buddy MCP exposes scoped native tools and enforces completion evidence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'buddy-mcp-'));
  const store = new BuddiesStore(':memory:');
  const workspace = store.createWorkspace({ name: 'Workspace', rootPath: root });
  const lead = store.createBuddy({
    project: workspace.id,
    name: 'Growth Lead',
    role: 'Own GTM closure',
  });
  const project = store.newProject({
    buddy: lead.id,
    workspace: workspace.id,
    title: 'Close proof loop',
    definitionOfDone: 'Evidence-backed decision recorded',
    status: 'in_progress',
    todos: [{ title: 'Record evidence', status: 'in_progress' }],
  });

  const server = createBuddyMcpServer(store as unknown as BuddiesStorePort, {
    buddyId: lead.id,
    workspaceId: workspace.id,
    buddyProjectId: project.id,
  });
  const client = new Client({ name: 'buddy-mcp-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
      'compact_memory',
      'complete_assignment',
      'complete_delegation',
      'delegate',
      'get_automations',
      'get_current_work',
      'get_inbox',
      'new_project',
      'remember',
      'request_human_approval',
      'request_review',
      'set_automation',
      'submit_review',
      'update_project',
    ]);

    const current = await client.callTool({
      name: 'get_current_work',
      arguments: {},
    });
    assert.equal(current.isError, undefined);
    assert.match(JSON.stringify(current.structuredContent), /Close proof loop/);

    const inbox = await client.callTool({
      name: 'get_inbox',
      arguments: {},
    });
    assert.equal(inbox.isError, undefined);
    assert.match(JSON.stringify(inbox.structuredContent), /assignedDelegations/);

    const rejected = await client.callTool({
      name: 'update_project',
      arguments: {
        projectId: project.id,
        status: 'done',
      },
    });
    assert.equal(rejected.isError, true);
    assert.match(JSON.stringify(rejected.content), /evidence is required/);

    const completed = await client.callTool({
      name: 'update_project',
      arguments: {
        projectId: project.id,
        status: 'done',
        evidence: ['metric:proof-loop-1'],
        todoOperations: [
          {
            operation: 'update',
            todoId: project.todos[0].id,
            status: 'done',
          },
        ],
      },
    });
    assert.equal(completed.isError, undefined);
    assert.equal(store.getBuddyProject(project.id)?.status, 'done');

    const approval = await client.callTool({
      name: 'request_human_approval',
      arguments: {
        action: 'Publish the proof',
        reason: 'The local evidence is complete.',
        risk: 'Publishing changes public state.',
        projectId: project.id,
      },
    });
    assert.equal(approval.isError, undefined);
    assert.match(JSON.stringify(approval.structuredContent), /"status":"pending"/);
    assert.equal(store.listApprovalRequests({ status: 'pending' }).length, 1);
    assert.equal(store.listAuditEvents({ buddy: lead.id }).length, 4);
  } finally {
    await client.close();
    await server.close();
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('Codex Buddy MCP configuration binds trusted context outside tool input', () => {
  const priorApiBase = process.env.UNLEASHD_BUDDY_API_BASE;
  process.env.UNLEASHD_BUDDY_API_BASE = 'http://127.0.0.1:9999';
  const args = buddyCodexMcpArgs(
    {
      buddyId: 'buddy-1',
      workspaceId: 'workspace-1',
      buddyProjectId: 'project-1',
      legacyWorkItemId: null,
      automationRunId: 'run-1',
      delegatedByBuddyId: null,
      parentBuddyConversationId: null,
      allowedBuddyOperations: ['buddy.get_automations', 'buddy.complete_assignment'],
    },
    'conversation-1',
    {
      command: '/usr/bin/node',
      args: ['/app/server/dist/buddies/mcp-server.js'],
      cwd: '/app/server',
    }
  );

  assert.deepEqual(args, [
    '-c',
    'mcp_servers.unleashd_buddy.command="/usr/bin/node"',
    '-c',
    'mcp_servers.unleashd_buddy.args=["/app/server/dist/buddies/mcp-server.js","--buddy","buddy-1","--workspace","workspace-1","--conversation","conversation-1","--api-base","http://127.0.0.1:9999","--project","project-1","--automation-run","run-1","--allowed-operation","buddy.get_automations","--allowed-operation","buddy.complete_assignment"]',
    '-c',
    'mcp_servers.unleashd_buddy.enabled=true',
    '-c',
    'mcp_servers.unleashd_buddy.required=true',
    '-c',
    'mcp_servers.unleashd_buddy.cwd="/app/server"',
  ]);
  if (priorApiBase === undefined) delete process.env.UNLEASHD_BUDDY_API_BASE;
  else process.env.UNLEASHD_BUDDY_API_BASE = priorApiBase;
});

test('stdio Buddy MCP entrypoint reopens durable state with trusted launch scope', async () => {
  const home = mkdtempSync(join(tmpdir(), 'buddy-mcp-stdio-'));
  const workspaceRoot = join(home, 'workspace');
  const database = join(home, 'buddies.sqlite');
  const store = new BuddiesStore(database);
  const workspace = store.createWorkspace({ name: 'Workspace', rootPath: workspaceRoot });
  const lead = store.createBuddy({
    project: workspace.id,
    name: 'Growth Lead',
    role: 'Own GTM closure',
  });
  store.newProject({
    buddy: lead.id,
    workspace: workspace.id,
    title: 'Durable MCP project',
    definitionOfDone: 'Native tool can read it after process launch',
  });
  store.close();

  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
  env.BUDDIES_HOME = home;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import',
      'tsx',
      join(process.cwd(), 'server/src/buddies/mcp-server.ts'),
      '--buddy',
      lead.id,
      '--workspace',
      workspace.id,
      '--conversation',
      'conversation-stdio',
    ],
    env,
    stderr: 'pipe',
  });
  const client = new Client({ name: 'buddy-mcp-stdio-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const current = await client.callTool({ name: 'get_current_work', arguments: {} });
    assert.equal(current.isError, undefined);
    assert.match(JSON.stringify(current.structuredContent), /Durable MCP project/);
  } finally {
    await client.close();
    rmSync(home, { recursive: true, force: true });
  }
});
