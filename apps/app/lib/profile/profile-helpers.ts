import { colors } from "@coffeesnob/design-tokens";

export const NAME_MAX = 40;
export const BIO_MAX = 280;
export const PAGE_SIZE = 30;
export const PROFILE_MAX_WIDTH = 760;

// 1,234 -> "1.2k". Floors so a count is never overstated.
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  const trim = (v: number) => String(Math.floor(v * 10) / 10);
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}m`;
  if (n >= 1000) return `${trim(n / 1000)}k`;
  return String(Math.floor(n));
}

// Newest entry (index 0) carries the highest number.
export function entryNumber(index: number, total: number): number {
  return total - index;
}

export function displayNameFor(p: { username: string; displayName: string | null }): string {
  return p.displayName?.trim() || p.username;
}

export function gridColumns(width: number): 3 | 4 {
  return width >= 768 ? 4 : 3;
}

// Photo-less tiles: sage ground, every third one oxblood (design's `photo-ph ox`).
export function tileGround(index: number): string {
  return index % 3 === 2 ? colors.oxblood : colors.sageDk;
}

export function remaining(text: string, max: number): number {
  return max - text.length;
}

export function normalizeEdit(input: { displayName: string; bio: string }):
  | { ok: true; fields: { displayName: string | null; bio: string | null } }
  | { ok: false } {
  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (displayName.length > NAME_MAX || bio.length > BIO_MAX) return { ok: false };
  return { ok: true, fields: { displayName: displayName || null, bio: bio || null } };
}

export function withFollowerDelta<T extends { followers: number }>(stats: T, following: boolean): T {
  return { ...stats, followers: Math.max(0, stats.followers + (following ? 1 : -1)) };
}

// A full page suggests there may be more.
export function hasMoreEntries(lastPageLength: number): boolean {
  return lastPageLength >= PAGE_SIZE;
}
