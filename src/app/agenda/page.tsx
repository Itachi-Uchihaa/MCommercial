import { Suspense } from "react";
import { Agenda } from "@/components/agenda/Agenda";
import { Chargement } from "@/components/Chargement";
import { addDays, isIsoDate, mondayOf } from "@/lib/agenda";
import { requireMembre, verifier } from "@/lib/session";
import type { DossierLite, RendezVous } from "@/lib/types";

/**
 * Agenda de l'équipe.
 * ?vue=liste : tous les RDV à venir d'un coup ; sinon semaine par semaine (?semaine=AAAA-MM-JJ).
 * ?commercial=Lamia filtre, ?dossier=<id> ouvre « Nouveau RDV » pour ce dossier, ?rdv=<id> ouvre ce RDV.
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
  const { semaine, dossier, commercial, rdv, vue, nouveau } = await searchParams;
  const liste = vue === "liste";

  // Lien vers un RDV précis : on ouvre sa semaine et sa fiche
  const { data: ouvert } =
    typeof rdv === "string" && /^[0-9a-f-]{36}$/i.test(rdv)
      ? await supabase.from("rendez_vous").select("*").eq("id", rdv).maybeSingle<RendezVous>()
      : { data: null };
  // ?nouveau=AAAA-MM-JJ : ouvre « Nouveau RDV » ce jour-là (jamais dans le passé)
  const jourNouveau = isIsoDate(nouveau) ? (nouveau < today ? today : nouveau) : null;
  const week = mondayOf(ouvert?.jour ?? jourNouveau ?? (isIsoDate(semaine) ? semaine : today));

  const [resRdvs, resDossiers, resAvenir] = await Promise.all([
    supabase
      .from("rendez_vous")
      .select("*")
      .gte("jour", week)
      .lte("jour", addDays(week, 6))
      .order("jour")
      .order("debut")
      .returns<RendezVous[]>(),
    supabase.from("dossiers").select("id, restaurant, commercial").is("perdu_le", null).order("restaurant").returns<DossierLite[]>(),
    liste
      ? supabase.from("rendez_vous").select("*").gte("jour", today).order("jour").order("debut").limit(500).returns<RendezVous[]>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  verifier(resRdvs, resDossiers, resAvenir);
  const rdvs = resRdvs.data;
  const dossiers = resDossiers.data;
  const avenir = resAvenir.data;

  return (
    <Agenda
      // Next garde la page en mémoire d'une visite à l'autre : un autre lien (autre commercial, autre semaine…)
      // doit repartir de ses paramètres, pas du filtre choisi la fois d'avant
      key={JSON.stringify([semaine, dossier, commercial, rdv, vue, nouveau])}
      me={me}
      canAdmin={canAdmin}
      equipe={equipe}
      dossiers={dossiers ?? []}
      today={today}
      nowTime={nowTime}
      initialVue={liste ? "liste" : "semaine"}
      initialWeek={week}
      initialRdvs={rdvs ?? []}
      initialListe={avenir ?? []}
      initialFilter={typeof commercial === "string" ? commercial : "Tous"}
      openForDossier={typeof dossier === "string" ? dossier : null}
      openRdv={ouvert ?? null}
      openNouveau={jourNouveau}
    />
  );
}
