import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '@claude-web-view/shared';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import { FilePreview, getPreviewType } from './FilePreview';

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

// Stable reference — module-level so react-markdown doesn't re-mount on every render.
const markdownComponents: Components = {
  code({ children, className, ...rest }) {
    if (className) return <code className={className} {...rest}>{children}</code>;
    const text = typeof children === 'string' ? children.trim() : null;
    if (!text) return <code {...rest}>{children}</code>;
    const previewType = getPreviewType(text);
    if (!previewType) return <code {...rest}>{children}</code>;
    return <FilePreview path={text} type={previewType} />;
  },
};

// =============================================================================
// Memoized Message Rendering
// =============================================================================

interface MemoizedMessageProps {
  msg: Message;
  className: string;
  forwardedRef?: React.RefObject<HTMLDivElement | null>;
}

const MemoizedMessage = memo(function MemoizedMessage({ msg, className, forwardedRef }: MemoizedMessageProps) {
  return (
    <div className={className} ref={forwardedRef}>
      {msg.role !== 'system' && (
        <div className={`message-role ${msg.role}`}>{msg.role}</div>
      )}
      <div className="message-content">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {msg.content || '...'}
        </Markdown>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.msg.content === next.msg.content
    && prev.msg.role === next.msg.role
    && prev.className === next.className
    && prev.forwardedRef === next.forwardedRef;
});

// =============================================================================
// Message Group Types
// =============================================================================

export interface MessageGroup {
  type: 'single' | 'loop-group';
  iteration?: number;
  total?: number;
  messages: Message[];
  isRunning?: boolean;
}

interface VirtualizedMessageListProps {
  messageGroups: MessageGroup[];
  collapsedIterations: Set<number>;
  toggleIterationCollapse: (iteration: number) => void;
  isRunning: boolean;
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
  onScrollStateChange: (isNearBottom: boolean, showScrollButton: boolean) => void;
  conversationId: string;
  markMessagesSeen: (id: string, lastIndex: number) => void;
  totalMessageCount: number;
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
}

// Estimate height based on content — rough approximation before measurement
function estimateGroupSize(group: MessageGroup, isCollapsed: boolean): number {
  if (group.type === 'loop-group' && isCollapsed) {
    return 40; // Just the header
  }

  // Estimate based on message content length
  let totalHeight = 0;
  if (group.type === 'loop-group') {
    totalHeight += 40; // Header height
  }

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
  collapsedIterations,
  toggleIterationCollapse,
  isRunning,
  lastMessageRef,
  onScrollStateChange,
  conversationId,
  markMessagesSeen,
  totalMessageCount,
  scrollToBottomRef,
}: VirtualizedMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const stickyBottomRef = useRef(true);
  // Track conversation ID to detect switches
  const prevConversationIdRef = useRef<string | null>(null);

  const virtualizer = useVirtualizer({
    count: messageGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const group = messageGroups[index];
      const isCollapsed = group.type === 'loop-group' && group.iteration != null
        ? collapsedIterations.has(group.iteration)
        : false;
      return estimateGroupSize(group, isCollapsed);
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
                  collapsedIterations={collapsedIterations}
                  toggleIterationCollapse={toggleIterationCollapse}
                  lastMessageRef={lastMessageRef}
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
// VirtualizedGroup: Renders a single group (either single message or loop-group)
// =============================================================================

interface VirtualizedGroupProps {
  group: MessageGroup;
  isLastGroup: boolean;
  collapsedIterations: Set<number>;
  toggleIterationCollapse: (iteration: number) => void;
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
}

const VirtualizedGroup = memo(function VirtualizedGroup({
  group,
  isLastGroup,
  collapsedIterations,
  toggleIterationCollapse,
  lastMessageRef,
}: VirtualizedGroupProps) {
  if (group.type === 'loop-group' && group.iteration != null) {
    const isCollapsed = collapsedIterations.has(group.iteration);
    return (
      <div className={`loop-iteration-group ${group.isRunning ? 'running' : ''}`}>
        <div
          className="loop-iteration-header"
          onClick={() => toggleIterationCollapse(group.iteration!)}
        >
          <span className="loop-iteration-chevron">
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </span>
          <span className="loop-iteration-label">
            Loop {group.iteration}/{group.total}
          </span>
          {group.isRunning && (
            <span className="loop-iteration-running">running...</span>
          )}
          {isCollapsed && (
            <span className="loop-iteration-collapsed-hint">
              {group.messages.length} message{group.messages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!isCollapsed && group.messages.map((msg, mi) => {
          const isLastMessage = isLastGroup && mi === group.messages.length - 1;
          return (
            <MemoizedMessage
              key={mi}
              msg={msg}
              className={`message ${msg.role} ${msg.isLoopMarker ? 'loop-marker' : ''}`}
              forwardedRef={isLastMessage ? lastMessageRef : undefined}
            />
          );
        })}
      </div>
    );
  }

  // Single (non-loop) messages
  return (
    <>
      {group.messages.map((msg, mi) => {
        const isLastMessage = isLastGroup && mi === group.messages.length - 1;
        return (
          <MemoizedMessage
            key={mi}
            msg={msg}
            className={`message ${msg.role} ${msg.isLoopMarker ? 'loop-marker' : ''}`}
            forwardedRef={isLastMessage ? lastMessageRef : undefined}
          />
        );
      })}
    </>
  );
}, (prev, next) => {
  // Only re-render if the group actually changed
  if (prev.group !== next.group) return false;
  if (prev.isLastGroup !== next.isLastGroup) return false;

  // Check collapsed state for loop groups
  if (prev.group.type === 'loop-group' && prev.group.iteration != null) {
    const prevCollapsed = prev.collapsedIterations.has(prev.group.iteration);
    const nextCollapsed = next.collapsedIterations.has(prev.group.iteration);
    if (prevCollapsed !== nextCollapsed) return false;
  }

  return true;
});
