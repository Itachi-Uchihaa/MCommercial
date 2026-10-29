"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { acteur } from "@/lib/acteur";
import { isIsoDate } from "@/lib/agenda";
import { notifierEquipe } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import type { ResultatRdv, SuiteRdv } from "@/lib/types";
import type { Result } from "./dossiers";

const RESULTATS: ResultatRdv[] = ["positif", "a_relancer", "pas_interesse"];
const RESULTAT_LABEL: Record<ResultatRdv, string> = { positif: "positif", a_relancer: "à relancer", pas_interesse: "pas intéressé" };
const SUITES: SuiteRdv[] = ["devis", "nouveau_rdv", "rien"];

export type CompteRenduInput = {
  rdvId: string;
  resultat: ResultatRdv;
  suite: SuiteRdv | null;
  compteRendu: string;
  /** Jour de rappel posé sur le dossier (AAAA-MM-JJ). */
  relanceLe: string | null;
  /** « Pas intéressé » : classer aussi le dossier perdu. */
  classerPerdu: boolean;
};

export async function enregistrerCompteRendu(input: CompteRenduInput): Promise<Result> {
  if (!RESULTATS.includes(input.resultat)) return { ok: false, error: "Indique comment s’est passé le RDV." };
  if (input.suite && !SUITES.includes(input.suite)) return { ok: false, error: "Suite inconnue. Recharge la page et réessaie." };
  if (input.relanceLe && !isIsoDate(input.relanceLe)) return { ok: false, error: "La date de rappel n’est pas valide." };

  try {
    const supabase = await createClient();
    const { data: rdv, error } = await supabase
      .from("rendez_vous")
      .update({
        resultat: input.resultat,
        suite: input.suite,
        compte_rendu: input.compteRendu.trim() || null,
        compte_rendu_le: new Date().toISOString(),
      })
      .eq("id", input.rdvId)
      .select("dossier_id, restaurant")
      .single();
    if (error) throw error;

    after(async () => {
      const a = await acteur(supabase);
      const note = input.compteRendu.trim();
      await notifierEquipe(
        "compte_rendu",
        {
          title: `Compte rendu : ${rdv.restaurant}`,
          body: `RDV de ${a.nom} : ${RESULTAT_LABEL[input.resultat]}${note ? `. ${note.length > 90 ? `${note.slice(0, 90)}…` : note}` : "."}`,
          url: rdv.dossier_id ? `/dossiers/${rdv.dossier_id}` : `/agenda?rdv=${input.rdvId}`,
          tag: `cr-${input.rdvId}`,
        },
        { sauf: a.email },
      );
    });

    if (rdv.dossier_id) {
      const patch = input.classerPerdu
        ? { perdu_le: new Date().toISOString(), raison_perte: "pas_interesse", relance_le: null }
        : input.relanceLe
          ? { relance_le: input.relanceLe }
          : null;
      if (patch) {
        const { error: dossierError } = await supabase.from("dossiers").update(patch).eq("id", rdv.dossier_id);
        if (dossierError) throw dossierError;
      }
    }

    refresh();
    return { ok: true };
  } catch (e) {
    console.error("Compte rendu non enregistré", e);
    return { ok: false, error: "Le compte rendu n’a pas pu être enregistré. Vérifie ta connexion et réessaie." };
  }
}
