import { coreKey, nearIdentical, similarity } from "./dedupe";
import { PLATFORMS, websiteDomain } from "./filter";
import { normalizeChainName, type Roaster, type Stockist } from "./index";

// Roasters we trust and the cafés they say pour their coffee (Phase 5,
// docs/superpowers/specs/2026-09-27-curation-phase-5-roasters-design.md).

type Matchable = { id: string; name: string; address: string | null; locality: string | null; region: string | null; countryCode: string | null; website: string | null };
export type PlaceSummary = { id: string; name: string; address: string | null; locality: string | null; countryCode: string | null };
export type RoasterReport = {
  stockists: { id: string; matchedId: string | null; place?: PlaceSummary; candidates?: PlaceSummary[] }[];
  ownCafes: Record<string, number>;
};

const summary = (p: Matchable): PlaceSummary => ({ id: p.id, name: p.name, address: p.address, locality: p.locality, countryCode: p.countryCode });
const words = (s: string) => normalizeChainName(s).split(" ").filter(Boolean);
// Street words every address shares; they'd make any two addresses look alike.
const STREET = new Set(["st", "street", "rd", "road", "ave", "avenue", "blvd", "dr", "the", "and", "suite", "ste", "unit"]);
const addressWords = (s: string) => new Set(words(s).filter((w) => !STREET.has(w) && (w.length > 1 || /\d/.test(w))));

// Share of the line's address words found in the place's address, city and region.
function addressOverlap(line: Set<string>, p: Matchable): number {
  if (!line.size) return 0;
  const have = addressWords([p.address, p.locality, p.region].filter(Boolean).join(" "));
  return [...line].filter((w) => have.has(w)).length / line.size;
}

// Every stockist gets the one index place that clearly fits, or none plus up
// to three candidates for a person to pick. The admin's pin always wins.
// Per-place why lines: "serves <Roaster>", "<Roaster>'s own café".
// ponytail: one pass over the index to bucket places by the stockists' core
// words, then a scan per bucket. Ceiling: a list of stockists named only with
// very common words ("Central") scans big buckets; fine for hundreds of lines.
export function matchRoasters(
  places: Matchable[],
  roasters: Roaster[],
  stockists: Stockist[],
): { why: Map<string, string[]>; report: RoasterReport } {
  const why = new Map<string, string[]>();
  const add = (id: string, line: string) => {
    const lines = why.get(id) ?? [];
    if (!lines.includes(line)) why.set(id, [...lines, line]);
  };
  const byId = new Map(roasters.map((r) => [r.id, r]));

  const wanted = new Set(stockists.filter((s) => !s.matchedId).flatMap((s) => coreKey(s.rawName).split(" ")).filter(Boolean));
  const bucket = new Map<string, Matchable[]>();
  const domains = new Map<string, Roaster>();
  for (const r of roasters) {
    const d = websiteDomain(r.website);
    if (d && !PLATFORMS.has(d)) domains.set(d, r);
  }
  const ownCafes: Record<string, number> = {};
  const placeById = new Map<string, Matchable>();

  for (const p of places) {
    placeById.set(p.id, p);
    // A roaster's own café: on the roaster's own website. Cafés without one
    // go in as a stockist line.
    const own = domains.get(websiteDomain(p.website) ?? "");
    if (own) {
      add(p.id, `${own.name}'s own café`);
      ownCafes[own.id] = (ownCafes[own.id] ?? 0) + 1;
    }
    if (!wanted.size) continue;
    for (const w of new Set(coreKey(p.name).split(" "))) if (wanted.has(w)) (bucket.get(w) ?? bucket.set(w, []).get(w)!).push(p);
  }

  const report: RoasterReport["stockists"] = stockists.map((s) => {
    const roaster = byId.get(s.roasterId);
    if (s.matchedId) {
      const p = placeById.get(s.matchedId);
      if (p && roaster) add(p.id, `serves ${roaster.name}`);
      return { id: s.id, matchedId: s.matchedId, ...(p ? { place: summary(p) } : {}) };
    }
    const seen = new Set<string>();
    const line = addressWords(s.rawAddress);
    const scored = coreKey(s.rawName)
      .split(" ")
      .flatMap((w) => bucket.get(w) ?? [])
      .filter((p) => !seen.has(p.id) && seen.add(p.id))
      .map((p) => {
        const near = nearIdentical(p.name, s.rawName);
        const name = near ? 1 : similarity(p.name, s.rawName);
        const addr = addressOverlap(line, p);
        const country = roaster?.countryCode && p.countryCode === roaster.countryCode ? 0.5 : 0;
        return { p, near, name, addr, score: name + 2 * addr + country };
      })
      .filter((c) => c.name >= 0.5)
      .sort((a, b) => b.score - a.score);
    const [best, next] = scored;
    const clear = best && (best.addr > 0 || best.near) && (!next || next.score < best.score - 0.01);
    if (clear) {
      if (roaster) add(best.p.id, `serves ${roaster.name}`);
      // Runners-up, so a wrong match can be re-pinned without a new build.
      return { id: s.id, matchedId: best.p.id, place: summary(best.p), candidates: scored.slice(1, 3).map((c) => summary(c.p)) };
    }
    return { id: s.id, matchedId: null, candidates: scored.slice(0, 3).map((c) => summary(c.p)) };
  });

  return { why, report: { stockists: report, ownCafes } };
}
