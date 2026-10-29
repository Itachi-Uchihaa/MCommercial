"use client";

import Image from "next/image";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { McaisseLogo } from "../McaisseLogo";

const PAUSE_KEY = "login-video-pause";

/** Abonnement à une media query, lisible au rendu (faux côté serveur). */
function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Pause de la vidéo, gardée dans le navigateur (simple confort). */
function usePause() {
  const lire = () => {
    try {
      return localStorage.getItem(PAUSE_KEY) === "1";
    } catch {
      return false;
    }
  };
  const pause = useSyncExternalStore(
    (cb) => {
      window.addEventListener("login-video", cb);
      return () => window.removeEventListener("login-video", cb);
    },
    lire,
    () => false,
  );
  const basculer = () => {
    try {
      localStorage.setItem(PAUSE_KEY, pause ? "0" : "1");
    } catch {
      // Stockage indisponible : la vidéo reprend au prochain chargement
    }
    window.dispatchEvent(new Event("login-video"));
  };
  return [pause, basculer] as const;
}

/**
 * Cadre des pages de connexion, sur le modèle du dashboard mcaisse_restaurateur :
 * téléphone : bannière photo en haut, formulaire dessous ;
 * ordinateur : formulaire à gauche, photo et vidéo à droite.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const ordinateur = useMedia("(min-width: 900px)");
  const calme = useMedia("(prefers-reduced-motion: reduce)");
  const [pause, basculer] = usePause();
  const video = useRef<HTMLVideoElement>(null);
  const avecVideo = ordinateur && !calme;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (pause) v.pause();
    else v.play().catch(() => {});
  }, [pause, avecVideo]);

  return (
    <main className="flex min-h-dvh flex-col bg-canvas text-ink min-[900px]:grid min-[900px]:grid-cols-[44fr_56fr]">
      <section
        aria-label="Un plat servi au restaurant"
        className="relative h-[34dvh] min-h-[220px] flex-none overflow-hidden rounded-b-[28px] bg-[#0b0c10] min-[900px]:order-2 min-[900px]:m-4 min-[900px]:ml-0 min-[900px]:h-auto min-[900px]:rounded-3xl"
      >
        <Image
          src="/images/restau-poster.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 900px) 56vw, 100vw"
          className="object-cover object-[50%_45%]"
        />
        {avecVideo && (
          <video
            ref={video}
            autoPlay={!pause}
            muted
            loop
            playsInline
            poster="/images/restau-poster.jpg"
            className="absolute inset-0 size-full object-cover"
          >
            <source src="/images/restau.mp4" type="video/mp4" />
          </video>
        )}
        {avecVideo && (
          <button
            type="button"
            onClick={basculer}
            aria-label={pause ? "Lire la vidéo" : "Mettre la vidéo en pause"}
            className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-black/45 text-white hover:bg-black/65"
          >
            {pause ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
          </button>
        )}
        {/* Assombrit le bas de la photo pour que le texte reste lisible */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/25 from-0% via-transparent via-35% to-[rgba(5,6,10,0.82)]" />
        <div className="absolute inset-x-5 top-[calc(18px+env(safe-area-inset-top,0px))] min-[900px]:hidden">
          <McaisseLogo suffix="Suivi" sombre />
        </div>
        <div className="absolute inset-x-5 bottom-5 text-white min-[900px]:inset-x-9 min-[900px]:bottom-9">
          <div className="hidden min-[900px]:block">
            <McaisseLogo sombre />
          </div>
          <p className="max-w-[18ch] text-[26px] leading-tight font-bold tracking-tight text-balance min-[900px]:mt-3 min-[900px]:text-[34px]">
            Ton équipe, sur le terrain.
          </p>
          <p className="mt-1.5 hidden max-w-[44ch] text-[15px] text-white/80 min-[900px]:block">
            Dossiers, agenda et relances de toute l’équipe commerciale, au même endroit et en direct.
          </p>
        </div>
      </section>

      <section className="flex flex-1 flex-col px-5 pt-7 pb-[calc(20px+env(safe-area-inset-bottom,0px))] sm:px-8 min-[900px]:order-1 min-[900px]:min-h-dvh min-[900px]:justify-between">
        <div className="hidden min-[900px]:block">
          <McaisseLogo suffix="Suivi commercial" />
        </div>
        <div className="mx-auto w-full max-w-[380px] min-[900px]:my-10">{children}</div>
        <footer className="mt-auto flex flex-wrap justify-between gap-x-4 gap-y-1 pt-8 text-[13px] text-muted min-[900px]:mt-0 min-[900px]:pt-0">
          <span>© mcaisse</span>
          <span>Un souci pour te connecter&nbsp;? Demande à ton responsable.</span>
        </footer>
      </section>
    </main>
  );
}
