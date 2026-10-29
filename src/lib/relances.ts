import { fmtHeure, fmtJourCourt } from "@/lib/agenda";
import { depuis, joursEntre } from "@/lib/dates";
import { jourEtape } from "@/lib/dossiers";
import type { Dossier, RendezVous } from "@/lib/types";

/** Un devis sans réponse depuis ce nombre de jours est à relancer. */
export const DEVIS_SANS_REPONSE_JOURS = 7;
/** Un dossier signé (ou TPE enrôlé) qui n'avance plus depuis ce nombre de jours est bloqué. */
export const ATTENTE_ETAPE_JOURS = 10;
/** Au-delà, un RDV sans compte rendu n'est plus réclamé. */
const COMPTE_RENDU_JOURS_MAX = 30;

export type Relance = {
  cle: string;
  type: "rappel" | "devis" | "compte_rendu" | "tpe" | "installation";
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
    if (d.perdu_le || d.date_installation) continue;
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
    } else if (d.devis_fait && !d.devis_accepte && !d.signature && devisLe && !d.relance_le) {
      // relance_le dans le futur = relance déjà faite, on attend
      const n = joursEntre(devisLe, today);
      if (n >= DEVIS_SANS_REPONSE_JOURS) {
        out.push({ ...base, cle: `devis-${d.id}`, type: "devis", jours: n, motif: `Devis envoyé ${depuis(n)}, sans réponse` });
      }
    }

    if (blocages) {
      const signeLe = jourEtape(d, "signature");
      const tpeLe = jourEtape(d, "enrolement_tpe");
      if (d.signature && !d.enrolement_tpe && signeLe) {
        const n = joursEntre(signeLe, today);
        if (n >= ATTENTE_ETAPE_JOURS) {
          out.push({ ...base, cle: `tpe-${d.id}`, type: "tpe", jours: n, motif: `Signé ${depuis(n)}, TPE pas enrôlé` });
        }
      } else if (d.enrolement_tpe && tpeLe) {
        const n = joursEntre(tpeLe, today);
        if (n >= ATTENTE_ETAPE_JOURS) {
          out.push({ ...base, cle: `install-${d.id}`, type: "installation", jours: n, motif: `TPE enrôlé ${depuis(n)}, pas installé` });
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
