import { BuddyBuilderEventSchema, BuddyWorkerThreadSchema } from './buddy.js';
import { AskUserQuestionSchema, type ContentPart, type MessageBody } from './content-schema.js';
import { toolContentPart } from './tool-content.js';

export function legacyToolInput(input: string | undefined): unknown {
  if (input === undefined) return undefined;
  try { return JSON.parse(input); } catch { return input; }
}

// Historical provider output only. New writes carry a typed body at their producer.
const MARKER = /(?:^[ \t]*🔧[ \t]+mcp_tool[ \t]*\r?\n\s*)?<!--\s*(ask_user_question|buddy_builder_result|buddy_worker_thread|buddy_team_configuration)\s*:(.*?)\s*-->|<!-- unleashd:buddy-review-result -->[\s\S]*?<!-- \/unleashd:buddy-review-result -->/gms;
const TOOL_LINE = /^(?:📖|✍️|✏️|⚡|💻|📂|🔍|🌐|📓|📝|🔧|▶️|📦|🔀|📁|🔒|🗑️|❌)[ \t]+(\S+)(?:[ \t]+([^\n]*))?$/gm;

function fencedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let fence: { marker: string; length: number } | null = null;
  let offset = 0;
  for (const line of content.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const wasFenced = fence !== null;
    if (marker) {
      if (!fence) fence = { marker: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.marker && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    }
    if (wasFenced || fence) ranges.push([offset, offset + line.length + 1]);
    offset += line.length + 1;
  }
  return ranges;
}

function decodeMarker(kind: string | undefined, payload: string): ContentPart[] {
  try {
    if (kind === 'ask_user_question') {
      const question = AskUserQuestionSchema.parse(JSON.parse(payload));
      return [{ t: 'question', question }];
    }
    if (kind === 'buddy_builder_result') {
      const event = BuddyBuilderEventSchema.parse(JSON.parse(decodeURIComponent(payload)));
      return [{ t: 'buddy_builder_result', event }];
    }
    if (kind === 'buddy_worker_thread') {
      const thread = BuddyWorkerThreadSchema.parse(JSON.parse(decodeURIComponent(payload)));
      return [{ t: 'buddy_worker_thread', thread }];
    }
  } catch { /* malformed historical marker stays hidden, never becomes a live affordance */ }
  return [];
}

/** Read old marker and emoji transcripts once when they leave the ingest store. */
export function legacyBody(content: string): MessageBody {
  const parts: ContentPart[] = [];
  const fences = fencedRanges(content);
  const inFence = (index: number) => fences.some(([start, end]) => index >= start && index < end);
  let cursor = 0;
  const appendText = (text: string) => { if (text) parts.push({ t: 'text', text }); };
  for (const marker of content.matchAll(MARKER)) {
    if (inFence(marker.index)) continue;
    if (marker.index > cursor) appendText(content.slice(cursor, marker.index));
    parts.push(...decodeMarker(marker[1], marker[2] ?? ''));
    cursor = marker.index + marker[0].length;
  }
  if (cursor > 0) {
    appendText(content.slice(cursor));
  } else {
    appendText(content);
  }
  const typed: ContentPart[] = [];
  for (const part of parts) {
    if (part.t !== 'text') { typed.push(part); continue; }
    const partFences = fencedRanges(part.text);
    let start = 0;
    for (const line of part.text.matchAll(TOOL_LINE)) {
      if (partFences.some(([first, last]) => line.index >= first && line.index < last)) continue;
      if (line.index > start) typed.push({ t: 'text', text: part.text.slice(start, line.index) });
      typed.push(toolContentPart(line[1], undefined, line[2] ?? ''));
      start = line.index + line[0].length;
    }
    if (start < part.text.length) typed.push({ t: 'text', text: part.text.slice(start) });
  }
  if (typed.length === 1 && typed[0].t === 'text') return { t: 'text', text: typed[0].text };
  return typed.length ? { t: 'parts', parts: typed } : { t: 'text', text: '' };
}
