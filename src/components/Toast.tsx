"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastState = { texte: string; erreur: boolean } | null;

/** showToast : confirmation courte (2,6 s). showError : erreur en rouge, laissée plus longtemps (6 s). */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const afficher = useCallback((texte: string, erreur: boolean) => {
    setToast({ texte, erreur });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), erreur ? 6000 : 2600);
  }, []);
  const showToast = useCallback((texte: string) => afficher(texte, false), [afficher]);
  const showError = useCallback((texte: string) => afficher(texte, true), [afficher]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast, showError };
}

const BULLE =
  "fixed bottom-[calc(146px+env(safe-area-inset-bottom,0px))] left-1/2 z-60 max-w-[90vw] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white lg:bottom-6";

/** Zones toujours présentes : les lecteurs d'écran annoncent le texte quand il apparaît. */
export function Toast({ message }: { message: ToastState }) {
  const succes = message && !message.erreur;
  const erreur = message?.erreur;
  return (
    <>
      <div role="status" className={succes ? `${BULLE} bg-ink` : "sr-only"}>
        {succes ? message.texte : null}
      </div>
      <div role="alert" className={erreur ? `${BULLE} bg-danger font-semibold` : "sr-only"}>
        {erreur ? message.texte : null}
      </div>
    </>
  );
}
