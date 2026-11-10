import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/cn";
import { DASHBOARD_PERIODS, type DashboardPeriod } from "@/lib/dashboard";
import { formatDay } from "@/lib/dates";
import type { TokenSum, UsageFigures, UsageTotals } from "@/lib/usage";

import { PeriodFilter, PeriodScoped } from "../period-filter";

const number = (value: number) => value.toLocaleString("en-US");
const head = "py-3 pr-5 text-label font-normal text-muted";

/** The Usage screen (#290): the tokens each kind of AI request used, as the servers counted them. */
export function UsageScreen({
  figures,
  period,
  countingSince,
  timeZone,
}: {
  figures: UsageFigures;
  period: DashboardPeriod;
  /** The first request counted, ever; null before there was one. */
  countingSince: Date | null;
  timeZone?: string;
}) {
  const within = DASHBOARD_PERIODS.find((entry) => entry.value === period)?.label.toLowerCase();
  const unreported = figures.total.input.unreported + figures.total.output.unreported > 0;
  return (
    <>
      <PageHeader
        title="Verbrauch"
        description="Die Tokens, die jede Art von KI-Anfrage verbraucht hat, wie dein KI-Anbieter und Jev sie gezählt haben. Eingabe ist, was Dossier gesendet hat, Ausgabe, was zurückkam, Denkschritte eingeschlossen."
      />
      <PeriodFilter period={period} path="/usage" remember={false}>
        <PeriodScoped className="flex max-w-[960px] flex-col gap-3 px-10 pb-[72px]">
          <div className="relative overflow-x-auto rounded-panel border border-line-card bg-card">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">Tokens nach Aufgabe, {within}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={cn(head, "pl-5")}>
                    Aufgabe
                  </th>
                  {["Anfragen", "Eingabe", "Ausgabe", "Gesamt"].map((label) => (
                    <th key={label} scope="col" className={cn(head, "w-[124px] text-right")}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {figures.rows.map((row) => (
                  <tr key={row.task} className="border-b border-line">
                    <th scope="row" className="py-3 pr-5 pl-5 text-left align-top font-normal">
                      <span className="block text-field font-medium">{row.label}</span>
                      <span className="block text-meta text-muted">{row.hint}</span>
                    </th>
                    <Figures totals={row} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="py-3 pr-5 pl-5 text-left align-top text-field font-medium">
                    Alle Aufgaben
                  </th>
                  <Figures totals={figures.total} strong />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-meta text-muted">
            {countingSince ? `Gezählt seit ${formatDay(countingSince, timeZone)}.` : "Noch nichts gezählt. Ab jetzt zählt jede KI-Anfrage."}
            {unreported && " “Not reported” means the server didn't say how many tokens a request used."}
          </p>
        </PeriodScoped>
      </PeriodFilter>
    </>
  );
}

/** Requests, input, output and total, for a task or all of them. */
function Figures({ totals, strong }: { totals: UsageTotals; strong?: boolean }) {
  const cell = cn("py-3 pr-5 text-right align-top text-sm tabular-nums", totals.requests === 0 && "text-muted", strong && "font-medium");
  return (
    <>
      <td className={cell}>{number(totals.requests)}</td>
      <td className={cell}>
        <Tokens sum={totals.input} />
      </td>
      <td className={cell}>
        <Tokens sum={totals.output} />
      </td>
      <td className={cell}>{totals.total === null ? <NotReported /> : number(totals.total)}</td>
    </>
  );
}

function Tokens({ sum }: { sum: TokenSum }) {
  if (sum.tokens === null) return <NotReported />;
  return (
    <>
      {number(sum.tokens)}
      {sum.unreported > 0 && (
        <span className="block text-meta font-normal text-muted">
          {number(sum.unreported)} {sum.unreported === 1 ? "request" : "requests"} not reported
        </span>
      )}
    </>
  );
}

function NotReported() {
  return <span className="font-normal text-muted">Nicht gemeldet</span>;
}
