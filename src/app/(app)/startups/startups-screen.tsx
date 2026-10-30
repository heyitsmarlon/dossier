"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/score-badge";
import { toast, toastResult } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useJob } from "@/hooks/use-job";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/dates";
import { postedAgo } from "@/lib/job-search/search";
import {
  STARTUP_SOURCE_INFO,
  STARTUP_SOURCES,
  startupFilterHref,
  type StartupEmail,
  type StartupFilter,
  type StartupsRefresh,
  type StartupStatusName,
  type StartupView,
} from "@/lib/startups/types";

import { lookUpStartupAddresses, refreshStartupsNow, removeStartupForGood, saveStartupNotes, setStartupStatus } from "./actions";

const EMAIL_LABEL_WORDS: Record<string, string> = { Hiring: "Bewerbungen", Founders: "Gründer", General: "Allgemein", Person: "Person" };

export type StartupsScreenProps = {
  filter: StartupFilter;
  list: { startups: StartupView[]; total: number; counts: Record<StartupStatusName, number> };
  lastRefresh: StartupsRefresh | null;
  refreshJobId: string | null;
  /** The profile's city and country, for the place filter; "" when not set. */
  city: string;
  country: string;
  /** The profile's headline, for the subject of an email from the user's own mail. */
  headline: string;
  /** Whether an AI provider is set up, so "Write to them" can start an application. */
  aiReady: boolean;
  today: string;
};

const VIEWS: { status: StartupStatusName; label: string }[] = [
  { status: "NEW", label: "Anzusehen" },
  { status: "SAVED", label: "Gemerkt" },
  { status: "CONTACTED", label: "Kontaktiert" },
  { status: "DISMISSED", label: "Verworfen" },
];

/**
 * The Startups screen (#222): startups that are hiring, from YC startups' job
 * posts and Hacker News' "Who is hiring?", ranked against the profile, with
 * the addresses they publish for applications. Dossier sends nothing: the
 * user writes to each one, from New application or their own mail.
 */
export function StartupsScreen({ filter, list, lastRefresh, refreshJobId, city, country, headline, aiReady, today }: StartupsScreenProps) {
  const router = useRouter();
  const [jobId, setJobId] = useState(refreshJobId);
  const [starting, startTransition] = useTransition();

  const job = useJob<StartupsRefresh>(jobId, 0, (update) => {
    if (update.status !== "DONE" && update.status !== "FAILED") return;
    setJobId(null);
    if (update.status === "FAILED") return toast(update.error ?? "Die Aktualisierung wurde nicht abgeschlossen. Versuch es noch einmal.");
    const added = update.result?.added ?? 0;
    toast(added > 0 ? `${added} ${added === 1 ? "neues Startup" : "neue Startups"} gefunden.` : "Diesmal keine neuen Startups.");
    router.refresh();
  });
  const refreshing = Boolean(jobId) && (!job || job.status === "QUEUED" || job.status === "RUNNING");

  const refresh = () =>
    startTransition(async () => {
      const result = toastResult(await refreshStartupsNow({}));
      if (result.ok) setJobId(result.data.jobId);
    });

  const go = (change: Partial<StartupFilter>) => router.replace(startupFilterHref({ ...filter, ...change }), { scroll: false });

  return (
    <>
      <PageHeader
        title="Startups"
        description="Startups, die einstellen, aus den Stellenanzeigen von YC-Startups und dem „Who is hiring?“-Thread auf Hacker News, nach deinem Profil gereiht, mit der Adresse, die jedes für Bewerbungen veröffentlicht. Du schreibst jedes selbst an."
        actions={
          <Button aria-disabled={refreshing || starting || undefined} onClick={() => !refreshing && !starting && refresh()}>
            {refreshing ? "Aktualisiere…" : "Aktualisieren"}
          </Button>
        }
      />
      <div className="flex flex-col gap-6 px-10 pb-20">
        <RefreshStatus lastRefresh={lastRefresh} refreshing={refreshing} step={job?.step ?? null} today={today} />
        {lastRefresh && (
          <>
            <ViewTabs filter={filter} counts={list.counts} />
            <Filters filter={filter} city={city} country={country} onChange={go} />
            {list.startups.length === 0 ? (
              <Empty filter={filter} />
            ) : (
              <>
                <p className="text-meta text-muted">
                  {list.total > list.startups.length ? `Die besten ${list.startups.length} von ${list.total}` : `${list.total} ${list.total === 1 ? "Startup" : "Startups"}`}
                  {filter.sort === "match" ? ", beste Treffer zuerst." : ", neueste zuerst."}
                </p>
                <ul className="flex flex-col gap-3">
                  {list.startups.map((startup) => (
                    <li key={`${startup.id}:${startup.status}:${startup.emails.length}:${startup.score}`}>
                      <StartupCard startup={startup} headline={headline} aiReady={aiReady} today={today} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

function RefreshStatus({ lastRefresh, refreshing, step, today }: { lastRefresh: StartupsRefresh | null; refreshing: boolean; step: string | null; today: string }) {
  if (refreshing) {
    return (
      <p role="status" className="rounded-card border border-line-card bg-card px-4 py-3 text-meta text-muted">
        {step ?? "Startet…"} Das dauert ein, zwei Minuten.
      </p>
    );
  }
  if (!lastRefresh) {
    return (
      <div role="note" className="flex flex-col gap-2 rounded-panel border border-line-card bg-card px-6 py-5 text-sm text-pretty">
        <p>
          Drück <strong>Aktualisieren</strong>, um nach Startups zu suchen. Dossier liest die Stellenanzeigen von YC-Startups und den „Who is hiring?“-Thread dieses Monats auf
          Hacker News, behält die, die an deinem Wohnort oder remote einstellen, und sucht auf den Websites der besten Treffer nach der Adresse, die sie für
          Bewerbungen veröffentlichen, unter Beachtung ihrer robots.txt.
        </p>
        <p className="text-muted">
          Danach aktualisiert es einmal am Tag, solange du diese Seite nutzt. Nichts wird an irgendwen geschickt: Du entscheidest, wem du schreibst.
        </p>
      </div>
    );
  }
  const failed = lastRefresh.sources.filter((source) => source.error);
  return (
    <div className="flex flex-col gap-2 text-meta text-muted">
      <p>
        Zuletzt aktualisiert {formatDateTime(new Date(lastRefresh.at), undefined, new Date(today))}:{" "}
        {lastRefresh.sources
          .filter((source) => !source.error)
          .map((source) => `${STARTUP_SOURCE_INFO[source.source].name} ${source.found}`)
          .join(" · ")}
        .
      </p>
      {failed.length > 0 && (
        <p role="note" className="rounded-card bg-warning-surface px-4 py-2.5 text-warning">
          {failed.map((source) => source.error).join("; ")}. {failed.length < lastRefresh.sources.length ? "Die andere hat funktioniert. " : ""}Die nächste Aktualisierung versucht es erneut.
        </p>
      )}
    </div>
  );
}

function ViewTabs({ filter, counts }: { filter: StartupFilter; counts: Record<StartupStatusName, number> }) {
  return (
    <nav aria-label="Ansichten der Startups" className="flex flex-wrap gap-1.5">
      {VIEWS.map((view) => (
        <Link
          key={view.status}
          href={startupFilterHref({ ...filter, status: view.status })}
          aria-current={view.status === filter.status ? "page" : undefined}
          className={cn(
            "flex items-baseline gap-1.5 rounded-control border px-3 py-2 text-control",
            view.status === filter.status
              ? "border-primary bg-selected font-medium text-primary-text hover:text-primary-text"
              : "border-line-field bg-card text-ink hover:border-line-strong hover:bg-hover hover:text-ink",
          )}
        >
          {view.label}
          <span className="text-xs opacity-65">{counts[view.status]}</span>
        </Link>
      ))}
    </nav>
  );
}

function Filters({ filter, city, country, onChange }: { filter: StartupFilter; city: string; country: string; onChange: (change: Partial<StartupFilter>) => void }) {
  const [q, setQ] = useState(filter.q);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onChange({ q: q.trim() });
  };
  return (
    <form
      role="search"
      aria-label="Startups filtern"
      onSubmit={submit}
      className="grid grid-cols-1 items-end gap-4 rounded-panel border border-line-card bg-card p-6 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
    >
      <Input label="Suche" value={q} placeholder="z. B. android, fintech, Berlin" onChange={(event) => setQ(event.target.value)} onBlur={() => q.trim() !== filter.q && onChange({ q: q.trim() })} />
      <Select label="Wo" value={filter.place} onChange={(event) => onChange({ place: event.target.value as StartupFilter["place"] })}>
        <option value="any">Überall</option>
        {city && <option value="city">{city}</option>}
        {country && <option value="country">{country}</option>}
        <option value="remote">Remote{country ? `, offen für ${country}` : ""}</option>
      </Select>
      <Select label="Quelle" value={filter.source} onChange={(event) => onChange({ source: event.target.value as StartupFilter["source"] })}>
        <option value="">Beide Quellen</option>
        {STARTUP_SOURCES.map((source) => (
          <option key={source} value={source}>
            {STARTUP_SOURCE_INFO[source].name}
          </option>
        ))}
      </Select>
      <Select label="Treffer" value={String(filter.minScore)} onChange={(event) => onChange({ minScore: Number(event.target.value) })}>
        <option value="0">Alle</option>
        <option value="50">ab 50</option>
        <option value="70">ab 70</option>
        <option value="85">ab 85</option>
      </Select>
      <Select label="Sortierung" value={filter.sort} onChange={(event) => onChange({ sort: event.target.value as StartupFilter["sort"] })}>
        <option value="match">Beste Treffer</option>
        <option value="newest">Neueste</option>
      </Select>
      <div className="sm:col-span-2 lg:col-span-5">
        <Checkbox label="Nur mit Adresse zum Anschreiben" checked={filter.withEmail} onChange={(event) => onChange({ withEmail: event.target.checked })} />
      </div>
    </form>
  );
}

function Empty({ filter }: { filter: StartupFilter }) {
  const filtered = filter.q || filter.place !== "any" || filter.source || filter.minScore > 0 || filter.withEmail;
  return (
    <p className="rounded-panel border border-dashed border-line-strong px-7 py-10 text-center text-sm text-muted">
      {filtered ? "Keine passen zu diesen Filtern. Versuch es mit weniger." : filter.status === "NEW" ? "Nichts Neues anzusehen. Die nächste Aktualisierung bringt vielleicht mehr." : "Noch keine hier."}
    </p>
  );
}

/** A subject for writing from the user's own mail. */
const mailto = (email: string, company: string, headline: string) =>
  `mailto:${email}?subject=${encodeURIComponent(headline ? `${headline}, interested in joining ${company}` : `Interested in joining ${company}`)}`;

function StartupCard({ startup: initial, headline, aiReady, today }: { startup: StartupView; headline: string; aiReady: boolean; today: string }) {
  const router = useRouter();
  const [startup, setStartup] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const info = STARTUP_SOURCE_INFO[startup.source];
  const posted = postedAgo(startup.postedAt, new Date(today));
  const blocked = Boolean(startup.noApplicationsFrom);

  const move = async (status: StartupStatusName, message: string) => {
    if (busy) return;
    setBusy(status);
    const before = startup.status;
    const result = toastResult(await setStartupStatus({ id: startup.id, status }));
    setBusy(null);
    if (!result.ok) return;
    toast(message, {
      action: {
        label: "Rückgängig",
        onClick: () => void setStartupStatus({ id: startup.id, status: before }).then((undone) => toastResult(undone).ok && router.refresh()),
      },
    });
    router.refresh();
  };

  const lookUp = async (people: boolean) => {
    if (busy) return;
    setBusy(people ? "people" : "emails");
    const result = toastResult(await lookUpStartupAddresses({ id: startup.id, people }));
    setBusy(null);
    if (!result.ok) return;
    const added = result.data.emails.length - startup.emails.length;
    setStartup(result.data);
    if (result.data.noApplicationsFrom) toast("Laut ihrer Website nehmen sie keine Initiativbewerbungen an.");
    else if (added > 0) toast(`${added} ${added === 1 ? "Adresse" : "Adressen"} auf ihrer Website gefunden.`);
    else toast(people ? "Ihre Website nennt keine persönlichen Adressen." : "Ihre Website nennt keine Adresse für Bewerbungen. Versuch es auf ihrer Karriereseite.");
  };

  const remove = async () => {
    setRemoving(false);
    if (toastResult(await removeStartupForGood({ id: startup.id })).ok) router.refresh();
  };

  return (
    <article aria-label={startup.company} className="flex flex-col gap-4 rounded-panel border border-line-card bg-card px-6 py-5">
      <div className="flex items-start gap-4">
        <ScoreBadge score={startup.score} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-serif text-section">{startup.company}</h3>
            <span className="rounded-full border border-line-field px-2 py-0.5 text-xs text-muted">
              {info.name} · {info.kind}
            </span>
          </div>
          <p className="text-sm text-pretty">{startup.summary}</p>
          <p className="text-meta text-muted">{[startup.location, startup.remote && !/remote/i.test(startup.location) ? "Remote" : "", startup.stage, posted].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {startup.roles.length > 0 && (
        <ul aria-label="Stellen" className="flex flex-wrap gap-1.5">
          {startup.roles.map((role) => (
            <li key={role} className="rounded-full border border-line-field bg-input px-2.5 py-1 text-xs">
              {role}
            </li>
          ))}
        </ul>
      )}

      {startup.reasons.length > 0 && <p className="text-meta text-muted">{startup.reasons.join(" · ")}</p>}

      {blocked && (
        <p role="note" className="rounded-card bg-warning-surface px-4 py-2.5 text-meta text-warning">
          Laut ihrer Website nehmen sie keine Initiativbewerbungen an: {startup.noApplicationsFrom}. Bewirb dich stattdessen auf eine ausgeschriebene Stelle.
        </p>
      )}

      <Emails emails={startup.emails} company={startup.company} headline={headline} peopleChecked={Boolean(startup.peopleCheckedAt)} />

      <div className="flex flex-wrap items-center gap-2">
        {startup.applicationId ? (
          <Link href={`/applications/${startup.applicationId}`} className={buttonClassName("secondary", "sm")}>
            Bewerbung öffnen
          </Link>
        ) : !blocked && aiReady ? (
          <Link href={`/new?startup=${encodeURIComponent(startup.id)}`} className={buttonClassName("primary", "sm")}>
            Anschreiben
          </Link>
        ) : !blocked ? (
          <Link href="/settings?section=ai" className="text-meta text-muted underline underline-offset-2 hover:text-ink">
            Wähle einen KI-Anbieter, um eine Bewerbung zu schreiben
          </Link>
        ) : null}
        {startup.website && !blocked && (
          <Button size="sm" variant="secondary" aria-disabled={busy !== null || undefined} onClick={() => void lookUp(false)}>
            {busy === "emails" ? "Suche…" : startup.emailsCheckedAt ? "Erneut auf ihrer Website suchen" : "Adressen auf ihrer Website finden"}
          </Button>
        )}
        {startup.website && !blocked && startup.emailsCheckedAt && (
          <Button size="sm" variant="text" aria-disabled={busy !== null || undefined} onClick={() => void lookUp(true)}>
            {busy === "people" ? "Suche…" : "Nach persönlichen Adressen suchen"}
          </Button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {startup.status !== "SAVED" && startup.status !== "CONTACTED" && startup.status !== "DISMISSED" && (
            <Button size="sm" variant="secondary" aria-disabled={busy !== null || undefined} onClick={() => void move("SAVED", `${startup.company} gemerkt.`)}>
              Merken
            </Button>
          )}
          {startup.status !== "CONTACTED" && startup.status !== "DISMISSED" && (
            <Button size="sm" variant="text" aria-disabled={busy !== null || undefined} onClick={() => void move("CONTACTED", `${startup.company} als kontaktiert markiert.`)}>
              Als kontaktiert markieren
            </Button>
          )}
          {startup.status === "DISMISSED" || startup.status === "CONTACTED" ? (
            <Button size="sm" variant="text" onClick={() => void move("NEW", `${startup.company} ist zurück unter „Anzusehen“.`)}>
              Zurückverschieben
            </Button>
          ) : (
            <Button size="sm" variant="danger-text" onClick={() => void move("DISMISSED", `${startup.company} verworfen.`)}>
              Verwerfen
            </Button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-meta">
        {startup.links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted underline underline-offset-2 hover:text-ink">
            {link.label} ↗
          </a>
        ))}
        <span className="ml-auto flex items-center gap-4">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-muted underline underline-offset-2 hover:text-ink">
            {open ? "Details ausblenden" : "Details und Notizen"}
          </button>
          <Button size="sm" variant="danger-text" onClick={() => setRemoving(true)}>
            Endgültig entfernen
          </Button>
        </span>
      </div>
      {open && (
        <div className="flex flex-col gap-4">
          {startup.details && startup.details !== startup.summary && <p className="max-h-80 overflow-y-auto text-sm whitespace-pre-wrap text-document">{startup.details}</p>}
          <Notes id={startup.id} initial={startup.notes} />
        </div>
      )}
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={`${startup.company} endgültig entfernen?`}
        description="Dossier löscht, was es über dieses Startup gespeichert hat, seine Adressen und deine Notizen, und Aktualisierungen lassen es künftig aus. Eine begonnene Bewerbung bleibt."
        confirmLabel="Endgültig entfernen"
        onConfirm={() => void remove()}
      />
    </article>
  );
}

function Notes({ id, initial }: { id: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const save = async () => {
    if (notes === saved) return;
    if (toastResult(await saveStartupNotes({ id, notes })).ok) setSaved(notes);
  };
  return <Textarea label="Notizen" rows={3} value={notes} maxLength={5_000} onChange={(event) => setNotes(event.target.value)} onBlur={() => void save()} />;
}

function Emails({ emails, company, headline, peopleChecked }: { emails: StartupEmail[]; company: string; headline: string; peopleChecked: boolean }) {
  if (emails.length === 0) return null;
  const copy = (email: string) =>
    void navigator.clipboard.writeText(email).then(
      () => toast(`${email} kopiert.`),
      () => toast("Kopieren hat nicht geklappt. Markiere die Adresse stattdessen."),
    );
  return (
    <div className="flex flex-col gap-1.5">
      <ul aria-label="Veröffentlichte Adressen" className="flex flex-col gap-1.5">
        {emails.map((entry) => (
          <li key={entry.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="w-20 text-meta text-muted">{EMAIL_LABEL_WORDS[entry.label] ?? entry.label}</span>
            <a href={mailto(entry.email, company, headline)} className="font-medium underline underline-offset-2">
              {entry.email}
            </a>
            <button type="button" onClick={() => copy(entry.email)} className="text-meta text-muted underline underline-offset-2 hover:text-ink">
              Kopieren
            </button>
            {/^https?:\/\//.test(entry.from) && (
              <a href={entry.from} target="_blank" rel="noopener noreferrer" className="text-meta text-muted hover:text-ink">
                Fundstelle ↗
              </a>
            )}
          </li>
        ))}
      </ul>
      {peopleChecked && emails.some((entry) => entry.onRequest) && (
        <p className="text-meta text-muted">Persönliche Adressen werden nach 14 Tagen verworfen, außer du schreibst dieses Startup an.</p>
      )}
    </div>
  );
}
