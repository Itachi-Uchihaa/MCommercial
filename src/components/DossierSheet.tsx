"use client";

import { useEffect, useRef, useState } from "react";
import { fmtSiret, maskSiret } from "@/lib/dossiers";
import type { Dossier, DossierInput } from "@/lib/types";

type Props = {
  open: boolean;
  /** Change à chaque ouverture pour repartir d'un formulaire neuf. */
  sessionKey: number;
  dossier: Dossier | null;
  commerciaux: string[];
  defaultCommercial: string;
  onClose: () => void;
  onSave: (input: DossierInput, id?: string) => Promise<string | null>;
  onDelete: (d: Dossier) => Promise<string | null>;
};

/** Feuille qui monte du bas de l'écran pour ajouter ou modifier un dossier. */
export function DossierSheet(props: Props) {
  const { open, onClose, sessionKey } = props;
  // Reste monté pendant l'animation de fermeture
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(r);
    }
    const t = setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, 250);
    return () => clearTimeout(t);
  }, [open]);

  if (!mounted) return null;
  const visible = open && entered;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`safe-bottom fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[92dvh] max-w-3xl overflow-y-auto rounded-t-[22px] bg-white px-4.5 pt-2 transition-transform duration-250 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-1 mb-3 h-1.25 w-10 rounded bg-[#d5d8e0]" />
        <SheetForm key={sessionKey} {...props} />
      </div>
    </>
  );
}

function SheetForm({ dossier: d, commerciaux, defaultCommercial, onSave, onDelete }: Props) {
  const [restaurant, setRestaurant] = useState(d?.restaurant ?? "");
  const [commercial, setCommercial] = useState(d?.commercial ?? defaultCommercial);
  const [dateRdv, setDateRdv] = useState(d?.date_rdv ?? "");
  const [siret, setSiret] = useState(d?.siret ? fmtSiret(d.siret) : "");
  const [mail, setMail] = useState(d?.mail ?? "");
  const [checks, setChecks] = useState({
    devis_fait: d?.devis_fait ?? false,
    devis_accepte: d?.devis_accepte ?? false,
    signature: d?.signature ?? false,
    enrolement_tpe: d?.enrolement_tpe ?? false,
  });
  const [dateInstall, setDateInstall] = useState(d?.date_installation ?? "");
  const [notes, setNotes] = useState(d?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!d) {
      const t = setTimeout(() => firstField.current?.focus(), 260);
      return () => clearTimeout(t);
    }
  }, [d]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = siret.replace(/\D/g, "");
    const m = mail.trim();
    if (!restaurant.trim()) return setError("Indique le nom du restaurant.");
    if (!commercial) return setError("Aucun commercial dans l'équipe : ajoute-en un dans Administration.");
    if (s && s.length !== 14) return setError("Le SIRET doit faire 14 chiffres.");
    if (m && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)) return setError("Adresse mail invalide.");
    setError(null);
    setBusy(true);
    const err = await onSave(
      {
        restaurant: restaurant.trim(),
        commercial,
        siret: s || null,
        mail: m || null,
        date_rdv: dateRdv || null,
        date_installation: dateInstall || null,
        notes: notes.trim() || null,
        ...checks,
      },
      d?.id,
    );
    setBusy(false);
    if (err) setError(`Non enregistré : ${err}`);
  }

  async function remove() {
    if (!d) return;
    if (!confirm(`Supprimer le dossier « ${d.restaurant} » ? Cette action est définitive.`)) return;
    setBusy(true);
    const err = await onDelete(d);
    setBusy(false);
    if (err) setError(`Suppression impossible : ${err}`);
  }

  const label = "mb-1.5 block text-[13.5px] text-muted";
  const CHECKS: [keyof typeof checks, string][] = [
    ["devis_fait", "Devis fait"],
    ["devis_accepte", "Devis accepté"],
    ["signature", "Signé"],
    ["enrolement_tpe", "TPE enrôlé"],
  ];

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="mb-3.5 text-xl font-bold">{d ? "Modifier le dossier" : "Nouveau dossier"}</h2>

      <label className="mb-3 block">
        <span className={label}>Nom du restaurant</span>
        <input ref={firstField} className="input" placeholder="Ex. Chez Marco" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} autoComplete="off" />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="mb-3 block">
          <span className={label}>Commercial</span>
          <select className="input" value={commercial} onChange={(e) => setCommercial(e.target.value)}>
            {commerciaux.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="mb-3 block">
          <span className={label}>Date du RDV</span>
          <input className="input" type="date" value={dateRdv} onChange={(e) => setDateRdv(e.target.value)} />
        </label>
      </div>

      <label className="mb-3 block">
        <span className={label}>N° SIRET</span>
        <input className="input" inputMode="numeric" placeholder="14 chiffres" value={siret} onChange={(e) => setSiret(maskSiret(e.target.value))} autoComplete="off" />
      </label>

      <label className="mb-3 block">
        <span className={label}>Mail</span>
        <input className="input" type="email" inputMode="email" placeholder="contact@resto.fr" value={mail} onChange={(e) => setMail(e.target.value)} autoComplete="off" />
      </label>

      <div className="mt-1 mb-3.5 grid grid-cols-2 gap-2">
        {CHECKS.map(([key, text]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-3 text-[15px]">
            <input
              type="checkbox"
              className="size-5.5 accent-brand"
              checked={checks[key]}
              onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
            />
            {text}
          </label>
        ))}
      </div>

      <label className="mb-3 block">
        <span className={label}>Date d’installation</span>
        <input className="input" type="date" value={dateInstall} onChange={(e) => setDateInstall(e.target.value)} />
      </label>

      <label className="mb-3 block">
        <span className={label}>Notes</span>
        <textarea className="input" rows={2} placeholder="Optionnel" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && <p className="mb-2.5 text-[13.5px] text-danger">{error}</p>}

      <button disabled={busy} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {d ? "Enregistrer" : "Ajouter le dossier"}
      </button>
      {d && (
        <button type="button" disabled={busy} onClick={remove} className="mt-2 w-full rounded-2xl py-4 font-bold text-danger">
          Supprimer ce dossier
        </button>
      )}
    </form>
  );
}
