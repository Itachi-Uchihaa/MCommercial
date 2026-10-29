"use client"; // Les pages d'erreur sont des composants client

import Link from "next/link";
import { useEffect } from "react";
import { McaisseLogo } from "@/components/McaisseLogo";

/** Une page n'a pas pu se charger (réseau, base indisponible) : on le dit, avec « Réessayer ». */
export default function Erreur({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <div className="w-full max-w-sm">
        <McaisseLogo suffix="Suivi" className="mb-5 ml-1" />
        <div role="alert" className="card px-5.5 py-6.5">
          <h1 className="mb-1 text-[22px] font-bold">Page indisponible</h1>
          <p className="mb-4.5 text-[14.5px] text-muted">Les données n’ont pas pu se charger. Vérifie ta connexion, puis réessaie.</p>
          <button onClick={() => retry()} className="w-full rounded-2xl bg-brand py-4 font-bold text-white">
            Réessayer
          </button>
          <Link href="/" className="mt-2 flex min-h-12 items-center justify-center font-semibold text-brand">
            Revenir à l’accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
