import "server-only";
import type { createClient } from "@/lib/supabase/server";

import type { Membre } from "@/lib/types";

/** Nom sous lequel un admin apparaît pour le reste de l'équipe : les comptes admin restent invisibles. */
export const NOM_ADMIN = "l’équipe mcaisse";

/** Prénom montré à l'équipe pour ce membre (« l'équipe mcaisse » pour un admin). */
export const nomPublic = (m: Pick<Membre, "nom" | "role">) => (m.role === "admin" ? NOM_ADMIN : m.nom);

/** Membre connecté qui fait l'action (pour « Par Lamia » dans les notifications). */
export async function acteur(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase() ?? null;
  if (!email) return { email: null, nom: "Quelqu’un" };
  const { data: m } = await supabase.from("membres").select("nom, role").ilike("email", email).maybeSingle<Pick<Membre, "nom" | "role">>();
  return { email, nom: m ? nomPublic(m) : "Quelqu’un" };
}
