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
  it("groups names that start with an ID-backed chain's name, for one-click review", () => {
    const leaks = Array.from({ length: 11 }, (_, i) => place(`s${i}`, "US", `Starbucks Branch ${i}`));
    expect(buildReport(leaks, null, [{ name: "starbucks", wikidata: "Q37158" }]).suggestedChains).toEqual([
      { key: "starbucks", name: "starbucks …", countryCode: "US", count: 11 },
    ]);
  });

  it("labels brand-ID groups with the brand, not a branch", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, countryCode: "DE", name: `Tchibo Filiale ${i}`, brand: "Tchibo", brandWikidata: "Q564213" }));
    expect(buildReport(many, null, []).suggestedChains).toEqual([{ key: "Q564213", name: "Tchibo", countryCode: "DE", count: 11 }]);
  });

  it("drops a chain's leftover group once it matches by prefix or was allowed", () => {
    const leaks = Array.from({ length: 11 }, (_, i) => place(`s${i}`, "US", `Starbucks Branch ${i}`));
    const sb = { name: "starbucks", wikidata: "Q37158" };
    expect(buildReport(leaks, null, [{ ...sb, prefix: true }]).suggestedChains).toEqual([]);
    expect(buildReport(leaks, null, [sb], [sb, { name: "starbucks …", wikidata: null }]).suggestedChains).toEqual([]);
  });

  it("never suggests a chain someone already decided on", () => {
    const many = Array.from({ length: 11 }, (_, i) => place(`p${i}`, "US", "Joe's Coffee"));
    expect(buildReport(many, null, [], [{ name: "joes coffee", wikidata: null }]).suggestedChains).toEqual([]);
  });

  it("suggests names with more than 10 places in one country, unless already blocked", () => {
    const many = Array.from({ length: 11 }, (_, i) => place(`p${i}`, "US", "Joe's Coffee"));
    expect(buildReport(many, null, []).suggestedChains).toEqual([{ key: "joes coffee", name: "Joe's Coffee", countryCode: "US", count: 11 }]);
    expect(buildReport(many, null, [{ name: "joes coffee", wikidata: null }]).suggestedChains).toEqual([]);
    expect(buildReport(many.slice(1), null, []).suggestedChains).toEqual([]);
  });
});
