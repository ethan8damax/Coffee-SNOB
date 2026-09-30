import { BASEMAP } from "./basemap";
import type { StyleLike } from "./brand-style";

// One fetch of the basemap style per page load, shared by the map and the shop
// band's street fallback; each recolors its own copy.
let styleRequest: Promise<StyleLike> | null = null;
export function loadBaseStyle(): Promise<StyleLike> {
  styleRequest ??= fetch(BASEMAP.styleUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`basemap style request failed: ${response.status}`);
      return response.json() as Promise<StyleLike>;
    })
    .catch((error) => {
      styleRequest = null;
      throw error;
    });
  return styleRequest;
}
