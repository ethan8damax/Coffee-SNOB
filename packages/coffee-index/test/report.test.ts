import { describe, expect, it } from "vitest";
import { buildReport } from "../src/report";

const place = (id: string, countryCode: string, name = id, brandWikidata: string | null = null) => ({ id, countryCode, name, brandWikidata });

describe("buildReport", () => {
  it("counts by country and diffs against the previous build", () => {
    const r = buildReport([place("a", "US"), place("b", "US"), place("c", "GB")], new Set(["a", "z"]), []);
    expect(r.byCountry).toEqual({ US: 2, GB: 1 });
    expect(r).toMatchObject({ count: 3, added: 2, removed: 1 });
  });
  it("raises the alarm past 10% churn, and not on a first build", () => {
    expect(buildReport([place("a", "US"), place("b", "US")], new Set(["a"]), []).alarm).toMatch(/added/);
    expect(buildReport([place("a", "US")], null, []).alarm).toBeNull();
  });
  it("suggests names with more than 10 places in one country, unless already blocked", () => {
    const many = Array.from({ length: 11 }, (_, i) => place(`p${i}`, "US", "Joe's Coffee"));
    expect(buildReport(many, null, []).suggestedChains).toEqual([{ key: "joes coffee", name: "Joe's Coffee", countryCode: "US", count: 11 }]);
    expect(buildReport(many, null, [{ name: "joes coffee", wikidata: null }]).suggestedChains).toEqual([]);
    expect(buildReport(many.slice(1), null, []).suggestedChains).toEqual([]);
  });
});
