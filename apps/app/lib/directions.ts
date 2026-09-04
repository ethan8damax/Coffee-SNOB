// One universal URL, no per-platform branching (see docs/superpowers/specs/
// 2026-09-03-map-community-shops-design.md, "Map rendering / integration").
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function openDirections(lat: number, lng: number) {
  const { Linking } = require("react-native");
  return Linking.openURL(directionsUrl(lat, lng));
}
