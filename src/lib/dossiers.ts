import { parisDay } from "@/lib/dates";
import type { Dossier, RaisonPerte, Source, StepKey } from "@/lib/types";

/** Les étapes du parcours, dans l'ordre. */
export const STEPS: { key: StepKey; court: string; long: string }[] = [
  { key: "devis_fait", court: "Devis", long: "Devis envoyé" },
  { key: "devis_accepte", court: "Accepté", long: "Devis accepté" },
  { key: "signature", court: "Signé", long: "Signé" },
  { key: "enrolement_tpe", court: "TPE", long: "TPE enrôlé" },
  { key: "installe", court: "Installé", long: "Installé" },
];

const DATE_ETAPE = {
  devis_fait: "devis_fait_le",
  devis_accepte: "devis_accepte_le",
  signature: "signature_le",
  enrolement_tpe: "enrolement_tpe_le",
} as const;

export function isDone(d: Dossier, key: StepKey) {
  return key === "installe" ? !!d.date_installation : d[key];
}

/** Modification d'une étape, telle que la base l'enregistre (affichage immédiat avant la réponse). */
export function patchEtape(key: StepKey, fait: boolean, today: string): Partial<Dossier> {
  if (key === "installe") return { date_installation: fait ? today : null };
  return { [key]: fait, [DATE_ETAPE[key]]: fait ? new Date().toISOString() : null };
}

/** Jour (AAAA-MM-JJ, heure de Paris) où l'étape a été franchie. */
export function jourEtape(d: Dossier, key: StepKey): string | null {
  if (key === "installe") return d.date_installation;
  const ts = d[DATE_ETAPE[key]];
  return ts ? parisDay(ts) : null;
}

/** Index de l'étape cochée la plus avancée (-1 : aucune). */
export function niveau(d: Dossier) {
  let n = -1;
  STEPS.forEach((s, i) => {
    if (isDone(d, s.key)) n = i;
  });
  return n;
}

export type Etape = "prospect" | StepKey | "perdu";

/** Où en est le dossier : perdu, prospect (aucune étape) ou la dernière étape franchie. */
export function etapeDe(d: Dossier): Etape {
  if (d.perdu_le) return "perdu";
  const n = niveau(d);
  return n < 0 ? "prospect" : STEPS[n].key;
}

export const FILTRES_ETAPE: { key: Etape | "tous"; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "prospect", label: "Prospects" },
  { key: "devis_fait", label: "Devis" },
  { key: "devis_accepte", label: "Acceptés" },
  { key: "signature", label: "Signés" },
  { key: "enrolement_tpe", label: "TPE" },
  { key: "installe", label: "Installés" },
  { key: "perdu", label: "Perdus" },
];

/** Prochaine étape à franchir, dans l'ordre du parcours (null : tout est fait). */
export const prochaineEtape = (d: Dossier) => STEPS.find((s) => !isDone(d, s.key)) ?? null;

/** Dernière étape franchie et son jour, pour la carte : « Devis envoyé il y a 9 j ». */
export function derniereEtape(d: Dossier) {
  const n = niveau(d);
  if (n < 0) return null;
  return { ...STEPS[n], jour: jourEtape(d, STEPS[n].key) };
}

export const SOURCES: Record<Source, string> = {
  terrain: "Prospection terrain",
  recommandation: "Recommandation",
  appel_entrant: "Appel entrant",
  salon: "Salon",
  site_web: "Site web",
  autre: "Autre",
};

export const RAISONS_PERTE: Record<RaisonPerte, string> = {
  prix: "Prix trop élevé",
  deja_equipe: "Déjà sous contrat",
  pas_le_moment: "Pas le bon moment",
  pas_interesse: "Pas intéressé",
  autre: "Autre raison",
};

/** « LE PETIT ZINC » → « Le Petit Zinc » */
export const titre = (s: string) => s.toLowerCase().replace(/(^|[\s'’-])\p{L}/gu, (c) => c.toUpperCase());

/** Ville tirée de l'adresse : « 12 RUE OBERKAMPF 75011 PARIS » → « Paris 11e ». */
export function villeDe(adresse: string | null) {
  const m = adresse?.match(/\b(\d{5})\s+([^,\d]+)$/);
  if (!m) return null;
  const [, cp, ville] = m;
  if (/^paris$/i.test(ville.trim()) && cp.startsWith("750")) {
    const arr = Number(cp.slice(3));
    return `Paris ${arr === 1 ? "1er" : `${arr}e`}`;
  }
  return titre(ville.trim());
}

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");

export const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "";

export const fmtSiret = (s: string | null) =>
  s ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4") : "";

/** Formatage pendant la saisie : « 123 456 789 01234 ». */
export const maskSiret = (raw: string) => {
  const v = raw.replace(/\D/g, "").slice(0, 14);
  return [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9), v.slice(9)].filter(Boolean).join(" ");
};

/** Lien d'appel : garde les chiffres et le « + ». */
export const telHref = (tel: string) => `tel:${tel.replace(/[^\d+]/g, "")}`;

/** Un commercial ne supprime que ses dossiers ; la direction et les admins suppriment ceux de tout le monde. */
export const peutSupprimer = (me: { role: string; nom: string }, d: { commercial: string }) =>
  me.role !== "commercial" || d.commercial === me.nom;
