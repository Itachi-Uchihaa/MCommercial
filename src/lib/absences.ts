import { addDays, fmtJourCourt } from "@/lib/agenda";
import type { Absence, MotifAbsence } from "@/lib/types";

export const MOTIFS: Record<MotifAbsence, { label: string; className: string }> = {
  ecole: { label: "École", className: "bg-[#f3e8ff] text-[#6a1fb0]" },
  conges: { label: "Congés", className: "bg-warn-soft text-warn" },
  autre: { label: "Absence", className: "bg-[#e6e8ef] text-ink-soft" },
};

export const MOTIF_KEYS = Object.keys(MOTIFS) as MotifAbsence[];

/** Répétition proposée à la saisie : les alternants vont à l'école chaque semaine ou une semaine sur deux. */
export type Repetition = "non" | "semaine" | "deux_semaines";

export const REPETITIONS: { key: Repetition; label: string }[] = [
  { key: "non", label: "Une seule fois" },
  { key: "semaine", label: "Chaque semaine" },
  { key: "deux_semaines", label: "Une semaine sur deux" },
];

/** Au plus un an de répétitions, pour éviter une saisie qui remplirait l'agenda à l'infini. */
export const MAX_OCCURRENCES = 53;

/** Les périodes d'une absence répétée : la première, puis la même décalée de 7 ou 14 jours jusqu'à `jusquau`. */
export function occurrences(debut: string, fin: string, repetition: Repetition, jusquau: string | null) {
  const pas = repetition === "semaine" ? 7 : repetition === "deux_semaines" ? 14 : 0;
  const liste = [{ debut, fin }];
  if (!pas || !jusquau) return liste;
  for (let n = 1; n < MAX_OCCURRENCES; n++) {
    const d = addDays(debut, n * pas);
    if (d > jusquau) break;
    liste.push({ debut: d, fin: addDays(fin, n * pas) });
  }
  return liste;
}

/** Absence de ce commercial ce jour-là (la première trouvée), ou undefined s'il est là. */
export const absenceDe = (absences: Absence[], commercial: string, jour: string) =>
  absences.find((a) => a.commercial === commercial && a.debut <= jour && jour <= a.fin);

/** Jours de semaine (lundi à vendredi) couverts par une période : « 5 jours » pour une semaine d'école. */
export function joursOuvres(debut: string, fin: string) {
  let n = 0;
  for (let j = debut; j <= fin; j = addDays(j, 1)) {
    const jour = new Date(`${j}T00:00:00Z`).getUTCDay();
    if (jour !== 0 && jour !== 6) n++;
  }
  return n;
}

/** « lun. 10 nov. » ou « lun. 10 nov. → ven. 14 nov. » */
export const fmtPeriode = (debut: string, fin: string) =>
  debut === fin ? fmtJourCourt(debut) : `${fmtJourCourt(debut)} → ${fmtJourCourt(fin)}`;

/**
 * Regroupe les absences qui se suivent ou se chevauchent pour un même commercial :
 * deux semaines d'école d'affilée s'affichent « du 10 au 21 nov. », pas en deux lignes.
 */
export function periodesContinues(absences: Absence[]) {
  const triees = [...absences].sort((a, b) => a.commercial.localeCompare(b.commercial) || a.debut.localeCompare(b.debut));
  const out: { commercial: string; debut: string; fin: string; motifs: MotifAbsence[]; absences: Absence[] }[] = [];
  for (const a of triees) {
    const der = out[out.length - 1];
    if (der && der.commercial === a.commercial && a.debut <= addDays(der.fin, 1)) {
      if (a.fin > der.fin) der.fin = a.fin;
      if (!der.motifs.includes(a.motif)) der.motifs.push(a.motif);
      der.absences.push(a);
    } else {
      out.push({ commercial: a.commercial, debut: a.debut, fin: a.fin, motifs: [a.motif], absences: [a] });
    }
  }
  return out.sort((a, b) => a.debut.localeCompare(b.debut) || a.commercial.localeCompare(b.commercial));
}
