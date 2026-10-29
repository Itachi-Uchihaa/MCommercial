"use client";

import { useState } from "react";
import { addDays, fmtSemaine, isoWeek, mondayOf } from "@/lib/agenda";
import { finDuMois } from "@/lib/dates";
import { BottomSheet } from "../BottomSheet";
import { IconChevronLeft, IconChevronRight } from "../icons";

type Props = {
  open: boolean;
  /** Change à chaque ouverture pour repartir de la semaine affichée. */
  sessionKey: number;
  /** Lundi de la semaine affichée dans l'agenda. */
  week: string;
  today: string;
  onClose: () => void;
  onChoisir: (monday: string) => void;
};

const MOIS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2026, i, 1)).toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" }),
);
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const cle = (annee: number, mois: number) => `${annee}-${String(mois + 1).padStart(2, "0")}`;

/** Lundis des semaines qui touchent ce mois (la première peut commencer le mois d'avant). */
function semainesDu(annee: number, mois: number) {
  const premier = `${cle(annee, mois)}-01`;
  const dernier = finDuMois(premier);
  const lundis: string[] = [];
  for (let l = mondayOf(premier); l <= dernier; l = addDays(l, 7)) lundis.push(l);
  return lundis;
}

/** Choisir une semaine de l'agenda : d'abord le mois (année réglable), puis la semaine. */
export function ChoixSemaine(props: Props) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} label="Choisir une semaine">
      <Contenu key={props.sessionKey} {...props} />
    </BottomSheet>
  );
}

function Contenu({ week, today, onChoisir }: Props) {
  const [annee, setAnnee] = useState(Number(week.slice(0, 4)));
  const [mois, setMois] = useState<number | null>(null);
  const moisAffiche = week.slice(0, 7);
  const moisDuJour = today.slice(0, 7);
  const semaineDuJour = mondayOf(today);

  if (mois !== null) {
    return (
      <div className="pb-5">
        <div className="mb-3 flex items-center gap-1 pr-12">
          <button
            type="button"
            onClick={() => setMois(null)}
            className="-ml-1.5 flex min-h-11 items-center gap-0.5 pr-2 text-[15px] font-semibold text-brand"
          >
            <IconChevronLeft className="size-5" />
            Mois
          </button>
        </div>
        <h2 className="mb-3 text-xl font-bold">
          {maj(MOIS[mois])} {annee}
        </h2>
        <ul className="card overflow-hidden">
          {semainesDu(annee, mois).map((lundi, i) => {
            const choisie = lundi === week;
            const actuelle = lundi === semaineDuJour;
            return (
              <li key={lundi} className={i ? "border-t border-line" : ""}>
                <button
                  type="button"
                  onClick={() => onChoisir(lundi)}
                  aria-current={choisie ? "true" : undefined}
                  className={`flex min-h-15 w-full items-center gap-3 px-4 py-2 text-left ${choisie ? "bg-brand-soft" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block font-bold ${choisie ? "text-brand-ink" : ""}`}>Semaine {isoWeek(lundi)}</span>
                    <span className="block text-[13.5px] text-muted">Du {fmtSemaine(lundi)}</span>
                  </span>
                  {actuelle && (
                    <span className="flex-none rounded-full bg-brand px-2.5 py-1 text-[12px] font-bold text-white">Cette semaine</span>
                  )}
                  <IconChevronRight className="size-[18px] flex-none text-[#8e95a5]" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="pb-5">
      <h2 className="mb-3 pr-12 text-xl font-bold">Choisir un mois</h2>
      <div className="mb-3 flex items-center justify-between rounded-[14px] border border-line p-1">
        <button
          type="button"
          onClick={() => setAnnee((a) => a - 1)}
          aria-label="Année précédente"
          className="grid size-11 place-items-center rounded-xl text-brand"
        >
          <IconChevronLeft className="size-5" />
        </button>
        <span className="text-[17px] font-bold tabular-nums" aria-live="polite">
          {annee}
        </span>
        <button
          type="button"
          onClick={() => setAnnee((a) => a + 1)}
          aria-label="Année suivante"
          className="grid size-11 place-items-center rounded-xl text-brand"
        >
          <IconChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {MOIS.map((nom, i) => {
          const k = cle(annee, i);
          const affiche = k === moisAffiche;
          const actuel = k === moisDuJour;
          return (
            <button
              key={nom}
              type="button"
              onClick={() => setMois(i)}
              aria-current={affiche ? "true" : undefined}
              className={`min-h-14 rounded-[14px] border px-1 text-[15px] font-semibold ${
                affiche ? "border-brand bg-brand text-white" : actuel ? "border-brand text-brand" : "border-line bg-white"
              }`}
            >
              {maj(nom)}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[13px] text-muted">En bleu plein : le mois affiché dans l’agenda. Bordure bleue : le mois en cours.</p>
    </div>
  );
}
