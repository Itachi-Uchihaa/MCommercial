"use server";

import { refresh } from "next/cache";
import { isIsoDate } from "@/lib/agenda";
import { MOTIF_KEYS, REPETITIONS, occurrences, type Repetition } from "@/lib/absences";
import { getCurrentMembre } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MotifAbsence } from "@/lib/types";
import type { Result } from "./dossiers";

export type AbsenceInput = {
  commercial: string;
  /** AAAA-MM-JJ, fin incluse. */
  debut: string;
  fin: string;
  motif: MotifAbsence;
  note: string;
  repetition: Repetition;
  /** Dernier jour où la répétition peut commencer (AAAA-MM-JJ), si répétition. */
  jusquau: string | null;
};

/** Le membre connecté peut-il gérer les absences de ce commercial ? (même règle que la base) */
async function verifierDroit(commercial: string) {
  const { me } = await getCurrentMembre();
  if (!me) return "Ta session a expiré. Reconnecte-toi puis réessaie.";
  if (me.role === "commercial" && me.nom !== commercial) {
    return "Tu ne peux gérer que tes propres absences. Demande à la direction de s’en charger.";
  }
  return null;
}

/** Ajoute une absence, ou toute une série (école chaque semaine…) en une fois. */
export async function ajouterAbsence(input: AbsenceInput): Promise<Result> {
  if (!input.commercial) return { ok: false, error: "Choisis la personne absente." };
  if (!isIsoDate(input.debut) || !isIsoDate(input.fin)) return { ok: false, error: "Indique le premier et le dernier jour d’absence." };
  if (input.fin < input.debut) return { ok: false, error: "Le dernier jour doit être le même jour ou après le premier." };
  if (!MOTIF_KEYS.includes(input.motif)) return { ok: false, error: "Motif inconnu. Recharge la page et réessaie." };
  if (!REPETITIONS.some((r) => r.key === input.repetition)) return { ok: false, error: "Répétition inconnue. Recharge la page et réessaie." };
  if (input.repetition !== "non" && (!input.jusquau || !isIsoDate(input.jusquau) || input.jusquau < input.debut)) {
    return { ok: false, error: "Indique jusqu’à quand l’absence se répète." };
  }
  const refus = await verifierDroit(input.commercial);
  if (refus) return { ok: false, error: refus };

  const periodes = occurrences(input.debut, input.fin, input.repetition, input.jusquau);
  const serie = periodes.length > 1 ? crypto.randomUUID() : null;
  const note = input.note.trim() || null;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("absences")
      .insert(periodes.map((p) => ({ commercial: input.commercial, ...p, motif: input.motif, note, serie })));
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("Absence non enregistrée", e);
    return { ok: false, error: "L’absence n’a pas pu être enregistrée. Vérifie ta connexion et réessaie." };
  }
}

/** Retire une absence, ou toute sa série à partir d'aujourd'hui (les absences passées restent). */
export async function retirerAbsence(id: string, toute: { serie: string; aPartirDu: string } | null): Promise<Result> {
  try {
    const supabase = await createClient();
    const { data: absence, error: lecture } = await supabase.from("absences").select("commercial").eq("id", id).single();
    if (lecture) throw lecture;
    const refus = await verifierDroit(absence.commercial);
    if (refus) return { ok: false, error: refus };

    const requete = supabase.from("absences").delete();
    const { error } =
      toute && isIsoDate(toute.aPartirDu)
        ? await requete.eq("serie", toute.serie).gte("fin", toute.aPartirDu)
        : await requete.eq("id", id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("Absence non retirée", e);
    return { ok: false, error: "L’absence n’a pas pu être retirée. Vérifie ta connexion et réessaie." };
  }
}
