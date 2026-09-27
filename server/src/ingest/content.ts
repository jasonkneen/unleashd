import {
  AskUserQuestionSchema,
  type ContentPart,
  type MessageBody,
  legacyBody,
  parseBuddyBuilderToolResult,
  parseBuddyWorkerToolResult,
  toolContentPart,
} from '@unleashd/shared';

// Pattern: parse-dont-validate (docs/patterns.md#parse-dont-validate)
// Native provider blocks and pre-contract marker transcripts enter the same typed body here.
// The renderer never scans a message for encoded widgets or guesses tools from emoji lines.
function receiptParts(output: unknown): ContentPart[] {
  const threads = parseBuddyWorkerToolResult(output);
  if (threads.length) return threads.map((thread) => ({ t: 'buddy_worker_thread', thread }));
  const event = parseBuddyBuilderToolResult(output);
  return event ? [{ t: 'buddy_builder_result', event }] : [];
}

export function nativeBody(partsJson: string | undefined, content: string): MessageBody {
  if (!partsJson) return legacyBody(content);
  let raw: unknown;
  try {
    raw = JSON.parse(partsJson);
  } catch {
    return legacyBody(content);
  }
  if (!Array.isArray(raw)) return legacyBody(content);
  const parts: ContentPart[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const part = item as Record<string, unknown>;
    if (part.t === 'text' && typeof part.text === 'string') {
      parts.push({ t: 'text', text: part.text });
    } else if (part.t === 'tool' && typeof part.name === 'string') {
      const question =
        part.name === 'AskUserQuestion' ? AskUserQuestionSchema.safeParse(part.input) : null;
      if (question?.success) parts.push({ t: 'question', question: question.data });
      else
        parts.push(
          toolContentPart(
            part.name,
            part.input,
            undefined,
            typeof part.status === 'string' ? part.status : undefined
          )
        );
    } else if (part.t === 'raw_result') {
      parts.push(...receiptParts(part.output));
    }
  }
  return parts.length ? { t: 'parts', parts } : { t: 'text', text: '' };
}
