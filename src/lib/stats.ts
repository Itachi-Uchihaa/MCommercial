import { addDays, isoWeek, mondayOf } from "@/lib/agenda";
import { debutDuMois, finDuMois, joursEntre, nomDuMois, parisDay } from "@/lib/dates";
import { RAISONS_PERTE, SOURCES, jourEtape } from "@/lib/dossiers";
import { rdvPasse } from "@/lib/relances";
import type { Dossier, Objectif, RaisonPerte, RendezVous, Source } from "@/lib/types";

export type Periode = "semaine" | "mois" | "trimestre";

export const PERIODES: { key: Periode; label: string }[] = [
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "trimestre", label: "Trimestre" },
];

type Bornes = { debut: string; fin: string; label: string };

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Premier et dernier jour de la période en cours (AAAA-MM-JJ). */
export function bornes(periode: Periode, today: string): Bornes {
  const annee = today.slice(0, 4);
  if (periode === "semaine") {
    const debut = mondayOf(today);
    return { debut, fin: addDays(debut, 6), label: `Semaine ${isoWeek(debut)}` };
  }
  if (periode === "mois") {
    return { debut: debutDuMois(today), fin: finDuMois(today), label: `${maj(nomDuMois(today))} ${annee}` };
  }
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
  const mois = (m: number) => `${annee}-${String(m).padStart(2, "0")}-01`;
  return { debut: mois(q * 3 + 1), fin: finDuMois(mois(q * 3 + 3)), label: `${q === 0 ? "1er" : `${q + 1}e`} trimestre ${annee}` };
}

const dans = (jour: string | null, b: { debut: string; fin: string }) => !!jour && jour >= b.debut && jour <= b.fin;
const somme = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/** Chiffres de l'équipe sur la période : signatures, taux, délai, parcours, par commercial, pertes, sources. */
export function statsEquipe({
  dossiers,
  rdvs,
  objectifs,
  commerciaux,
  today,
  nowTime,
  periode,
}: {
  dossiers: Dossier[];
  rdvs: RendezVous[];
  objectifs: Objectif[];
  commerciaux: string[];
  today: string;
  nowTime: string;
  periode: Periode;
}) {
  const b = bornes(periode, today);
  const signes = dossiers.filter((d) => dans(jourEtape(d, "signature"), b));
  const devis = dossiers.filter((d) => dans(jourEtape(d, "devis_fait"), b));
  const installes = dossiers.filter((d) => dans(d.date_installation, b));

  // Délai moyen : du premier RDV (ou de la création du dossier) à la signature
  const premierRdv = new Map<string, string>();
  for (const r of rdvs) {
    const deja = r.dossier_id && premierRdv.get(r.dossier_id);
    if (r.dossier_id && (!deja || r.jour < deja)) premierRdv.set(r.dossier_id, r.jour);
  }
  const delais = signes
    .map((d) => joursEntre(premierRdv.get(d.id) ?? parisDay(d.created_at), jourEtape(d, "signature")!))
    .filter((n) => n >= 0);

  // Objectif : somme des objectifs mensuels compris dans la période (aucun à la semaine)
  const cibleDe = (nom?: string) => {
    if (periode === "semaine") return null;
    const os = objectifs.filter((o) => dans(o.mois, b) && (!nom || o.commercial === nom));
    return os.length ? somme(os.map((o) => o.signatures)) : null;
  };

  const semaine = { debut: mondayOf(today), fin: addDays(mondayOf(today), 6) };
  const parCommercial = commerciaux.map((nom) => {
    const siens = dossiers.filter((d) => d.commercial === nom);
    const s = siens.filter((d) => dans(jourEtape(d, "signature"), b)).length;
    const dv = siens.filter((d) => dans(jourEtape(d, "devis_fait"), b)).length;
    return {
      nom,
      rdvSemaine: rdvs.filter((r) => r.commercial === nom && dans(r.jour, semaine)).length,
      devisEnAttente: siens.filter((d) => !d.perdu_le && d.devis_fait && !d.devis_accepte && !d.signature).length,
      signes: s,
      cible: cibleDe(nom),
      taux: dv ? Math.round((s / dv) * 100) : null,
    };
  });

  const perdus = dossiers.filter((d) => d.perdu_le && dans(parisDay(d.perdu_le), b));
  const pertes = (Object.keys(RAISONS_PERTE) as RaisonPerte[])
    .map((r) => ({ label: RAISONS_PERTE[r], n: perdus.filter((d) => (d.raison_perte ?? "autre") === r).length }))
    .filter((x) => x.n > 0)
    .sort((a, c) => c.n - a.n);
  const sources = [
    ...(Object.keys(SOURCES) as Source[]).map((s) => ({ label: SOURCES[s], n: signes.filter((d) => d.source === s).length })),
    { label: "Non renseignée", n: signes.filter((d) => !d.source).length },
  ]
    .filter((x) => x.n > 0)
    .sort((a, c) => c.n - a.n);

  return {
    bornes: b,
    signes: signes.length,
    cible: cibleDe(),
    devis: devis.length,
    taux: devis.length ? Math.round((signes.length / devis.length) * 100) : null,
    delaiMoyen: delais.length ? Math.round(somme(delais) / delais.length) : null,
    installes: installes.length,
    enAttenteInstall: dossiers.filter((d) => !d.perdu_le && d.signature && !d.date_installation).length,
    entonnoir: [
      { label: "RDV réalisés", n: rdvs.filter((r) => dans(r.jour, b) && rdvPasse(r, today, nowTime)).length },
      { label: "Devis envoyés", n: devis.length },
      { label: "Acceptés", n: dossiers.filter((d) => dans(jourEtape(d, "devis_accepte"), b)).length },
      { label: "Signés", n: signes.length },
      { label: "TPE enrôlés", n: dossiers.filter((d) => dans(jourEtape(d, "enrolement_tpe"), b)).length },
      { label: "Installés", n: installes.length },
    ],
    parCommercial,
    perdus: perdus.length,
    pertes,
    sources,
  };
}

export type StatsEquipe = ReturnType<typeof statsEquipe>;
