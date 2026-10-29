import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Chargement } from "@/components/Chargement";
import { Fiche } from "@/components/dossiers/Fiche";
import { requireMembre } from "@/lib/session";
import type { Dossier, JournalEntry, RendezVous } from "@/lib/types";

/** Fiche client : parcours daté, RDV, journal et infos. */
export default function FichePage({ params }: PageProps<"/dossiers/[id]">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: Pick<PageProps<"/dossiers/[id]">, "params">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, me, canAdmin, equipe, today, nowTime } = await requireMembre();

  const [{ data: dossier }, { data: rdvs }, { data: journal }] = await Promise.all([
    supabase.from("dossiers").select("*").eq("id", id).maybeSingle<Dossier>(),
    supabase.from("rendez_vous").select("*").eq("dossier_id", id).order("jour").order("debut"),
    supabase.from("journal").select("*").eq("dossier_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!dossier) notFound();

  return (
    <Fiche
      key={dossier.id}
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      nowTime={nowTime}
      dossier={dossier}
      rdvs={(rdvs ?? []) as RendezVous[]}
      journal={(journal ?? []) as JournalEntry[]}
    />
  );
}
