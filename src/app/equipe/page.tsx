import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { Equipe } from "@/components/equipe/Equipe";
import { addDays, mondayOf } from "@/lib/agenda";
import { debutDuMois } from "@/lib/dates";
import { relancesDe } from "@/lib/relances";
import { requireMembre, verifier } from "@/lib/session";
import { PERIODES, bornes, statsEquipe, type Periode } from "@/lib/stats";
import type { Dossier, Objectif, RendezVous } from "@/lib/types";

/** Pilotage de l'équipe. ?periode=semaine|mois|trimestre */
export default function EquipePage({ searchParams }: PageProps<"/equipe">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/equipe">, "searchParams">) {
  const { supabase, me, canAdmin, equipe, today, nowTime } = await requireMembre();
  const sp = await searchParams;
  const periode: Periode = PERIODES.some((p) => p.key === sp.periode) ? (sp.periode as Periode) : "mois";
  const b = bornes(periode, today);
  const lundi = mondayOf(today);
  // Assez d'historique pour le délai moyen (premier RDV d'un dossier signé dans la période)
  const depuis = addDays(b.debut < lundi ? b.debut : lundi, -180);

  const [resDossiers, resRdvs, resObjectifs] = await Promise.all([
    supabase.from("dossiers").select("*").order("restaurant"),
    supabase.from("rendez_vous").select("*").gte("jour", depuis).lte("jour", addDays(lundi, 6)).order("jour").order("debut"),
    supabase.from("objectifs").select("*").gte("mois", `${today.slice(0, 4)}-01-01`).lte("mois", `${today.slice(0, 4)}-12-01`),
  ]);
  verifier(resDossiers, resRdvs, resObjectifs);
  const dossiers = (resDossiers.data ?? []) as Dossier[];
  const rdvs = (resRdvs.data ?? []) as RendezVous[];
  const objectifs = (resObjectifs.data ?? []) as Objectif[];
  const commerciaux = [...new Set([...equipe, ...rdvs.filter((r) => r.jour >= lundi).map((r) => r.commercial)])];

  const relances = relancesDe({ dossiers, rdvs, today, nowTime });
  const mois = debutDuMois(today);

  return (
    <Equipe
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      nowTime={nowTime}
      periode={periode}
      stats={statsEquipe({ dossiers, rdvs, objectifs, commerciaux, today, periode })}
      aRelancer={Object.fromEntries(commerciaux.map((c) => [c, relances.filter((r) => r.commercial === c).length]))}
      blocages={relancesDe({ dossiers, rdvs, today, nowTime, blocages: true })}
      semaine={rdvs.filter((r) => r.jour >= lundi)}
      objectifsDuMois={Object.fromEntries(objectifs.filter((o) => o.mois === mois).map((o) => [o.commercial, o.signatures]))}
      dossiers={dossiers}
    />
  );
}
