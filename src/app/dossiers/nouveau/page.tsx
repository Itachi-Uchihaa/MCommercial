import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { NouveauDossier } from "@/components/dossiers/NouveauDossier";
import { requireMembre } from "@/lib/session";

/** Nouveau dossier, prérempli depuis l'annuaire officiel des entreprises. */
export default function NouveauDossierPage() {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const { supabase, me, canAdmin, equipe } = await requireMembre();
  // Pour signaler un restaurant déjà suivi par un collègue
  const { data } = await supabase.from("dossiers").select("id, restaurant, commercial, siret");

  return (
    <NouveauDossier
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      existants={(data ?? []) as { id: string; restaurant: string; commercial: string; siret: string | null }[]}
    />
  );
}
