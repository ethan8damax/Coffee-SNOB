import { describe, expect, it } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { streetsStyle } from "./streets-style";
import type { StyleLike } from "./brand-style";

const layer = (id: string, type: string, paint: Record<string, unknown> = {}) => ({ id, type, paint, layout: {} });
const fixture = (): StyleLike => ({
  version: 8,
  sources: {},
  layers: [
    layer("background", "background", { "background-color": "#fff" }),
    layer("water", "fill"),
    layer("building", "fill"),
    layer("highway_minor", "line", { "line-color": "#eee" }),
    layer("highway_major_inner", "line", { "line-color": "#fff" }),
    layer("highway_motorway_casing", "line"),
    layer("tunnel_motorway_inner", "line"),
    layer("railway", "line"),
    layer("label_city", "symbol"),
  ],
});
const byId = (s: StyleLike, id: string) => s.layers.find((l) => l.id === id)!;
const shown = (s: StyleLike) => s.layers.filter((l) => l.layout?.visibility !== "none").map((l) => l.id);

describe("streetsStyle", () => {
  it("keeps only the oxblood ground and road strokes", () => {
    const s = streetsStyle(fixture());
    expect(shown(s)).toEqual(["background", "highway_minor", "highway_major_inner", "tunnel_motorway_inner"]);
    expect(byId(s, "background").paint?.["background-color"]).toBe(colors.oxblood);
    expect(byId(s, "highway_minor").paint?.["line-color"]).toBe(colors.oxbloodLt);
  });

  it("doesn't touch the input", () => {
    const input = fixture();
    streetsStyle(input);
    expect(byId(input, "building").layout).toEqual({});
  });
});
