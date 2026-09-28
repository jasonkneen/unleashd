import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type UsePolledFetchResult, usePolledFetch } from '../../hooks/usePolledFetch';
import { formatTimeAgo } from '../../utils/time';
import { readUrl } from './BuddyMemory';
import { BuddySigil } from './BuddySigil';
import { buddyTabPath } from './buddy-tabs';
import type { Doc } from './types';
import './BuddyAboutCard.css';

// The Buddy (i): who it is and what it remembers, on the DM header and the Buddy page.
// Owner, 2026-09-28: the old (i) was a bare role string in an unstyled box and could not
// show memories. The card reads the three Buddy docs only while open (the same cache keys
// the memory page edits, so opening one after the other costs no second round trip).

// Pattern: table-driven (docs/patterns.md#table-driven)
const MEMORY_DOCS = [
  { kind: 'soul', label: 'Soul' },
  { kind: 'working', label: 'Working memory' },
  { kind: 'long_term', label: 'Long-term memory' },
] as const;
type MemoryDoc = (typeof MEMORY_DOCS)[number];

/** The disclosure: (i) summary + card. Outside click and Escape close it. */
export function BuddyAbout(props: {
  buddyId: string;
  name: string;
  role: string;
  /** Short facts under the name (model, status); empty renders nothing. */
  facts: readonly string[];
  /** Extra rows under the role (the Buddy page's reporting line). */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => ref.current?.removeAttribute('open');
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <details
      ref={ref}
      className="buddy-detail-about buddy-about"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onClick={(event) => {
        // A followed link leaves the card behind on the Buddy page (the header stays mounted).
        if ((event.target as Element).closest('a')) ref.current?.removeAttribute('open');
      }}
    >
      <summary aria-label={`About ${props.name}`} title={`About ${props.name}`}>
        ⓘ
      </summary>
      {open && <BuddyAboutCard {...props} />}
    </details>
  );
}

export function BuddyAboutCard({
  buddyId,
  name,
  role,
  facts,
  children,
}: {
  buddyId: string;
  name: string;
  role: string;
  facts: readonly string[];
  children?: ReactNode;
}) {
  const memory = buddyTabPath(buddyId, 'memory');
  return (
    <section className="ui-popover buddy-about-card" aria-label={`About ${name}`}>
      <div className="buddy-about-card__head ui-row">
        <BuddySigil className="buddy-about-card__sigil" name={name} />
        <div className="ui-stack" style={{ minWidth: 0 }}>
          <strong className="ui-truncate">{name}</strong>
          <span className="buddy-about-card__facts ui-truncate">{facts.join(' · ')}</span>
        </div>
      </div>
      <p className="buddy-about-card__role">{role}</p>
      {children}
      <section className="ui-popover__section" aria-label="Memory">
        <p className="ui-section__title">Memory</p>
        <ul className="buddy-about-card__docs">
          {MEMORY_DOCS.map((doc) => (
            <MemoryRow key={doc.kind} buddyId={buddyId} doc={doc} to={`${memory}#${doc.kind}`} />
          ))}
        </ul>
        <Link className="buddy-about-card__open" to={memory}>
          Open memory →
        </Link>
      </section>
    </section>
  );
}

/** One doc read, canonicalised: a never-written doc answers null (revision 0). */
type MemoryView =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'unwritten' }
  | { kind: 'written'; doc: Doc };

function memoryView(read: UsePolledFetchResult<Doc | null>): MemoryView {
  switch (read.kind) {
    case 'idle':
    case 'loading':
      return { kind: 'loading' };
    case 'failed':
      return { kind: 'failed', message: read.error.message };
    case 'ready':
    case 'stale':
      return read.data === null ? { kind: 'unwritten' } : { kind: 'written', doc: read.data };
  }
}

function MemoryRow({ buddyId, doc, to }: { buddyId: string; doc: MemoryDoc; to: string }) {
  const read = usePolledFetch<Doc | null>(
    readUrl(buddyId, doc.kind, { scope: 'buddy', name: '' }),
    0
  );
  const view = memoryView(read);
  return (
    <li>
      <Link className="buddy-about-card__doc ui-stack" to={to}>
        <span className="buddy-about-card__doc-head ui-row">
          <span className="buddy-about-card__doc-label">{doc.label}</span>
          <MemoryMeta view={view} />
        </span>
        <MemoryPreview view={view} />
      </Link>
    </li>
  );
}

function MemoryMeta({ view }: { view: MemoryView }) {
  switch (view.kind) {
    case 'loading':
    case 'failed':
    case 'unwritten':
      return null;
    case 'written':
      return (
        <span className="buddy-about-card__doc-meta">
          Rev {view.doc.revision} · {formatTimeAgo(new Date(view.doc.updatedAt))}
        </span>
      );
  }
}

function MemoryPreview({ view }: { view: MemoryView }) {
  switch (view.kind) {
    case 'loading':
      return <span className="buddy-about-card__preview ui-muted">Loading…</span>;
    case 'failed':
      return (
        <span className="buddy-about-card__preview" role="alert">
          Could not load: {view.message}
        </span>
      );
    case 'unwritten':
      return <span className="buddy-about-card__preview ui-muted">Not written yet</span>;
    case 'written':
      return (
        <span className="buddy-about-card__preview">
          {plainPreview(view.doc.content) || 'Empty'}
        </span>
      );
  }
}

/**
 * Markdown to one line of plain text for a two-line clamp. HTML comments go first: the soul
 * template's guidance lives in `<!-- -->` and would otherwise be every Buddy's preview.
 */
export function plainPreview(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+(.*)$/gm, '$1 —')
    .replace(/^\s{0,3}(>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*`~]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/ —$/, '')
    .trim();
}
