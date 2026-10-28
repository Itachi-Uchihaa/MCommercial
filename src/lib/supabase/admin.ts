import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";

/**
 * Client Supabase avec la clé secrète (service role).
 * Contourne les règles d'accès : à n'utiliser QUE côté serveur, après avoir
 * vérifié que l'utilisateur connecté est admin (voir requireAdmin).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY manquante : ajoute la clé secrète Supabase dans .env.local et dans Vercel.",
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const hasAdminKey = () => !!process.env.SUPABASE_SECRET_KEY;
