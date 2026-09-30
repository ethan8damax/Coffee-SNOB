import { colors } from "@coffeesnob/design-tokens";
import type { StyleLike, StyleLayerLike } from "./brand-style";

// The shop band's fallback when a shop has no photo (photos Phase 2 spec,
// section 3): the basemap's streets, one shade off the oxblood ground. Same
// OpenFreeMap style as the map, reduced to road strokes. Pure JSON in → out.
const ROAD = /^(highway|road|tunnel|bridge)/;

function keep(layer: StyleLayerLike): StyleLayerLike {
  if (layer.type === "background") return { ...layer, paint: { ...layer.paint, "background-color": colors.oxblood } };
  if (layer.type === "line" && ROAD.test(layer.id) && !/casing/.test(layer.id)) {
    return { ...layer, paint: { ...layer.paint, "line-color": colors.oxbloodLt, "line-opacity": 1 } };
  }
  return { ...layer, layout: { ...layer.layout, visibility: "none" } };
}

export function streetsStyle<T extends StyleLike>(style: T): T {
  return { ...style, layers: style.layers.map(keep) };
}
