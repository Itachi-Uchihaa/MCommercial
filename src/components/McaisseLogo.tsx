// Symbole mcaisse (deux boucles bleues, le bas en gris, le point sous le croisement),
// repris de mcaisse_restaurateur (components/shared/McaisseLogo.tsx).
// sombre : posé sur une photo ou un fond foncé (bleu plus clair, texte blanc).
// anime : le symbole se dessine en boucle (écrans de chargement, voir .trace dans globals.css).
export function McaisseMark({
  className = "h-5 w-auto",
  sombre = false,
  anime = false,
}: {
  className?: string;
  sombre?: boolean;
  anime?: boolean;
}) {
  const bleu = sombre ? "stroke-[#7aa4ff]" : "stroke-brand";
  const gris = sombre ? "stroke-white/70" : "stroke-[#b9bdc4]";
  return (
    <svg viewBox="3 3 94 52" className={`${anime ? "trace" : ""} ${className}`} aria-hidden>
      <g fill="none" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round">
        <path pathLength={1} className={bleu} d="M50 36 L34 12 Q31 7.5 25 7.5 L17 7.5 Q7.5 7.5 7.5 17 L7.5 44" />
        <path pathLength={1} className={bleu} d="M50 36 L66 12 Q69 7.5 75 7.5 L83 7.5 Q92.5 7.5 92.5 17 L92.5 44" />
        <path pathLength={1} className={gris} d="M7.5 44 Q7.5 50.5 14 50.5 L25 50.5 Q28.5 50.5 31 48.5 L50 36" />
        <path pathLength={1} className={gris} d="M92.5 44 Q92.5 50.5 86 50.5 L75 50.5 Q71.5 50.5 69 48.5 L50 36" />
      </g>
      <circle cx="50" cy="50" r="3.6" className={sombre ? "fill-[#7aa4ff]" : "fill-brand"} />
    </svg>
  );
}

/** Symbole + nom, comme le logo officiel : « m » en bleu, « caisse » dans la couleur du texte. */
export function McaisseLogo({
  suffix,
  className = "",
  sombre = false,
  anime = false,
}: {
  suffix?: string;
  className?: string;
  sombre?: boolean;
  anime?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${sombre ? "text-white" : ""} ${className}`}>
      <McaisseMark className="h-[22px] w-auto" sombre={sombre} anime={anime} />
      <span className="text-[16px] font-bold tracking-tight">
        <span className={sombre ? "text-[#a9c4ff]" : "text-brand"}>m</span>caisse
        {suffix && <span className={`font-medium ${sombre ? "text-white/75" : "text-muted"}`}> · {suffix}</span>}
      </span>
    </span>
  );
}
