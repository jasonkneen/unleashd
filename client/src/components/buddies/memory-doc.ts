/**
 * client/src/components/buddies/memory-doc.ts
 *
 * κ for a Buddy doc's text → what the Memory page reads. Memory docs are written as
 * `## YYYY-MM-DD` dated entries, often under a leading `<!-- authored_by: … -->` block the
 * Buddy Builder stamps on a soul. The page shows the entries as a timeline (a small date
 * beside each), and the comment as meta, so neither renders as raw markup or giant headings.
 * Pure and CSS-free.
 */

export type MemoryEntry = { date: string; label: string; body: string };

export type MemoryReading = {
  /** `authored_by` from the leading comment; null when the doc carries none. */
  authoredBy: string | null;
  /** Text before the first dated entry (a title, a standing summary). */
  preamble: string;
  entries: MemoryEntry[];
};

const LEADING_COMMENT = /^\s*<!--([\s\S]*?)-->\s*/;
const DATED_HEADING = /^##\s+(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\s*$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `builder (owner:project_…)` reads as `builder`: the id is provenance, not a name. */
function authorOf(comment: string): string | null {
  const match = /^\s*authored_by:\s*([^\s(]+)/m.exec(comment);
  return match ? match[1] : null;
}

export function readMemoryDoc(content: string): MemoryReading {
  const comment = LEADING_COMMENT.exec(content);
  const text = comment ? content.slice(comment[0].length) : content;
  const preamble: string[] = [];
  const entries: { date: string; label: string; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const dated = DATED_HEADING.exec(line);
    if (dated) {
      const [, year, month, day] = dated;
      const date = `${year}-${month}-${day}`;
      // Writers append a second `## <same day>` rather than editing the first; one day, one entry.
      if (entries.at(-1)?.date === date) continue;
      entries.push({
        date,
        label: `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`,
        lines: [],
      });
    } else {
      (entries.at(-1)?.lines ?? preamble).push(line);
    }
  }
  return {
    authoredBy: comment ? authorOf(comment[1]) : null,
    preamble: preamble.join('\n').trim(),
    entries: entries.map(({ date, label, lines }) => ({
      date,
      label,
      body: lines.join('\n').trim(),
    })),
  };
}
