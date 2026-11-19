"use client";

import { useState, useTransition } from "react";
import { enregistrerAbonnement } from "@/app/actions/dossiers";

type Props = {
  dossierId: string;
  /** Prix enregistré (euros par mois) ou null. */
  prix: number | null;
  onMessage: (message: string) => void;
  onErreur: (message: string) => void;
};

const fmtPrix = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

/** Prix de l'abonnement : affiché et modifiable par la direction et les admins seulement. */
export function PrixAbonnement({ dossierId, prix, onMessage, onErreur }: Props) {
  const initial = prix === null ? "" : String(prix).replace(".", ",");
  const [valeur, setValeur] = useState(initial);
  const [pending, start] = useTransition();
  const modifie = valeur.trim() !== initial;

  function enregistrer(nouveau: number | null) {
    start(async () => {
      const res = await enregistrerAbonnement(dossierId, nouveau);
      if (!res.ok) return onErreur(res.error);
      if (nouveau === null) setValeur("");
      onMessage(nouveau === null ? "Prix de l’abonnement retiré" : "Prix de l’abonnement enregistré");
    });
  }

  function valider(e: React.FormEvent) {
    e.preventDefault();
    const texte = valeur.trim().replace(/\s/g, "").replace(",", ".");
    if (!texte) return prix !== null && enregistrer(null);
    const n = Number(texte);
    if (!Number.isFinite(n) || n < 0) return onErreur("Indique un prix en euros, par exemple 49,90.");
    enregistrer(n);
  }

  return (
    <form onSubmit={valider} className="mt-4 rounded-[14px] border border-dashed border-brand/40 bg-brand-soft/40 p-3">
      <label htmlFor={`${dossierId}-abonnement`} className="flex items-baseline justify-between gap-2 text-[14px] font-semibold">
        Prix de l’abonnement
        <span className="text-[12.5px] font-normal text-muted">Visible par la direction uniquement</span>
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={`${dossierId}-abonnement`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="ex. 49,90"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          className="input flex-1"
        />
        <span className="flex-none text-[14px] text-muted">€ / mois</span>
      </div>
      {prix !== null && !modifie && <p className="mt-1.5 text-[13px] text-muted">{fmtPrix(prix)} € par mois</p>}
      {modifie && (
        <div className="mt-2.5 flex gap-2">
          <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-xl bg-brand font-bold text-white disabled:opacity-60">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setValeur(initial)}
            disabled={pending}
            className="min-h-11 rounded-xl px-3 font-semibold text-muted disabled:opacity-60"
          >
            Annuler
          </button>
        </div>
      )}
    </form>
  );
}
