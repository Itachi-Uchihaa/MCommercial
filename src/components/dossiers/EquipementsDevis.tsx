"use client";

import { useState, useTransition } from "react";
import { enregistrerEquipements } from "@/app/actions/dossiers";
import { EQUIPEMENTS } from "@/lib/dossiers";
import type { Equipements } from "@/lib/types";

type Props = {
  dossierId: string;
  valeurs: Equipements;
  onMessage: (message: string) => void;
  onErreur: (message: string) => void;
};

const MAX = 99;

/** Équipements du devis : une quantité par ligne, enregistrées d'un coup (une seule ligne de journal). */
export function EquipementsDevis({ dossierId, valeurs, onMessage, onErreur }: Props) {
  const [q, setQ] = useState<Equipements>(valeurs);
  const [pending, start] = useTransition();
  const modifie = EQUIPEMENTS.some((e) => q[e.key] !== valeurs[e.key]);

  const changer = (key: keyof Equipements, n: number) =>
    setQ((v) => ({ ...v, [key]: Math.max(0, Math.min(MAX, Number.isFinite(n) ? Math.trunc(n) : 0)) }));

  function enregistrer() {
    start(async () => {
      const res = await enregistrerEquipements(dossierId, q);
      if (res.ok) onMessage("Équipements du devis enregistrés");
      else onErreur(res.error);
    });
  }

  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas/60 p-3">
      <p className="text-[14px] font-semibold">Équipements du devis</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {EQUIPEMENTS.map(({ key, label }) => (
          // Écran trop étroit : le nom passe au-dessus des boutons plutôt que d'être coupé
          <li key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={`${dossierId}-${key}`} className="min-w-20 flex-1 text-[14.5px] leading-snug">
              {label}
            </label>
            {/* − / quantité / + restent ensemble, à droite (sous le nom si l'écran est trop étroit) */}
            <span className="ml-auto flex flex-none items-center gap-2">
              <button
                type="button"
                onClick={() => changer(key, q[key] - 1)}
                disabled={q[key] <= 0}
                aria-label={`Un ${label} de moins`}
                className="grid size-11 flex-none place-items-center rounded-xl border border-line bg-white text-xl font-bold text-brand disabled:text-[#c4c8d2]"
              >
                −
              </button>
              <input
                id={`${dossierId}-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX}
                value={q[key]}
                onChange={(e) => changer(key, e.target.valueAsNumber)}
                onFocus={(e) => e.target.select()}
                className="input h-11 min-h-0 w-14 flex-none px-1 py-0 text-center font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={() => changer(key, q[key] + 1)}
                disabled={q[key] >= MAX}
                aria-label={`Un ${label} de plus`}
                className="grid size-11 flex-none place-items-center rounded-xl border border-line bg-white text-xl font-bold text-brand disabled:text-[#c4c8d2]"
              >
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      {modifie && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={enregistrer}
            disabled={pending}
            className="min-h-11 flex-1 rounded-xl bg-brand font-bold text-white disabled:opacity-60"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setQ(valeurs)}
            disabled={pending}
            className="min-h-11 rounded-xl px-3 font-semibold text-muted disabled:opacity-60"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
