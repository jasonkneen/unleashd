import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '@claude-web-view/shared';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import type { Root, Text, Break } from 'mdast';
import type { Plugin } from 'unified';

// Inline remark-breaks: converts soft newlines in text to <br> hard breaks.
// Standard Markdown collapses single newlines into spaces within a paragraph,
// which makes plain-text lists (e.g. file paths) render as one long line.
const remarkBreaks: Plugin<[], Root> = () => (tree) => {
  const visit = (node: Root | Root['children'][number]) => {
    if (!('children' in node)) return;
    const next: typeof node.children = [];
    for (const child of node.children) {
      if (child.type === 'text') {
        const lines = (child as Text).value.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) next.push({ type: 'break' } as Break);
          if (lines[i]) next.push({ type: 'text', value: lines[i] } as Text);
        }
      } else {
        visit(child as Root['children'][number]);
        next.push(child);
      }
    }
    node.children = next as typeof node.children;
  };
  visit(tree);
};
import { FilePreview, getPreviewType } from './FilePreview';
import { ASK_USER_QUESTION_RE, parseAskUserQuestion, AskUserQuestionWidget } from './AskUserQuestion';

// =============================================================================
// VirtualizedMessageList: Renders large message lists efficiently using
// @tanstack/react-virtual. Virtualizes at the messageGroup level to handle
// both single messages and collapsible loop iteration groups.
//
// KEY DESIGN:
// - Virtualizes groups (not individual messages) to maintain loop iteration collapsibility
// - Uses measureElement for accurate dynamic heights after Markdown renders
// - Sticky-bottom mode: auto-scrolls during streaming when user is near bottom
// - Instant scroll on conversation mount (useLayoutEffect avoids flash)
// - overscan: 3 items for smooth scrolling without excessive DOM
// =============================================================================

// =============================================================================
// Tool Line Collapsing
//
// Tool use lines from providers arrive as emoji + filename text chunks embedded
// in the assistant message content (e.g. "📖 train.py\n✏️ objectives.py\n").
// When there are many consecutive tool lines, they create an ugly "brick" of
// noise. This preprocessor detects runs of 3+ consecutive tool lines and
// collapses them into a single summary line like "🔧 8 tool uses".
//
// The collapsed summary preserves the full list as a tooltip (title attribute)
// via a custom markdown paragraph component.
// =============================================================================

// Matches lines that are tool-emoji labels from our providers.
// Pattern: emoji (possibly with variation selector) + space + text
const TOOL_LINE_RE = /^(?:📖|✍️|✏️|⚡|📂|🔍|🌐|📓|🔧|▶️|📦|🔀|📁|🔒|🗑️|❌)\s+\S/;

/** Minimum consecutive tool lines before collapsing */
const COLLAPSE_THRESHOLD = 3;

/**
 * Pre-process message content to collapse long runs of tool-use lines.
 * Runs of COLLAPSE_THRESHOLD+ consecutive tool lines are replaced with
 * a summary. Shorter runs are left as-is.
 */
function collapseToolLines(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let toolRun: string[] = [];

  const flushRun = () => {
    if (toolRun.length >= COLLAPSE_THRESHOLD) {
      // Count by emoji type for a richer summary
      const counts = new Map<string, number>();
      for (const line of toolRun) {
        // Extract first emoji (may be multi-codepoint)
        const emojiMatch = line.match(/^(\S+)\s/);
        const emoji = emojiMatch?.[1] ?? '🔧';
        counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [emoji, count] of counts) {
        parts.push(`${emoji}×${count}`);
      }
      result.push(`\`${parts.join(' ')}\` ${toolRun.length} tool uses`);
    } else {
      result.push(...toolRun);
    }
    toolRun = [];
  };

  for (const line of lines) {
    if (TOOL_LINE_RE.test(line)) {
      toolRun.push(line);
    } else {
      flushRun();
      result.push(line);
    }
  }
  flushRun();

  return result.join('\n');
}

// =============================================================================
// Code Content Classification
//
// react-markdown v10 calls the custom `code` component for BOTH fenced code
// blocks (`<pre><code>`) and inline code (`<code>`). There is no `inline` prop
// in v10 — the only signals are:
//   - className: present when a language tag is specified (e.g. ```python)
//   - text content: fenced blocks have newlines, inline typically doesn't
//
// We classify code content into a discriminated union (CodeContent) and dispatch
// to one handler per variant. This avoids the old fallthrough chain where a
// rejected parsePathBlock silently fell to getPreviewType, which treated entire
// multi-line blocks as a single image path (the "many lines as one line" bug).
//
// CONSTRAINT: parsePathBlock used to be all-or-nothing — if ANY line (like "...")
// wasn't a valid file path, the entire block was rejected. classifyPathBlock
// replaces it with per-line classification: valid paths → FilePreview with hover,
// non-path lines → plain text. The block qualifies as a path_block if at least
// one line is a valid file path.
//
// CONSTRAINT: getPreviewType only handles single-line text (rejects newlines).
// Multi-line text MUST go through classifyPathBlock, never getPreviewType.
// =============================================================================

// -- Types: what a single line within a multi-line code block can be -----------
type PathBlockEntry =
  | { kind: 'file_path'; path: string; type: 'image' | 'html' | 'video' }
  | { kind: 'text_line'; text: string };

// -- Types: what the entire <code> element represents -------------------------
type CodeContent =
  | { kind: 'empty' }
  | { kind: 'syntax_highlighted'; className: string }
  | { kind: 'path_block'; entries: PathBlockEntry[] }
  | { kind: 'clickable_url'; url: string }
  | { kind: 'single_file_path'; path: string; type: 'image' | 'html' | 'video' }
  | { kind: 'plain_code' };

// -- Canonicalization: classify each line independently -----------------------
// Replaces the old parsePathBlock which returned null if ANY line failed.
// Now every line gets a classification — valid paths become file_path entries
// (rendered as FilePreview with hover), everything else becomes text_line
// (rendered as plain monospace text).
function classifyPathBlock(text: string): PathBlockEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const type = getPreviewType(line);
      if (type) return { kind: 'file_path' as const, path: line, type };
      return { kind: 'text_line' as const, text: line };
    });
}

// -- Canonicalization: single entry point for all code content ----------------
// Ordered by specificity: language-tagged > multi-line > single-line patterns.
function classifyCodeContent(
  text: string | null,
  className: string | undefined,
): CodeContent {
  if (!text) return { kind: 'empty' };

  // Language-tagged fenced blocks (className from rehype-highlight, e.g. "language-python").
  // These always pass through to syntax highlighting — never interpreted as paths.
  if (className) return { kind: 'syntax_highlighted', className };

  // Multi-line: fenced code block without language tag.
  if (text.includes('\n')) {
    const entries = classifyPathBlock(text);
    // Upgrade to path_block only if at least one line is a real file path.
    // A block with zero file paths is just plain code.
    if (entries.some((e) => e.kind === 'file_path')) {
      return { kind: 'path_block', entries };
    }
    return { kind: 'plain_code' };
  }

  // Single-line: bare URL in backticks (remark-gfm can't autolink inside code spans).
  if (/^https?:\/\/\S+$/.test(text)) {
    return { kind: 'clickable_url', url: text };
  }

  // Single-line: file path with previewable extension.
  const previewType = getPreviewType(text);
  if (previewType) {
    return { kind: 'single_file_path', path: text, type: previewType };
  }

  return { kind: 'plain_code' };
}

// -- Helpers ------------------------------------------------------------------

function getCodeText(children: unknown): string | null {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    const text = children.map((child) => (typeof child === 'string' ? child : '')).join('');
    return text.length > 0 ? text : null;
  }
  return null;
}

// -- Markdown component overrides ---------------------------------------------
// Factory returns a stable Components object keyed on `workingDirectory` so
// react-markdown doesn't re-mount on every render. Relative file paths are
// resolved against workingDirectory; absolute paths pass through unchanged.
function makeMarkdownComponents(workingDirectory: string): Components {
  return {
    a({ href, children, ...rest }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    },
    // Thin dispatcher: classify once, switch exhaustively, zero work in cases.
    code({ children, className, ...rest }) {
      const text = getCodeText(children)?.trim() ?? null;
      const content = classifyCodeContent(text, className);

      switch (content.kind) {
        case 'empty':
        case 'plain_code':
          return <code className={className} {...rest}>{children}</code>;

        case 'syntax_highlighted':
          return <code className={content.className} {...rest}>{children}</code>;

        case 'path_block':
          return (
            <code className={className} {...rest}>
              {content.entries.map((entry, i) => (
                <span key={i}>
                  {entry.kind === 'file_path'
                    ? <FilePreview path={entry.path} type={entry.type} workingDirectory={workingDirectory} />
                    : <span className="path-block-text-line">{entry.text}</span>
                  }
                  {i < content.entries.length - 1 && <br />}
                </span>
              ))}
            </code>
          );

        case 'clickable_url':
          return (
            <a href={content.url} target="_blank" rel="noopener noreferrer">
              <code {...rest}>{children}</code>
            </a>
          );

        case 'single_file_path':
          return <FilePreview path={content.path} type={content.type} workingDirectory={workingDirectory} />;
      }
    },
  };
}

// =============================================================================
// Memoized Message Rendering
// =============================================================================

interface MemoizedMessageProps {
  msg: Message;
  className: string;
  forwardedRef?: React.RefObject<HTMLDivElement | null>;
  workingDirectory: string;
}

/**
 * Split message content into segments: text (rendered as Markdown) and
 * AskUserQuestion markers (rendered as interactive widgets).
 *
 * The <!--ask_user_question:{json}--> markers are injected by the Claude
 * provider when it detects an AskUserQuestion tool_use in the assistant
 * message. See server/src/providers/claude.ts for the injection point.
 */
type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'ask_user_question'; json: string };

function splitAskUserSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  // Reset regex state (global flag means it's stateful)
  ASK_USER_QUESTION_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ASK_USER_QUESTION_RE.exec(content)) !== null) {
    // Text before the marker
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    // The marker itself
    segments.push({ type: 'ask_user_question', json: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last marker
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return segments;
}

const MemoizedMessage = memo(function MemoizedMessage({ msg, className, forwardedRef, workingDirectory }: MemoizedMessageProps) {
  // Collapse consecutive tool-emoji lines in assistant messages to reduce noise.
  // User/system messages pass through unchanged.
  const displayContent = useMemo(() => {
    if (msg.role !== 'assistant') return msg.content || '...';
    return collapseToolLines(msg.content || '...');
  }, [msg.content, msg.role]);

  // Split content into text + AskUserQuestion widget segments
  const segments = useMemo(() => splitAskUserSegments(displayContent), [displayContent]);
  const hasAskWidget = segments.some(s => s.type === 'ask_user_question');

  // Memoize markdown components keyed on workingDirectory so react-markdown
  // gets a stable reference and doesn't re-mount its component tree.
  const mdComponents = useMemo(() => makeMarkdownComponents(workingDirectory), [workingDirectory]);

  return (
    <div className={className} ref={forwardedRef}>
      {msg.role !== 'system' && (
        <div className={`message-role ${msg.role}`}>{msg.role}</div>
      )}
      <div className="message-content">
        {hasAskWidget ? (
          // Mixed content: interleave Markdown and AskUserQuestion widgets
          segments.map((seg, i) => {
            if (seg.type === 'text') {
              const trimmed = seg.content.trim();
              if (!trimmed) return null;
              return (
                <Markdown
                  key={i}
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeHighlight]}
                  components={mdComponents}
                >
                  {trimmed}
                </Markdown>
              );
            }
            // AskUserQuestion widget
            try {
              const data = parseAskUserQuestion(seg.json);
              return <AskUserQuestionWidget key={i} data={data} />;
            } catch {
              // Malformed JSON — render raw marker as text
              return <code key={i}>AskUserQuestion (parse error)</code>;
            }
          })
        ) : (
          // Fast path: no widgets, render as pure Markdown
          <Markdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeHighlight]}
            components={mdComponents}
          >
            {displayContent}
          </Markdown>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.msg.content === next.msg.content
    && prev.msg.role === next.msg.role
    && prev.className === next.className
    && prev.forwardedRef === next.forwardedRef
    && prev.workingDirectory === next.workingDirectory;
});

// =============================================================================
// Message Group Types
// =============================================================================

export interface MessageGroup {
  type: 'single';
  messages: Message[];
}

interface VirtualizedMessageListProps {
  messageGroups: MessageGroup[];
  isRunning: boolean;
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
  onScrollStateChange: (isNearBottom: boolean, showScrollButton: boolean) => void;
  conversationId: string;
  markMessagesSeen: (id: string, lastIndex: number) => void;
  totalMessageCount: number;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
  /** Conversation working directory — used to resolve relative file paths in previews. */
  workingDirectory: string;
}

// Estimate height based on content — rough approximation before measurement
function estimateGroupSize(group: MessageGroup): number {
  // Estimate based on message content length
  let totalHeight = 0;

  for (const msg of group.messages) {
    const contentLength = msg.content?.length ?? 0;
    // Rough estimate: ~50px base + 20px per 100 chars
    const estimatedHeight = 80 + Math.ceil(contentLength / 100) * 20;
    totalHeight += Math.min(estimatedHeight, 600); // Cap at reasonable max
  }

  return Math.max(totalHeight, 60);
}

export function VirtualizedMessageList({
  messageGroups,
  isRunning,
  lastMessageRef,
  onScrollStateChange,
  conversationId,
  markMessagesSeen,
  totalMessageCount,
  scrollToBottomRef,
  workingDirectory,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const stickyBottomRef = useRef(true);
  // Track conversation ID to detect switches
  const prevConversationIdRef = useRef<string | null>(null);

  const virtualizer = useVirtualizer({
    count: messageGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      return estimateGroupSize(messageGroups[index]);
    },
    overscan: 3,
    measureElement: (element) => {
      // Measure actual DOM height for accurate positioning
      return element.getBoundingClientRect().height;
    },
  });

  // Scroll to bottom instantly on conversation mount (before paint)
  useLayoutEffect(() => {
    const isNewConversation = prevConversationIdRef.current !== conversationId;
    prevConversationIdRef.current = conversationId;

    if (isNewConversation && messageGroups.length > 0) {
      // Instant scroll to bottom on conversation switch
      virtualizer.scrollToIndex(messageGroups.length - 1, { align: 'end' });
      stickyBottomRef.current = true;
    }
  }, [conversationId, messageGroups.length, virtualizer]);

  // Auto-scroll during streaming when sticky-bottom is true
  useEffect(() => {
    if (stickyBottomRef.current && messageGroups.length > 0) {
      virtualizer.scrollToIndex(messageGroups.length - 1, {
        align: 'end',
        behavior: isRunning ? 'auto' : 'smooth',
      });
    }
  }, [messageGroups.length, isRunning, virtualizer]);

  // Track scroll position for sticky-bottom mode
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 150;
    stickyBottomRef.current = isNearBottom;
    onScrollStateChange(isNearBottom, distanceFromBottom >= 200);
  }, [onScrollStateChange]);

  // IntersectionObserver for NEW badge — mark messages seen when last is visible
  useEffect(() => {
    if (totalMessageCount === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            markMessagesSeen(conversationId, totalMessageCount - 1);
          }
        }
      },
      { threshold: 0.5 }
    );

    if (lastMessageRef.current) {
      observer.observe(lastMessageRef.current);
    }

    return () => observer.disconnect();
  }, [conversationId, totalMessageCount, markMessagesSeen, lastMessageRef]);

  // Expose scrollToBottom function via ref
  useEffect(() => {
    if (scrollToBottomRef) {
      scrollToBottomRef.current = () => {
        if (messageGroups.length > 0) {
          virtualizer.scrollToIndex(messageGroups.length - 1, { align: 'end', behavior: 'smooth' });
          stickyBottomRef.current = true;
        }
      };
    }
    return () => {
      if (scrollToBottomRef) {
        scrollToBottomRef.current = null;
      }
    };
  }, [scrollToBottomRef, messageGroups.length, virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="messages-container"
      onScroll={handleScroll}
      style={{ overflowY: 'auto' }}
    >
      {messageGroups.length === 0 ? null : (
        <div
          className="virtual-list-inner"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map((virtualItem) => {
            const group = messageGroups[virtualItem.index];
            const isLastGroup = virtualItem.index === messageGroups.length - 1;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <VirtualizedGroup
                  group={group}
                  isLastGroup={isLastGroup}
                  lastMessageRef={lastMessageRef}
                  workingDirectory={workingDirectory}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// VirtualizedGroup: Renders a single message group
// =============================================================================

interface VirtualizedGroupProps {
  group: MessageGroup;
  isLastGroup: boolean;
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
  workingDirectory: string;
}

const VirtualizedGroup = memo(function VirtualizedGroup({
  group,
  isLastGroup,
  lastMessageRef,
  workingDirectory,
}: VirtualizedGroupProps) {
  return (
    <>
      {group.messages.map((msg, mi) => {
        const isLastMessage = isLastGroup && mi === group.messages.length - 1;
        return (
          <MemoizedMessage
            key={mi}
            msg={msg}
            className={`message ${msg.role}`}
            forwardedRef={isLastMessage ? lastMessageRef : undefined}
            workingDirectory={workingDirectory}
          />
        );
      })}
    </>
  );
}, (prev, next) => {
  if (prev.group !== next.group) return false;
  if (prev.isLastGroup !== next.isLastGroup) return false;
  return true;
});
