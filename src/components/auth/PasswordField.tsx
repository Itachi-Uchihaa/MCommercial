"use client";

import { useState } from "react";

type Props = {
  ref?: React.Ref<HTMLInputElement>;
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  /** Lien ou bouton aligné à droite du libellé (ex. « Mot de passe oublié ? »). */
  aside?: React.ReactNode;
};

/** Champ mot de passe avec bouton pour l'afficher (évite les fautes de frappe au doigt). */
export function PasswordField({ ref, id, label, value, onChange, autoComplete, invalid, describedBy, aside }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-semibold">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="input pr-13"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="Afficher le mot de passe"
          aria-pressed={visible}
          className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-[10px] text-muted hover:bg-canvas hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
