"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isDone, today } from "@/lib/dossiers";
import type { Dossier, DossierInput, Membre, StepKey } from "@/lib/types";
import { Board } from "./Board";
import { DossierCard } from "./DossierCard";
import { DossierSheet } from "./DossierSheet";
import { Header } from "./Header";
import { Kpis } from "./Kpis";
import { Toast, useToast } from "./Toast";

/** equipe : prénoms des membres de rôle « commercial » (gérés dans /admin). */
type Props = { me: Membre; initialDossiers: Dossier[]; equipe: string[] };

export function Dashboard({ me, initialDossiers, equipe }: Props) {
  const supabase = createClient();
  const [dossiers, setDossiers] = useState<Dossier[]>(initialDossiers);
  const [filter, setFilter] = useState("Tous");
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(false);
  const [sheet, setSheet] = useState<{ open: boolean; dossier: Dossier | null; key: number }>({
    open: false,
    dossier: null,
    key: 0,
  });
  const openSheet = (dossier: Dossier | null) => setSheet((s) => ({ open: true, dossier, key: s.key + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));
  const { toast, showToast } = useToast();

  const upsertLocal = useCallback((row: Dossier) => {
    setDossiers((prev) => {
      const i = prev.findIndex((d) => d.id === row.id);
      if (i === -1) return [row, ...prev];
      const next = [...prev];
      next[i] = row;
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("dossiers").select("*").order("created_at", { ascending: false });
    if (!error && data) setDossiers(data as Dossier[]);
  }, [supabase]);

  // Synchronisation en direct avec le reste de l'équipe
  useEffect(() => {
    const channel = supabase
      .channel("dossiers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "dossiers" }, (payload: RealtimePostgresChangesPayload<Dossier>) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as Partial<Dossier>).id;
          setDossiers((prev) => prev.filter((d) => d.id !== id));
        } else {
          upsertLocal(payload.new as Dossier);
        }
      })
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
  }, [supabase, reload, upsertLocal]);

  const commerciaux = useMemo(() => {
    // Commerciaux de l'équipe + anciens noms encore présents sur des dossiers
    const set = new Set(equipe);
    dossiers.forEach((d) => d.commercial && set.add(d.commercial));
    return [...set];
  }, [dossiers, equipe]);

  const scope = useMemo(
    () => (filter === "Tous" ? dossiers : dossiers.filter((d) => d.commercial === filter)),
    [dossiers, filter],
  );

  const visibles = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s/g, "");
    if (!q) return scope;
    return scope.filter((d) =>
      [d.restaurant, d.siret, d.mail, d.commercial, d.notes].some((v) =>
        String(v ?? "").toLowerCase().replace(/\s/g, "").includes(q),
      ),
    );
  }, [scope, query]);

  async function toggleStep(d: Dossier, key: StepKey) {
    const patch: Partial<Dossier> =
      key === "installe"
        ? { date_installation: d.date_installation ? null : today() }
        : { [key]: !isDone(d, key) };
    upsertLocal({ ...d, ...patch }); // affichage immédiat
    const { error } = await supabase.from("dossiers").update(patch).eq("id", d.id);
    if (error) {
      upsertLocal(d);
      showToast(`Non enregistré : ${error.message}`);
    }
  }

  async function save(input: DossierInput, id?: string) {
    const res = id
      ? await supabase.from("dossiers").update(input).eq("id", id).select().single()
      : await supabase.from("dossiers").insert(input).select().single();
    if (res.error) return res.error.message;
    upsertLocal(res.data as Dossier);
    closeSheet();
    showToast(id ? "Dossier mis à jour" : "Dossier ajouté");
    return null;
  }

  async function remove(d: Dossier) {
    const { error } = await supabase.from("dossiers").delete().eq("id", d.id);
    if (error) return error.message;
    setDossiers((prev) => prev.filter((x) => x.id !== d.id));
    closeSheet();
    showToast("Dossier supprimé");
    return null;
  }

  const defaultCommercial = commerciaux.includes(me.nom) ? me.nom : filter !== "Tous" ? filter : (commerciaux[0] ?? "");

  return (
    <>
      <Header me={me} live={live} />

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom,0px))]">
        <Kpis dossiers={scope} />

        <SectionTitle>Par commercial</SectionTitle>
        <Board dossiers={dossiers} commerciaux={commerciaux} />

        <SectionTitle right={visibles.length ? `${visibles.length} affiché${visibles.length > 1 ? "s" : ""}` : ""}>
          Dossiers
        </SectionTitle>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {["Tous", ...commerciaux].map((c) => {
            const n = c === "Tous" ? dossiers.length : dossiers.filter((d) => d.commercial === c).length;
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                aria-pressed={active}
                className={`flex-none whitespace-nowrap rounded-full border px-3.5 py-2 text-[15px] ${
                  active ? "border-brand bg-brand text-white" : "border-line bg-white"
                }`}
              >
                {c} ({n})
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un restaurant, SIRET, mail…"
          autoComplete="off"
          className="input mt-2.5 rounded-2xl"
        />

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {visibles.length === 0 ? (
            <p className="px-5 py-9 text-center text-muted">
              {dossiers.length
                ? "Aucun dossier ne correspond à ta recherche."
                : "Aucun dossier pour l’instant. Ajoute le premier avec le bouton en bas."}
            </p>
          ) : (
            visibles.map((d) => (
              <DossierCard
                key={d.id}
                dossier={d}
                onToggle={(k) => toggleStep(d, k)}
                onEdit={() => openSheet(d)}
              />
            ))
          )}
        </div>
      </main>

      <button
        onClick={() => openSheet(null)}
        className="fixed right-4.5 bottom-[calc(20px+env(safe-area-inset-bottom,0px))] z-30 h-14 rounded-full bg-brand px-5.5 font-bold text-white shadow-[0_8px_22px_rgba(17,94,245,.35)]"
      >
        + Nouveau dossier
      </button>

      <DossierSheet
        open={sheet.open}
        sessionKey={sheet.key}
        dossier={sheet.dossier}
        commerciaux={commerciaux}
        defaultCommercial={defaultCommercial}
        onClose={closeSheet}
        onSave={save}
        onDelete={remove}
      />

      <Toast message={toast} />
    </>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: string }) {
  return (
    <div className="mx-0.5 mt-5.5 mb-2.5 flex items-baseline justify-between text-[13px] font-bold tracking-wider text-muted uppercase">
      <span>{children}</span>
      {right && <span>{right}</span>}
    </div>
  );
}
