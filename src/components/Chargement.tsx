/** Écran d'attente des pages, pendant le chargement des données. */
export function Chargement() {
  return (
    <main className="grid min-h-dvh place-items-center text-muted" aria-busy="true">
      Chargement…
    </main>
  );
}
