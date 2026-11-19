"use client";

import { PAIEMENTS } from "@/lib/dossiers";
import type { Paiement } from "@/lib/types";

type Props = {
  valeur: Paiement | null;
  disabled?: boolean;
  onChoix: (paiement: Paiement | null) => void;
};

/**
 * Étape « Devis payé » : payé, en plusieurs fois ou en attente.
 * Les trois choix font avancer le dossier, pour qu'un paiement en cours ne bloque pas la suite.
 */
export function ChoixPaiement({ valeur, disabled, onChoix }: Props) {
  return (
    <div className="mt-2 rounded-[14px] border border-line bg-canvas/60 p-3">
      <p id="paiement-titre" className="text-[14px] font-semibold">
        Paiement du devis
      </p>
      <div role="group" aria-labelledby="paiement-titre" className="mt-2 grid grid-cols-3 gap-2">
        {PAIEMENTS.map((p) => {
          const actif = valeur === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => !actif && onChoix(p.key)}
              disabled={disabled}
              aria-pressed={actif}
              className={`min-h-11 rounded-xl border px-2 text-[14px] leading-tight disabled:opacity-60 ${
                actif ? "border-brand bg-brand font-bold text-white" : "border-line bg-white font-semibold"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {valeur && (
        <button
          type="button"
          onClick={() => confirm("Retirer le paiement de ce devis ?") && onChoix(null)}
          disabled={disabled}
          className="mt-1.5 min-h-11 rounded-xl px-1 text-[14px] font-semibold text-muted disabled:opacity-60"
        >
          Retirer
        </button>
      )}
    </div>
  );
}
