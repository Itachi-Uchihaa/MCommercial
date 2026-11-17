"use client";

import { useState, useTransition } from "react";
import { fixerDate } from "@/app/actions/dossiers";
import type { EtapeDatee } from "@/lib/types";

type Props = {
  dossierId: string;
  etape: EtapeDatee;
  /** Date enregistrée (AAAA-MM-JJ) ou null. */
  valeur: string | null;
  /** Heure enregistrée (HH:MM:SS) ou null : installation seulement. */
  heure?: string | null;
  onMessage: (message: string) => void;
  onErreur: (message: string) => void;
};

const LIBELLE: Record<EtapeDatee, string> = { installation: "Date d’installation", accompagnement: "Date d’accompagnement" };

/**
 * Date d'une étape datée (installation, accompagnement) : à venir = prévue, faite le jour venu.
 * L'installation a aussi une heure, facultative.
 */
export function DateEtape({ dossierId, etape, valeur, heure = null, onMessage, onErreur }: Props) {
  const avecHeure = etape === "installation";
  const heureEnregistree = heure ? heure.slice(0, 5) : "";
  const [jour, setJour] = useState(valeur ?? "");
  const [h, setH] = useState(heureEnregistree);
  const [pending, start] = useTransition();
  const modifie = jour !== (valeur ?? "") || (avecHeure && h !== heureEnregistree);

  function enregistrer(nouveau: string | null) {
    start(async () => {
      const res = await fixerDate(dossierId, etape, nouveau, nouveau && avecHeure && h ? h : null);
      if (!res.ok) return onErreur(res.error);
      if (nouveau === null) {
        setJour("");
        setH("");
      }
      onMessage(nouveau ? `${LIBELLE[etape]} enregistrée` : "Date retirée");
    });
  }

  function annuler() {
    setJour(valeur ?? "");
    setH(heureEnregistree);
  }

  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas/60 p-3">
      <label htmlFor={`${dossierId}-${etape}`} className="text-[14px] font-semibold">
        {LIBELLE[etape]}
      </label>
      <div className={avecHeure ? "mt-1.5 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2" : "mt-1.5"}>
        <input
          id={`${dossierId}-${etape}`}
          type="date"
          value={jour}
          onChange={(e) => setJour(e.target.value)}
          className="input"
        />
        {avecHeure && (
          <input
            type="time"
            aria-label="Heure d’installation"
            value={h}
            onChange={(e) => setH(e.target.value)}
            className="input"
          />
        )}
      </div>
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
              onClick={annuler}
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
