import { describe, it, expect } from "vitest";
import { brandStyle, MAP_PALETTE, type StyleLike } from "./brand-style";

function layer(id: string, type: string, paint: Record<string, unknown> = {}, layout: Record<string, unknown> = {}) {
  return { id, type, paint, layout };
}

const fixture = (): StyleLike => ({
  version: 8,
  sources: {},
  layers: [
    layer("background", "background", { "background-color": "rgb(242,243,240)" }),
    layer("park", "fill", { "fill-color": "rgb(230,233,229)" }),
    layer("water", "fill", { "fill-color": "rgb(194,200,202)" }),
    layer("waterway", "line", { "line-color": "hsl(195,17%,78%)" }),
    layer("building", "fill", { "fill-color": "rgb(234,234,229)" }),
    layer("highway_minor", "line", { "line-color": "hsl(0,0%,88%)" }),
    layer("highway_major_inner", "line", { "line-color": "#fff" }),
    layer("highway_motorway_casing", "line", { "line-color": "rgb(213,213,213)" }),
    layer("highway-shield-us-interstate", "symbol", {}, { "icon-image": "x" }),
    layer("label_city", "symbol", { "text-color": "#000" }),
    layer("something_unknown", "fill", { "fill-color": "red" }),
  ],
});

const byId = (style: StyleLike, id: string) => style.layers.find((l) => l.id === id)!;

describe("brandStyle", () => {
  it("paints land, parks, water and buildings from the design palette", () => {
    const s = brandStyle(fixture());
    expect(byId(s, "background").paint!["background-color"]).toBe(MAP_PALETTE.land);
    expect(byId(s, "park").paint!["fill-color"]).toBe(MAP_PALETTE.park);
    expect(byId(s, "water").paint!["fill-color"]).toBe(MAP_PALETTE.water);
    expect(byId(s, "waterway").paint!["line-color"]).toBe(MAP_PALETTE.water);
    expect(byId(s, "building").paint!["fill-color"]).toBe(MAP_PALETTE.block);
  });

  it("uses cream for roads, lighter for arterials", () => {
    const s = brandStyle(fixture());
    expect(byId(s, "highway_minor").paint!["line-color"]).toBe(MAP_PALETTE.roadMinor);
    expect(byId(s, "highway_major_inner").paint!["line-color"]).toBe(MAP_PALETTE.roadMajor);
  });

  it("removes road casings and shields", () => {
    const s = brandStyle(fixture());
    expect(byId(s, "highway_motorway_casing").paint!["line-opacity"]).toBe(0);
    expect(byId(s, "highway-shield-us-interstate").layout!.visibility).toBe("none");
  });

  it("sets labels to ink at 55% over a land-colored halo", () => {
    const s = brandStyle(fixture());
    expect(byId(s, "label_city").paint!["text-color"]).toBe(MAP_PALETTE.label);
    expect(byId(s, "label_city").paint!["text-halo-color"]).toBe(MAP_PALETTE.land);
  });

  it("leaves unrecognised layers alone and never mutates its input", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const s = brandStyle(input);
    expect(byId(s, "something_unknown").paint!["fill-color"]).toBe("red");
    expect(JSON.stringify(input)).toBe(before);
  });
});
