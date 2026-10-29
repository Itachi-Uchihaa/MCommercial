"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updatePrenom } from "@/app/parametres/actions";
import type { Membre } from "@/lib/types";
import { NotificationsReglage } from "./NotificationsReglage";
import { Toast, useToast } from "./Toast";

export function Parametres({ me }: { me: Membre }) {
  const [nom, setNom] = useState(me.nom);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { toast, showToast } = useToast();
  const inchange = nom.trim().replace(/\s+/g, " ") === me.nom;

  return (
    <>
      <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 pb-3 backdrop-blur-md">
        <Link href="/" aria-label="Retour à l’accueil" className="grid size-10 place-items-center rounded-full bg-canvas text-xl">
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold tracking-tight">Paramètres</h1>
          <p className="truncate text-[13px] text-muted">{me.email}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-[calc(40px+env(safe-area-inset-bottom,0px))]">
        <h2 className="mx-0.5 mb-2.5 text-[13px] font-bold tracking-wider text-muted uppercase">Mon profil</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updatePrenom(nom);
              setError(r.ok ? null : r.error);
              if (r.ok) showToast(r.message);
            });
          }}
          className="rounded-[18px] border border-line bg-white p-3.5"
        >
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] text-muted">Prénom</span>
            <input
              className="input"
              name="prenom"
              autoComplete="given-name"
              maxLength={40}
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setError(null);
              }}
            />
          </label>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Visible par toute l’équipe : en haut de l’app, dans les filtres, sur tes dossiers et tes RDV.
          </p>
          {error && (
            <p role="alert" className="mt-2.5 text-[13.5px] text-danger">
              {error}
            </p>
          )}
          <button
            disabled={pending || inchange}
            className="mt-3.5 w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-40"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>

        <NotificationsReglage />
      </main>

      <Toast message={toast} />
    </>
  );
}
