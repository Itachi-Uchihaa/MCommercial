"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDays, colorOf, fmtHeure, fmtJour, mapsUrl } from "@/lib/agenda";
import { resumeEquipements, telHref } from "@/lib/dossiers";
import type { Dossier, Membre } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { IconFolder, IconPhone, IconRoute } from "../icons";

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  today: string;
  /** Dossiers dont l'installation est aujourd'hui ou plus tard, triés par jour puis heure. */
  dossiers: Dossier[];
  /** Commercial choisi (?qui=), vide pour toute l'équipe. */
  initialQui: string;
};

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function titreJour(jour: string, today: string) {
  if (jour === today) return `Aujourd’hui · ${fmtJour(jour)}`;
  if (jour === addDays(today, 1)) return `Demain · ${fmtJour(jour)}`;
  return maj(fmtJour(jour));
}

/** Installations programmées : la liste de toute l'équipe, filtrable par commercial. */
export function Installations({ me, canAdmin, equipe, today, dossiers, initialQui }: Props) {
  const live = useRealtimeRefresh(["dossiers"]);
  const commerciaux = useMemo(() => [...new Set(dossiers.map((d) => d.commercial))].sort((a, b) => a.localeCompare(b, "fr")), [dossiers]);
  const [qui, setQui] = useState(commerciaux.includes(initialQui) ? initialQui : "");

  function choisir(nom: string) {
    setQui(nom);
    const url = new URL(window.location.href);
    if (nom) url.searchParams.set("qui", nom);
    else url.searchParams.delete("qui");
    window.history.replaceState(null, "", url);
  }

  const visibles = qui ? dossiers.filter((d) => d.commercial === qui) : dossiers;
  const jours = useMemo(() => {
    const map = new Map<string, Dossier[]>();
    for (const d of visibles) map.set(d.date_installation!, [...(map.get(d.date_installation!) ?? []), d]);
    return [...map.entries()];
  }, [visibles]);

  const total = dossiers.length;
  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="installations"
      title="Installations"
      subtitle={total ? `${total} installation${total > 1 ? "s" : ""} programmée${total > 1 ? "s" : ""}` : "Aucune installation programmée"}
    >
      {commerciaux.length > 1 && (
        <div role="group" aria-label="Commercial" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {["", ...commerciaux].map((nom) => {
            const active = qui === nom;
            const n = nom ? dossiers.filter((d) => d.commercial === nom).length : total;
            return (
              <button
                key={nom || "tous"}
                onClick={() => choisir(nom)}
                aria-pressed={active}
                className={`min-h-11 flex-none rounded-full border px-3.5 text-[14px] whitespace-nowrap ${
                  active ? "border-brand bg-brand font-bold text-white" : "border-line bg-white font-semibold"
                }`}
              >
                {nom || "Toute l’équipe"} <span className={active ? "" : "text-muted"}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {jours.length ? (
        <div className="space-y-5">
          {jours.map(([jour, liste]) => (
            <section key={jour} aria-labelledby={`jour-${jour}`}>
              <h2 id={`jour-${jour}`} className="section-title">
                {titreJour(jour, today)} · {liste.length}
              </h2>
              <ul className="space-y-2">
                {liste.map((d) => {
                  const materiel = resumeEquipements(d);
                  return (
                    <li key={d.id} className="card overflow-hidden">
                      <div className="flex gap-3 px-4 py-3.5">
                        <span className={`w-14 flex-none pt-0.5 font-extrabold tabular-nums ${d.heure_installation ? "text-lg" : "text-[13px] leading-tight text-muted"}`}>
                          {d.heure_installation ? fmtHeure(d.heure_installation) : "Heure à fixer"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Link href={`/dossiers/${d.id}`} className="block text-[17px] font-bold break-words hover:text-brand">
                            {d.restaurant}
                          </Link>
                          <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-muted">
                            <span aria-hidden className="size-2 rounded-full" style={{ background: colorOf(d.commercial, equipe).bar }} />
                            {d.commercial}
                            {d.adresse && ` · ${d.adresse}`}
                          </p>
                          {materiel && <p className="mt-1 text-[13.5px]">{materiel}</p>}
                        </div>
                      </div>
                      <div className="grid auto-cols-fr grid-flow-col border-t border-line">
                        {d.adresse && (
                          <a href={mapsUrl(d.adresse)} target="_blank" rel="noopener noreferrer" className={ACTION}>
                            <IconRoute />
                            Itinéraire
                          </a>
                        )}
                        {d.telephone && (
                          <a href={telHref(d.telephone)} className={ACTION}>
                            <IconPhone />
                            Appeler
                          </a>
                        )}
                        <Link href={`/dossiers/${d.id}`} className={ACTION}>
                          <IconFolder />
                          Voir la fiche
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="card px-4 py-4 text-[14.5px] text-muted">
          Aucune installation programmée{qui ? ` pour ${qui}` : ""}. La date se fixe sur la fiche du dossier, à l’étape Installation.
        </p>
      )}
    </AppShell>
  );
}

const ACTION =
  "flex min-h-14 flex-col items-center justify-center gap-1 border-l border-line text-[13px] font-semibold text-brand first:border-l-0";
