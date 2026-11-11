import { employmentAskedFor, type EmploymentType, type SearchQuery } from "./search";

// The kinds of employment a posting offers (Vollzeit, Teilzeit…), read from
// its title, else its text: sources rarely say it in a field of their own.

const PATTERNS: [EmploymentType, RegExp][] = [
  ["fulltime", /vollzeit|full[\s-]?time/i],
  ["parttime", /teilzeit|part[\s-]?time/i],
  ["minijob", /mini[\s-]?job|geringfügig|\b5[2-9]\d\s?(€|euro)/i],
  ["student", /werkstudent|working student/i],
  ["freelance", /freiberuf|freelanc|honorarbasis|\bcontractor\b/i],
];

const typesIn = (text: string) => PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([type]) => type);

/** The kinds a posting names: in its title if it names any there, else in its text; empty when it doesn't say. */
export function employmentTypesOf(posting: { title: string; description: string }): EmploymentType[] {
  const inTitle = typesIn(posting.title);
  return inTitle.length > 0 ? inTitle : typesIn(posting.description);
}

/** Whether a posting may be shown for the kinds a search asks for: it offers one of them, or doesn't say. */
export function fitsEmployment(posting: { title: string; description: string }, query: Pick<SearchQuery, "employment">): boolean {
  const asked = employmentAskedFor(query);
  if (asked.length === 0) return true;
  const offered = employmentTypesOf(posting);
  return offered.length === 0 || offered.some((type) => asked.includes(type));
}
