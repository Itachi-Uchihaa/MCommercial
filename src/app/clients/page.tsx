import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { Clients } from "@/components/clients/Clients";
import { requireMembre, verifier } from "@/lib/session";
import type { Dossier } from "@/lib/types";

/** Carnet des clients : tous les restaurants suivis, de A à Z. ?statut=clients&q=zinc */
export default function ClientsPage({ searchParams }: PageProps<"/clients">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/clients">, "searchParams">) {
  const { supabase, me, canAdmin } = await requireMembre();
  const sp = await searchParams;

  const res = await supabase.from("dossiers").select("*").order("restaurant");
  verifier(res);

  return (
    <Clients
      // Un autre lien repart de ses filtres, pas de ceux de la visite d'avant
      key={JSON.stringify([sp.statut, sp.q])}
      me={me}
      canAdmin={canAdmin}
      dossiers={(res.data ?? []) as Dossier[]}
      initial={{ statut: typeof sp.statut === "string" ? sp.statut : "tous", q: typeof sp.q === "string" ? sp.q : "" }}
    />
  );
}
