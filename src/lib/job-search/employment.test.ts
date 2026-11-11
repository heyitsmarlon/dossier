import { describe, expect, it } from "vitest";

import { employmentTypesOf, fitsEmployment } from "./employment";
import { queryFromParams, searchHref } from "./search";

const posting = (title: string, description = "") => ({ title, description });

describe("employment", () => {
  it("reads the kinds from the title first, else the text", () => {
    expect(employmentTypesOf(posting("Verkäufer (m/w/d) in Teilzeit", "Vollzeit möglich"))).toEqual(["parttime"]);
    expect(employmentTypesOf(posting("Verkäufer (m/w/d)", "Wir suchen dich in Vollzeit oder Teilzeit."))).toEqual(["fulltime", "parttime"]);
    expect(employmentTypesOf(posting("Werkstudent Marketing"))).toEqual(["student"]);
    expect(employmentTypesOf(posting("Aushilfe auf Minijob-Basis"))).toEqual(["minijob"]);
    expect(employmentTypesOf(posting("Designer", "Du arbeitest selbstständig im Team."))).toEqual([]);
  });

  it("keeps postings of an asked kind, and ones that don't say", () => {
    const query = { employment: ["fulltime" as const, "parttime" as const] };
    expect(fitsEmployment(posting("Koch (m/w/d) Vollzeit"), query)).toBe(true);
    expect(fitsEmployment(posting("Koch (m/w/d) Teilzeit"), query)).toBe(true);
    expect(fitsEmployment(posting("Koch (m/w/d) Minijob"), query)).toBe(false);
    expect(fitsEmployment(posting("Koch (m/w/d)"), query)).toBe(true);
    expect(fitsEmployment(posting("Koch (m/w/d) Minijob"), {})).toBe(true);
  });

  it("goes in and out of the URL", () => {
    const query = queryFromParams({ q: "Koch", type: "parttime,fulltime,nonsense" })!;
    expect(query.employment).toEqual(["fulltime", "parttime"]);
    expect(searchHref(query)).toBe("/jobs?q=Koch&type=fulltime%2Cparttime");
  });
});
