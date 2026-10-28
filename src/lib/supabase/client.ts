import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Client Supabase côté navigateur (une seule instance partagée). */
export function createClient() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
