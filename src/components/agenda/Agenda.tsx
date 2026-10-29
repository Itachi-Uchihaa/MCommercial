"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { notifierRdv } from "@/app/actions/notifications";
import {
  RDV_TYPES,
  addDays,
  colorOf,
  fmtHeure,
  fmtJour,
  fmtSemaine,
  isoWeek,
  mapsUrl,
  mondayOf,
  type CommercialColor,
} from "@/lib/agenda";
import { rdvPasse } from "@/lib/relances";
import { createClient } from "@/lib/supabase/client";
import type { DossierLite, Membre, RendezVous, RendezVousInput } from "@/lib/types";
import { AppShell } from "../AppShell";
import { CompteRenduSheet } from "../CompteRenduSheet";
import { IconCheck, IconChevronRight } from "../icons";
import { Toast, useToast } from "../Toast";
import { AgendaListe, type PeriodeListe } from "./AgendaListe";
import { RdvSheet, type RdvDefaults } from "./RdvSheet";

type Vue = "semaine" | "liste";

type Props = {
  me: Membre;
  canAdmin: boolean;
  /** Prénoms des membres de rôle « commercial », dans l'ordre (sert aussi aux couleurs). */
  equipe: string[];
  dossiers: DossierLite[];
  /** Date du jour et heure à Paris (AAAA-MM-JJ, HH:MM). */
  today: string;
  nowTime: string;
  initialVue: Vue;
  /** Lundi de la semaine affichée au chargement. */
  initialWeek: string;
  initialRdvs: RendezVous[];
  /** RDV à venir, chargés d'avance quand on arrive sur la vue Liste. */
  initialListe: RendezVous[];
  /** Commercial filtré au chargement (« Tous » : toute l'équipe). */
  initialFilter: string;
  /** Dossier pour lequel ouvrir directement « Nouveau RDV » (lien depuis la fiche dossier). */
  openForDossier: string | null;
  /** RDV à ouvrir directement (lien depuis la fiche dossier). */
  openRdv: RendezVous | null;
};

type SheetState = { open: boolean; rdv: RendezVous | null; defaults: RdvDefaults; key: number };

const byHoraire = (a: RendezVous, b: RendezVous) => a.jour.localeCompare(b.jour) || a.debut.localeCompare(b.debut);
const inWeek = (jour: string, monday: string) => jour >= monday && jour <= addDays(monday, 6);

/** Garde la vue, la semaine et le commercial dans l'URL : un rechargement ou un lien partagé retombe dessus. */
function syncUrl(vue: Vue, monday: string, today: string, filter: string) {
  const p = new URLSearchParams();
  if (vue === "liste") p.set("vue", "liste");
  else if (monday !== mondayOf(today)) p.set("semaine", monday);
  if (filter !== "Tous") p.set("commercial", filter);
  window.history.replaceState(null, "", `/agenda${p.size ? `?${p}` : ""}`);
}

export function Agenda({
  me,
  canAdmin,
  equipe,
  dossiers: initialDossiers,
  today,
  nowTime,
  initialVue,
  initialWeek,
  initialRdvs,
  initialListe,
  initialFilter,
  openForDossier,
  openRdv,
}: Props) {
  const supabase = createClient();
  const [vue, setVueState] = useState<Vue>(initialVue);
  const vueRef = useRef<Vue>(initialVue);
  const [week, setWeek] = useState(initialWeek);
  const weekRef = useRef(initialWeek);
  const [rdvs, setRdvs] = useState<RendezVous[]>(initialRdvs);
  const [liste, setListe] = useState<RendezVous[]>(initialListe);
  const [listeChargee, setListeChargee] = useState(initialVue === "liste");
  const [periode, setPeriodeState] = useState<PeriodeListe>("avenir");
  const periodeRef = useRef<PeriodeListe>("avenir");
  const [dossiers, setDossiers] = useState<DossierLite[]>(initialDossiers);
  const [filter, setFilterState] = useState(initialFilter);
  const filterRef = useRef(initialFilter);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cr, setCr] = useState<RendezVous | null>(null);
  const { toast, showToast } = useToast();
  const [sheet, setSheet] = useState<SheetState>(() => {
    const d = openForDossier ? initialDossiers.find((x) => x.id === openForDossier) : undefined;
    return {
      open: !!d || !!openRdv,
      rdv: openRdv,
      defaults: { jour: today, commercial: d?.commercial ?? "", dossier_id: d?.id ?? null },
      key: 0,
    };
  });

  // Les liens « Planifier un RDV » et « ouvrir ce RDV » ne doivent pas rouvrir la fiche au rechargement
  useEffect(() => {
    if (openForDossier || openRdv) syncUrl(initialVue, initialWeek, today, initialFilter);
  }, [openForDossier, openRdv, initialVue, initialWeek, today, initialFilter]);

  const nomDossier = useMemo(() => new Map(dossiers.map((d) => [d.id, d.restaurant])), [dossiers]);
  const source = vue === "liste" ? liste : rdvs;

  const commerciaux = useMemo(() => {
    // Commerciaux de l'équipe + anciens noms encore présents sur des RDV
    const set = new Set(equipe);
    source.forEach((r) => set.add(r.commercial));
    return [...set];
  }, [equipe, source]);

  const upsertLocal = useCallback((row: RendezVous) => {
    const keep = inWeek(row.jour, weekRef.current);
    setRdvs((prev) => {
      const rest = prev.filter((r) => r.id !== row.id);
      return keep ? [...rest, row].sort(byHoraire) : rest;
    });
  }, []);

  const loadWeek = useCallback(
    async (monday: string) => {
      const { data, error } = await supabase
        .from("rendez_vous")
        .select("*")
        .gte("jour", monday)
        .lte("jour", addDays(monday, 6))
        .order("jour")
        .order("debut");
      if (weekRef.current !== monday) return; // une autre semaine a été demandée entre-temps
      if (error) {
        console.error("Agenda non chargé", error);
        showToast("L’agenda n’a pas pu se charger. Vérifie ta connexion et réessaie.");
      } else setRdvs(data as RendezVous[]);
    },
    [supabase, showToast],
  );

  /** Vue Liste : RDV à venir, ou des 60 derniers jours (les plus récents d'abord). */
  const loadListe = useCallback(
    async (p: PeriodeListe) => {
      const base = supabase.from("rendez_vous").select("*");
      const { data, error } = await (p === "avenir"
        ? base.gte("jour", today).order("jour").order("debut").limit(500)
        : base
            .lt("jour", today)
            .gte("jour", addDays(today, -60))
            .order("jour", { ascending: false })
            .order("debut", { ascending: false })
            .limit(500));
      if (periodeRef.current !== p) return; // l'autre période a été demandée entre-temps
      setListeChargee(true);
      if (error) {
        console.error("Liste des RDV non chargée", error);
        showToast("La liste n’a pas pu se charger. Vérifie ta connexion et réessaie.");
      } else setListe(data as RendezVous[]);
    },
    [supabase, today, showToast],
  );

  const reload = useCallback(async () => {
    if (vueRef.current === "liste") loadListe(periodeRef.current);
    else loadWeek(weekRef.current);
    const { data, error } = await supabase.from("dossiers").select("id, restaurant, commercial").is("perdu_le", null).order("restaurant");
    if (!error && data) setDossiers(data as DossierLite[]);
  }, [supabase, loadWeek, loadListe]);

  function setFilter(c: string) {
    filterRef.current = c;
    setFilterState(c);
    syncUrl(vueRef.current, weekRef.current, today, c);
  }

  function setVue(v: Vue) {
    vueRef.current = v;
    setVueState(v);
    syncUrl(v, weekRef.current, today, filterRef.current);
    if (v === "liste") loadListe(periodeRef.current);
    else loadWeek(weekRef.current);
  }

  function setPeriode(p: PeriodeListe) {
    periodeRef.current = p;
    setPeriodeState(p);
    setListeChargee(false);
    loadListe(p);
  }

  async function goToWeek(monday: string) {
    if (monday === weekRef.current) return;
    weekRef.current = monday;
    setWeek(monday);
    syncUrl(vueRef.current, monday, today, filterRef.current);
    setLoading(true);
    await loadWeek(monday);
    if (weekRef.current === monday) setLoading(false);
  }

  // Synchronisation en direct avec le reste de l'équipe
  useEffect(() => {
    const channel = supabase
      .channel("agenda-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rendez_vous" },
        (payload: RealtimePostgresChangesPayload<RendezVous>) => {
          if (vueRef.current === "liste") return void loadListe(periodeRef.current);
          if (payload.eventType === "DELETE") {
            const id = (payload.old as Partial<RendezVous>).id;
            setRdvs((prev) => prev.filter((r) => r.id !== id));
          } else {
            upsertLocal(payload.new as RendezVous);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setLive(true);
          reload(); // rattrape ce qui a pu changer pendant la connexion
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive(false);
        }
      });

    // Téléphone qui sort de veille : on recharge
    const onVisible = () => !document.hidden && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, reload, upsertLocal, loadListe]);

  const defaultCommercial = commerciaux.includes(me.nom) ? me.nom : filter !== "Tous" ? filter : (commerciaux[0] ?? "");

  const openNew = (jour?: string) =>
    setSheet((s) => ({
      open: true,
      rdv: null,
      defaults: {
        // Le jour touché, sinon aujourd'hui (ou le lundi d'une semaine à venir)
        jour: jour ?? (vue === "semaine" && week > today ? week : today),
        commercial: defaultCommercial,
        dossier_id: null,
      },
      key: s.key + 1,
    }));
  const openEdit = (rdv: RendezVous) => setSheet((s) => ({ ...s, open: true, rdv, key: s.key + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));

  async function save(input: RendezVousInput, id?: string) {
    const avant = id ? [...rdvs, ...liste, ...(openRdv ? [openRdv] : [])].find((r) => r.id === id) : undefined;
    const res = id
      ? await supabase.from("rendez_vous").update(input).eq("id", id).select().single()
      : await supabase.from("rendez_vous").insert(input).select().single();
    if (res.error) {
      console.error("RDV non enregistré", res.error);
      return "Le RDV n’a pas pu être enregistré. Vérifie ta connexion et réessaie.";
    }
    const row = res.data as RendezVous;
    closeSheet();
    showToast(id ? "RDV mis à jour" : "RDV ajouté");
    // Le serveur prévient le commercial concerné et ceux qui suivent les RDV de l'équipe
    const change = !avant || avant.commercial !== row.commercial || avant.jour !== row.jour || avant.debut !== row.debut;
    if (change) notifierRdv(row.id, avant && avant.commercial === row.commercial ? "modifie" : "nouveau").catch(() => {});

    if (vueRef.current === "liste") loadListe(periodeRef.current);
    // On suit le RDV s'il tombe dans une autre semaine
    else if (mondayOf(row.jour) === weekRef.current) upsertLocal(row);
    else goToWeek(mondayOf(row.jour));
    return null;
  }

  async function remove(r: RendezVous) {
    const { error } = await supabase.from("rendez_vous").delete().eq("id", r.id);
    if (error) {
      console.error("RDV non supprimé", error);
      return "Le RDV n’a pas pu être supprimé. Vérifie ta connexion et réessaie.";
    }
    setRdvs((prev) => prev.filter((x) => x.id !== r.id));
    setListe((prev) => prev.filter((x) => x.id !== r.id));
    closeSheet();
    showToast("RDV supprimé");
    return null;
  }

  /** RDV du même commercial qui chevauchent ce créneau. */
  async function findConflicts(input: RendezVousInput, id?: string) {
    let q = supabase
      .from("rendez_vous")
      .select("*")
      .eq("commercial", input.commercial)
      .eq("jour", input.jour)
      .lt("debut", input.fin)
      .gt("fin", input.debut);
    if (id) q = q.neq("id", id);
    const { data } = await q;
    return (data ?? []) as RendezVous[];
  }

  const visibles = filter === "Tous" ? source : source.filter((r) => r.commercial === filter);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const currentWeek = mondayOf(today);

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="agenda"
      title="Agenda"
      action={{ label: "Nouveau RDV", onClick: () => openNew() }}
    >
      <div role="group" aria-label="Affichage" className="grid grid-cols-2 gap-0.5 rounded-xl bg-[#e6e8ef] p-[3px] sm:w-64">
        {(
          [
            ["semaine", "Semaine"],
            ["liste", "Liste"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVue(key)}
            aria-pressed={vue === key}
            className={`min-h-10 rounded-[9px] text-[14px] ${
              vue === key ? "bg-white font-bold shadow-[0_1px_3px_rgba(15,23,51,.12)]" : "font-semibold text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vue === "semaine" && (
        <>
          <div className="mt-3 flex items-center gap-1 rounded-[18px] border border-line bg-white p-1.5">
            <button
              onClick={() => goToWeek(addDays(week, -7))}
              aria-label="Semaine précédente"
              className="grid size-11 flex-none place-items-center rounded-xl text-2xl text-brand"
            >
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center" aria-live="polite">
              <p className="font-bold">Semaine {isoWeek(week)}</p>
              <p className="text-[13px] text-muted">Du {fmtSemaine(week)}</p>
            </div>
            <button
              onClick={() => goToWeek(addDays(week, 7))}
              aria-label="Semaine suivante"
              className="grid size-11 flex-none place-items-center rounded-xl text-2xl text-brand"
            >
              ›
            </button>
          </div>

          {week !== currentWeek && (
            <button
              onClick={() => goToWeek(currentWeek)}
              className="mx-auto mt-1.5 block min-h-11 rounded-full px-3.5 text-[14px] font-semibold text-brand"
            >
              Revenir à cette semaine
            </button>
          )}
        </>
      )}

      <div role="group" aria-label="Commercial" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {["Tous", ...commerciaux].map((c) => {
          const n = c === "Tous" ? source.length : source.filter((r) => r.commercial === c).length;
          const active = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              aria-pressed={active}
              className={`flex min-h-10 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[15px] whitespace-nowrap ${
                active ? "border-brand bg-brand text-white" : "border-line bg-white"
              }`}
            >
              {c !== "Tous" && (
                <span
                  aria-hidden
                  className={`size-2.5 flex-none rounded-full ${active ? "ring-2 ring-white" : ""}`}
                  style={{ background: colorOf(c, equipe).bar }}
                />
              )}
              {c === "Tous" ? "Toute l’équipe" : c} ({n})
            </button>
          );
        })}
      </div>

      {vue === "liste" ? (
        <AgendaListe
          rdvs={visibles}
          loading={!listeChargee}
          periode={periode}
          onPeriode={setPeriode}
          today={today}
          nowTime={nowTime}
          equipe={equipe}
          nomDossier={nomDossier}
          showCommercial={filter === "Tous"}
          onEdit={openEdit}
          onCompteRendu={setCr}
        />
      ) : (
        <div aria-busy={loading} className={`lg:grid lg:grid-cols-2 lg:gap-x-5 ${loading ? "opacity-50" : ""}`}>
          {days.map((day, i) => {
            const list = visibles.filter((r) => r.jour === day);
            if (i >= 5 && !list.length) return null; // week-end affiché seulement s'il y a des RDV
            const isToday = day === today;
            return (
              <section key={day} aria-labelledby={`jour-${day}`} className="mt-4">
                <div className="mx-0.5 mb-1.5 flex min-h-7 items-center justify-between">
                  <h2
                    id={`jour-${day}`}
                    className={`text-[13px] font-bold tracking-wider uppercase ${isToday ? "text-brand" : "text-muted"}`}
                  >
                    {fmtJour(day)}
                    {isToday && " · Aujourd’hui"}
                  </h2>
                  {/* Pas d'ajout dans un jour passé */}
                  {day >= today && (
                    <button
                      onClick={() => openNew(day)}
                      aria-label={`Ajouter un RDV le ${fmtJour(day)}`}
                      className="-my-2 -mr-2 grid size-11 place-items-center rounded-full text-2xl leading-none text-brand"
                    >
                      +
                    </button>
                  )}
                </div>
                {list.length ? (
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
                    {list.map((r) => (
                      <RdvCard
                        key={r.id}
                        rdv={r}
                        nom={(r.dossier_id && nomDossier.get(r.dossier_id)) || r.restaurant}
                        color={colorOf(r.commercial, equipe)}
                        showCommercial={filter === "Tous"}
                        passe={rdvPasse(r, today, nowTime)}
                        onEdit={() => openEdit(r)}
                        onCompteRendu={() => setCr(r)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[18px] border border-dashed border-line px-3.5 py-3 text-[14px] text-muted">
                    {loading ? "Chargement…" : "Aucun RDV"}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <RdvSheet
        open={sheet.open}
        sessionKey={sheet.key}
        rdv={sheet.rdv}
        defaults={sheet.defaults}
        today={today}
        commerciaux={commerciaux}
        dossiers={dossiers}
        onClose={closeSheet}
        onSave={save}
        onDelete={remove}
        findConflicts={findConflicts}
      />

      <CompteRenduSheet
        rdv={cr}
        today={today}
        onClose={() => setCr(null)}
        onSaved={(message) => {
          setCr(null);
          showToast(message);
        }}
      />

      <Toast message={toast} />
    </AppShell>
  );
}

function RdvCard({
  rdv: r,
  nom,
  color,
  showCommercial,
  passe,
  onEdit,
  onCompteRendu,
}: {
  rdv: RendezVous;
  nom: string;
  color: CommercialColor;
  showCommercial: boolean;
  passe: boolean;
  onEdit: () => void;
  onCompteRendu: () => void;
}) {
  return (
    <article className={`relative overflow-hidden rounded-[18px] border border-line ${passe ? "bg-[#f7f8fa]" : "bg-white"}`}>
      <span aria-hidden className="absolute top-4 left-3.5 size-2.5 rounded-full" style={{ background: color.bar }} />
      <button onClick={onEdit} className="flex w-full items-start gap-2 py-3 pr-3 pl-8 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`font-bold tabular-nums ${passe ? "text-ink-soft" : ""}`}>
              {fmtHeure(r.debut)} – {fmtHeure(r.fin)}
            </span>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[12px] font-semibold text-ink-soft">{RDV_TYPES[r.type]}</span>
            {showCommercial && (
              <span className="ml-auto rounded-full px-2.5 py-1 text-[12.5px] font-semibold" style={{ background: color.soft, color: color.ink }}>
                {r.commercial}
              </span>
            )}
          </span>
          <span className="mt-1 block text-[17px] font-bold break-words">{nom}</span>
          {r.notes && <span className="mt-0.5 line-clamp-2 block text-[13.5px] text-muted">{r.notes}</span>}
        </span>
        {/* Repère : la carte s'ouvre pour modifier le RDV */}
        <IconChevronRight className="mt-0.5 size-5 text-[#8e95a5]" />
      </button>
      {passe && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line py-2 pr-3 pl-8">
          {r.compte_rendu_le ? (
            <span className="flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-ok-ink">
              <IconCheck className="size-4" />
              Compte rendu fait
            </span>
          ) : (
            <button onClick={onCompteRendu} className="min-h-11 rounded-xl bg-warn-soft px-3.5 text-[14px] font-bold text-warn">
              Faire le compte rendu
            </button>
          )}
          <button onClick={onEdit} className="ml-auto min-h-11 rounded-xl px-3 text-[14px] font-semibold text-brand">
            Modifier
          </button>
        </div>
      )}
      {!passe && r.adresse && (
        <a
          href={mapsUrl(r.adresse)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 border-t border-line py-2 pr-3.5 pl-8 text-[13.5px]"
        >
          <span className="min-w-0 flex-1 truncate text-muted">{r.adresse}</span>
          <span className="flex-none font-semibold text-brand">Itinéraire ›</span>
        </a>
      )}
    </article>
  );
}
