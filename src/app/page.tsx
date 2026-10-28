import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { Dashboard } from "@/components/Dashboard";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import type { Dossier, Membre } from "@/lib/types";

export default function Home() {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email as string | undefined;
  if (!email) redirect("/login");

  const { data: me } = await supabase
    .from("membres")
    .select("*")
    .ilike("email", email)
    .maybeSingle<Membre>();

  if (!me) {
    return (
      <AuthCard
        title="Accès non autorisé"
        subtitle={`Le compte ${email} n'est pas encore dans l'équipe. Demande à ton responsable de t'ajouter.`}
      >
        <SignOutButton className="w-full rounded-2xl bg-brand py-4 font-bold text-white">Changer de compte</SignOutButton>
      </AuthCard>
    );
  }

  const { data: dossiers } = await supabase
    .from("dossiers")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Dossier[]>();

  return <Dashboard me={me} initialDossiers={dossiers ?? []} />;
}

function Chargement() {
  return (
    <main className="grid min-h-dvh place-items-center text-muted" aria-busy="true">
      Chargement…
    </main>
  );
}
