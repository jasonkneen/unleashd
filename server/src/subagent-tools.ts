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

export function isSubagentSpawnTool(provider: Provider, toolName: string): boolean {
  return toolName === 'Task' || (provider === 'gemini' && toolName in GEMINI_LOCAL_AGENT_LABELS);
}

export function getSubagentDescription(
  provider: Provider,
  toolName: string,
  input: Record<string, unknown>
): string {
  if (toolName === 'Task') {
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
