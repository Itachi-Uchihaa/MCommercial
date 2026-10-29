"use client";

import { SOURCES, maskSiret } from "@/lib/dossiers";
import type { DossierInfos, Source } from "@/lib/types";

type Props = {
  value: DossierInfos;
  onChange: (patch: Partial<DossierInfos>) => void;
  commerciaux: string[];
  meNom: string;
  /** Champs remplis depuis l'annuaire : regroupés sous un bandeau. */
  hideSiret?: boolean;
};

const label = "mb-1.5 block text-[13.5px] text-muted";

/** Champs d'un dossier, partagés par « Nouveau dossier » et « Modifier les infos ». */
export function DossierFields({ value: v, onChange, commerciaux, meNom, hideSiret = false }: Props) {
  return (
    <>
      <label className="mb-3 block">
        <span className={label}>Nom du restaurant</span>
        <input
          className="input"
          name="restaurant"
          placeholder="Ex. Chez Marco"
          value={v.restaurant}
          onChange={(e) => onChange({ restaurant: e.target.value })}
          autoComplete="off"
        />
      </label>

      <label className="mb-3 block">
        <span className={label}>Adresse</span>
        <input
          className="input"
          name="adresse"
          placeholder="Ex. 12 rue de la Paix 69002 Lyon"
          value={v.adresse ?? ""}
          onChange={(e) => onChange({ adresse: e.target.value })}
          autoComplete="off"
        />
      </label>

      <label className="mb-3 block">
        <span className={label}>Gérant</span>
        <input
          className="input"
          name="gerant"
          placeholder="Prénom et nom"
          value={v.gerant ?? ""}
          onChange={(e) => onChange({ gerant: e.target.value })}
          autoComplete="off"
        />
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="mb-3 block">
          <span className={label}>Téléphone</span>
          <input
            className="input"
            name="telephone"
            type="tel"
            inputMode="tel"
            placeholder="06 12 34 56 78"
            value={v.telephone ?? ""}
            onChange={(e) => onChange({ telephone: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label className="mb-3 block">
          <span className={label}>Mail</span>
          <input
            className="input"
            name="mail"
            type="email"
            inputMode="email"
            placeholder="contact@resto.fr"
            value={v.mail ?? ""}
            onChange={(e) => onChange({ mail: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      {!hideSiret && (
        <label className="mb-3 block">
          <span className={label}>N° SIRET</span>
          <input
            className="input"
            name="siret"
            inputMode="numeric"
            placeholder="14 chiffres"
            value={maskSiret(v.siret ?? "")}
            onChange={(e) => onChange({ siret: e.target.value })}
            autoComplete="off"
          />
        </label>
      )}

      <p id="source" className={label}>
        D’où vient ce contact ?
      </p>
      <div role="group" aria-labelledby="source" className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(SOURCES) as Source[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={v.source === s}
            onClick={() => onChange({ source: v.source === s ? null : s })}
            className={`min-h-10 rounded-full border px-3.5 text-[14px] ${
              v.source === s ? "border-2 border-brand bg-brand-soft font-bold text-brand-ink" : "border-line font-semibold"
            }`}
          >
            {SOURCES[s]}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className={label}>Commercial</span>
        <select className="input" name="commercial" value={v.commercial} onChange={(e) => onChange({ commercial: e.target.value })}>
          {commerciaux.map((c) => (
            <option key={c} value={c}>
              {c === meNom ? `${c} (moi)` : c}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
