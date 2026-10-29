"use client";

import { useMemo, useState } from "react";
import { FILTRES_ETAPE, etapeDe, type Etape } from "@/lib/dossiers";
import type { Dossier, Membre, RendezVous } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { IconSearch } from "../icons";
import { DossierCard } from "./DossierCard";

type Filtres = { etape: Etape | "tous"; commercial: string; q: string };

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  today: string;
  dossiers: Dossier[];
  /** Prochain RDV, par dossier. */
  prochains: Record<string, RendezVous>;
  /** Motif de relance, par dossier. */
  relances: Record<string, string>;
  initial: Filtres;
};

const normalise = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s/g, "");

/** Garde les filtres dans l'URL : un lien partagé ou un rechargement retombe dessus. */
function syncUrl({ etape, commercial, q }: Filtres) {
  const p = new URLSearchParams();
  if (etape !== "tous") p.set("etape", etape);
  if (commercial) p.set("commercial", commercial);
  if (q.trim()) p.set("q", q.trim());
  window.history.replaceState(null, "", `/dossiers${p.size ? `?${p}` : ""}`);
}

export function DossiersList({ me, canAdmin, equipe, today, dossiers, prochains, relances, initial }: Props) {
  const live = useRealtimeRefresh(["dossiers", "rendez_vous"]);
  const [filtres, setFiltres] = useState<Filtres>(initial);
  const set = (patch: Partial<Filtres>) =>
    setFiltres((f) => {
      const next = { ...f, ...patch };
      syncUrl(next);
      return next;
    });

  // Commerciaux de l'équipe + anciens noms encore présents sur des dossiers
  const commerciaux = useMemo(() => [...new Set([...equipe, ...dossiers.map((d) => d.commercial)])], [equipe, dossiers]);

  const scope = useMemo(
    () => (filtres.commercial === "Tous" ? dossiers : dossiers.filter((d) => d.commercial === filtres.commercial)),
    [dossiers, filtres.commercial],
  );

  const compte = useMemo(() => {
    const c: Record<string, number> = { tous: 0 };
    for (const d of scope) {
      const e = etapeDe(d);
      c[e] = (c[e] ?? 0) + 1;
      if (e !== "perdu") c.tous += 1;
    }
    return c;
  }, [scope]);

  const visibles = useMemo(() => {
    const q = normalise(filtres.q);
    return scope
      .filter((d) => {
        const e = etapeDe(d);
        return filtres.etape === "tous" ? e !== "perdu" : e === filtres.etape;
      })
      .filter(
        (d) =>
          !q ||
          [d.restaurant, d.siret, d.mail, d.gerant, d.adresse, d.commercial, d.telephone].some((v) => normalise(v).includes(q)),
      )
      .sort((a, b) => Number(!!relances[b.id]) - Number(!!relances[a.id])); // à relancer d'abord
  }, [scope, filtres.etape, filtres.q, relances]);

  const aRelancer = scope.filter((d) => relances[d.id]).length;
  const filtre = filtres.etape !== "tous" || filtres.q.trim() !== "";

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="dossiers"
      title="Dossiers"
      subtitle={
        <>
          {compte.tous} en cours
          {aRelancer > 0 && (
            <>
              {" · "}
              <b className="text-warn">{aRelancer} à relancer</b>
            </>
          )}
        </>
      }
      action={{ label: "Nouveau dossier", href: "/dossiers/nouveau" }}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">Rechercher un dossier</span>
          <IconSearch className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted" />
          <input
            type="search"
            value={filtres.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Restaurant, SIRET, gérant…"
            autoComplete="off"
            spellCheck={false}
            className="input rounded-2xl pl-11"
          />
        </label>
        <label className="block sm:w-56">
          <span className="sr-only">Commercial</span>
          <select className="input rounded-2xl" value={filtres.commercial} onChange={(e) => set({ commercial: e.target.value })}>
            <option value="Tous">Toute l’équipe</option>
            {commerciaux.map((c) => (
              <option key={c} value={c}>
                {c === me.nom ? `${c} (moi)` : c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="group" aria-label="Étape" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTRES_ETAPE.map(({ key, label }) => {
          const active = filtres.etape === key;
          return (
            <button
              key={key}
              onClick={() => set({ etape: key })}
              aria-pressed={active}
              className={`min-h-10 flex-none rounded-full border px-3.5 text-[14px] whitespace-nowrap ${
                active ? "border-brand bg-brand font-bold text-white" : "border-line bg-white font-semibold"
              }`}
            >
              {label} <span className={active ? "" : "text-muted"}>{compte[key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
        {visibles.map((d) => (
          <DossierCard
            key={d.id}
            dossier={d}
            today={today}
            prochain={prochains[d.id]}
            relance={relances[d.id]}
            showCommercial={filtres.commercial === "Tous"}
          />
        ))}
      </div>

      {visibles.length === 0 && (
        <div className="px-5 py-9 text-center text-muted">
          {dossiers.length === 0 ? (
            <p>Aucun dossier pour l’instant. Ajoute le premier avec « Nouveau dossier ».</p>
          ) : (
            <>
              <p>Aucun dossier ne correspond à ces filtres.</p>
              {filtre && (
                <button onClick={() => set({ etape: "tous", q: "" })} className="mt-2 min-h-11 font-semibold text-brand">
                  Effacer les filtres
                </button>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
