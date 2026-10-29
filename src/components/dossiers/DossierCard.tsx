import Link from "next/link";
import { fmtHeure, fmtJourCourt } from "@/lib/agenda";
import { depuis, joursEntre } from "@/lib/dates";
import { RAISONS_PERTE, STEPS, derniereEtape, niveau, villeDe } from "@/lib/dossiers";
import type { Dossier, RendezVous } from "@/lib/types";
import { IconClock } from "../icons";

type Props = {
  dossier: Dossier;
  today: string;
  prochain?: RendezVous;
  /** Motif de relance, s'il y en a une. */
  relance?: string;
  showCommercial: boolean;
};

/** Carte d'un dossier : avancement, dernière étape datée, prochain RDV. Les étapes se cochent dans la fiche. */
export function DossierCard({ dossier: d, today, prochain, relance, showCommercial }: Props) {
  const n = niveau(d);
  const derniere = derniereEtape(d);
  const meta = [showCommercial && d.commercial, villeDe(d.adresse)].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/dossiers/${d.id}`}
      className={`card block px-4 py-3.5 hover:border-[#c9cfdc] ${relance ? "border-warn-line" : ""} ${d.perdu_le ? "bg-[#f7f8fa]" : ""}`}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-[17px] font-bold break-words">{d.restaurant}</span>
        {relance && (
          <span className="flex flex-none items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[12.5px] font-bold text-warn">
            <IconClock className="size-3.5" />À relancer
          </span>
        )}
        {d.perdu_le && (
          <span className="flex-none rounded-full bg-[#e6e8ef] px-2.5 py-1 text-[12.5px] font-bold text-ink-soft">Perdu</span>
        )}
      </span>
      {meta && <span className="mt-0.5 block text-[13px] text-muted">{meta}</span>}

      <span aria-hidden className="mt-3 grid grid-cols-5 gap-1">
        {STEPS.map((s, i) => (
          <span key={s.key} className={`h-1.5 rounded-full ${i <= n ? (d.perdu_le ? "bg-[#a9afbd]" : "bg-brand") : "bg-line"}`} />
        ))}
      </span>

      <span className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px]">
        <span>
          {d.perdu_le ? (
            <span className="text-muted">{d.raison_perte ? RAISONS_PERTE[d.raison_perte] : "Perdu"}</span>
          ) : derniere ? (
            <>
              <b className="font-semibold">{derniere.long}</b>
              {derniere.jour && <span className="text-muted"> {depuis(joursEntre(derniere.jour, today))}</span>}
            </>
          ) : (
            <span className="text-muted">Prospect, aucune étape</span>
          )}
        </span>
        {prochain && (
          <span className="font-semibold text-brand">
            RDV {prochain.jour === today ? "aujourd’hui" : fmtJourCourt(prochain.jour)} à {fmtHeure(prochain.debut)}
          </span>
        )}
      </span>
      {relance && <span className="mt-1 block text-[13px] font-semibold text-warn">{relance}</span>}
    </Link>
  );
}
