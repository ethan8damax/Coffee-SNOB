import { colors } from "@coffeesnob/design-tokens";
import { pinStyleForRating } from "./pin-style";

// HTML for Leaflet divIcon markers, mirroring the design's map.jsx pins.
// Kept as pure string builders (no DOM, no react-native) so they're unit
// testable; MapView.web.tsx wraps them in L.divIcon. Every marker element is
// zero-sized and anchored at the coordinate — the inner wrapper positions
// itself relative to that point.

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chevronRowHtml(rating: number, color: string, width: number): string {
  const height = (width * 1.27).toFixed(2);
  const chevrons = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<svg width="${width}" height="${height}" viewBox="0 0 9 11" fill="none" stroke="${color}" stroke-opacity="${n <= rating ? "1" : ".3"}" stroke-width="2.8" style="display:block"><path d="M1.5 1.5 6 5.5l-4.5 4"/></svg>`,
    )
    .join("");
  return `<span style="display:inline-flex;gap:1.5px">${chevrons}</span>`;
}

// Tier 4-5 carry the shop name; 1-3 sit back as outlined chevrons-only marks
// (design: "Pin weight is the detour scale, not a rating").
export function ratedPinHtml(opts: { name: string; rating: number; selected: boolean; dimmed: boolean }): string {
  const { name, rating, selected, dimmed } = opts;
  const style = pinStyleForRating(rating);
  const named = rating >= 4;
  const border = selected ? `2px solid ${colors.ink}` : `1px solid ${style.border}`;
  const stem = selected ? colors.ink : style.border;
  const label = named
    ? `<span style="font-family:'AreaExtended-Bold',sans-serif;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:${style.foreground}">${escapeHtml(name)}</span>`
    : "";
  return (
    `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-100%);opacity:${dimmed ? ".72" : "1"};cursor:pointer">` +
    `<div style="display:flex;align-items:center;gap:6px;padding:${named ? "5px 8px" : "5px 6px"};border-radius:2px;background:${style.background};border:${border};white-space:nowrap">` +
    `${label}${chevronRowHtml(rating, style.foreground, named ? 5 : 4.5)}` +
    `</div>` +
    `<div style="width:2px;height:9px;background:${stem};margin:0 auto"></div>` +
    `</div>`
  );
}

// The "any shop nearby" layer: small muted dots, 6px of invisible padding so
// they're tappable.
export function nearbyDotHtml(opts: { selected: boolean; dim?: boolean }): string {
  const { selected, dim = false } = opts;
  const size = selected ? 11 : dim ? 5 : 7;
  return (
    `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:6px;cursor:pointer">` +
    `<div style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;background:${selected ? colors.ink : colors.card};border:1.4px solid ${selected ? colors.ink : colors.ink3};opacity:${selected ? "1" : dim ? ".45" : ".7"}"></div>` +
    `</div>`
  );
}

export function userDotHtml(): string {
  return `<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;box-sizing:border-box;background:${colors.oxblood};border:2.5px solid ${colors.paper}"></div>`;
}
