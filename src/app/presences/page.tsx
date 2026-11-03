import { Suspense } from "react";
import { Chargement } from "@/components/Chargement";
import { Presences } from "@/components/presences/Presences";
import { addDays, isIsoDate, mondayOf } from "@/lib/agenda";
import { requireMembre, verifier } from "@/lib/session";
import type { Absence } from "@/lib/types";

/** Qui est là, semaine par semaine, et les absences à venir. ?semaine=AAAA-MM-JJ */
export default function PresencesPage({ searchParams }: PageProps<"/presences">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/presences">, "searchParams">) {
  const { supabase, me, canAdmin, equipe, today } = await requireMembre();
  const { semaine } = await searchParams;
  const week = mondayOf(isIsoDate(semaine) ? semaine : today);
  // Huit semaines d'historique : revenir quelques semaines en arrière reste instantané
  const depuis = [week, addDays(mondayOf(today), -56)].sort()[0];

  const res = await supabase.from("absences").select("*").gte("fin", depuis).order("debut").returns<Absence[]>();
  verifier(res);

  return (
    <Presences
      key={week}
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      today={today}
      depuis={depuis}
      initialWeek={week}
      absences={res.data ?? []}
    />
  );
}
