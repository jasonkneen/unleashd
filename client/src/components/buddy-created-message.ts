export const BUDDY_CREATED_START = '<!-- unleashd:buddy-created -->';
export const BUDDY_CREATED_END = '<!-- /unleashd:buddy-created -->';

export interface BuddyCreated {
  type: 'buddy_created';
  buddy: {
    id: string;
    name: string;
    role: string;
    status: string;
    provider: string | null;
    model: string | null;
    reasoning_effort: string | null;
  };
  route: string;
}

export function parseBuddyCreated(json: string): BuddyCreated | null {
  let value: unknown;
  try {
    value = JSON.parse(json.trim());
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  const result = value as Record<string, unknown>;
  const buddy = result.buddy;
  if (result.type !== 'buddy_created' || !buddy || typeof buddy !== 'object') return null;

  const record = buddy as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.role !== 'string' ||
    typeof record.status !== 'string'
  ) {
    return null;
  }
  const route = `/buddies/${record.id}`;
  if (result.route !== route) return null;

  const nullableString = (candidate: unknown): candidate is string | null =>
    candidate === null || typeof candidate === 'string';
  if (
    !nullableString(record.provider) ||
    !nullableString(record.model) ||
    !nullableString(record.reasoning_effort)
  ) {
    return null;
  }

  return {
    type: 'buddy_created',
    buddy: {
      id: record.id,
      name: record.name,
      role: record.role,
      status: record.status,
      provider: record.provider,
      model: record.model,
      reasoning_effort: record.reasoning_effort,
    },
    route,
  };
}

/**
 * Compatibility envelope for provider text output. Structured provider events
 * should normalize to the same `BuddyCreated` payload before reaching the UI.
 */
export const BUDDY_CREATED_RE =
  /<!-- unleashd:buddy-created -->\r?\n([\s\S]*?)\r?\n<!-- \/unleashd:buddy-created -->/;
