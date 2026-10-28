import { pct, stats } from "@/lib/dossiers";
import type { Dossier } from "@/lib/types";

/** Les 6 compteurs, avec le taux de passage depuis l'étape précédente. */
export function Kpis({ dossiers }: { dossiers: Dossier[] }) {
  const s = stats(dossiers);
  const tiles: [string, number, string | null, string][] = [
    ["Dossiers", s.total, null, ""],
    ["Devis faits", s.devis, pct(s.devis, s.total), "des dossiers"],
    ["Devis acceptés", s.acc, pct(s.acc, s.devis), "des devis"],
    ["Signés", s.sign, pct(s.sign, s.acc), "des acceptés"],
    ["TPE enrôlés", s.tpe, pct(s.tpe, s.sign), "des signés"],
    ["Installés", s.inst, pct(s.inst, s.sign), "des signés"],
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {tiles.map(([label, value, rate, suffix]) => (
        <div key={label} className="min-w-0 rounded-[18px] border border-line bg-white px-3 pt-3 pb-2.5">
          <b className="block text-[28px] leading-tight font-extrabold text-brand tabular-nums sm:text-[32px]">{value}</b>
          <span className="block text-[13px] text-muted">{label}</span>
          <small className="mt-1.5 block text-[11.5px] text-muted">
            {rate ? (
              <>
                <em className="font-bold text-ink not-italic">{rate}</em> {suffix}
              </>
            ) : (
              " "
            )}
          </small>
        </div>
      ))}
    </div>
  );
}
