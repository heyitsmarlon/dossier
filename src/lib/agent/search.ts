import { z } from "zod";

import { EMPTY_QUERY, searchQuerySchema, type SearchQuery } from "@/lib/job-search/search";

/** Fixed product and source-budget cap, shared by forms and server writes. */
export { MAX_AGENT_SEARCHES } from "./limits";
export const agentSearchInputSchema = z.object({
  name: z.string().trim().min(1, "Gib der Suche einen Namen.").max(100),
  query: searchQuerySchema.refine((query) => Boolean(query.keywords), "Gib an, wonach gesucht werden soll."),
  enabled: z.boolean().default(true),
  sort: z.number().int().min(0).default(0),
});
export type AgentSearchInput = z.input<typeof agentSearchInputSchema>;
export type SavedAgentSearch = { id: string; name: string; query: SearchQuery; enabled: boolean; sort: number; createdAt: Date; updatedAt: Date };

/** Shared setup wording for the engine and the master enable action. */
export function agentSearchSetupProblem(searches: readonly SavedAgentSearch[]): string | null {
  if (!searches.length) return "Gib zuerst an, wonach gesucht werden soll (Einstellungen → Job-Agent).";
  const enabled = searches.filter((search) => search.enabled);
  if (!enabled.length) return "Schalte zuerst eine Agent-Suche ein (Einstellungen → Job-Agent).";
  const empty = enabled.find((search) => !search.query.keywords.trim());
  if (empty) return `Gib zuerst an, wonach „${empty.name}“ suchen soll (Einstellungen → Job-Agent).`;
  const missingCountry = enabled.find((search) => !search.query.country);
  if (missingCountry) return `Wähle zuerst ein Land für „${missingCountry.name}“ (Einstellungen → Job-Agent).`;
  return null;
}

/** Same recovery rules as the SQL upgrade: keep meaningful keywords, repair
 * optional fields and truncate the place rather than lose the whole search. */
export function legacyAgentQuery(value: string): SearchQuery | null {
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return null; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  const keywords = searchQuerySchema.shape.keywords.safeParse(q.keywords);
  if (!keywords.success || !keywords.data) return null;
  return {
    keywords: keywords.data,
    place: typeof q.place === "string" ? Array.from(q.place.trim()).slice(0, 200).join("").trim() : "",
    country: searchQuerySchema.shape.country.catch(EMPTY_QUERY.country).parse(q.country),
    radiusKm: searchQuerySchema.shape.radiusKm.catch(EMPTY_QUERY.radiusKm).parse(q.radiusKm),
    remoteOnly: searchQuerySchema.shape.remoteOnly.catch(EMPTY_QUERY.remoteOnly).parse(q.remoteOnly),
    postedWithin: searchQuerySchema.shape.postedWithin.catch(EMPTY_QUERY.postedWithin).parse(q.postedWithin),
  };
}
