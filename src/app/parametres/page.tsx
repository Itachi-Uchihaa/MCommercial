import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Chargement } from "@/components/Chargement";
import { Parametres } from "@/components/Parametres";
import { getCurrentMembre } from "@/lib/auth";

export default function ParametresPage() {
  return (
    <Suspense fallback={<Chargement onglets={false} />}>
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
