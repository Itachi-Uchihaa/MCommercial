import { McaisseLogo } from "./McaisseLogo";

/** Carte d'information plein écran (accès non autorisé, dossier introuvable, clé admin manquante). */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-5">
      <div className="w-full max-w-sm">
        <McaisseLogo suffix="Suivi" className="mb-5 ml-1" />
        <div className="card px-5.5 py-6.5">
          <h1 className="mb-1 text-[22px] font-bold">{title}</h1>
          <p className="mb-4.5 text-[14.5px] text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
