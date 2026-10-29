import Link from "next/link";
import { McaisseLogo, McaisseMark } from "./McaisseLogo";
import { NAV, TabBar } from "./navigation";

/** Bloc gris qui scintille, à la place d'un texte ou d'une carte pas encore chargés. */
export function Squelette({ className = "", arrondi = "rounded-lg" }: { className?: string; arrondi?: string }) {
  return <span aria-hidden className={`squelette block ${arrondi} ${className}`} />;
}

/** Fine barre bleue qui file en haut de l'écran. */
function Progression() {
  return (
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-brand-soft">
      <span className="progression block h-full w-1/3 rounded-full bg-brand" />
    </div>
  );
}

/**
 * Écran d'attente des pages : la silhouette de l'écran qui arrive (titre, cartes) et le logo qui se dessine.
 * Garde les onglets du bas et le menu de gauche pour que la navigation ne « clignote » pas
 * (sauf pour les pages sans onglets : Administration, Paramètres).
 */
export function Chargement({ onglets = true }: { onglets?: boolean }) {
  if (!onglets) {
    return (
      <>
        <Progression />
        <header className="safe-top sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 pb-3">
          <span aria-hidden className="size-11 flex-none rounded-full bg-canvas" />
          <div className="flex-1">
            <Squelette className="h-4.5 w-36" />
            <Squelette className="mt-1.5 h-3 w-24" />
          </div>
          <McaisseMark className="h-7 w-auto" anime />
        </header>
        <Contenu />
      </>
    );
  }

  return (
    <div className="lg:flex">
      <Progression />
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none flex-col border-r border-line bg-white px-3 py-6 lg:flex">
        <Link href="/" className="mb-6 px-2">
          <McaisseLogo suffix="Suivi" anime />
        </Link>
        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {NAV.map(({ key, href, label, Icon }) => (
            <Link key={key} href={href} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold text-ink-soft hover:bg-canvas">
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="mx-auto flex max-w-3xl items-start gap-3 px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] lg:max-w-6xl lg:items-end lg:px-8 lg:pt-8">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold lg:hidden">
              <McaisseMark className="h-4 w-auto" anime />
              <span>
                <span className="text-brand">m</span>caisse
              </span>
            </p>
            <Squelette className="h-7 w-52 max-w-full" />
            <Squelette className="mt-2 h-3.5 w-32" />
          </div>
          <span aria-hidden className="size-11 flex-none rounded-full bg-brand-soft lg:hidden" />
        </header>
        <Contenu />
      </div>

      <TabBar />
    </div>
  );
}

/** Silhouette commune : une grande carte, puis une liste. */
function Contenu() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-4 pb-32 lg:max-w-6xl lg:px-8" aria-busy="true">
      <p role="status" className="sr-only">
        Chargement…
      </p>
      <div className="card p-4">
        <Squelette className="h-3.5 w-28" />
        <Squelette className="mt-3 h-8 w-20" />
        <Squelette className="mt-3 h-2.5 w-full" arrondi="rounded-full" />
      </div>

      <Squelette className="mt-6 mb-2 h-3 w-24" />
      <div className="card overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex items-center gap-3 px-3.5 py-3.5 ${i ? "border-t border-line" : ""}`}>
            <Squelette className="size-10 flex-none" arrondi="rounded-full" />
            <div className="min-w-0 flex-1">
              <Squelette className={`h-4 ${["w-40", "w-32", "w-44"][i]} max-w-full`} />
              <Squelette className={`mt-2 h-3 ${["w-24", "w-36", "w-28"][i]} max-w-full`} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
