import "server-only";
import { redirect } from "next/navigation";
import { todayParis } from "@/lib/agenda";
import { isAdminEmail } from "@/lib/auth";
import { parisTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Membre } from "@/lib/types";

/**
 * Contexte commun des pages : client Supabase, membre connecté, équipe, jour et heure de Paris.
 * Sans session : redirige vers /login. `me` est null si le compte n'est pas dans l'équipe.
 */
export async function loadSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email) redirect("/login");

  const [{ data: me }, { data: commerciaux }] = await Promise.all([
    supabase.from("membres").select("*").ilike("email", email).maybeSingle<Membre>(),
    supabase.from("membres").select("nom").eq("role", "commercial").order("nom"),
  ]);

  return {
    supabase,
    email,
    me,
    canAdmin: isAdminEmail(email),
    /** Prénoms des membres de rôle « commercial », dans l'ordre (sert aussi aux couleurs). */
    equipe: (commerciaux ?? []).map((c) => c.nom as string),
    today: todayParis(),
    nowTime: parisTime(),
  };
}

/** Comme loadSession, mais renvoie vers l'accueil (« Accès non autorisé ») un compte hors équipe. */
export async function requireMembre() {
  const session = await loadSession();
  if (!session.me) redirect("/");
  return { ...session, me: session.me };
}
