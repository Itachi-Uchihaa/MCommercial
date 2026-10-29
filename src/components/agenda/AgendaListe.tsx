"use client";

import { useMemo, useState } from "react";
import { RDV_TYPES, colorOf, fmtHeure, fmtJour } from "@/lib/agenda";
import { rdvPasse } from "@/lib/relances";
import type { RendezVous } from "@/lib/types";
import { Squelette } from "../Chargement";
import { IconCheck, IconChevronRight, IconSearch } from "../icons";

export type PeriodeListe = "avenir" | "passes";

type Props = {
  /** RDV déjà filtrés par commercial, dans l'ordre d'affichage. */
  rdvs: RendezVous[];
  loading: boolean;
  periode: PeriodeListe;
  onPeriode: (p: PeriodeListe) => void;
  today: string;
  nowTime: string;
  equipe: string[];
  nomDossier: Map<string, string>;
  showCommercial: boolean;
  onEdit: (r: RendezVous) => void;
  onCompteRendu: (r: RendezVous) => void;
  /** Ouvre « Nouveau RDV » (depuis « Aucun RDV à venir »). */
  onNouveau: () => void;
};

const normalise = (s: string | null | undefined) => (s ?? "").toLowerCase();

/** Tous les RDV d'un coup, regroupés par jour (vue « Liste » de l'agenda). */
export function AgendaListe({
  rdvs,
  loading,
  periode,
  onPeriode,
  today,
  nowTime,
  equipe,
  nomDossier,
  showCommercial,
  onEdit,
  onCompteRendu,
  onNouveau,
}: Props) {
  const [q, setQ] = useState("");
  const nom = (r: RendezVous) => (r.dossier_id && nomDossier.get(r.dossier_id)) || r.restaurant;

  const groupes = useMemo(() => {
    const t = normalise(q.trim());
    const out: [string, RendezVous[]][] = [];
    for (const r of rdvs) {
      const n = (r.dossier_id && nomDossier.get(r.dossier_id)) || r.restaurant;
      if (t && ![n, r.adresse, r.commercial, r.notes, RDV_TYPES[r.type]].some((v) => normalise(v).includes(t))) continue;
      const dernier = out[out.length - 1];
      if (dernier && dernier[0] === r.jour) dernier[1].push(r);
      else out.push([r.jour, [r]]);
    }
    return out;
  }, [rdvs, q, nomDossier]);

  const total = groupes.reduce((n, [, l]) => n + l.length, 0);

  return (
    <>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div role="group" aria-label="Période" className="grid grid-cols-2 gap-0.5 rounded-xl bg-[#e6e8ef] p-[3px] sm:w-64">
          {(
            [
              ["avenir", "À venir"],
              ["passes", "Passés"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => onPeriode(key)}
              aria-pressed={periode === key}
              className={`min-h-11 rounded-[9px] text-[14px] ${
                periode === key ? "bg-white font-bold shadow-[0_1px_3px_rgba(15,23,51,.12)]" : "font-semibold text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block flex-1">
          <span className="sr-only">Rechercher un RDV</span>
          <IconSearch className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Restaurant, adresse, commercial…"
            autoComplete="off"
            spellCheck={false}
            className="input rounded-2xl pl-11"
          />
        </label>
      </div>

      <p className="mx-0.5 mt-3 text-[13px] text-muted">
        {loading ? (
          <>
            <span className="sr-only">Chargement…</span>
            <Squelette className="my-0.5 h-3.5 w-40" />
          </>
        ) : (
          `${total} RDV ${periode === "avenir" ? "à venir" : "sur les 60 derniers jours"}${q.trim() ? " pour cette recherche" : ""}`
        )}
      </p>

      <div aria-busy={loading} className={loading ? "opacity-50" : ""}>
        {groupes.map(([jour, list]) => (
          <section key={jour} aria-labelledby={`liste-${jour}`} className="mt-4">
            <h2 id={`liste-${jour}`} className={`section-title ${jour === today ? "!text-brand" : ""}`}>
              {fmtJour(jour)}
              {jour === today && " · Aujourd’hui"}
            </h2>
            <ul className="card overflow-hidden">
              {list.map((r, i) => {
                const passe = rdvPasse(r, today, nowTime);
                const color = colorOf(r.commercial, equipe);
                return (
                  <li key={r.id} className={`flex flex-wrap items-center gap-x-2 pr-2 ${i ? "border-t border-line" : ""} ${passe ? "bg-[#f7f8fa]" : ""}`}>
                    <button onClick={() => onEdit(r)} className="flex min-h-15 min-w-0 flex-1 basis-60 items-center gap-3 py-2 pl-4 text-left">
                      <span className={`w-12 flex-none font-bold tabular-nums ${passe ? "text-ink-soft" : ""}`}>{fmtHeure(r.debut)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold break-words">{nom(r)}</span>
                        {/* Le commercial sous le nom : le nom garde toute la largeur */}
                        <span className="mt-0.5 flex items-center gap-1.5">
                          {showCommercial && (
                            <span
                              className="flex-none rounded-full px-2 py-0.5 text-[12px] font-semibold"
                              style={{ background: color.soft, color: color.ink }}
                            >
                              {r.commercial}
                            </span>
                          )}
                          <span className="min-w-0 truncate text-[13px] text-muted">
                            {RDV_TYPES[r.type]}
                            {r.adresse && ` · ${r.adresse}`}
                          </span>
                        </span>
                      </span>
                      {!passe && <IconChevronRight className="size-[18px] text-[#8e95a5]" />}
                    </button>
                    {passe &&
                      (r.compte_rendu_le ? (
                        <span className="flex min-h-11 flex-none items-center px-2 text-ok-ink" title="Compte rendu fait">
                          <IconCheck className="size-5" />
                          <span className="sr-only">Compte rendu fait</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => onCompteRendu(r)}
                          className="my-1.5 ml-auto min-h-11 flex-none rounded-xl bg-warn-soft px-3 text-[13.5px] font-bold text-warn"
                        >
                          Faire le compte rendu
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {!loading && total === 0 &&
        (!q.trim() && periode === "avenir" ? (
          <button
            onClick={onNouveau}
            className="mt-4 flex min-h-14 w-full items-center justify-between gap-2 rounded-[18px] border border-dashed border-line px-4 py-3 text-left text-muted hover:border-brand/40 hover:bg-white"
          >
            Aucun RDV à venir
            <span className="font-semibold text-brand">+ Planifier</span>
          </button>
        ) : (
          <p className="px-5 py-9 text-center text-muted">
            {q.trim() ? "Aucun RDV ne correspond à cette recherche." : "Aucun RDV sur les 60 derniers jours."}
          </p>
        ))}
    </>
  );
}
