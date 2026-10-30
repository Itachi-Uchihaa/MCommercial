import { todayParis } from "@/lib/agenda";
import { parisDay } from "@/lib/dates";
import type { Dossier, EtapeDatee, EtapeManuelle, Equipements, RaisonPerte, Source, StepKey } from "@/lib/types";

/** Les étapes du parcours, dans l'ordre. « RDV » se coche toute seule, les autres à la main. */
export const STEPS: { key: StepKey; court: string; long: string }[] = [
  { key: "rdv", court: "RDV", long: "RDV fait" },
  { key: "devis_fait", court: "Devis", long: "Devis envoyé" },
  { key: "signature", court: "Signé", long: "Signé" },
  { key: "groupe_sav", court: "SAV", long: "Groupe SAV créé" },
  { key: "form", court: "Form", long: "Form" },
  { key: "enrolement_tpe", court: "TPE", long: "TPE enrôlé" },
  { key: "installation", court: "Install.", long: "Installation" },
  { key: "accompagnement", court: "Accomp.", long: "Accompagnement" },
];

/** Étapes datées et leur colonne : faites quand leur jour est arrivé. */
export const DATE_PREVUE: Record<EtapeDatee, "date_installation" | "date_accompagnement"> = {
  installation: "date_installation",
  accompagnement: "date_accompagnement",
};

export const estDatee = (key: StepKey): key is EtapeDatee => key in DATE_PREVUE;

/** Date choisie pour une étape datée, si elle est encore à venir (« prévue le … »). */
export function datePrevue(d: Dossier, key: EtapeDatee) {
  const jour = d[DATE_PREVUE[key]];
  return jour && jour > todayParis() ? jour : null;
}

export const ETAPES_MANUELLES: EtapeManuelle[] = ["devis_fait", "signature", "groupe_sav", "form", "enrolement_tpe"];

const DATE_ETAPE = {
  devis_fait: "devis_fait_le",
  signature: "signature_le",
  groupe_sav: "groupe_sav_le",
  form: "form_le",
  enrolement_tpe: "enrolement_tpe_le",
} as const;

/** « RDV » : le premier RDV du dossier a eu lieu. Étapes datées : leur jour est arrivé. */
export function isDone(d: Dossier, key: StepKey) {
  if (key === "rdv") return !!d.rdv_le && d.rdv_le <= todayParis();
  if (estDatee(key)) {
    const jour = d[DATE_PREVUE[key]];
    return !!jour && jour <= todayParis();
  }
  return d[key];
}

/** Modification d'une étape, telle que la base l'enregistre (affichage immédiat avant la réponse). */
export function patchEtape(key: EtapeManuelle, fait: boolean): Partial<Dossier> {
  return { [key]: fait, [DATE_ETAPE[key]]: fait ? new Date().toISOString() : null };
}

/** Jour (AAAA-MM-JJ, heure de Paris) où l'étape a été franchie. */
export function jourEtape(d: Dossier, key: StepKey): string | null {
  if (key === "rdv") return isDone(d, "rdv") ? d.rdv_le : null;
  if (estDatee(key)) return isDone(d, key) ? d[DATE_PREVUE[key]] : null;
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
  { key: "rdv", label: "RDV faits" },
  { key: "devis_fait", label: "Devis" },
  { key: "signature", label: "Signés" },
  { key: "groupe_sav", label: "SAV" },
  { key: "form", label: "Form" },
  { key: "enrolement_tpe", label: "TPE" },
  { key: "installation", label: "Installés" },
  { key: "accompagnement", label: "Accompagnés" },
  { key: "perdu", label: "Perdus" },
];

/** Prochaine étape à franchir : celle qui suit l'étape la plus avancée (null : tout est fait). */
export const prochaineEtape = (d: Dossier) => STEPS[niveau(d) + 1] ?? null;

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

/** SIREN (9 chiffres) : « 123 456 789 ». SIRET (14 chiffres) : « 123 456 789 01234 ». */
export const fmtSiret = (s: string | null) =>
  s ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})?$/, (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(" ")) : "";

/** « SIREN » ou « SIRET » selon le nombre de chiffres enregistrés. */
export const nomSiret = (s: string | null) => (s?.length === 9 ? "SIREN" : "SIRET");

/** Même entreprise : numéros identiques, ou SIREN (9 chiffres) qui ouvre le SIRET de l'autre. */
export const memeEntreprise = (a: string, b: string) =>
  a === b || ((a.length === 9 || b.length === 9) && a.slice(0, 9) === b.slice(0, 9));

/** Formatage pendant la saisie : « 123 456 789 » (SIREN) puis « 123 456 789 01234 » (SIRET). */
export const maskSiret = (raw: string) => {
  const v = raw.replace(/\D/g, "").slice(0, 14);
  return [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9), v.slice(9)].filter(Boolean).join(" ");
};

/** Lien d'appel : garde les chiffres et le « + ». */
export const telHref = (tel: string) => `tel:${tel.replace(/[^\d+]/g, "")}`;

/** Un commercial ne supprime que ses dossiers ; la direction et les admins suppriment ceux de tout le monde. */
export const peutSupprimer = (me: { role: string; nom: string }, d: { commercial: string }) =>
  me.role !== "commercial" || d.commercial === me.nom;

/** Équipements proposés au devis, dans l'ordre d'affichage (« pluriel » pour le résumé). */
export const EQUIPEMENTS: { key: keyof Equipements; label: string; pluriel: string }[] = [
  { key: "devis_ipad", label: "iPad", pluriel: "iPad" },
  { key: "devis_imprimante", label: "Imprimante", pluriel: "imprimantes" },
  { key: "devis_tiroir_caisse", label: "Tiroir caisse", pluriel: "tiroirs caisse" },
  { key: "devis_tpe", label: "TPE", pluriel: "TPE" },
  { key: "devis_borne", label: "Borne", pluriel: "bornes" },
];

/** « 2 iPad · 1 imprimante · 1 TPE » (null si rien n'est prévu). */
export function resumeEquipements(d: Equipements) {
  const parts = EQUIPEMENTS.filter((e) => d[e.key] > 0).map(
    (e) => `${d[e.key]} ${d[e.key] > 1 ? e.pluriel : e.label === "iPad" || e.label === "TPE" ? e.label : e.label.toLowerCase()}`,
  );
  return parts.length ? parts.join(" · ") : null;
}
