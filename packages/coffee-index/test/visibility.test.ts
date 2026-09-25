import { describe, expect, it } from "vitest";
import { scorePlace } from "../src/visibility";
import { mergeCluster } from "../src/dedupe";
import { sp } from "./helpers";

describe("scorePlace", () => {
  it("shows a coffee shop that two sources agree on, and says why", () => {
    const p = mergeCluster([
      sp({ sourceId: "ov:a", name: "Perc", lat: 1, lng: 1, category: "coffee_shop", datasets: ["Foursquare"] }),
      sp({ sourceId: "osm:node/1", name: "Perc", lat: 1, lng: 1, datasets: ["OpenStreetMap"] }),
    ]);
    expect(scorePlace(p)).toEqual({ visibility: "show", why: ["in 2 sources", "listed as a coffee shop"] });
  });
  it("dims a generic café seen once", () => {
    expect(scorePlace(mergeCluster([sp({ sourceId: "osm:node/1", name: "Bakery Café", lat: 1, lng: 1, category: "cafe", datasets: ["OpenStreetMap"] })])))
      .toEqual({ visibility: "dim", why: [] });
  });
  it("counts hours or a website once", () => {
    const p = mergeCluster([sp({ sourceId: "osm:node/1", name: "X", lat: 1, lng: 1, category: "coffee_shop", hours: "24/7", website: "x.com", datasets: ["OpenStreetMap"] })]);
    expect(scorePlace(p)).toEqual({ visibility: "show", why: ["listed as a coffee shop", "has hours or a website"] });
  });
});
