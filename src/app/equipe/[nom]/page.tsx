import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Chargement } from "@/components/Chargement";
import { FicheCommercial } from "@/components/equipe/FicheCommercial";
import { requireMembre, verifier } from "@/lib/session";
import type { Dossier, JournalEntry, RendezVous } from "@/lib/types";

/** Fiche d'un commercial : ses chiffres, ses RDV, tout ce qu'il a fait et ses dossiers. */
export default function CommercialPage({ params }: PageProps<"/equipe/[nom]">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: Pick<PageProps<"/equipe/[nom]">, "params">) {
  const nom = decodeURIComponent((await params).nom);
  const { supabase, me, canAdmin, equipe, today, nowTime } = await requireMembre();

  const [resDossiers, resRdvs, resJournal] = await Promise.all([
    supabase.from("dossiers").select("*").eq("commercial", nom).order("updated_at", { ascending: false }),
    supabase.from("rendez_vous").select("*").eq("commercial", nom).order("jour", { ascending: false }).order("debut", { ascending: false }).limit(500),
    // Ce qu'il a écrit ou fait sur les dossiers (notes, étapes, comptes rendus), avec le nom du restaurant
    supabase
      .from("journal")
      .select("*, dossiers(restaurant)")
      .eq("auteur", nom)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);
  verifier(resDossiers, resRdvs, resJournal);
  const dossiers = (resDossiers.data ?? []) as Dossier[];
  const rdvs = (resRdvs.data ?? []) as RendezVous[];

  // Un ancien commercial garde sa fiche tant qu'il a des dossiers ou des RDV ; un nom inconnu n'en a pas
  if (!equipe.includes(nom) && !dossiers.length && !rdvs.length) notFound();

  return (
    <FicheCommercial
      key={nom}
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      nom={nom}
      today={today}
      nowTime={nowTime}
      dossiers={dossiers}
      rdvs={rdvs}
      journal={(resJournal.data ?? []) as (JournalEntry & { dossiers: { restaurant: string } | null })[]}
    />
  );
}
