import { describe, expect, it } from "vitest";
import { mergeCluster } from "../src/dedupe";
import { keepPlace, learnChainSignals } from "../src/filter";
import { sp } from "./helpers";

const chains = [{ name: "starbucks", wikidata: "Q37158" }, { name: "costa", wikidata: "Q608845" }];
const m = (p: Parameters<typeof sp>[0]) => mergeCluster([sp(p)]);

describe("learnChainSignals", () => {
  const branded = [
    m({ sourceId: "osm:node/1", name: "Starbucks Coffee", lat: 1, lng: 1, brandWikidata: "Q37158", website: "https://www.starbucks.com/store/1" }),
    m({ sourceId: "osm:node/2", name: "Starbucks", lat: 2, lng: 2, brandWikidata: "Q37158", website: "https://starbucks.com" }),
    m({ sourceId: "osm:node/3", name: "Costa", lat: 3, lng: 3, brandWikidata: "Q608845", website: "https://facebook.com/costa" }),
    m({ sourceId: "osm:node/4", name: "Costa", lat: 4, lng: 4, brandWikidata: "Q608845", website: "https://facebook.com/costa2" }),
  ];
  const learned = learnChainSignals(branded, chains);

  it("blocks unbranded records named exactly like a branded chain record", () => {
    expect(keepPlace(m({ sourceId: "ov:a", name: "Starbucks Coffee", lat: 5, lng: 5 }), chains, learned)).toBe(false);
  });

  it("blocks unbranded records on a chain's own website domain", () => {
    expect(keepPlace(m({ sourceId: "ov:b", name: "Starbucks (Century Marriott)", lat: 5, lng: 5, website: "http://www.starbucks.com" }), chains, learned)).toBe(false);
  });

  it("learns a domain shared by two entries of the same chain (Starbucks, Starbucks Reserve)", () => {
    const withReserve = [
      ...branded,
      m({ sourceId: "osm:node/5", name: "Starbucks Reserve", lat: 6, lng: 6, brandWikidata: "Q71150001", website: "https://starbucks.com/reserve" }),
    ];
    const both = [...chains, { name: "starbucks reserve", wikidata: "Q71150001" }];
    const l = learnChainSignals(withReserve, both);
    expect(keepPlace(m({ sourceId: "ov:e", name: "Starbucks in Hilton Hotel", lat: 7, lng: 7, website: "http://www.starbucks.com" }), both, l)).toBe(false);
  });

  it("never learns shared platform domains, and never loosens name matching", () => {
    expect(keepPlace(m({ sourceId: "ov:c", name: "Neighbourhood Coffee", lat: 5, lng: 5, website: "https://facebook.com/nbhd" }), chains, learned)).toBe(true);
    expect(keepPlace(m({ sourceId: "ov:d", name: "Costa Rica Café", lat: 5, lng: 5 }), chains, learned)).toBe(true);
  });
});
