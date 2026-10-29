"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { IconX } from "./icons";

/** Saisie en cours dans la feuille ouverte (voir useUnsavedGuard). */
const DirtyContext = createContext<React.RefObject<boolean> | null>(null);

/**
 * À appeler dans un formulaire posé dans une BottomSheet : tant que `dirty` est vrai,
 * fermer la feuille (bouton Fermer, appui à côté, Échap) demande confirmation.
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
  const panneau = useRef<HTMLDivElement>(null);
  const retour = useRef<HTMLElement | null>(null);
  const fermerRef = useRef<() => void>(() => {});
  // Glisser vers le bas pour fermer : décalage du doigt (px), ou null hors geste
  const [glisse, setGlisse] = useState<number | null>(null);
  if (open && !mounted) setMounted(true);

  // Fermeture « par accident » ou volontaire : on protège la saisie en cours
  useEffect(() => {
    fermerRef.current = () => {
      if (dirty.current && !confirm("Fermer sans enregistrer ? Ce que tu as saisi sera perdu.")) return;
      onClose();
    };
  }, [onClose]);

  useEffect(() => {
    if (open) {
      // Focus dans la feuille, Échap partout, page du dessous figée
      retour.current = document.activeElement as HTMLElement | null;
      const r = requestAnimationFrame(() => {
        setEntered(true);
        panneau.current?.focus({ preventScroll: true });
      });
      const echap = (e: KeyboardEvent) => e.key === "Escape" && fermerRef.current();
      document.addEventListener("keydown", echap);
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        cancelAnimationFrame(r);
        document.removeEventListener("keydown", echap);
        document.body.style.overflow = overflow;
      };
    }
    const t = setTimeout(() => {
      setMounted(false);
      setEntered(false);
      setGlisse(null);
      retour.current?.focus?.({ preventScroll: true }); // retour au bouton qui a ouvert la feuille
    }, 250);
    return () => clearTimeout(t);
  }, [open]);

  // Glisser vers le bas pour fermer (téléphone), seulement quand le contenu est déjà tout en haut.
  // Écouteurs natifs non « passifs » : on bloque le rebond de la page pendant le geste.
  useEffect(() => {
    const el = panneau.current;
    if (!mounted || !el) return;
    let depart: { y: number; t: number } | null = null;
    let dy = 0;

    const debut = (e: TouchEvent) => {
      dy = 0;
      depart = el.scrollTop <= 0 ? { y: e.touches[0].clientY, t: Date.now() } : null;
    };
    const bouge = (e: TouchEvent) => {
      if (!depart) return;
      dy = e.touches[0].clientY - depart.y;
      if (dy <= 0) {
        // Vers le haut : c'est un défilement du contenu, pas une fermeture
        depart = null;
        setGlisse(null);
        return;
      }
      e.preventDefault();
      setGlisse(dy);
    };
    const fin = () => {
      if (!depart) return;
      const rapide = dy > 30 && dy / Math.max(1, Date.now() - depart.t) > 0.6;
      depart = null;
      if (dy > Math.min(140, el.offsetHeight * 0.25) || rapide) {
        fermerRef.current(); // demande confirmation si une saisie est en cours
        // Fermeture refusée : la feuille remonte ; acceptée : elle finit de descendre depuis le doigt
        requestAnimationFrame(() => setGlisse(null));
      } else setGlisse(null);
    };

    el.addEventListener("touchstart", debut, { passive: true });
    el.addEventListener("touchmove", bouge, { passive: false });
    el.addEventListener("touchend", fin);
    el.addEventListener("touchcancel", fin);
    return () => {
      el.removeEventListener("touchstart", debut);
      el.removeEventListener("touchmove", bouge);
      el.removeEventListener("touchend", fin);
      el.removeEventListener("touchcancel", fin);
    };
  }, [mounted]);

  if (!mounted) return null;
  const visible = open && entered;

  return (
    <DirtyContext.Provider value={dirty}>
      <div
        onClick={() => fermerRef.current()}
        style={glisse !== null && visible ? { opacity: Math.max(0.2, 1 - glisse / 400) } : undefined}
        className={`fixed inset-0 z-40 bg-ink/35 transition-opacity duration-200 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        // Pendant le geste, la feuille suit le doigt (sans animation)
        style={glisse !== null && visible ? { transform: `translateY(${glisse}px)`, transition: "none" } : undefined}
        className={`safe-bottom fixed inset-x-0 bottom-0 z-41 mx-auto max-h-[92dvh] max-w-3xl overflow-y-auto overscroll-contain rounded-t-[22px] bg-white px-4.5 pt-2 outline-none transition-transform duration-250 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Poignée : indique qu'on peut glisser la feuille vers le bas pour la fermer */}
        <div aria-hidden className="mx-auto mt-1 mb-3 h-1.25 w-10 rounded bg-[#d5d8e0]" />
        <button
          type="button"
          onClick={() => fermerRef.current()}
          aria-label="Fermer"
          className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-muted hover:bg-canvas"
        >
          <IconX className="size-5" />
        </button>
        {children}
      </div>
    </DirtyContext.Provider>
  );
}
