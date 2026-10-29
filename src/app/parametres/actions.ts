"use server";

import { refresh } from "next/cache";
import { getCurrentMembre } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Erreur montrée telle quelle (validation) ; toute autre erreur reste dans les logs. */
class Refus extends Error {}

/**
 * Change le prénom du membre connecté.
 * Les dossiers, les RDV et les objectifs stockent le prénom du commercial (pas son id) : on les renomme avec lui,
 * sinon ils resteraient rangés sous l'ancien prénom.
 */
export async function updatePrenom(input: string): Promise<ActionResult> {
  try {
    const { me } = await getCurrentMembre();
    if (!me) throw new Refus("Ta session a expiré : reconnecte-toi.");

    const nom = input.trim().replace(/\s+/g, " ");
    if (!nom) throw new Refus("Indique ton prénom.");
    if (nom.length > 40) throw new Refus("Ton prénom doit faire 40 caractères maximum.");
    if (nom === me.nom) return { ok: true, message: "Prénom enregistré" };

    // La table membres n'est modifiable qu'avec la clé secrète (pas de règle d'écriture pour les membres)
    const admin = createAdminClient();
    const { data: membres, error: readError } = await admin.from("membres").select("id, nom");
    if (readError) throw readError;
    if ((membres ?? []).some((m) => m.id !== me.id && m.nom.toLowerCase() === nom.toLowerCase())) {
      throw new Refus(`« ${nom} » est déjà pris dans l’équipe. Ajoute l’initiale de ton nom, par exemple « ${nom} B. ».`);
    }

    const { error } = await admin.from("membres").update({ nom }).eq("id", me.id);
    if (error) throw error;
    for (const table of ["dossiers", "rendez_vous", "objectifs"] as const) {
      const { error: renameError } = await admin.from(table).update({ commercial: nom }).eq("commercial", me.nom);
      if (renameError) throw renameError;
    }

    refresh();
    return { ok: true, message: "Prénom enregistré" };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, error: e.message };
    console.error("Prénom non enregistré", e);
    return { ok: false, error: "Ton prénom n’a pas pu être enregistré. Vérifie ta connexion et réessaie." };
  }
}
