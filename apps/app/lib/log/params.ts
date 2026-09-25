import type { LogVisitInput } from "@coffeesnob/supabase";

export const NOTE_MAX = 500;

export type LogParams =
  | { kind: "existing"; shopId: string; name?: string }
  | {
      kind: "osm";
      externalId: string;
      name: string;
      lat: number;
      lng: number;
      address: string | null;
      website: string | null;
      phone: string | null;
      hours: string | null;
      legacyIds?: string[];
    }
  | { kind: "none" };

type Raw = Record<string, string | string[] | undefined>;

function str(raw: Raw, key: string): string | null {
  const v = raw[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : null;
}

function num(raw: Raw, key: string): number | null {
  const s = str(raw, key);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseLogParams(raw: Raw): LogParams {
  const shopId = str(raw, "shopId");
  if (shopId) {
    const name = str(raw, "name");
    return name ? { kind: "existing", shopId, name } : { kind: "existing", shopId };
  }
  const externalId = str(raw, "externalId");
  const name = str(raw, "name");
  const lat = num(raw, "lat");
  const lng = num(raw, "lng");
  if (!externalId || !name || lat === null || lng === null) return { kind: "none" };
  return {
    kind: "osm",
    externalId,
    name,
    lat,
    lng,
    address: str(raw, "address"),
    website: str(raw, "website"),
    phone: str(raw, "phone"),
    hours: str(raw, "hours"),
    ...legacyIds(raw),
  };
}

// A coffee index place's OSM ids, comma-joined by the map ("node/7,way/8").
function legacyIds(raw: Raw): { legacyIds?: string[] } {
  const ids = str(raw, "legacyIds")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return ids.length ? { legacyIds: ids } : {};
}

export function normalizeNote(note: string): string | null {
  const t = note.trim().slice(0, NOTE_MAX).trim();
  return t ? t : null;
}

export type LogForm = { rating: number | null; drink: string | null; note: string };

export function buildLogVisitInput(params: LogParams, form: LogForm): LogVisitInput | null {
  if (params.kind === "none" || form.rating === null) return null;
  const common = { rating: form.rating, drink: form.drink, note: normalizeNote(form.note) };
  if (params.kind === "existing") return { kind: "existing", shopId: params.shopId, ...common };
  const { kind: _k, ...shop } = params;
  return { kind: "osm", ...shop, ...common };
}

export function canPublish(params: LogParams, rating: number | null, submitting: boolean): boolean {
  return params.kind !== "none" && rating !== null && !submitting;
}
