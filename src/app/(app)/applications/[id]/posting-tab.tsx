"use client";

import Link from "next/link";
import { useId } from "react";

import { FactList } from "@/components/fact-list";
import { MatchRows } from "@/components/match-rows";
import type { Match, Requirement } from "@/lib/application-data";
import type { FactItem } from "@/lib/profile";

import { sectionHref } from "../../profile/sections";

/** The Job posting tab's posting, as saved with the application. */
export type PostingData = {
  text: string;
  /** The saved link to the posting, or "". */
  url: string;
  /** When it was pasted, e.g. "27 Sep". */
  pasted: string;
};

/** "jobs.ledgerly.com/senior-designer" for a link, without the scheme. */
function shortLink(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname === "/" ? "" : pathname}`;
  } catch {
    return url;
  }
}

/**
 * The Job posting tab (APP-11): what the user tells the AI for this
 * application (APP-15), how the profile matches the posting and the posting
 * as pasted, whitespace kept, with a link to the original if saved.
 */
export function PostingTab({
  applicationId,
  posting,
  match,
  requirements,
  onAddSkill,
  facts,
  setFacts,
}: {
  applicationId: string;
  posting: PostingData;
  match: Match | null;
  requirements: Requirement[];
  onAddSkill: (index: number, skill: string) => void;
  facts: FactItem[];
  setFacts: (change: (facts: FactItem[]) => FactItem[]) => void;
}) {
  const factsHint = useId();
  return (
    <div className="@container flex flex-1 flex-col items-center gap-4 overflow-auto bg-canvas px-10 pt-11 pb-16">
      <section
        aria-labelledby={`${factsHint}-title`}
        aria-describedby={factsHint}
        className="flex w-full max-w-[640px] flex-col gap-4 rounded-panel border border-line-card bg-card px-[30px] py-7"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id={`${factsHint}-title`} className="text-[15px] font-medium">
            Fakten für diese Bewerbung
          </h2>
          <p id={factsHint} className="text-sm text-pretty text-muted">
            Was die KI nur für diese Stelle wissen sollte, zusätzlich zu deinen{" "}
            <Link href={sectionHref("facts")} className="text-muted underline underline-offset-2 hover:text-ink">
              Fakten über mich
            </Link>
            . Sie nutzt sie, wenn sie hier das nächste Mal etwas schreibt oder neu schreibt.
          </p>
        </div>
        <FactList
          applicationId={applicationId}
          facts={facts}
          setFacts={setFacts}
          placeholder="z. B. Ich habe die Design-Leitung letztes Jahr auf einer Konferenz getroffen. Oder: Stell meine Forschungsarbeit in den Vordergrund."
        />
      </section>
      <div className="flex w-full max-w-[640px] flex-wrap justify-between gap-x-3 gap-y-1 text-meta text-muted">
        <span className="min-w-0">
          Stellenanzeige
          {posting.url && (
            <>
              {" · "}
              <a
                href={posting.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-muted underline underline-offset-2 hover:text-ink"
              >
                {shortLink(posting.url)}
                <span aria-hidden="true"> ↗</span>{" "}
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            </>
          )}
        </span>
        <span>Pasted {posting.pasted}</span>
      </div>
      <div className="flex w-full max-w-[640px] flex-col gap-[22px] rounded-panel border border-line-card bg-card px-[30px] py-7">
        {match && match.items.length > 0 && <MatchRows match={match} requirements={requirements} onAddSkill={onAddSkill} />}
        <div className={match && match.items.length > 0 ? "flex flex-col gap-2.5 border-t border-line pt-5" : "flex flex-col gap-2.5"}>
          <h2 className="text-[15px] font-medium">Originalanzeige</h2>
          {posting.text.trim() ? (
            <p className="text-sm leading-[1.65] whitespace-pre-wrap text-document">{posting.text}</p>
          ) : (
            <p className="text-sm text-muted">Zu dieser Bewerbung wurde keine Anzeige gespeichert.</p>
          )}
        </div>
      </div>
    </div>
  );
}
