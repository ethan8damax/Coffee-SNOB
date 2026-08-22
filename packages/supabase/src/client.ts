import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "./types";

export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<"public">
): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error("createSupabaseClient: both url and anonKey are required");
  }
  return createClient<Database>(url, anonKey, options);
}
