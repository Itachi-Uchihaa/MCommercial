import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Chargement } from "@/components/Chargement";
import { Fiche } from "@/components/dossiers/Fiche";
import { requireMembre, verifier } from "@/lib/session";
import type { Dossier, JournalEntry, MenuFichier, RendezVous } from "@/lib/types";

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

  const [resDossier, resRdvs, resJournal, resMenu] = await Promise.all([
    supabase.from("dossiers").select("*").eq("id", id).maybeSingle<Dossier>(),
    supabase.from("rendez_vous").select("*").eq("dossier_id", id).order("jour").order("debut"),
    supabase.from("journal").select("*").eq("dossier_id", id).order("created_at", { ascending: false }).limit(100),
    supabase.from("menu_fichiers").select("*").eq("dossier_id", id).order("created_at"),
  ]);
  // Une panne n'est pas un dossier supprimé : page d'erreur avec « Réessayer », pas « introuvable »
  verifier(resDossier, resRdvs, resJournal, resMenu);
  const dossier = resDossier.data;
  if (!dossier) notFound();
  const rdvs = resRdvs.data;
  const journal = resJournal.data;

  // Les fichiers du menu sont privés : liens signés valables une heure
  const fichiers = (resMenu.data ?? []) as MenuFichier[];
  const { data: liens } = fichiers.length
    ? await supabase.storage.from("menus").createSignedUrls(fichiers.map((f) => f.chemin), 3600)
    : { data: [] };
  const menu = fichiers.map((f) => ({ ...f, url: liens?.find((l) => l.path === f.chemin)?.signedUrl ?? null }));

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
      menu={menu}
    />
  );
}
