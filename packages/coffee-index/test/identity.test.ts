import { describe, expect, it } from "vitest";
import { assignIds } from "../src/identity";

describe("assignIds", () => {
  it("makes cs_ ids from the Overture id first, else OSM", () => {
    const { ids } = assignIds([["ov:a", "osm:node/1"], ["osm:node/2"]], {});
    expect(ids[0]).toMatch(/^cs_[0-9a-f]{12}$/);
    expect(ids[0]).not.toBe(ids[1]);
    expect(assignIds([["osm:node/1", "ov:a"]], {}).ids[0]).toBe(ids[0]);
  });

  it("keeps an old id when any source id was seen before", () => {
    const first = assignIds([["osm:node/1"]], {});
    const second = assignIds([["ov:new", "osm:node/1"]], first.idMap);
    expect(second.ids[0]).toBe(first.ids[0]);
    expect(second.idMap["ov:new"]).toBe(first.ids[0]);
  });

  it("gives a split-off cluster a fresh id, not a duplicate", () => {
    const prev = { "osm:node/1": "cs_aaaaaaaaaaaa", "osm:node/2": "cs_aaaaaaaaaaaa" };
    const { ids } = assignIds([["osm:node/1"], ["osm:node/2"]], prev);
    expect(ids[0]).toBe("cs_aaaaaaaaaaaa");
    expect(ids[1]).not.toBe("cs_aaaaaaaaaaaa");
  });

  it("never hands a brand-new place an id another place used before", () => {
    const prev = { "osm:node/1": "cs_aaaaaaaaaaaa" };
    const { ids } = assignIds([["osm:node/7"]], prev);
    expect(ids[0]).not.toBe("cs_aaaaaaaaaaaa");
  });

  it("remembers vanished sources so a comeback keeps its id", () => {
    const { idMap } = assignIds([], { "osm:node/9": "cs_bbbbbbbbbbbb" });
    expect(idMap["osm:node/9"]).toBe("cs_bbbbbbbbbbbb");
  });
});
