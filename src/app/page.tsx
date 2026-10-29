import { Suspense } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Chargement } from "@/components/Chargement";
import { SignOutButton } from "@/components/SignOutButton";
import { Aujourdhui } from "@/components/aujourdhui/Aujourdhui";
import { addDays } from "@/lib/agenda";
import { debutDuMois, parisDay } from "@/lib/dates";
import { relancesDe, rdvPasse } from "@/lib/relances";
import { loadSession } from "@/lib/session";
import type { Dossier, Objectif, RendezVous } from "@/lib/types";

/** Accueil : objectif du mois, prochain RDV, RDV du jour et relances. */
export default function Home() {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const { supabase, email, me, canAdmin, equipe, today, nowTime } = await loadSession();

  if (!me) {
    return (
      <AuthCard
        title="Accès non autorisé"
        subtitle={`Le compte ${email} n’est pas encore dans l’équipe. Demande à ton responsable de t’ajouter.`}
      >
        <SignOutButton className="w-full rounded-2xl bg-brand py-4 font-bold text-white">Changer de compte</SignOutButton>
      </AuthCard>
    );
  }

  // Un commercial voit sa journée ; le directeur voit celle de toute l'équipe
  const estCommercial = me.role === "commercial";
  const mois = debutDuMois(today);
  let qDossiers = supabase.from("dossiers").select("*").is("perdu_le", null);
  let qRdvs = supabase
    .from("rendez_vous")
    .select("*")
    .gte("jour", addDays(today, -30))
    .lte("jour", addDays(today, 30))
    .order("jour")
    .order("debut");
  if (estCommercial) {
    qDossiers = qDossiers.eq("commercial", me.nom);
    qRdvs = qRdvs.eq("commercial", me.nom);
  }
  const [{ data: dossiersData }, { data: rdvsData }, { data: objectifsData }] = await Promise.all([
    qDossiers,
    qRdvs,
    supabase.from("objectifs").select("*").eq("mois", mois),
  ]);
  const dossiers = (dossiersData ?? []) as Dossier[];
  const rdvs = (rdvsData ?? []) as RendezVous[];
  const objectifs = (objectifsData ?? []) as Objectif[];

  const signes = dossiers.filter((d) => d.signature_le && parisDay(d.signature_le) >= mois).length;
  const cibles = objectifs.filter((o) => !estCommercial || o.commercial === me.nom);
  const telephones = new Map(dossiers.map((d) => [d.id, d.telephone]));
  const prochain = estCommercial ? rdvs.find((r) => !rdvPasse(r, today, nowTime)) : undefined;

  return (
    <Aujourdhui
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      estCommercial={estCommercial}
      objectif={{ mois, signes, cible: cibles.length ? cibles.reduce((s, o) => s + o.signatures, 0) : null }}
      prochain={prochain ? { ...prochain, telephone: (prochain.dossier_id && telephones.get(prochain.dossier_id)) || null } : null}
      duJour={rdvs.filter((r) => r.jour === today)}
      passes={rdvs.filter((r) => r.jour === today && rdvPasse(r, today, nowTime)).map((r) => r.id)}
      relances={relancesDe({ dossiers, rdvs, today, nowTime })}
    />
  );
}
