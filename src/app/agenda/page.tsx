import { Suspense } from "react";
import { Agenda } from "@/components/agenda/Agenda";
import { Chargement } from "@/components/Chargement";
import { addDays, isIsoDate, mondayOf } from "@/lib/agenda";
import { requireMembre } from "@/lib/session";
import type { DossierLite, RendezVous } from "@/lib/types";

/**
 * Agenda de l'équipe, semaine par semaine.
 * ?semaine=AAAA-MM-JJ ouvre la semaine de ce jour, ?commercial=Lamia filtre,
 * ?dossier=<id> ouvre « Nouveau RDV » pour ce dossier.
 */
export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <Suspense fallback={<Chargement />}>
      <Contenu searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ searchParams }: Pick<PageProps<"/agenda">, "searchParams">) {
  const { supabase, me, canAdmin, equipe, today, nowTime } = await requireMembre();
  const { semaine, dossier, commercial } = await searchParams;
  const week = mondayOf(isIsoDate(semaine) ? semaine : today);

  const [{ data: rdvs }, { data: dossiers }] = await Promise.all([
    supabase
      .from("rendez_vous")
      .select("*")
      .gte("jour", week)
      .lte("jour", addDays(week, 6))
      .order("jour")
      .order("debut")
      .returns<RendezVous[]>(),
    supabase.from("dossiers").select("id, restaurant, commercial").is("perdu_le", null).order("restaurant").returns<DossierLite[]>(),
  ]);

  return (
    <Agenda
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      dossiers={dossiers ?? []}
      today={today}
      nowTime={nowTime}
      initialWeek={week}
      initialRdvs={rdvs ?? []}
      initialFilter={typeof commercial === "string" ? commercial : "Tous"}
      openForDossier={typeof dossier === "string" ? dossier : null}
    />
  );
}
