import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { DossiersList } from "@/components/dossiers/DossiersList";
import { addDays } from "@/lib/agenda";
import { FILTRES_ETAPE, type Etape } from "@/lib/dossiers";
import { rdvPasse, relancesDe } from "@/lib/relances";
import { requireMembre, verifier } from "@/lib/session";
import type { Dossier, RendezVous } from "@/lib/types";

/** Dossiers, rangés par étape. ?etape=devis_fait&commercial=Lamia&q=zinc */
export default function DossiersPage({ searchParams }: PageProps<"/dossiers">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/dossiers">, "searchParams">) {
  const { supabase, me, canAdmin, equipe, today, nowTime } = await requireMembre();
  const sp = await searchParams;

  const [resDossiers, resRdvs] = await Promise.all([
    supabase.from("dossiers").select("*").order("updated_at", { ascending: false }),
    supabase.from("rendez_vous").select("*").gte("jour", addDays(today, -30)).order("jour").order("debut"),
  ]);
  verifier(resDossiers, resRdvs);
  const dossiers = (resDossiers.data ?? []) as Dossier[];
  const rdvs = (resRdvs.data ?? []) as RendezVous[];

  // Prochain RDV de chaque dossier
  const prochains: Record<string, RendezVous> = {};
  for (const r of rdvs) {
    if (r.dossier_id && !prochains[r.dossier_id] && !rdvPasse(r, today, nowTime)) prochains[r.dossier_id] = r;
  }
  // Ce qu'il faut relancer, par dossier (le plus ancien d'abord)
  const relances: Record<string, string> = {};
  for (const r of relancesDe({ dossiers, rdvs, today, nowTime })) {
    if (r.dossierId && !relances[r.dossierId]) relances[r.dossierId] = r.motif;
  }

  const etape = FILTRES_ETAPE.some((f) => f.key === sp.etape) ? (sp.etape as Etape) : "tous";
  const commercial =
    typeof sp.commercial === "string" ? sp.commercial : me.role === "commercial" ? me.nom : "Tous";

  return (
    <DossiersList
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      dossiers={dossiers}
      prochains={prochains}
      relances={relances}
      initial={{ etape, commercial, q: typeof sp.q === "string" ? sp.q : "" }}
    />
  );
}
