import { CLAUDE_SUBAGENT_TOOL_NAMES } from '@nbardy/agent-cli';
import type { Provider } from '@unleashd/shared';

const GEMINI_LOCAL_AGENT_LABELS: Record<string, string> = {
  generalist: 'Generalist Agent',
  browser_agent: 'Browser Agent',
  codebase_investigator: 'Codebase Investigator Agent',
  cli_help: 'CLI Help Agent',
};

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

// Claude's spawn tool is `Agent` since Claude Code 2.1 and `Task` before; matching only `Task`
// hid every 2.1 sub-agent. The harness owns the name set (agent-cli CLAUDE_SUBAGENT_TOOL_NAMES).
// Guard: conversation-runtime.test.ts "a recorded Claude 2.1 Agent launch becomes a sub-agent".
export function isSubagentSpawnTool(provider: Provider, toolName: string): boolean {
  return (
    CLAUDE_SUBAGENT_TOOL_NAMES.has(toolName) ||
    (provider === 'gemini' && toolName in GEMINI_LOCAL_AGENT_LABELS)
  );
}

export function getSubagentDescription(
  provider: Provider,
  toolName: string,
  input: Record<string, unknown>
): string {
  if (CLAUDE_SUBAGENT_TOOL_NAMES.has(toolName)) {
    const description = firstString(input.description) ?? 'Running sub-agent task...';
    const subagentType = firstString(input.subagent_type);
    return subagentType ? `[${subagentType}] ${description}` : description;
  }

  if (provider === 'gemini' && toolName in GEMINI_LOCAL_AGENT_LABELS) {
    const label = GEMINI_LOCAL_AGENT_LABELS[toolName] ?? toolName;
    const request = firstString(input.request, input.task, input.objective, input.question);
    return request ? `[${label}] ${request}` : `Running ${label}...`;
  }

  return `Running ${toolName}...`;
}
