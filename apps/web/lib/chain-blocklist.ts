import { getChainBlocklist } from "@coffeesnob/supabase";
import type { ChainEntry } from "./nearby-shops";
import { getSupabase } from "./supabase";

// The chain blocklist, cached briefly so admin edits land within a minute
// (plus up to CACHE_TTL_MS for boxes already cached). If Supabase is down the
// map still works: it serves the last list it had, or no filter at all.
const BLOCKLIST_TTL_MS = 60 * 1000;
let blocklist: { expiresAt: number; names: ChainEntry[] } = { expiresAt: 0, names: [] };
export async function getBlocklist(): Promise<ChainEntry[]> {
  if (blocklist.expiresAt > Date.now()) return blocklist.names;
  try {
    blocklist = { expiresAt: Date.now() + BLOCKLIST_TTL_MS, names: await getChainBlocklist(getSupabase()) };
  } catch {
    blocklist = { ...blocklist, expiresAt: Date.now() + 5000 };
  }
  return blocklist.names;
}
