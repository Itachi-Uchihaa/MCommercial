"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/** Saisie en cours dans la feuille ouverte (voir useUnsavedGuard). */
const DirtyContext = createContext<React.RefObject<boolean> | null>(null);

/**
 * À appeler dans un formulaire posé dans une BottomSheet : tant que `dirty` est vrai,
 * un appui à côté de la feuille ou Échap demande confirmation avant de fermer.
 */
export function useUnsavedGuard(dirty: boolean) {
  const ref = useContext(DirtyContext);
  useEffect(() => {
    if (!ref) return;
    ref.current = dirty;
    return () => {
      ref.current = false;
    };
  }, [ref, dirty]);
}

/** Feuille qui monte du bas de l'écran (fiche dossier, fiche RDV, compte rendu…). */
export function BottomSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Nom de la fenêtre pour les lecteurs d'écran (ex. « Compte rendu »). */
  label: string;
  children: React.ReactNode;
}) {
  // Reste monté pendant l'animation de fermeture
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const dirty = useRef(false);
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

  // Fermeture « par accident » (appui à côté, Échap) : on protège la saisie en cours
  const fermer = () => {
    if (dirty.current && !confirm("Fermer sans enregistrer ? Ce que tu as saisi sera perdu.")) return;
    onClose();
  };

  return (
    <DirtyContext.Provider value={dirty}>
      <div
        onClick={fermer}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity duration-200 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={(e) => e.key === "Escape" && fermer()}
        className={`safe-bottom fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[92dvh] max-w-3xl overflow-y-auto overscroll-contain rounded-t-[22px] bg-white px-4.5 pt-2 transition-transform duration-250 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mt-1 mb-3 h-1.25 w-10 rounded bg-[#d5d8e0]" />
        {children}
      </div>
    </DirtyContext.Provider>
  );
}
