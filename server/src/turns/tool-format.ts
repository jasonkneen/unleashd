/** Codex shell completion events carry only exit_code and repeat the started call. */
export function isCompletionOnlyToolUse(name: string, input?: unknown, displayText?: string): boolean {
  if (name !== 'shell' || (typeof displayText === 'string' && displayText.trim())) return false;
  return !!input && typeof input === 'object' && typeof (input as Record<string, unknown>).exit_code === 'number';
}
