import type { BuddyContext, ConversationKind } from '@unleashd/shared';
import { isBuddyKind } from '@unleashd/shared';
import type { BuddyOverview, BuddyOverviewEmployee, BuddyProject } from './types';

export function selectDirectoryEmployees(overview: BuddyOverview): BuddyOverviewEmployee[] {
  return overview.topLevel;
}

export function buddyCardMetrics(employee: BuddyOverviewEmployee) {
  return {
    team: employee.team.length,
    open: employee.currentWork.open,
    active: employee.currentWork.active,
    blocked: employee.currentWork.blocked,
  };
}

export function effectiveSwarmDebugPrefix(
  buddyContext: BuddyContext | null | undefined,
  swarmDebugPrefix: string | null | undefined,
  kind?: ConversationKind | null
): string | null {
  // Kind is canonical when present; legacy buddyContext fallback keeps old payloads working.
  if (kind && isBuddyKind(kind)) return null;
  return buddyContext ? null : (swarmDebugPrefix ?? null);
}

export function buddyProjectTodoProgress(project: Pick<BuddyProject, 'todos'>) {
  const relevantTodos = project.todos.filter((todo) => todo.status !== 'cancelled');
  return {
    done: relevantTodos.filter((todo) => todo.status === 'done').length,
    total: relevantTodos.length,
  };
}
