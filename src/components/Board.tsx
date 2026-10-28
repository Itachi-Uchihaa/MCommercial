import { stats } from "@/lib/dossiers";
import type { Dossier } from "@/lib/types";

/** Classement des commerciaux : dossiers, signés, installés. */
export function Board({ dossiers, commerciaux }: { dossiers: Dossier[]; commerciaux: string[] }) {
  const rows = commerciaux
    .map((c) => ({ c, ...stats(dossiers.filter((d) => d.commercial === c)) }))
    .sort((a, b) => b.sign - a.sign || b.total - a.total);

  const row = "grid grid-cols-[1fr_repeat(3,52px)] items-center gap-1 px-3.5 tabular-nums [&>*:not(:first-child)]:text-right";

  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-white">
      <div className={`${row} py-2 text-[11.5px] tracking-wide text-muted uppercase`}>
        <span>Commercial</span>
        <span>Doss.</span>
        <span>Signés</span>
        <span>Inst.</span>
      </div>
      {rows.map((r) => (
        <div key={r.c} className={`${row} border-t border-line py-2.5`}>
          <span className="font-semibold">{r.c}</span>
          <span>{r.total}</span>
          <span>{r.sign}</span>
          <span>{r.inst}</span>
        </div>
      ))}
    </div>
  );
}
