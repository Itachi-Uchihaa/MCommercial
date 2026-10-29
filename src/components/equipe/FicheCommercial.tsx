"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RDV_TYPES, colorOf, fmtHeure, fmtHeureLongue, fmtJour, fmtJourCourt } from "@/lib/agenda";
import { parisDay, parisTime } from "@/lib/dates";
import { STEPS, niveau } from "@/lib/dossiers";
import { rdvPasse, relancesDe } from "@/lib/relances";
import type { Dossier, JournalEntry, Membre, RendezVous } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { DossierCard } from "../dossiers/DossierCard";
import { IconCalendar, IconCheck, IconChevronRight, IconClock, IconFolder } from "../icons";

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  nom: string;
  today: string;
  nowTime: string;
  /** Ses dossiers, du plus récemment modifié au plus ancien. */
  dossiers: Dossier[];
  /** Ses RDV, du plus récent au plus ancien. */
  rdvs: RendezVous[];
  /** Ce qu'il a écrit ou fait dans les journaux des dossiers. */
  journal: (JournalEntry & { dossiers: { restaurant: string } | null })[];
};

const SIGNE = STEPS.findIndex((s) => s.key === "signature");

/** Une ligne du fil d'activité. */
type Evenement = {
  cle: string;
  ts: string;
  type: "note" | "historique" | "compte_rendu" | "rdv";
  titre: string;
  texte?: string;
  href?: string;
};

const PAR_PAGE = 30;
const maj = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function FicheCommercial({ me, canAdmin, equipe, nom, today, nowTime, dossiers, rdvs, journal }: Props) {
  const live = useRealtimeRefresh(["dossiers", "rendez_vous", "journal"]);
  const [affiches, setAffiches] = useState(PAR_PAGE);
  const couleur = colorOf(nom, equipe).bar;

  const chiffres = useMemo(() => {
    const ouverts = dossiers.filter((d) => !d.perdu_le);
    const signes = ouverts.filter((d) => niveau(d) >= SIGNE).length;
    const devis = dossiers.filter((d) => d.devis_fait).length;
    const passes = rdvs.filter((r) => rdvPasse(r, today, nowTime));
    return {
      enCours: ouverts.length - signes,
      signes,
      perdus: dossiers.length - ouverts.length,
      taux: devis ? Math.round((dossiers.filter((d) => niveau(d) >= SIGNE).length / devis) * 100) : null,
      rdvFaits: passes.length,
      sansCompteRendu: passes.filter((r) => !r.compte_rendu_le).length,
    };
  }, [dossiers, rdvs, today, nowTime]);

  // Les RDV sont rangés du plus récent au plus ancien : on remet les prochains dans l'ordre
  const aVenir = useMemo(() => rdvs.filter((r) => !rdvPasse(r, today, nowTime)).reverse(), [rdvs, today, nowTime]);

  const prochains = useMemo(() => {
    const p: Record<string, RendezVous> = {};
    for (const r of aVenir) if (r.dossier_id && !p[r.dossier_id]) p[r.dossier_id] = r;
    return p;
  }, [aVenir]);

  const relances = useMemo(() => {
    const out: Record<string, string> = {};
    for (const r of relancesDe({ dossiers, rdvs, today, nowTime })) if (r.dossierId && !out[r.dossierId]) out[r.dossierId] = r.motif;
    return out;
  }, [dossiers, rdvs, today, nowTime]);

  // Fil d'activité : journal des dossiers + RDV planifiés pour lui, du plus récent au plus ancien
  const activite = useMemo(() => {
    const ev: Evenement[] = journal.map((j) => {
      const resto = j.dossiers?.restaurant ?? "Dossier supprimé";
      return {
        cle: `j-${j.id}`,
        ts: j.created_at,
        type: j.type,
        titre:
          j.type === "historique" ? `${maj(j.texte)} · ${resto}` : j.type === "compte_rendu" ? `Compte rendu · ${resto}` : `Note · ${resto}`,
        texte: j.type === "historique" ? undefined : j.texte,
        href: `/dossiers/${j.dossier_id}`,
      };
    });
    for (const r of rdvs) {
      ev.push({
        cle: `r-${r.id}`,
        ts: r.created_at,
        type: "rdv",
        titre: `RDV planifié · ${r.restaurant}`,
        texte: `${RDV_TYPES[r.type]} le ${fmtJour(r.jour)} à ${fmtHeureLongue(r.debut)}`,
        href: r.dossier_id ? `/dossiers/${r.dossier_id}` : `/agenda?rdv=${r.id}`,
      });
    }
    return ev.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [journal, rdvs]);

  // Regroupé par jour
  const jours = useMemo(() => {
    const map = new Map<string, Evenement[]>();
    for (const e of activite.slice(0, affiches)) {
      const j = parisDay(e.ts);
      map.set(j, [...(map.get(j) ?? []), e]);
    }
    return [...map.entries()];
  }, [activite, affiches]);

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="equipe"
      title={nom}
      subtitle={`${dossiers.length} dossier${dossiers.length > 1 ? "s" : ""} · ${rdvs.length} RDV`}
      back={{ href: "/equipe", label: "Équipe" }}
    >
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tuile titre="En cours" valeur={chiffres.enCours} detail={chiffres.perdus ? `${chiffres.perdus} perdu${chiffres.perdus > 1 ? "s" : ""}` : "aucun perdu"} />
        <Tuile titre="Signés" valeur={chiffres.signes} detail={chiffres.taux !== null ? `${chiffres.taux} % des devis` : "aucun devis"} vert />
        <Tuile titre="RDV faits" valeur={chiffres.rdvFaits} detail={`${aVenir.length} à venir`} />
        <Tuile
          titre="Comptes rendus"
          valeur={chiffres.rdvFaits - chiffres.sansCompteRendu}
          detail={chiffres.sansCompteRendu ? `${chiffres.sansCompteRendu} manquant${chiffres.sansCompteRendu > 1 ? "s" : ""}` : "tous faits"}
          alerte={chiffres.sansCompteRendu > 0}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="prochains">
          <h2 id="prochains" className="section-title">
            Prochains RDV
          </h2>
          {aVenir.length ? (
            <ul className="card overflow-hidden">
              {aVenir.slice(0, 5).map((r, i) => (
                <li key={r.id} className={i ? "border-t border-line" : ""}>
                  <Link href={`/agenda?rdv=${r.id}`} className="flex min-h-15 items-center gap-3 py-2 pr-3.5 pl-4">
                    <span aria-hidden className="h-9 w-1 flex-none rounded-full" style={{ background: couleur }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.restaurant}</span>
                      <span className="block text-[13px] text-muted">
                        {r.jour === today ? "Aujourd’hui" : maj(fmtJourCourt(r.jour))} à {fmtHeure(r.debut)} · {RDV_TYPES[r.type]}
                      </span>
                    </span>
                    <IconChevronRight className="size-[18px] text-[#8e95a5]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Link
              href={`/agenda?commercial=${encodeURIComponent(nom)}&nouveau=${today}`}
              className="flex min-h-12 items-center justify-between gap-2 rounded-[18px] border border-dashed border-line px-3.5 py-3 text-[14px] text-muted hover:border-brand/40 hover:bg-white"
            >
              Aucun RDV prévu
              <span className="font-semibold text-brand">+ Planifier</span>
            </Link>
          )}
          {aVenir.length > 5 && (
            <Link href={`/agenda?commercial=${encodeURIComponent(nom)}`} className="mt-1 flex min-h-11 items-center text-[14px] font-bold text-brand">
              Voir ses {aVenir.length} RDV dans l’agenda
            </Link>
          )}
        </section>

        <section aria-labelledby="activite">
          <h2 id="activite" className="section-title">
            Activité
          </h2>
          {jours.length ? (
            <div className="card p-4">
              {jours.map(([jour, evs], k) => (
                <div key={jour} className={k ? "mt-4 border-t border-line pt-4" : ""}>
                  <h3 className="mb-2.5 text-[13px] font-bold text-muted">
                    {jour === today ? "Aujourd’hui" : maj(fmtJour(jour))}
                  </h3>
                  <ol className="flex flex-col gap-3">
                    {evs.map((e) => (
                      <li key={e.cle}>
                        <Link href={e.href ?? "#"} className="flex gap-2.5">
                          <Pastille type={e.type} />
                          <span className="min-w-0 flex-1">
                            <span className="flex gap-2 text-[14.5px]">
                              <b className="min-w-0 flex-1 font-semibold break-words">{e.titre}</b>
                              <span className="flex-none text-[12.5px] text-muted tabular-nums">{parisTime(e.ts)}</span>
                            </span>
                            {e.texte && <span className="mt-0.5 block text-[13.5px] break-words whitespace-pre-line text-ink-soft">{e.texte}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {activite.length > affiches && (
                <button onClick={() => setAffiches((n) => n + PAR_PAGE)} className="mt-3 min-h-11 w-full rounded-xl bg-canvas font-semibold text-brand">
                  Voir plus ({activite.length - affiches})
                </button>
              )}
            </div>
          ) : (
            <p className="rounded-[18px] border border-dashed border-line px-3.5 py-3 text-[14px] text-muted">Aucune activité pour l’instant.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="ses-dossiers" className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="ses-dossiers" className="section-title">
            Ses dossiers
          </h2>
          {dossiers.length > 0 && (
            <Link href={`/dossiers?commercial=${encodeURIComponent(nom)}`} className="mb-2 min-h-11 px-1 text-[14px] font-bold text-brand">
              Filtrer dans Dossiers
            </Link>
          )}
        </div>
        {dossiers.length ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2">
            {dossiers.map((d) => (
              <DossierCard key={d.id} dossier={d} today={today} prochain={prochains[d.id]} relance={relances[d.id]} showCommercial={false} />
            ))}
          </div>
        ) : (
          <p className="rounded-[18px] border border-dashed border-line px-3.5 py-3 text-[14px] text-muted">Aucun dossier pour l’instant.</p>
        )}
      </section>
    </AppShell>
  );
}

function Tuile({ titre, valeur, detail, vert, alerte }: { titre: string; valeur: number; detail: string; vert?: boolean; alerte?: boolean }) {
  return (
    <div className="card px-4 pt-3 pb-3">
      <p className="text-[13px] font-semibold text-muted">{titre}</p>
      <p className={`text-[28px] leading-tight font-extrabold tabular-nums ${vert ? "text-ok-ink" : ""}`}>{valeur}</p>
      <p className={`mt-0.5 text-[12.5px] ${alerte ? "font-semibold text-warn" : "text-muted"}`}>{detail}</p>
    </div>
  );
}

function Pastille({ type }: { type: Evenement["type"] }) {
  const Icon = type === "rdv" ? IconCalendar : type === "compte_rendu" ? IconCheck : type === "note" ? IconFolder : IconClock;
  const style =
    type === "rdv" ? "bg-brand-soft text-brand" : type === "compte_rendu" ? "bg-ok-soft text-ok-ink" : "bg-[#e6e8ef] text-ink-soft";
  return (
    <span aria-hidden className={`grid size-8 flex-none place-items-center rounded-full ${style}`}>
      <Icon className="size-4" />
    </span>
  );
}
