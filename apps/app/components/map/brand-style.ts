// Recolors OpenFreeMap's "positron" vector style to the design's map palette
// (Claude Design "Coffee Snob - Map.html" → "Map style handoff"): warm land,
// cream roads, water only just distinguished, labels ink at 55%, no shields.
// Pure JSON in → JSON out so it can be unit tested; positron ships no POI
// layers, so nothing needs hiding beyond road shields.

export const MAP_PALETTE = {
  land: "#e6dec9",
  block: "#e2d9c2",
  park: "#dcdcbf",
  water: "#d3d5cd",
  roadMinor: "#f1ebda",
  roadMajor: "#f6f1e2",
  rail: "#ddd3bb",
  boundary: "#cfc6b0",
  label: "rgba(75,66,58,.55)",
} as const;

export type StyleLayerLike = {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  [key: string]: unknown;
};
export type StyleLike = { layers: StyleLayerLike[]; [key: string]: unknown };

function recolor(layer: StyleLayerLike): StyleLayerLike {
  const { id, type } = layer;
  const paint = { ...(layer.paint ?? {}) };
  const layout = { ...(layer.layout ?? {}) };
  const out: StyleLayerLike = { ...layer, paint, layout };

  if (type === "background") {
    paint["background-color"] = MAP_PALETTE.land;
  } else if (id === "park" || id === "landcover_wood") {
    paint["fill-color"] = MAP_PALETTE.park;
  } else if (id.startsWith("landcover_ice") || id === "landcover_glacier") {
    paint["fill-color"] = MAP_PALETTE.land;
  } else if (id === "landuse_residential" || id === "building") {
    paint["fill-color"] = MAP_PALETTE.block;
  } else if (id === "water") {
    paint["fill-color"] = MAP_PALETTE.water;
  } else if (id === "waterway") {
    paint["line-color"] = MAP_PALETTE.water;
  } else if (type === "symbol" && /shield/.test(id)) {
    layout.visibility = "none";
  } else if (type === "symbol") {
    paint["text-color"] = MAP_PALETTE.label;
    paint["text-halo-color"] = MAP_PALETTE.land;
  } else if (type === "line" && /casing/.test(id)) {
    // The design's roads are plain cream strokes with no outline.
    paint["line-opacity"] = 0;
  } else if (type === "line" && /^railway/.test(id)) {
    paint["line-color"] = MAP_PALETTE.rail;
  } else if (type === "line" && /^boundary/.test(id)) {
    paint["line-color"] = MAP_PALETTE.boundary;
  } else if (type === "line" && /(major|motorway)/.test(id)) {
    paint["line-color"] = MAP_PALETTE.roadMajor;
  } else if (type === "line" && /^(highway|road|aeroway|tunnel|bridge)/.test(id)) {
    paint["line-color"] = MAP_PALETTE.roadMinor;
  } else if (type === "fill" && /^(aeroway|road_area)/.test(id)) {
    paint["fill-color"] = MAP_PALETTE.roadMinor;
  }

  return out;
}

export function brandStyle<T extends StyleLike>(style: T): T {
  return { ...style, layers: style.layers.map(recolor) };
}
