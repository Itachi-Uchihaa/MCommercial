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

/** Emails ajoutés à la main dans la variable ADMIN_EMAILS (facultatif), en plus des rôles. */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/** Accès à l'Administration (comptes de l'équipe, objectifs) : admins et directeurs, plus ADMIN_EMAILS. */
export const peutAdministrer = (m: Pick<Membre, "role" | "email">) =>
  m.role === "admin" || m.role === "directeur" || isAdminEmail(m.email);

/** Lève une erreur si l'utilisateur connecté n'a pas accès à l'Administration. */
export async function requireAdmin() {
  const { me } = await getCurrentMembre();
  if (!me || !peutAdministrer(me)) throw new Error("Action réservée à la direction.");
  return me;
}
