import { fmtHeure, fmtJourCourt } from "@/lib/agenda";
import { depuis, joursEntre } from "@/lib/dates";
import { derniereEtape, jourEtape, prochaineEtape } from "@/lib/dossiers";
import type { Dossier, RendezVous } from "@/lib/types";

/** Un devis sans réponse depuis ce nombre de jours est à relancer. */
export const DEVIS_SANS_REPONSE_JOURS = 7;
/** Un dossier signé qui n'avance plus (groupe SAV, Form, TPE) depuis ce nombre de jours est bloqué. */
export const ATTENTE_ETAPE_JOURS = 10;
/** Au-delà, un RDV sans compte rendu n'est plus réclamé. */
const COMPTE_RENDU_JOURS_MAX = 30;

export type Relance = {
  cle: string;
  type: "rappel" | "devis" | "compte_rendu" | "apres_signature";
  dossierId: string | null;
  /** RDV concerné (compte rendu à faire). */
  rdv?: RendezVous;
  restaurant: string;
  commercial: string;
  motif: string;
  /** Ancienneté en jours, pour trier les plus urgentes d'abord. */
  jours: number;
};

/** RDV terminé (jour passé, ou aujourd'hui avec l'heure de fin dépassée). */
export const rdvPasse = (r: RendezVous, today: string, nowTime: string) =>
  r.jour < today || (r.jour === today && fmtHeure(r.fin) <= nowTime);

/**
 * Ce qu'il faut relancer : rappels arrivés à échéance, devis sans réponse, RDV sans compte rendu.
 * `blocages` ajoute les dossiers signés qui n'avancent plus (vue directeur).
 */
export function relancesDe({
  dossiers,
  rdvs,
  today,
  nowTime,
  blocages = false,
}: {
  dossiers: Dossier[];
  rdvs: RendezVous[];
  today: string;
  nowTime: string;
  blocages?: boolean;
}): Relance[] {
  const out: Relance[] = [];

  for (const d of dossiers) {
    // Perdu, ou TPE enrôlé (dernière étape) : plus rien à suivre
    if (d.perdu_le || d.enrolement_tpe) continue;
    const base = { dossierId: d.id, restaurant: d.restaurant, commercial: d.commercial };
    const devisLe = jourEtape(d, "devis_fait");

    if (d.relance_le && d.relance_le <= today) {
      out.push({
        ...base,
        cle: `rappel-${d.id}`,
        type: "rappel",
        jours: joursEntre(d.relance_le, today),
        motif: d.relance_le === today ? "Relance prévue aujourd’hui" : `Relance prévue le ${fmtJourCourt(d.relance_le)}`,
      });
    } else if (d.devis_fait && !d.signature && devisLe && !d.relance_le) {
      // relance_le dans le futur = relance déjà faite, on attend
      const n = joursEntre(devisLe, today);
      if (n >= DEVIS_SANS_REPONSE_JOURS) {
        out.push({ ...base, cle: `devis-${d.id}`, type: "devis", jours: n, motif: `Devis envoyé ${depuis(n)}, sans réponse` });
      }
    }

    // Signé, mais la suite (groupe SAV, Form, TPE) n'avance plus
    if (blocages && d.signature) {
      const derniere = derniereEtape(d);
      const suite = prochaineEtape(d);
      if (derniere?.jour && suite) {
        const n = joursEntre(derniere.jour, today);
        if (n >= ATTENTE_ETAPE_JOURS) {
          out.push({
            ...base,
            cle: `suite-${d.id}`,
            type: "apres_signature",
            jours: n,
            motif: `${derniere.long} ${depuis(n)}, « ${suite.long} » pas fait`,
          });
        }
      }
    }
  }

  for (const r of rdvs) {
    if (r.compte_rendu_le || !rdvPasse(r, today, nowTime)) continue;
    const n = joursEntre(r.jour, today);
    if (n > COMPTE_RENDU_JOURS_MAX) continue;
    out.push({
      cle: `cr-${r.id}`,
      type: "compte_rendu",
      dossierId: r.dossier_id,
      rdv: r,
      restaurant: r.restaurant,
      commercial: r.commercial,
      jours: n,
      motif: n === 0 ? `RDV de ${fmtHeure(r.debut)} sans compte rendu` : `RDV du ${fmtJourCourt(r.jour)} sans compte rendu`,
    });
  }

  return out.sort((a, b) => b.jours - a.jours);
}
