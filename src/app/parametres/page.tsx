import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Parametres } from "@/components/Parametres";
import { getCurrentMembre } from "@/lib/auth";

export default function ParametresPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center text-muted" aria-busy="true">Chargement…</main>}>
      <Contenu />
    </Suspense>
  );
}

async function Contenu() {
  const { email, me } = await getCurrentMembre();
  if (!email) redirect("/login");
  if (!me) redirect("/"); // affiche « Accès non autorisé »

  return <Parametres me={me} />;
}
