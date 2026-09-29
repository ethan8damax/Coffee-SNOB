// Admin "Add one yourself": a spot pasted from anywhere — "27.96, -82.46",
// a Google/Apple/OSM map link. null if there's no plausible pair in it.
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // Google place link (the pin, not the camera)
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // Google camera
    /[?&](?:q|ll|query|mlat)=(-?\d+(?:\.\d+)?)(?:,|%2C|&mlon=)(-?\d+(?:\.\d+)?)/i, // ?q=lat,lng · OSM ?mlat=&mlon=
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, // openstreetmap.org/#map=z/lat/lng
    /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/, // plain pair
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  return null;
}

// Straight-line metres between two points (haversine); plenty for "is this the same shop?".
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
