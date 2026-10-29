"use server";

import { refresh } from "next/cache";
import { isIsoDate } from "@/lib/agenda";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Result } from "./dossiers";

/**
 * Enregistre les objectifs de signatures d'un mois, par commercial.
 * Réservé à l'espace Administration : la table n'est modifiable qu'avec la clé secrète.
 */
export async function enregistrerObjectifs(mois: string, objectifs: Record<string, number>): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Seuls les administrateurs peuvent fixer les objectifs." };
  }
  if (!isIsoDate(mois) || !mois.endsWith("-01")) return { ok: false, error: "Mois invalide." };

  const lignes = Object.entries(objectifs).map(([commercial, n]) => ({ commercial, mois, signatures: n }));
  if (lignes.some((l) => !Number.isInteger(l.signatures) || l.signatures < 0 || l.signatures > 999)) {
    return { ok: false, error: "Un objectif doit être un nombre entier entre 0 et 999." };
  }

  try {
    const { error } = await createAdminClient()
      .from("objectifs")
      .upsert(lignes.map((l) => ({ ...l, updated_at: new Date().toISOString() })), { onConflict: "commercial,mois" });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("Objectifs non enregistrés", e);
    return { ok: false, error: "Les objectifs n’ont pas pu être enregistrés. Vérifie ta connexion et réessaie." };
  }
}
