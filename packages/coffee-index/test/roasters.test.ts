import { describe, expect, it } from "vitest";
import { parseStockists } from "../src/index";
import { matchRoasters } from "../src/roasters";
import { scorePlace } from "../src/visibility";
import { mergeCluster } from "../src/dedupe";
import { sp } from "./helpers";

const place = (id: string, name: string, extra: Partial<{ address: string; locality: string; region: string; countryCode: string; website: string }> = {}) => ({
  id, name, address: null, locality: null, region: null, countryCode: null, website: null, ...extra,
});
const heart = { id: "r1", name: "Heart", website: "https://www.heartroasters.com/shop", countryCode: "US" };
const line = (id: string, rawName: string, rawAddress = "", matchedId: string | null = null) => ({ id, roasterId: "r1", rawName, rawAddress, matchedId });

describe("parseStockists", () => {
  it("reads 'Name, address' and tab-separated lines, dropping blanks and repeats", () => {
    expect(parseStockists("Blue Door Cafe, 12 Main St, Portland OR\n\n  Luna\t5 Oak Ave\tSeattle \nBlue Door Cafe, 12 Main St, Portland OR\n")).toEqual([
      { rawName: "Blue Door Cafe", rawAddress: "12 Main St, Portland OR" },
      { rawName: "Luna", rawAddress: "5 Oak Ave, Seattle" },
    ]);
  });
});

describe("matchRoasters", () => {
  const places = [
    place("cs_1", "Blue Door Coffee", { address: "12 Main St", locality: "Portland", countryCode: "US" }),
    place("cs_2", "Blue Door Cafe", { address: "400 Elm St", locality: "Boston", countryCode: "US" }),
    place("cs_3", "Luna", { countryCode: "US" }),
    place("cs_4", "Luna", { countryCode: "MX" }),
    place("cs_5", "Heart Coffee", { website: "http://heartroasters.com", countryCode: "US" }),
    place("cs_6", "Moonrise", { countryCode: "US" }),
    place("cs_7", "Moonrise", { countryCode: "US" }),
  ];

  it("matches by name plus address", () => {
    const { report, why } = matchRoasters(places, [heart], [line("s1", "Blue Door Cafe", "12 Main Street, Portland OR")]);
    expect(report.stockists[0]).toMatchObject({ matchedId: "cs_1", place: { name: "Blue Door Coffee" } });
    expect(why.get("cs_1")).toEqual(["serves Heart"]);
  });

  it("uses the roaster's country when a line has no address", () => {
    expect(matchRoasters(places, [heart], [line("s1", "Luna")]).report.stockists[0].matchedId).toBe("cs_3");
  });

  it("leaves a tie unmatched with candidates for the admin", () => {
    const s = matchRoasters(places, [heart], [line("s1", "Moonrise")]).report.stockists[0];
    expect(s.matchedId).toBeNull();
    expect(s.candidates?.map((c) => c.id)).toEqual(["cs_6", "cs_7"]);
  });

  it("never matches on a weak name alone", () => {
    expect(matchRoasters(places, [heart], [line("s1", "Blue Moon Bakery")]).report.stockists[0].matchedId).toBeNull();
  });

  it("lets the admin's pin win", () => {
    const { report, why } = matchRoasters(places, [heart], [line("s1", "Moonrise", "", "cs_7")]);
    expect(report.stockists[0]).toMatchObject({ matchedId: "cs_7", place: { id: "cs_7" } });
    expect(why.get("cs_7")).toEqual(["serves Heart"]);
  });

  it("finds the roaster's own café by website domain", () => {
    const { report, why } = matchRoasters(places, [heart], []);
    expect(why.get("cs_5")).toEqual(["Heart's own café"]);
    expect(report.ownCafes).toEqual({ r1: 1 });
  });

  it("ignores shared platforms as a roaster website", () => {
    const insta = { ...heart, website: "https://instagram.com/heart" };
    const ig = [place("cs_9", "Someone Else", { website: "https://instagram.com/else" })];
    expect(matchRoasters(ig, [insta], []).why.size).toBe(0);
  });
});

describe("roaster visibility", () => {
  it("shows a place a roaster vouches for, first in its why", () => {
    const p = mergeCluster([sp({ sourceId: "osm:node/1", name: "Luna", lat: 1, lng: 1, category: "cafe", datasets: ["OpenStreetMap"] })]);
    expect(scorePlace(p)).toEqual({ visibility: "dim", why: [] });
    expect(scorePlace(p, 0, ["serves Heart"])).toEqual({ visibility: "show", why: ["serves Heart"] });
  });
});
