import { STEPS, fmtDate, fmtSiret, isDone } from "@/lib/dossiers";
import type { Dossier, StepKey } from "@/lib/types";

type Props = {
  dossier: Dossier;
  onToggle: (key: StepKey) => void;
  onEdit: () => void;
};

export function DossierCard({ dossier: d, onToggle, onEdit }: Props) {
  return (
    <article className="rounded-[18px] border border-line bg-white p-3.5">
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(e) => e.key === "Enter" && onEdit()}
        className="flex cursor-pointer items-start gap-2.5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold">{d.restaurant}</p>
          {(d.siret || d.mail) && (
            <p className="mt-0.5 truncate text-[13px] text-muted">
              {d.siret && <>SIRET {fmtSiret(d.siret)}</>}
              {d.siret && d.mail && " · "}
              {d.mail && (
                <a href={`mailto:${d.mail}`} onClick={(e) => e.stopPropagation()} className="text-brand">
                  {d.mail}
                </a>
              )}
            </p>
          )}
        </div>
        <span className="flex-none rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-semibold text-brand">
          {d.commercial}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
        {STEPS.map(({ key, label }) => {
          const done = isDone(d, key);
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              aria-pressed={done}
              className={`flex min-h-13.5 min-w-0 flex-col items-center gap-1 rounded-xl border px-0.5 pt-2 pb-1.5 text-[11.5px] sm:text-[12.5px] ${
                done ? "border-ok-line bg-ok-soft font-semibold text-ok-ink" : "border-line bg-[#fafbfd] text-muted"
              }`}
            >
              <span
                className={`grid size-5 place-items-center rounded-full border-2 ${
                  done ? "border-ok bg-ok" : "border-[#c4c8d2]"
                }`}
              >
                {done && (
                  <svg viewBox="0 0 12 12" className="size-3 text-white" aria-hidden>
                    <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {(d.date_rdv || d.date_installation) && (
        <div className="mt-2.5 flex flex-wrap gap-x-3.5 text-[12.5px] text-muted">
          {d.date_rdv && (
            <span>
              RDV <b className="font-semibold text-ink">{fmtDate(d.date_rdv)}</b>
            </span>
          )}
          {d.date_installation && (
            <span>
              Installé le <b className="font-semibold text-ink">{fmtDate(d.date_installation)}</b>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
