export type BuddyAutomationRunStatus = 'claimed' | 'running' | 'complete' | 'failed' | 'cancelled';

export interface BuddyAutomation {
  id: string;
  buddy_id: string;
  workspace_id: string;
  buddy_project_id: string | null;
  name: string;
  schedule_kind: 'cron' | 'interval';
  schedule_expression: string;
  timezone: string;
  job_kind: 'prompt' | 'sequence' | 'loop';
  job_payload:
    | { prompt: string }
    | { prompts: string[] }
    | {
        prompt: string;
        termination: {
          condition: string;
          max_iterations: number;
          max_duration_seconds: number;
        };
      };
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuddyAutomationRun {
  id: string;
  automation_id: string;
  scheduled_for: string;
  idempotency_key: string;
  status: BuddyAutomationRunStatus;
  conversation_id: string | null;
  iteration: number;
  outcome: string | null;
  error: string | null;
  claimed_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface BuddyRecord {
  id: string;
  name: string;
  role: string;
  status: string;
  provider: string | null;
  model: string | null;
  reasoning_effort: string | null;
}

interface BuddyWorkspace {
  id: string;
  name: string;
  root_path: string;
}

interface BuddySkill {
  name: string;
  instruction_path: string;
  mode: string;
}

interface BuddyDelegation {
  id: string;
  child_conversation_id: string | null;
}

interface BuddyLegacyWorkItem {
  id: string;
  buddy_id: string | null;
  project_id: string;
}

interface BuddyDetailContext {
  buddy: BuddyRecord;
  workspace: BuddyWorkspace | null;
  project: { id: string } | null;
  projects: unknown[];
  legacyWorkItems: unknown[];
  sprint: unknown;
  relationships: unknown[];
  skills: BuddySkill[];
  soul: string;
  memory: {
    summary: string;
    recentJournal: Array<{ path: string; content: string }>;
  };
}

export interface BuddiesStorePort {
  dashboard(): unknown;
  getBuddy(id: string): BuddyRecord | null;
  listBuddyWorkspaces(buddy: string): unknown[];
  listBuddyOwnedProjects(input: Record<string, unknown>): unknown[];
  listWorkItems(input: Record<string, unknown>): unknown[];
  listConversationLinks(buddy: string): unknown[];
  listAutomations(input: { buddy: string }): BuddyAutomation[];
  listBuddyRelationships(buddy: string): unknown[];
  listBuddySkills(buddy: string): BuddySkill[];
  listDelegations(input: Record<string, unknown>): BuddyDelegation[];
  listReviews(input: Record<string, unknown>): unknown[];
  getBuddyContext(
    buddy: string,
    input: { workspace?: string; project?: string }
  ): BuddyDetailContext;
  getWorkItem(id: string): BuddyLegacyWorkItem | null;
  updateConversationLink(
    id: string,
    changes: { status?: string; providerSessionId?: string }
  ): unknown;
  updateDelegation(
    id: string,
    changes: { status?: string; childConversationId?: string | null; outcome?: string | null }
  ): BuddyDelegation;
  linkConversation(input: Record<string, unknown>): unknown;
  setBuddyRelationship(input: Record<string, unknown>): unknown;
  assignBuddySkill(input: Record<string, unknown>): unknown;
  createDelegation(input: Record<string, unknown>): BuddyDelegation;
  createReview(input: Record<string, unknown>): { id: string };
  updateReview(id: string, changes: Record<string, unknown>): unknown;
  readBuddyMemory(buddy: string): unknown;
  remember(buddy: string, input: Record<string, unknown>): unknown;
  newProject(input: Record<string, unknown>): unknown;
  updateProject(id: string, changes: Record<string, unknown>): unknown;
  createAutomation(input: Record<string, unknown>): BuddyAutomation;
  getAutomation(id: string): BuddyAutomation | null;
  updateAutomation(id: string, changes: Record<string, unknown>): BuddyAutomation;
  deleteAutomation(id: string): BuddyAutomation;
  listDueAutomations(at: Date): BuddyAutomation[];
  claimAutomationRun(
    id: string,
    input?: { scheduledFor?: string; idempotencyKey?: string }
  ): BuddyAutomationRun;
  updateAutomationRun(
    id: string,
    changes: {
      status: BuddyAutomationRunStatus;
      conversationId?: string | null;
      iteration?: number;
      outcome?: string | null;
      error?: string | null;
      nextRunAt?: string | null;
    }
  ): BuddyAutomationRun;
  listAutomationRuns(id: string, options?: { limit?: number }): BuddyAutomationRun[];
  updateWorkItemStatus(
    id: string,
    status: string,
    options: { blockedReason?: string; nextAction?: string }
  ): unknown;
}

export interface BuddiesModule {
  BuddiesStore: new () => BuddiesStorePort;
}
