import { TabBar } from "./navigation";

/**
 * Écran d'attente des pages. Garde les onglets du bas pour que la navigation ne « clignote » pas
 * (sauf pour les pages sans onglets : Administration, Paramètres).
 */
export function Chargement({ onglets = true }: { onglets?: boolean }) {
  return (
    <>
      <main className="grid min-h-dvh place-items-center text-muted" aria-busy="true">
        <p role="status">Chargement…</p>
      </main>
      {onglets && <TabBar />}
    </>
  );
}
