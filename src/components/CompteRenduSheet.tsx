"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerCompteRendu } from "@/app/actions/rdv";
import { RDV_TYPES, addDays, fmtHeure, fmtJourCourt } from "@/lib/agenda";
import type { RendezVous, ResultatRdv, SuiteRdv } from "@/lib/types";
import { BottomSheet, useUnsavedGuard } from "./BottomSheet";
import { IconCheck, IconClock, IconX } from "./icons";

const RESULTATS: { key: ResultatRdv; label: string; Icon: typeof IconCheck }[] = [
  { key: "positif", label: "Positif", Icon: IconCheck },
  { key: "a_relancer", label: "À relancer", Icon: IconClock },
  { key: "pas_interesse", label: "Pas intéressé", Icon: IconX },
];

const SUITES: { key: SuiteRdv; label: string }[] = [
  { key: "devis", label: "Devis à envoyer" },
  { key: "nouveau_rdv", label: "Planifier un autre RDV" },
  { key: "rien", label: "Rien pour l’instant" },
];

type Props = {
  /** RDV dont on fait le compte rendu (null : feuille fermée). */
  rdv: RendezVous | null;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Compte rendu après un RDV : résultat, suite, jour de rappel et ce qu'il faut retenir. */
export function CompteRenduSheet({ rdv, today, onClose, onSaved }: Props) {
  // Garde le dernier RDV affiché pendant l'animation de fermeture
  const [shown, setShown] = useState(rdv);
  if (rdv && rdv !== shown) setShown(rdv);

  return (
    <BottomSheet open={!!rdv} onClose={onClose} label="Compte rendu">
      {shown && <Form key={shown.id} rdv={shown} today={today} onSaved={onSaved} onClose={onClose} />}
    </BottomSheet>
  );
}

function Form({ rdv, today, onSaved, onClose }: { rdv: RendezVous } & Omit<Props, "rdv">) {
  const router = useRouter();
  const [resultat, setResultat] = useState<ResultatRdv | null>(rdv.resultat);
  const [suite, setSuite] = useState<SuiteRdv | null>(rdv.suite);
  const [relanceLe, setRelanceLe] = useState("");
  const [note, setNote] = useState(rdv.compte_rendu ?? "");
  const [classerPerdu, setClasserPerdu] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dossier = !!rdv.dossier_id;
  useUnsavedGuard(resultat !== rdv.resultat || suite !== rdv.suite || note !== (rdv.compte_rendu ?? ""));

  function choisir(r: ResultatRdv) {
    setResultat(r);
    setError(null);
    // Rappel proposé : 3 jours après un RDV positif, 7 jours s'il faut relancer
    setRelanceLe(r === "positif" ? addDays(today, 3) : r === "a_relancer" ? addDays(today, 7) : "");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resultat) return setError("Indique comment s’est passé le RDV.");
    start(async () => {
      const res = await enregistrerCompteRendu({
        rdvId: rdv.id,
        resultat,
        suite,
        compteRendu: note,
        relanceLe: dossier && relanceLe ? relanceLe : null,
        classerPerdu: dossier && resultat === "pas_interesse" && classerPerdu,
      });
      if (!res.ok) return setError(res.error);
      if (suite === "nouveau_rdv" && rdv.dossier_id) router.push(`/agenda?dossier=${rdv.dossier_id}`);
      onSaved("Compte rendu enregistré");
    });
  }

  const chip = (active: boolean) =>
    `min-h-11 rounded-full px-3.5 text-[14px] ${
      active ? "border-2 border-brand bg-brand-soft font-bold text-brand-ink" : "border border-line font-semibold"
    }`;

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="pr-12 text-xl font-extrabold">Compte rendu</h2>
      <p className="mt-0.5 text-[14px] text-muted">
        {RDV_TYPES[rdv.type]} · {rdv.restaurant} · {fmtJourCourt(rdv.jour)}, {fmtHeure(rdv.debut)} – {fmtHeure(rdv.fin)}
      </p>

      <p id="cr-resultat" className="mt-4.5 mb-2 text-[14px] font-semibold">
        Comment s’est passé le RDV ?
      </p>
      <div role="group" aria-labelledby="cr-resultat" className="grid grid-cols-3 gap-2">
        {RESULTATS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={resultat === key}
            onClick={() => choisir(key)}
            className={`flex h-19 flex-col items-center justify-center gap-1.5 rounded-[14px] text-[14px] ${
              resultat === key ? "border-2 border-brand bg-brand-soft font-bold text-brand-ink" : "border border-line font-semibold"
            }`}
          >
            <Icon className="size-[22px]" />
            {label}
          </button>
        ))}
      </div>

      {resultat === "pas_interesse" && dossier && (
        <label className="mt-3 flex min-h-11 items-center gap-2.5 rounded-xl border border-line px-3 text-[14.5px]">
          <input type="checkbox" className="size-5 accent-brand" checked={classerPerdu} onChange={(e) => setClasserPerdu(e.target.checked)} />
          Classer le dossier perdu (pas intéressé)
        </label>
      )}

      {resultat !== "pas_interesse" && (
        <>
          <p id="cr-suite" className="mt-4.5 mb-2 text-[14px] font-semibold">
            Et maintenant ?
          </p>
          <div role="group" aria-labelledby="cr-suite" className="flex flex-wrap gap-2">
            {SUITES.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={suite === key} onClick={() => setSuite(key)} className={chip(suite === key)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {dossier && resultat && resultat !== "pas_interesse" && (
        <label className="mt-4.5 block">
          <span className="mb-2 block text-[14px] font-semibold">Me le rappeler le</span>
          <input className="input" type="date" min={today} value={relanceLe} onChange={(e) => setRelanceLe(e.target.value)} />
        </label>
      )}

      <label className="mt-4 block">
        <span className="mb-2 block text-[14px] font-semibold">Ce qu’il faut retenir</span>
        <textarea
          className="input"
          rows={3}
          placeholder="Besoins, objections, personnes rencontrées…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {dossier && <p className="mt-2 text-[13px] text-muted">Ajouté au journal du dossier.</p>}

      {error && (
        <p role="alert" className="mt-3 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <button disabled={pending} className="mt-4 w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {pending ? "Enregistrement…" : "Enregistrer le compte rendu"}
      </button>
      <button type="button" onClick={onClose} className="mt-1 min-h-12 w-full font-semibold text-muted">
        Plus tard
      </button>
    </form>
  );
}
