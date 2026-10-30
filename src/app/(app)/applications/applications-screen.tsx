"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";

import { changeStatus } from "@/components/change-status";

import { PageHeader } from "@/components/page-header";
import { buttonClassName } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import type { ApplicationRow } from "@/lib/applications-data";
import { FILTERS, listHref, statusesIn, type Filter, type ListParams, type View } from "@/lib/applications-list";
import { cn } from "@/lib/cn";

import { rememberListView } from "./actions";
import { Board } from "./board";
import { Table } from "./table";

export type ApplicationsScreenProps = {
  params: ListParams;
  /** The applications in view: filtered, searched and sorted. */
  rows: ApplicationRow[];
  /** How many each filter holds, before searching. */
  counts: Record<Filter, number>;
  summary: string;
  /** No applications at all yet. */
  empty: boolean;
  /** Archived applications, hidden unless shown (E9-5). */
  archivedCount: number;
};

const HINTS: Record<View, string> = {
  board: "Zieh eine Karte, um ihren Status zu ändern",
  table: "Klick auf eine Zeile, um sie zu öffnen",
};

/** How long typing pauses before the search runs. */
const SEARCH_DELAY_MS = 250;

/**
 * The Applications screen (LST-1, LST-2): the summary, Board / Table, search
 * and filters. Every change goes into the URL and the server answers with
 * the matching applications.
 */
export function ApplicationsScreen({ params, rows, counts, summary, empty, archivedCount }: ApplicationsScreenProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q);
  // Back and forward change the URL's search; the box follows.
  const [urlQuery, setUrlQuery] = useState(params.q);
  if (params.q !== urlQuery) {
    setUrlQuery(params.q);
    if (params.q !== query.trim()) setQuery(params.q);
  }
  const typing = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A moved card shows in its new column at once; if the move fails, it goes back (LST-4).
  const [shown, showMove] = useOptimistic(rows, (current, { id, to }: { id: string; to: ApplicationStatus }) =>
    current.map((row) => (row.id === id ? { ...row, status: to, updated: "Heute", updatedAt: Date.now() } : row)),
  );
  const [, startMove] = useTransition();
  const move = (row: ApplicationRow, to: ApplicationStatus) =>
    startMove(async () => {
      showMove({ id: row.id, to });
      await changeStatus(row.id, to);
    });

  // Each view, filter or sort gets its own history entry, so Back returns to
  // it, and is remembered for the next visit (LST-7) before the page asks
  // for it. Typing a search only updates the current entry.
  const go = (next: Partial<ListParams>, { replace = false } = {}) => {
    clearTimeout(typing.current);
    const state = { ...params, q: query.trim(), ...next };
    const href = listHref(state);
    const remember = "view" in next || "filter" in next || "sort" in next;
    startTransition(async () => {
      if (remember) await rememberListView({ view: state.view, filter: state.filter, sort: state.sort });
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  };

  const search = (value: string) => {
    setQuery(value);
    clearTimeout(typing.current);
    typing.current = setTimeout(() => go({ q: value.trim() }, { replace: true }), SEARCH_DELAY_MS);
  };

  // On the board the screen keeps to the window and each column scrolls on
  // its own; the table scrolls with the page.
  const board = !empty && rows.length > 0 && params.view === "board";

  return (
    <div className={cn("flex flex-col", board ? "h-panel min-h-[520px]" : "flex-1")}>
      <PageHeader
        title="Bewerbungen"
        description={summary}
        actions={
          <>
            <SegmentedControl<View>
              aria-label="Ansicht"
              size="sm"
              options={[
                { value: "board", label: "Board" },
                { value: "table", label: "Tabelle" },
              ]}
              value={params.view}
              onValueChange={(view) => go({ view })}
            />
            <Link href="/new?fresh=1" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
              + Neue Bewerbung
            </Link>
          </>
        }
      />

      {empty ? (
        <FirstApplication />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 px-10 pb-[18px]">
            <input
              type="search"
              aria-label="Bewerbungen durchsuchen"
              placeholder="Firma oder Stelle suchen"
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && go({ q: query.trim() }, { replace: true })}
              className="min-w-[180px] flex-[0_1_300px] rounded-control border border-line-input bg-input px-3 py-2.5 text-sm placeholder:text-muted focus-visible:border-primary focus-visible:outline-offset-0"
            />
            <div role="group" aria-label="Anzeigen" className="flex flex-wrap gap-1.5">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={params.filter === value}
                  onClick={() => go({ filter: value })}
                  className={cn(
                    "flex items-baseline gap-1.5 rounded-control border px-3 py-2 text-control",
                    params.filter === value ? "border-primary bg-selected font-medium text-primary-text" : "border-line-field bg-card hover:border-line-strong hover:bg-hover",
                  )}
                >
                  {label}{" "}
                  <span className="text-xs opacity-65">{counts[value]}</span>
                </button>
              ))}
            </div>
            {archivedCount > 0 && (
              <button
                type="button"
                aria-pressed={params.archived}
                onClick={() => go({ archived: !params.archived })}
                className="rounded-control px-1 py-2 text-control text-muted underline-offset-3 hover:text-ink aria-pressed:text-ink aria-pressed:underline"
              >
                Archivierte anzeigen{" "}
                <span className="text-xs opacity-65">{archivedCount}</span>
              </button>
            )}
            <span className="ml-auto text-meta text-muted">{HINTS[params.view]}</span>
          </div>

          <div className={cn("flex min-h-0 flex-1 flex-col motion-safe:transition-opacity", pending && "opacity-60")} aria-busy={pending || undefined}>
            {rows.length === 0 ? (
              <Nothing>{params.q ? `Keine Bewerbungen passen zu „${params.q}“.` : "In dieser Ansicht ist noch nichts."}</Nothing>
            ) : board ? (
              <Board rows={shown} statuses={statusesIn(params.filter)} onMove={move} />
            ) : (
              <Table rows={shown} sort={params.sort} onSort={(sort) => go({ sort })} onMove={move} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** When the search or filter leaves nothing to show. */
function Nothing({ children }: { children: ReactNode }) {
  return (
    <div className="mx-10 mb-16 rounded-panel border border-line-card bg-card px-5 py-9 text-center text-sm text-muted">{children}</div>
  );
}

/** Before the first application: where to start. */
function FirstApplication() {
  return (
    <div className="mx-10 mb-16 flex max-w-[640px] flex-col items-start gap-3 rounded-panel border border-line-card bg-card px-7 py-7">
      <h2 className="font-serif text-section">Deine erste Bewerbung</h2>
      <p className="text-sm text-muted">
        Füge eine Stellenanzeige ein, dann lese ich sie, gleiche sie mit deinem Profil ab und entwerfe einen zugeschnittenen Lebenslauf und ein Anschreiben. Aus deinem
        Profil entsteht alles, es lohnt sich also, es zuerst auszufüllen.
      </p>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Link href="/new?fresh=1" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
          + Neue Bewerbung
        </Link>
        <Link href="/profile" className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          Profil ausfüllen
        </Link>
      </div>
    </div>
  );
}
