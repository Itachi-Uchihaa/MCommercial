import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { Installations } from "@/components/installations/Installations";
import { requireMembre, verifier } from "@/lib/session";
import type { Dossier } from "@/lib/types";

/** Toutes les installations programmées (aujourd'hui et à venir), jour par jour. ?qui=Nom */
export default function InstallationsPage({ searchParams }: PageProps<"/installations">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/installations">, "searchParams">) {
  const { supabase, me, canAdmin, equipe, today } = await requireMembre();
  const { qui } = await searchParams;

  const res = await supabase
    .from("dossiers")
    .select("*")
    .is("perdu_le", null)
    .gte("date_installation", today)
    .order("date_installation")
    .order("heure_installation", { nullsFirst: false })
    .order("restaurant");
  verifier(res);

  return (
    <Installations
      key={typeof qui === "string" ? qui : ""}
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      dossiers={(res.data ?? []) as Dossier[]}
      initialQui={typeof qui === "string" ? qui : ""}
    />
  );
}
