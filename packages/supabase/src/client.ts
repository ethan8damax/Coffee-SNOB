import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error("createSupabaseClient: both url and anonKey are required");
  }
  return createClient<Database>(url, anonKey);
}
