"use client";

import { useRef, useState, useTransition } from "react";
import { modifierDossier } from "@/app/actions/dossiers";
import type { Dossier, DossierInfos } from "@/lib/types";
import { BottomSheet, useUnsavedGuard } from "../BottomSheet";
import { DossierFields } from "./DossierFields";

type Props = {
  open: boolean;
  /** Change à chaque ouverture pour repartir d'un formulaire neuf. */
  sessionKey: number;
  dossier: Dossier;
  commerciaux: string[];
  meNom: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Absent si la personne n'a pas le droit de supprimer ce dossier. */
  onSupprimer?: () => void;
};

/** Modifier les infos d'un dossier, ou le supprimer. Les étapes se cochent dans la fiche. */
export function DossierSheet(props: Props) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} label="Modifier le dossier">
      <Form key={props.sessionKey} {...props} />
    </BottomSheet>
  );
}

function Form({ dossier: d, commerciaux, meNom, onSaved, onSupprimer }: Props) {
  const [infos, setInfos] = useState<DossierInfos>({
    restaurant: d.restaurant,
    commercial: d.commercial,
    siret: d.siret,
    mail: d.mail,
    telephone: d.telephone,
    gerant: d.gerant,
    adresse: d.adresse,
    activite: d.activite,
    source: d.source,
    notes: d.notes,
  });
  const [error, setError] = useState<string | null>(null);
  const [nomInvalide, setNomInvalide] = useState(false);
  const [pending, start] = useTransition();
  const nomRef = useRef<HTMLInputElement>(null);
  const [initiales] = useState(() => JSON.stringify(infos));
  useUnsavedGuard(JSON.stringify(infos) !== initiales);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!infos.restaurant.trim()) {
      setError("Indique le nom du restaurant.");
      setNomInvalide(true);
      return nomRef.current?.focus();
    }
    setError(null);
    start(async () => {
      const res = await modifierDossier(d.id, infos);
      if (res.ok) onSaved("Dossier mis à jour");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="mb-3.5 pr-12 text-xl font-bold">Modifier le dossier</h2>
      <DossierFields
        value={infos}
        onChange={(p) => {
          setInfos((i) => ({ ...i, ...p }));
          if (p.restaurant !== undefined) setNomInvalide(false);
        }}
        commerciaux={commerciaux}
        meNom={meNom}
        restaurantRef={nomRef}
        restaurantInvalide={nomInvalide}
      />
      <label className="mb-3 block">
        <span className="mb-1.5 block text-[13.5px] text-muted">Remarque</span>
        <textarea
          className="input"
          rows={2}
          placeholder="Optionnel"
          value={infos.notes ?? ""}
          onChange={(e) => setInfos((i) => ({ ...i, notes: e.target.value }))}
        />
      </label>

      {error && (
        <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <button disabled={pending} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      {onSupprimer && (
        <button type="button" disabled={pending} onClick={onSupprimer} className="mt-2 w-full rounded-2xl py-4 font-bold text-danger disabled:opacity-60">
          Supprimer ce dossier
        </button>
      )}
    </form>
  );
}
