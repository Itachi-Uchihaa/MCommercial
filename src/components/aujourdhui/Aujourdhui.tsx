"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { relanceFaite } from "@/app/actions/dossiers";
import { RDV_TYPES, colorOf, fmtHeure, fmtJour, fmtJourCourt, mapsUrl } from "@/lib/agenda";
import { finDuMois, joursEntre, nomDuMois } from "@/lib/dates";
import { telHref } from "@/lib/dossiers";
import type { Relance } from "@/lib/relances";
import type { Membre, RendezVous } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { CompteRenduSheet } from "../CompteRenduSheet";
import { IconCalendar, IconCheck, IconFolder, IconPhone, IconRoute } from "../icons";
import { Toast, useToast } from "../Toast";

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  today: string;
  estCommercial: boolean;
  /** Signatures du mois (du commercial, ou de l'équipe) et objectif s'il est fixé. */
  objectif: { mois: string; signes: number; cible: number | null };
  prochain: (RendezVous & { telephone: string | null }) | null;
  duJour: RendezVous[];
  /** Ids des RDV du jour déjà terminés. */
  passes: string[];
  relances: Relance[];
};

const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Aujourdhui({ me, canAdmin, equipe, today, estCommercial, objectif, prochain, duJour, passes, relances }: Props) {
  const live = useRealtimeRefresh(["dossiers", "rendez_vous", "objectifs"]);
  const [cr, setCr] = useState<RendezVous | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [, start] = useTransition();
  const { toast, showToast, showError } = useToast();

  function relance(r: Relance) {
    if (!r.dossierId) return;
    setEnCours(r.cle);
    start(async () => {
      const res = await relanceFaite(r.dossierId!);
      setEnCours(null);
      if (res.ok) showToast("Relance notée dans le journal");
      else showError(res.error);
    });
  }

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="aujourdhui"
      title={`Bonjour, ${me.nom}`}
      subtitle={maj(fmtJour(today))}
      action={{ label: "Ajouter un dossier", href: "/dossiers/nouveau" }}
    >
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Objectif {...objectif} today={today} estCommercial={estCommercial} canAdmin={canAdmin} />

          {prochain && (
            <section aria-labelledby="prochain">
              <h2 id="prochain" className="section-title">
                Prochain RDV
              </h2>
              <article className="card overflow-hidden">
                <div className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-extrabold tabular-nums">
                      {fmtHeure(prochain.debut)} – {fmtHeure(prochain.fin)}
                    </span>
                    {prochain.jour !== today && (
                      <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-bold text-brand-ink">
                        {maj(fmtJourCourt(prochain.jour))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-lg font-bold break-words">{prochain.restaurant}</p>
                  <p className="text-[14px] text-muted">
                    {RDV_TYPES[prochain.type]}
                    {prochain.adresse && ` · ${prochain.adresse}`}
                  </p>
                </div>
                <div className="grid auto-cols-fr grid-flow-col border-t border-line">
                  {prochain.adresse && (
                    <a href={mapsUrl(prochain.adresse)} target="_blank" rel="noopener noreferrer" className={ACTION}>
                      <IconRoute />
                      Itinéraire
                    </a>
                  )}
                  {prochain.telephone && (
                    <a href={telHref(prochain.telephone)} className={ACTION}>
                      <IconPhone />
                      Appeler
                    </a>
                  )}
                  {prochain.dossier_id ? (
                    <Link href={`/dossiers/${prochain.dossier_id}`} className={ACTION}>
                      <IconFolder />
                      Voir la fiche
                    </Link>
                  ) : (
                    <Link href={`/agenda?rdv=${prochain.id}`} className={ACTION}>
                      <IconCalendar />
                      Voir le RDV
                    </Link>
                  )}
                </div>
              </article>
            </section>
          )}

          <section aria-labelledby="jour">
            <h2 id="jour" className="section-title">
              {duJour.length ? `Aujourd’hui · ${duJour.length} RDV` : "Aujourd’hui"}
            </h2>
            {duJour.length ? (
              <ol className="card overflow-hidden">
                {duJour.map((r, i) => {
                  const fini = passes.includes(r.id);
                  return (
                    <li key={r.id} className={`flex min-h-15 flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 ${i ? "border-t border-line" : ""}`}>
                      <span className={`w-12 font-bold tabular-nums ${fini ? "text-muted" : ""}`}>{fmtHeure(r.debut)}</span>
                      <span className="min-w-0 flex-1 basis-32">
                        <span className={`block font-semibold break-words ${fini ? "text-muted" : ""}`}>{r.restaurant}</span>
                        <span className="flex items-center gap-1.5 text-[13px] text-muted">
                          {!estCommercial && (
                            <span aria-hidden className="size-2 rounded-full" style={{ background: colorOf(r.commercial, equipe).bar }} />
                          )}
                          {RDV_TYPES[r.type]}
                          {!estCommercial && ` · ${r.commercial}`}
                        </span>
                      </span>
                      {fini &&
                        (r.compte_rendu_le ? (
                          <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ok-ink">
                            <IconCheck className="size-4" />
                            Compte rendu fait
                          </span>
                        ) : (
                          <button onClick={() => setCr(r)} className="ml-auto min-h-11 rounded-xl bg-warn-soft px-3 text-[14px] font-bold text-warn">
                            Faire le compte rendu
                          </button>
                        ))}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Link
                href={`/agenda?nouveau=${today}`}
                className="card flex min-h-14 items-center justify-between gap-2 px-4 py-2.5 text-[14.5px] text-muted hover:border-brand/40"
              >
                Aucun RDV aujourd’hui
                <span className="font-semibold text-brand">+ Planifier</span>
              </Link>
            )}
          </section>
        </div>

        <section aria-labelledby="relancer">
          <h2 id="relancer" className={`section-title ${relances.length ? "!text-warn" : ""}`}>
            {relances.length ? `À relancer · ${relances.length}` : "À relancer"}
          </h2>
          {relances.length ? (
            <ul className="space-y-2">
              {relances.map((r) => (
                <li key={r.cle} className="card flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-2.5 pl-4">
                  {r.dossierId ? (
                    <Link href={`/dossiers/${r.dossierId}`} className="min-w-0 flex-1 basis-40 py-1">
                      <RelanceTexte r={r} estCommercial={estCommercial} />
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 basis-40 py-1">
                      <RelanceTexte r={r} estCommercial={estCommercial} />
                    </span>
                  )}
                  {r.type === "compte_rendu" ? (
                    <button onClick={() => setCr(r.rdv!)} className="ml-auto min-h-11 flex-none rounded-xl bg-warn-soft px-3.5 text-[14px] font-bold text-warn">
                      Faire le compte rendu
                    </button>
                  ) : (
                    <button
                      onClick={() => relance(r)}
                      disabled={enCours === r.cle}
                      className="ml-auto min-h-11 flex-none rounded-xl bg-warn-soft px-3.5 text-[14px] font-bold text-warn disabled:opacity-60"
                    >
                      {enCours === r.cle ? "Enregistrement…" : "J’ai relancé"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="card px-4 py-4 text-[14.5px] text-muted">Rien à relancer : tout est à jour.</p>
          )}
        </section>
      </div>

      <CompteRenduSheet
        rdv={cr}
        today={today}
        onClose={() => setCr(null)}
        onSaved={(message) => {
          setCr(null);
          showToast(message);
        }}
      />
      <Toast message={toast} />
    </AppShell>
  );
}

const ACTION =
  "flex min-h-14 flex-col items-center justify-center gap-1 border-l border-line text-[13px] font-semibold text-brand first:border-l-0";

function RelanceTexte({ r, estCommercial }: { r: Relance; estCommercial: boolean }) {
  return (
    <>
      <span className="block font-bold break-words">{r.restaurant}</span>
      <span className="block text-[13px] text-muted">
        {r.motif}
        {!estCommercial && ` · ${r.commercial}`}
      </span>
    </>
  );
}

function Objectif({
  mois,
  signes,
  cible,
  today,
  estCommercial,
  canAdmin,
}: Props["objectif"] & { today: string; estCommercial: boolean; canAdmin: boolean }) {
  const restants = joursEntre(today, finDuMois(today));
  const titre = `${estCommercial ? "Objectif" : "Objectif de l’équipe"} · ${nomDuMois(mois)}`;

  if (cible === null) {
    return (
      <section aria-labelledby="objectif" className="card px-4 py-3.5">
        <h2 id="objectif" className="text-[15px] font-bold">
          Signés en {nomDuMois(mois)}
        </h2>
        <p className="mt-1 text-[28px] leading-tight font-extrabold text-brand tabular-nums">{signes}</p>
        <p className="mt-1 text-[13px] text-muted">
          Aucun objectif fixé pour ce mois.
          {canAdmin && (
            <>
              {" "}
              <Link href="/equipe#objectifs" className="inline-flex min-h-11 items-center font-semibold text-brand">
                Fixer les objectifs
              </Link>
            </>
          )}
        </p>
      </section>
    );
  }

  const ratio = cible ? Math.min(signes / cible, 1) : 1;
  return (
    <section aria-labelledby="objectif" className="card px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="objectif" className="text-[15px] font-bold">
          {titre}
        </h2>
        <p className="text-[14px] text-muted">
          <b className="text-lg text-ink tabular-nums">{signes}</b> signés sur {cible}
        </p>
      </div>
      <div aria-hidden className="mt-2.5 h-2 overflow-hidden rounded-full bg-brand-soft">
        <div className={`h-full rounded-full ${signes >= cible ? "bg-ok" : "bg-brand"}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-muted">
        {signes >= cible
          ? "Objectif atteint."
          : `Encore ${cible - signes} signature${cible - signes > 1 ? "s" : ""}, ${
              restants === 0 ? "dernier jour du mois" : `${restants} jour${restants > 1 ? "s" : ""} restant${restants > 1 ? "s" : ""}`
            }`}
      </p>
    </section>
  );
}
