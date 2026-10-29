// Symbole mcaisse (deux boucles bleues, le bas en gris, le point sous le croisement),
// repris de mcaisse_restaurateur (components/shared/McaisseLogo.tsx).
export function McaisseMark({ className = "h-5 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="3 3 94 52" className={className} aria-hidden>
      <g fill="none" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round">
        <path className="stroke-brand" d="M50 36 L34 12 Q31 7.5 25 7.5 L17 7.5 Q7.5 7.5 7.5 17 L7.5 44" />
        <path className="stroke-brand" d="M50 36 L66 12 Q69 7.5 75 7.5 L83 7.5 Q92.5 7.5 92.5 17 L92.5 44" />
        <path className="stroke-[#b9bdc4]" d="M7.5 44 Q7.5 50.5 14 50.5 L25 50.5 Q28.5 50.5 31 48.5 L50 36" />
        <path className="stroke-[#b9bdc4]" d="M92.5 44 Q92.5 50.5 86 50.5 L75 50.5 Q71.5 50.5 69 48.5 L50 36" />
      </g>
      <circle cx="50" cy="50" r="3.6" className="fill-brand" />
    </svg>
  );
}

/** Symbole + nom, comme le logo officiel : « m » en bleu, « caisse » dans la couleur du texte. */
export function McaisseLogo({ suffix, className = "" }: { suffix?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <McaisseMark className="h-[22px] w-auto" />
      <span className="text-[16px] font-bold tracking-tight">
        <span className="text-brand">m</span>caisse
        {suffix && <span className="font-medium text-muted"> · {suffix}</span>}
      </span>
    </span>
  );
}
