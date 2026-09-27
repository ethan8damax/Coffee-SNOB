import { describe, expect, it } from "vitest";
import { linkUserShops, missingRated } from "../src/freshness";

const place = (id: string, name: string, lat: number, lng: number, sourceIds: string[] = []) => ({ id, name, lat, lng, sourceIds });
const rated = (externalId: string, name = "X", lat = 0, lng = 0) => ({ externalId, name, lat, lng });

describe("missingRated", () => {
  const places = [place("cs_aaaaaaaaaaaa", "Perc", 1, 1, ["ov:1", "osm:node/5"])];

  it("finds rated shops by cs_ id or by an older OSM id, and skips hand-added ones", () => {
    const out = missingRated(places, [rated("cs_aaaaaaaaaaaa"), rated("node/5"), rated("way/9"), rated("user/abc")], []);
    expect(out).toEqual([{ externalId: "way/9", builds: 1 }]);
  });

  it("counts consecutive builds missing, and forgets a shop that came back", () => {
    const prev = [{ externalId: "way/9", builds: 1 }, { externalId: "node/5", builds: 3 }];
    expect(missingRated(places, [rated("way/9"), rated("node/5")], prev)).toEqual([{ externalId: "way/9", builds: 2 }]);
  });
});

describe("linkUserShops", () => {
  it("links a hand-added shop to the same café within 75 m", () => {
    const ps = [place("cs_1", "Perc Coffee", 33.8, -84.4), place("cs_2", "Perc Coffee", 33.81, -84.4)];
    expect(linkUserShops(ps, [rated("user/abc", "Perc", 33.8003, -84.4)])).toBe(1);
    expect(ps[0].sourceIds).toEqual(["user/abc"]);
    expect(ps[1].sourceIds).toEqual([]);
  });

  it("leaves it alone when the name is different or it's too far", () => {
    const ps = [place("cs_1", "Chrome Yellow", 33.8, -84.4), place("cs_2", "Perc", 33.802, -84.4)];
    expect(linkUserShops(ps, [rated("user/abc", "Perc", 33.8, -84.4)])).toBe(0);
  });
});
