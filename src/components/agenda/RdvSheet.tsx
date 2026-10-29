"use client";

import { useState } from "react";
import { RDV_TYPES, fmtHeure, fmtJour, fromMin, toMin } from "@/lib/agenda";
import type { DossierLite, RdvType, RendezVous, RendezVousInput } from "@/lib/types";
import { BottomSheet, useUnsavedGuard } from "../BottomSheet";

export type RdvDefaults = { jour: string; commercial: string; dossier_id: string | null };

type Props = {
  open: boolean;
  /** Change à chaque ouverture pour repartir d'un formulaire neuf. */
  sessionKey: number;
  rdv: RendezVous | null;
  /** Valeurs de départ d'un nouveau RDV (jour touché, dossier d'origine…). */
  defaults: RdvDefaults;
  commerciaux: string[];
  dossiers: DossierLite[];
  onClose: () => void;
  onSave: (input: RendezVousInput, id?: string) => Promise<string | null>;
  onDelete: (r: RendezVous) => Promise<string | null>;
  findConflicts: (input: RendezVousInput, id?: string) => Promise<RendezVous[]>;
};

/** Feuille d'ajout ou de modification d'un rendez-vous. */
export function RdvSheet(props: Props) {
  return (
    <BottomSheet open={props.open} onClose={props.onClose} label={props.rdv ? "Modifier le RDV" : "Nouveau RDV"}>
      <RdvForm key={props.sessionKey} {...props} />
    </BottomSheet>
  );
}

function RdvForm({ rdv: r, defaults, commerciaux, dossiers, onSave, onDelete, findConflicts }: Props) {
  const [dossierId, setDossierId] = useState(r ? r.dossier_id : defaults.dossier_id);
  const [restaurant, setRestaurant] = useState(r?.restaurant ?? "");
  const [commercial, setCommercial] = useState(r?.commercial ?? defaults.commercial);
  const [type, setType] = useState<RdvType>(r?.type ?? "decouverte");
  const [jour, setJour] = useState(r?.jour ?? defaults.jour);
  const [debut, setDebut] = useState(r ? fmtHeure(r.debut) : "09:00");
  const [fin, setFin] = useState(r ? fmtHeure(r.fin) : "10:00");
  const [adresse, setAdresse] = useState(r?.adresse ?? "");
  const [notes, setNotes] = useState(r?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  /** Chevauchement signalé : le prochain envoi enregistre quand même. */
  const [conflict, setConflict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dossier = dossiers.find((d) => d.id === dossierId);
  const saisie = JSON.stringify([dossierId, restaurant, commercial, type, jour, debut, fin, adresse, notes]);
  const [initiale] = useState(saisie);
  useUnsavedGuard(saisie !== initiale);

  function changeDossier(id: string) {
    setDossierId(id || null);
    const d = dossiers.find((x) => x.id === id);
    if (d && commerciaux.includes(d.commercial)) {
      setCommercial(d.commercial);
      setConflict(null);
    }
  }

  /** Décale la fin pour garder la même durée. */
  function changeDebut(v: string) {
    setConflict(null);
    if (v && debut && fin) {
      const duree = toMin(fin) - toMin(debut);
      setFin(fromMin(Math.min(toMin(v) + (duree > 0 ? duree : 60), 23 * 60 + 59)));
    }
    setDebut(v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nom = (dossier?.restaurant ?? restaurant).trim();
    if (!nom) return setError("Indique le nom du restaurant.");
    if (!commercial) return setError("Aucun commercial dans l'équipe : ajoute-en un dans Administration.");
    if (!jour) return setError("Indique la date du RDV.");
    if (!debut || !fin) return setError("Indique l'heure de début et de fin.");
    if (fin <= debut) return setError("L'heure de fin doit être après l'heure de début.");

    const input: RendezVousInput = {
      dossier_id: dossier?.id ?? null,
      restaurant: nom,
      commercial,
      type,
      jour,
      debut,
      fin,
      adresse: adresse.trim() || null,
      notes: notes.trim() || null,
    };
    setError(null);
    setBusy(true);

    if (!conflict) {
      const autres = await findConflicts(input, r?.id);
      if (autres.length) {
        setBusy(false);
        const liste = autres.map((a) => `${fmtHeure(a.debut)}–${fmtHeure(a.fin)}, ${a.restaurant}`).join(" ; ");
        return setConflict(
          `${commercial} a déjà ${autres.length > 1 ? "des RDV" : "un RDV"} sur ce créneau (${liste}). Change l’heure, ou enregistre quand même.`,
        );
      }
    }

    const err = await onSave(input, r?.id);
    setBusy(false);
    if (err) setError(err);
  }

  async function remove() {
    if (!r) return;
    if (!confirm(`Supprimer le RDV « ${r.restaurant} » du ${fmtJour(r.jour)} ? Cette action est définitive.`)) return;
    setBusy(true);
    const err = await onDelete(r);
    setBusy(false);
    if (err) setError(err);
  }

  const label = "mb-1.5 block text-[13.5px] text-muted";

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="mb-3.5 text-xl font-bold">{r ? "Modifier le RDV" : "Nouveau RDV"}</h2>

      <label className="mb-3 block">
        <span className={label}>Dossier</span>
        <select className="input" value={dossier?.id ?? ""} onChange={(e) => changeDossier(e.target.value)}>
          <option value="">Aucun : nouveau prospect</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.restaurant} · {d.commercial}
            </option>
          ))}
        </select>
      </label>

      {!dossier && (
        <label className="mb-3 block">
          <span className={label}>Nom du restaurant</span>
          <input className="input" placeholder="Ex. Chez Marco" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} autoComplete="off" />
        </label>
      )}

      <label className="mb-3 block">
        <span className={label}>Commercial</span>
        <select
          className="input"
          value={commercial}
          onChange={(e) => {
            setCommercial(e.target.value);
            setConflict(null);
          }}
        >
          {commerciaux.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      <span id="rdv-type" className={label}>
        Type de RDV
      </span>
      <div role="group" aria-labelledby="rdv-type" className="mb-3 grid grid-cols-3 gap-2">
        {(Object.keys(RDV_TYPES) as RdvType[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`rounded-xl border px-1 py-3 text-[15px] ${
              type === t ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line"
            }`}
          >
            {RDV_TYPES[t]}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className={label}>Date</span>
        <input
          className="input"
          type="date"
          value={jour}
          onChange={(e) => {
            setJour(e.target.value);
            setConflict(null);
          }}
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="mb-3 block">
          <span className={label}>Début</span>
          <input className="input" type="time" value={debut} onChange={(e) => changeDebut(e.target.value)} />
        </label>
        <label className="mb-3 block">
          <span className={label}>Fin</span>
          <input
            className="input"
            type="time"
            value={fin}
            onChange={(e) => {
              setFin(e.target.value);
              setConflict(null);
            }}
          />
        </label>
      </div>

      <label className="mb-3 block">
        <span className={label}>Adresse</span>
        <input className="input" placeholder="Ex. 12 rue de la Paix, Lyon" value={adresse} onChange={(e) => setAdresse(e.target.value)} autoComplete="off" />
      </label>

      <label className="mb-3 block">
        <span className={label}>Notes</span>
        <textarea className="input" rows={2} placeholder="Optionnel" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {conflict && (
        <p role="alert" className="mb-2.5 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13.5px] text-warn">
          {conflict}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <button disabled={busy} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {busy ? "Enregistrement…" : conflict ? "Enregistrer quand même" : r ? "Enregistrer" : "Ajouter le RDV"}
      </button>
      {r && (
        <button type="button" disabled={busy} onClick={remove} className="mt-2 w-full rounded-2xl py-4 font-bold text-danger">
          Supprimer ce RDV
        </button>
      )}
    </form>
  );
}
