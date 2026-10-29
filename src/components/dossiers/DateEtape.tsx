"use client";

import { useState, useTransition } from "react";
import { fixerDate } from "@/app/actions/dossiers";
import type { EtapeDatee } from "@/lib/types";

type Props = {
  dossierId: string;
  etape: EtapeDatee;
  /** Date enregistrée (AAAA-MM-JJ) ou null. */
  valeur: string | null;
  onMessage: (message: string) => void;
  onErreur: (message: string) => void;
};

const LIBELLE: Record<EtapeDatee, string> = { installation: "Date d’installation", accompagnement: "Date d’accompagnement" };

/** Date d'une étape datée (installation, accompagnement) : à venir = prévue, faite le jour venu. */
export function DateEtape({ dossierId, etape, valeur, onMessage, onErreur }: Props) {
  const [jour, setJour] = useState(valeur ?? "");
  const [pending, start] = useTransition();
  const modifie = jour !== (valeur ?? "");

  function enregistrer(nouveau: string | null) {
    start(async () => {
      const res = await fixerDate(dossierId, etape, nouveau);
      if (!res.ok) return onErreur(res.error);
      if (nouveau === null) setJour("");
      onMessage(nouveau ? `${LIBELLE[etape]} enregistrée` : "Date retirée");
    });
  }

  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas/60 p-3">
      <label htmlFor={`${dossierId}-${etape}`} className="text-[14px] font-semibold">
        {LIBELLE[etape]}
      </label>
      <input
        id={`${dossierId}-${etape}`}
        type="date"
        value={jour}
        onChange={(e) => setJour(e.target.value)}
        className="input mt-1.5"
      />
      {(modifie || valeur) && (
        <div className="mt-2.5 flex gap-2">
          {modifie && jour && (
            <button
              type="button"
              onClick={() => enregistrer(jour)}
              disabled={pending}
              className="min-h-11 flex-1 rounded-xl bg-brand font-bold text-white disabled:opacity-60"
            >
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          )}
          {modifie && valeur && (
            <button
              type="button"
              onClick={() => setJour(valeur)}
              disabled={pending}
              className="min-h-11 rounded-xl px-3 font-semibold text-muted disabled:opacity-60"
            >
              Annuler
            </button>
          )}
          {!modifie && valeur && (
            <button
              type="button"
              onClick={() => confirm("Retirer cette date ?") && enregistrer(null)}
              disabled={pending}
              className="min-h-11 rounded-xl px-3 font-semibold text-danger disabled:opacity-60"
            >
              Retirer la date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
