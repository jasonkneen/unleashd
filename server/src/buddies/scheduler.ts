import type { BuddiesStorePort, BuddyAutomation, BuddyAutomationRun } from './contract';

export interface BuddyAutomationConversation {
  conversationId: string;
  runTurn(prompt: string): Promise<string>;
  stop(): void;
  finish(status: 'complete' | 'failed' | 'cancelled'): void;
}

export interface BuddySchedulerOptions {
  store: BuddiesStorePort;
  createConversation(
    automation: BuddyAutomation,
    run: BuddyAutomationRun
  ): Promise<BuddyAutomationConversation>;
  pollIntervalMs?: number;
  now?: () => Date;
  logger?: Pick<Console, 'warn' | 'error'>;
}

function cronFieldMatches(field: string, value: number, min: number, max: number): boolean {
  return field.split(',').some((part) => {
    const [base, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) return false;
    let start = min;
    let end = max;
    if (base !== '*') {
      const [startText, endText] = base.split('-');
      start = Number(startText);
      end = endText === undefined ? start : Number(endText);
    }
    return (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= min &&
      end <= max &&
      value >= start &&
      value <= end &&
      (value - start) % step === 0
    );
  });
}

function zonedParts(date: Date, timezone: string): number[] {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    minute: 'numeric',
    hour: 'numeric',
    day: 'numeric',
    month: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return [
    Number(values.minute),
    Number(values.hour),
    Number(values.day),
    Number(values.month),
    weekdays[values.weekday],
  ];
}

export function nextAutomationRunAt(automation: BuddyAutomation, after: Date): string {
  if (automation.schedule_kind === 'interval') {
    const seconds = Number(automation.schedule_expression);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('Interval automation must use positive seconds');
    }
    return new Date(after.getTime() + seconds * 1000).toISOString();
  }

  const fields = automation.schedule_expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('Cron automation must have five fields');
  const start = new Date(after);
  start.setUTCSeconds(0, 0);
  start.setUTCMinutes(start.getUTCMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let offset = 0; offset < limit; offset += 1) {
    const candidate = new Date(start.getTime() + offset * 60_000);
    const parts = zonedParts(candidate, automation.timezone);
    const dayOfMonthMatches = cronFieldMatches(fields[2], parts[2], 1, 31);
    const dayOfWeekMatches = cronFieldMatches(fields[4], parts[4], 0, 6);
    const dayMatches =
      fields[2] === '*'
        ? dayOfWeekMatches
        : fields[4] === '*'
          ? dayOfMonthMatches
          : dayOfMonthMatches || dayOfWeekMatches;
    if (
      cronFieldMatches(fields[0], parts[0], 0, 59) &&
      cronFieldMatches(fields[1], parts[1], 0, 23) &&
      cronFieldMatches(fields[3], parts[3], 1, 12) &&
      dayMatches
    ) {
      return candidate.toISOString();
    }
  }
  throw new Error('No cron occurrence found in the next year');
}

export class BuddyScheduler {
  private readonly store: BuddiesStorePort;
  private readonly createConversation: BuddySchedulerOptions['createConversation'];
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly logger: Pick<Console, 'warn' | 'error'>;
  private timer: NodeJS.Timeout | null = null;
  private activeRuns = new Set<string>();

  constructor(options: BuddySchedulerOptions) {
    this.store = options.store;
    this.createConversation = options.createConversation;
    this.pollIntervalMs = options.pollIntervalMs ?? 30_000;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? console;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
    this.timer.unref?.();
    void this.poll();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async poll(): Promise<void> {
    for (const automation of this.store.listDueAutomations(this.now())) {
      const run = this.store.claimAutomationRun(automation.id, {
        scheduledFor: automation.next_run_at ?? this.now().toISOString(),
      });
      if (this.activeRuns.has(run.id)) continue;
      if (run.status === 'running') {
        const nextRunAt = this.nextRunAt(automation, run);
        this.store.updateAutomationRun(run.id, {
          status: 'failed',
          error: 'Automation interrupted by scheduler restart',
          ...(nextRunAt ? { nextRunAt } : {}),
        });
        continue;
      }
      if (run.status !== 'claimed') continue;
      void this.execute(automation, run);
    }
  }

  async runNow(automationId: string): Promise<BuddyAutomationRun> {
    const automation = this.store.getAutomation(automationId);
    if (!automation) throw new Error(`automation not found: ${automationId}`);
    const scheduledFor = this.now().toISOString();
    const run = this.store.claimAutomationRun(automation.id, {
      scheduledFor,
      idempotencyKey: `${automation.id}:manual:${scheduledFor}`,
    });
    if (run.status === 'claimed' && !this.activeRuns.has(run.id))
      void this.execute(automation, run);
    return run;
  }

  private async execute(automation: BuddyAutomation, claimed: BuddyAutomationRun): Promise<void> {
    if (this.activeRuns.has(claimed.id)) return;
    this.activeRuns.add(claimed.id);
    let conversation: BuddyAutomationConversation | null = null;
    try {
      conversation = await this.createConversation(automation, claimed);
      let run = this.store.updateAutomationRun(claimed.id, {
        status: 'running',
        conversationId: conversation.conversationId,
      });
      let outcome = '';
      if (automation.job_kind === 'prompt') {
        outcome = await conversation.runTurn((automation.job_payload as { prompt: string }).prompt);
        run = this.store.updateAutomationRun(run.id, {
          status: 'running',
          iteration: 1,
          outcome,
        });
      } else if (automation.job_kind === 'sequence') {
        const prompts = (automation.job_payload as { prompts: string[] }).prompts;
        for (let index = 0; index < prompts.length; index += 1) {
          outcome = await conversation.runTurn(prompts[index]);
          run = this.store.updateAutomationRun(run.id, {
            status: 'running',
            iteration: index + 1,
            outcome,
          });
        }
      } else {
        const payload = automation.job_payload as {
          prompt: string;
          termination: {
            condition: string;
            max_iterations: number;
            max_duration_seconds: number;
          };
        };
        const deadline = Date.now() + payload.termination.max_duration_seconds * 1000;
        let terminationSatisfied = false;
        for (let iteration = 1; iteration <= payload.termination.max_iterations; iteration += 1) {
          if (Date.now() >= deadline) throw new Error('Automation loop duration limit reached');
          const prompt = [
            payload.prompt,
            '',
            `Termination condition: ${payload.termination.condition}`,
            'When the condition is satisfied, include exactly [BUDDY_AUTOMATION_DONE].',
            `Iteration ${iteration} of ${payload.termination.max_iterations}.`,
          ].join('\n');
          outcome = await this.runBeforeDeadline(conversation, prompt, deadline);
          run = this.store.updateAutomationRun(run.id, {
            status: 'running',
            iteration,
            outcome,
          });
          if (outcome.includes('[BUDDY_AUTOMATION_DONE]')) {
            terminationSatisfied = true;
            break;
          }
        }
        if (!terminationSatisfied) {
          throw new Error(
            `Automation loop did not satisfy its termination condition after ${payload.termination.max_iterations} iterations`
          );
        }
      }
      const nextRunAt = this.nextRunAt(automation, claimed);
      this.store.updateAutomationRun(run.id, {
        status: 'complete',
        outcome,
        ...(nextRunAt ? { nextRunAt } : {}),
      });
      conversation.finish('complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[buddies] Automation ${automation.id} failed: ${message}`);
      const nextRunAt = this.nextRunAt(automation, claimed);
      this.store.updateAutomationRun(claimed.id, {
        status: 'failed',
        error: message,
        ...(nextRunAt ? { nextRunAt } : {}),
      });
      conversation?.finish('failed');
      conversation?.stop();
    } finally {
      this.activeRuns.delete(claimed.id);
    }
  }

  private nextRunAt(automation: BuddyAutomation, claimed: BuddyAutomationRun): string | undefined {
    const scheduledAt = new Date(claimed.scheduled_for);
    const now = this.now();
    const reference =
      Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < now.getTime()
        ? now
        : scheduledAt;
    try {
      return nextAutomationRunAt(automation, reference);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[buddies] Cannot schedule the next run for automation ${automation.id}: ${message}`
      );
      return undefined;
    }
  }

  private async runBeforeDeadline(
    conversation: BuddyAutomationConversation,
    prompt: string,
    deadline: number
  ): Promise<string> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Automation loop duration limit reached');
    let timeout: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        conversation.runTurn(prompt),
        new Promise<string>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Automation loop duration limit reached')),
            remaining
          );
          timeout.unref?.();
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
