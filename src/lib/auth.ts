import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Membre } from "@/lib/types";

/** Membre connecté (ou null s'il n'est pas connecté / pas dans l'équipe). */
export async function getCurrentMembre() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email) return { email: null, me: null };

  const { data: me } = await supabase
    .from("membres")
    .select("*")
    .ilike("email", email)
    .maybeSingle<Membre>();

  return { email, me };
}

/** Lève une erreur si l'utilisateur connecté n'est pas admin. */
export async function requireAdmin() {
  const { me } = await getCurrentMembre();
  if (!me || me.role !== "admin") throw new Error("Action réservée aux admins.");
  return me;
}
