"use client";

import type { Trimmed } from "@/lib/application-data";

/** "Studio Brik role" or "1 bullet from the Fieldnote role" */
function describe(item: Trimmed[number]): string {
  if (item.kind === "unit") return item.unit.label;
  const count = item.lines.length;
  return `${count} ${count === 1 ? "Stichpunkt" : "Stichpunkte"} aus ${item.label}`;
}

/** Whether the page limit left it out (E10-10), rather than "Leave out" (#217). */
export const byPageLimit = (item: Trimmed[number]) => item.kind === "bullets" || !item.byHand;

/**
 * What was left out of the resume, each with "Put back": to fit its page
 * limit (E10-10) or by hand (#217). When it's both, the page limit's say so.
 */
export function TrimmedNotice({ items, onPutBack }: { items: Trimmed; onPutBack: (index: number) => void }) {
  const allByPageLimit = items.every(byPageLimit);
  return (
    <div role="note" className="flex flex-col gap-1.5 rounded-card border border-line-card bg-card px-4 py-3 text-meta">
      <p className="text-muted">{allByPageLimit ? "Weggelassen, um ins Seitenlimit zu passen:" : "In diesem Lebenslauf weggelassen:"}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="text-ink">
              {describe(item)}
              {!allByPageLimit && byPageLimit(item) && <span className="text-muted"> · wegen Seitenlimit</span>}
            </span>
            <button
              type="button"
              aria-label={`${describe(item)} wieder aufnehmen`}
              onClick={() => onPutBack(index)}
              className="text-muted underline underline-offset-2 hover:text-ink"
            >
              Wieder aufnehmen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
