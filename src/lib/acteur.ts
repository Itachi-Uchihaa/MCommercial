import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Membre connecté qui fait l'action (pour « Par Lamia » dans les notifications). */
export async function acteur(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase() ?? null;
  if (!email) return { email: null, nom: "Quelqu’un" };
  const { data: m } = await supabase.from("membres").select("nom").ilike("email", email).maybeSingle();
  return { email, nom: (m?.nom as string | undefined) ?? "Quelqu’un" };
}
