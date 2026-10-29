"use server";

import { refresh } from "next/cache";
import { getCurrentMembre } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Change le prénom du membre connecté.
 * Les dossiers, les RDV et les objectifs stockent le prénom du commercial (pas son id) : on les renomme avec lui,
 * sinon ils resteraient rangés sous l'ancien prénom.
 */
export async function updatePrenom(input: string): Promise<ActionResult> {
  try {
    const { me } = await getCurrentMembre();
    if (!me) throw new Error("Ta session a expiré : reconnecte-toi.");

    const nom = input.trim().replace(/\s+/g, " ");
    if (!nom) throw new Error("Indique ton prénom.");
    if (nom.length > 40) throw new Error("Ton prénom doit faire 40 caractères maximum.");
    if (nom === me.nom) return { ok: true, message: "Prénom enregistré" };

    // La table membres n'est modifiable qu'avec la clé secrète (pas de règle d'écriture pour les membres)
    const admin = createAdminClient();
    const { data: membres, error: readError } = await admin.from("membres").select("id, nom");
    if (readError) throw new Error(readError.message);
    if ((membres ?? []).some((m) => m.id !== me.id && m.nom.toLowerCase() === nom.toLowerCase())) {
      throw new Error(`« ${nom} » est déjà pris dans l'équipe. Ajoute l'initiale de ton nom, par exemple « ${nom} B. ».`);
    }

    const { error } = await admin.from("membres").update({ nom }).eq("id", me.id);
    if (error) throw new Error(error.message);
    for (const table of ["dossiers", "rendez_vous", "objectifs"] as const) {
      const { error: renameError } = await admin.from(table).update({ commercial: nom }).eq("commercial", me.nom);
      if (renameError) throw new Error(renameError.message);
    }

    refresh();
    return { ok: true, message: "Prénom enregistré" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." };
  }
}
