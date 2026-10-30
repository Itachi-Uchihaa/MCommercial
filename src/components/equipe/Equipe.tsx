"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { enregistrerObjectifs } from "@/app/actions/objectifs";
import { RDV_TYPES, addDays, colorOf, fmtHeure, mondayOf } from "@/lib/agenda";
import { deMois, debutDuMois, parisDay } from "@/lib/dates";
import { EQUIPEMENTS, RAISONS_PERTE, SOURCES, etapeDe, FILTRES_ETAPE } from "@/lib/dossiers";
import type { Relance } from "@/lib/relances";
import { PERIODES, type Periode, type StatsEquipe } from "@/lib/stats";
import type { Dossier, Membre, RendezVous } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { BottomSheet, useUnsavedGuard } from "../BottomSheet";
import { IconChevronRight, IconDownload } from "../icons";
import { Toast, useToast } from "../Toast";

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  today: string;
  nowTime: string;
  /** Période choisie au chargement (?periode=). */
  periode: Periode;
  /** Chiffres des trois périodes, calculés d'avance : le changement de période est instantané. */
  stats: Record<Periode, StatsEquipe>;
  /** Nombre de relances en attente, par commercial. */
  aRelancer: Record<string, number>;
  /** Relances et dossiers signés qui n'avancent plus. */
  blocages: Relance[];
  /** RDV de la semaine en cours. */
  semaine: RendezVous[];
  objectifsDuMois: Record<string, number>;
  /** Tous les dossiers, pour l'export CSV. */
  dossiers: Dossier[];
};

/**
 * Colonne des noms du tableau « Semaine de l'équipe » : fixe au défilement, titre compris.
 * Le fond blanc déborde à gauche (marge du conteneur) et à droite (espace entre les cases) :
 * les jours qui défilent passent dessous sans se voir.
 */
const COLONNE_FIXE = "sticky left-0 z-10 bg-white shadow-[-16px_0_0_0_#fff,8px_0_0_0_#fff]";

/** « Lun. » */
const jourCourt = (day: string) => {
  const s = new Date(`${day}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function Equipe(props: Props) {
  const { me, canAdmin, equipe, today, nowTime, stats, aRelancer, blocages, semaine, objectifsDuMois, dossiers } = props;
  const [periode, setPeriodeState] = useState(props.periode);
  const s = stats[periode];
  // Garde la période dans l'adresse (rechargement, lien partagé) sans recharger la page
  const setPeriode = (p: Periode) => {
    setPeriodeState(p);
    window.history.replaceState(null, "", p === "mois" ? "/equipe" : `/equipe?periode=${p}`);
  };
  const live = useRealtimeRefresh(["dossiers", "rendez_vous", "objectifs"]);
  const [objectifs, setObjectifs] = useState({ open: false, key: 0 });
  const { toast, showToast } = useToast();

  const lundi = mondayOf(today);
  const jours = Array.from({ length: 7 }, (_, i) => addDays(lundi, i)).filter(
    (j, i) => i < 5 || semaine.some((r) => r.jour === j), // week-end affiché seulement s'il y a des RDV
  );
  const commerciaux = s.parCommercial.map((c) => c.nom);
  const duJour = semaine.filter((r) => r.jour === today);
  const max = Math.max(1, ...s.entonnoir.map((e) => e.n));

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="equipe"
      title="Équipe"
      subtitle={`${s.bornes.label} · ${equipe.length} commercia${equipe.length > 1 ? "ux" : "l"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="group" aria-label="Période" className="grid grid-cols-3 gap-0.5 rounded-xl bg-[#e6e8ef] p-[3px]">
          {PERIODES.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriode(p.key)}
              aria-pressed={p.key === periode}
              className={`flex min-h-11 items-center justify-center rounded-[9px] px-3.5 text-[14px] ${
                p.key === periode ? "bg-white font-bold shadow-[0_1px_3px_rgba(15,23,51,.12)]" : "font-semibold text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => exporterCsv(dossiers, today)}
          className="hidden min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold sm:flex"
        >
          <IconDownload className="size-[18px]" />
          Exporter les dossiers en CSV
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <Tuile titre="Signés">
          <p className="text-[28px] leading-tight font-extrabold tabular-nums">
            {s.signes}
            {s.cible !== null && <span className="text-[15px] font-semibold text-muted"> / {s.cible}</span>}
          </p>
          {s.cible !== null ? (
            <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft">
              <div className="h-full bg-brand" style={{ width: `${Math.min(s.signes / Math.max(s.cible, 1), 1) * 100}%` }} />
            </div>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-muted">{periode === "semaine" ? "cette semaine" : "aucun objectif fixé"}</p>
          )}
        </Tuile>
        <Tuile titre="Taux de signature">
          <p className="text-[28px] leading-tight font-extrabold tabular-nums">{s.taux === null ? "–" : `${s.taux} %`}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">des {s.devis} devis envoyés</p>
        </Tuile>
        <Tuile titre="Délai moyen">
          <p className="text-[28px] leading-tight font-extrabold tabular-nums">{s.delaiMoyen === null ? "–" : `${s.delaiMoyen} j`}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">du premier RDV à la signature</p>
        </Tuile>
        <Tuile titre="TPE enrôlés">
          <p className="text-[28px] leading-tight font-extrabold tabular-nums">{s.tpe}</p>
          <p className={`mt-0.5 text-[12.5px] ${s.enAttenteTpe ? "font-semibold text-warn" : "text-muted"}`}>
            {s.enAttenteTpe ? `${s.enAttenteTpe} signé${s.enAttenteTpe > 1 ? "s" : ""} en attente` : "aucun en attente"}
          </p>
        </Tuile>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="terrain">
          <h2 id="terrain" className="section-title">
            Aujourd’hui sur le terrain
          </h2>
          <ul className="card overflow-hidden">
            {commerciaux.map((c, i) => {
              const siens = duJour.filter((r) => r.commercial === c);
              const prochain = siens.find((r) => r.jour > today || fmtHeure(r.fin) > nowTime) ?? null;
              return (
                <li key={c} className={i ? "border-t border-line" : ""}>
                  <Link href={`/agenda?commercial=${encodeURIComponent(c)}`} className="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4">
                    <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: colorOf(c, equipe).bar }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {c}
                        {siens.length > 0 && ` · ${siens.length} RDV`}
                      </span>
                      <span className={`block text-[13px] ${siens.length ? "text-muted" : "font-semibold text-warn"}`}>
                        {!siens.length
                          ? "Aucun RDV aujourd’hui"
                          : prochain
                            ? `Prochain ${fmtHeure(prochain.debut)} · ${RDV_TYPES[prochain.type]}, ${prochain.restaurant}`
                            : "Journée terminée"}
                      </span>
                    </span>
                    <IconChevronRight className="size-[18px] text-[#8e95a5]" />
                  </Link>
                </li>
              );
            })}
            {commerciaux.length === 0 && (
              <li className="px-4 py-4 text-muted">
                Aucun commercial dans l’équipe.{" "}
                {canAdmin && (
                  <Link href="/admin" className="font-semibold text-brand">
                    Ajouter des comptes
                  </Link>
                )}
              </li>
            )}
          </ul>
        </section>

        <section aria-labelledby="debloquer">
          <h2 id="debloquer" className={`section-title ${blocages.length ? "!text-warn" : ""}`}>
            {blocages.length ? `À débloquer · ${blocages.length}` : "À débloquer"}
          </h2>
          {blocages.length ? (
            <ul className="card overflow-hidden">
              {blocages.map((r, i) => (
                <li key={r.cle} className={i ? "border-t border-line" : ""}>
                  <Link
                    href={r.dossierId ? `/dossiers/${r.dossierId}` : "/agenda"}
                    className="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold break-words">{r.restaurant}</span>
                      <span className="block text-[13px] text-muted">
                        {r.motif} · {r.commercial}
                      </span>
                    </span>
                    <IconChevronRight className="size-[18px] text-[#8e95a5]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card px-4 py-4 text-[14.5px] text-muted">Rien de bloqué : tout avance.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="commerciaux" className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="commerciaux" className="section-title whitespace-nowrap">
            Par commercial
          </h2>
          {canAdmin && (
            <button
              id="objectifs"
              onClick={() => setObjectifs((o) => ({ open: true, key: o.key + 1 }))}
              className="mb-2 min-h-11 px-1 text-[14px] font-bold whitespace-nowrap text-brand"
            >
              Fixer les objectifs<span className="max-sm:hidden"> {deMois(today)}</span>
            </button>
          )}
        </div>
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {s.parCommercial.map((c) => (
            <Link key={c.nom} href={`/equipe/${encodeURIComponent(c.nom)}`} className="card block px-4 py-3.5 hover:border-[#c9cfdc]">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: colorOf(c.nom, equipe).bar }} />
                <b className="flex-1">{c.nom}</b>
                <span className="text-[14px] tabular-nums">
                  <b>{c.signes}</b>
                  <span className="text-muted">{c.cible !== null ? ` / ${c.cible} signés` : ` signé${c.signes > 1 ? "s" : ""}`}</span>
                </span>
              </div>
              {c.cible !== null && (
                <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-soft">
                  <div className="h-full bg-brand" style={{ width: `${Math.min(c.signes / Math.max(c.cible, 1), 1) * 100}%` }} />
                </div>
              )}
              <p className="mt-2 text-[13px] text-muted">
                {c.rdvSemaine} RDV cette semaine · {c.devisEnAttente} devis en attente
                {c.taux !== null && ` · ${c.taux} % signés`}
                {aRelancer[c.nom] > 0 && (
                  <>
                    {" · "}
                    <b className="text-warn">{aRelancer[c.nom]} à relancer</b>
                  </>
                )}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="parcours" className="card mt-5 p-4 lg:p-5">
        <h2 id="parcours" className="text-[17px] font-bold">
          Du premier RDV à l’accompagnement
        </h2>
        <div className="mt-3.5 flex flex-col gap-2.5 text-[14px]">
          {s.entonnoir.map((e, i) => {
            const avant = i > 0 ? s.entonnoir[i - 1].n : 0;
            return (
              <div key={e.label} className="grid grid-cols-[112px_minmax(0,1fr)_76px] items-center gap-2.5 sm:grid-cols-[140px_minmax(0,1fr)_96px]">
                <span className="font-semibold">{e.label}</span>
                <span aria-hidden className="h-5 rounded-md bg-brand-soft">
                  <span
                    className={`block h-full rounded-md ${i === s.entonnoir.length - 1 ? "bg-ok" : "bg-brand"}`}
                    style={{ width: `${(e.n / max) * 100}%` }}
                  />
                </span>
                <span className="tabular-nums">
                  <b>{e.n}</b>
                  {i > 0 && avant > 0 && <span className="text-muted"> · {Math.round((e.n / avant) * 100)}&nbsp;%</span>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] text-muted">Le pourcentage compare chaque étape à la précédente, sur la période.</p>
      </section>

      <section aria-labelledby="semaine" className="card mt-5 p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="semaine" className="text-[17px] font-bold">
            Semaine de l’équipe
          </h2>
          <Link href="/agenda" className="flex min-h-11 items-center text-[14px] font-bold text-brand">
            Ouvrir l’agenda
          </Link>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1.5 text-[13px] tabular-nums">
            <thead>
              <tr className="text-[12.5px] text-muted">
                <th scope="col" className={`w-24 text-left font-bold ${COLONNE_FIXE}`}>
                  Commercial
                </th>
                {jours.map((j) => (
                  <th key={j} scope="col" className={`px-1.5 text-left ${j === today ? "font-extrabold text-brand" : "font-bold"}`}>
                    {jourCourt(j)} {Number(j.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commerciaux.map((c) => (
                <tr key={c}>
                  <th scope="row" className={`pt-2 text-left align-top font-bold ${COLONNE_FIXE}`}>
                    {c}
                  </th>
                  {jours.map((j) => {
                    const siens = semaine.filter((r) => r.commercial === c && r.jour === j);
                    const color = colorOf(c, equipe);
                    return (
                      <td
                        key={j}
                        className={`rounded-[10px] p-2 align-top ${siens.length ? "" : "border-[1.5px] border-dashed border-[#d5d8e0] text-muted"} ${
                          j === today ? "ring-[1.5px] ring-brand ring-inset" : ""
                        }`}
                        style={siens.length ? { background: color.soft, color: color.ink } : undefined}
                      >
                        {siens.length
                          ? siens.map((r) => (
                              <span key={r.id} className="block">
                                {fmtHeure(r.debut)} {RDV_TYPES[r.type]}
                              </span>
                            ))
                          : "Libre"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Barres
          titre="Pourquoi on perd"
          detail={`${s.perdus} dossier${s.perdus > 1 ? "s" : ""} perdu${s.perdus > 1 ? "s" : ""} · ${s.bornes.label.toLowerCase()}`}
          lignes={s.pertes}
          couleur="bg-[#e8710a]"
          vide="Aucun dossier perdu sur la période."
        />
        <Barres
          titre="D’où viennent les signatures"
          detail={`${s.signes} signé${s.signes > 1 ? "s" : ""} · ${s.bornes.label.toLowerCase()}`}
          lignes={s.sources}
          couleur="bg-brand"
          vide="Aucune signature sur la période."
        />
      </div>

      <button
        onClick={() => exporterCsv(dossiers, today)}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-white font-semibold sm:hidden"
      >
        <IconDownload className="size-[18px]" />
        Exporter les dossiers en CSV
      </button>

      {canAdmin && (
        <ObjectifsSheet
          open={objectifs.open}
          sessionKey={objectifs.key}
          mois={debutDuMois(today)}
          commerciaux={equipe}
          valeurs={objectifsDuMois}
          onClose={() => setObjectifs((o) => ({ ...o, open: false }))}
          onSaved={() => {
            setObjectifs((o) => ({ ...o, open: false }));
            showToast("Objectifs enregistrés");
          }}
        />
      )}
      <Toast message={toast} />
    </AppShell>
  );
}

function Tuile({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="card min-w-0 px-3.5 py-3.5 lg:px-4.5 lg:py-4">
      <h2 className="text-[13px] font-semibold text-muted">{titre}</h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Barres({
  titre,
  detail,
  lignes,
  couleur,
  vide,
}: {
  titre: string;
  detail: string;
  lignes: { label: string; n: number }[];
  couleur: string;
  vide: string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  return (
    <section className="card p-4 lg:p-5">
      <h2 className="text-[17px] font-bold">{titre}</h2>
      <p className="mb-3.5 text-[13px] text-muted">{detail}</p>
      {lignes.length === 0 ? (
        <p className="text-[14px] text-muted">{vide}</p>
      ) : (
        <div className="flex flex-col gap-2.5 text-[14px]">
          {lignes.map((l) => (
            <div key={l.label} className="grid grid-cols-[150px_minmax(0,1fr)_28px] items-center gap-2.5">
              <span>{l.label}</span>
              <span aria-hidden className="h-2.5 rounded-full bg-[#f0f1f5]">
                <span className={`block h-full rounded-full ${couleur}`} style={{ width: `${(l.n / max) * 100}%` }} />
              </span>
              <b className="text-right tabular-nums">{l.n}</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ObjectifsSheet({
  open,
  sessionKey,
  mois,
  commerciaux,
  valeurs,
  onClose,
  onSaved,
}: {
  open: boolean;
  sessionKey: number;
  mois: string;
  commerciaux: string[];
  valeurs: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Objectifs du mois">
      <ObjectifsForm key={sessionKey} mois={mois} commerciaux={commerciaux} valeurs={valeurs} onSaved={onSaved} />
    </BottomSheet>
  );
}

function ObjectifsForm({
  mois,
  commerciaux,
  valeurs,
  onSaved,
}: {
  mois: string;
  commerciaux: string[];
  valeurs: Record<string, number>;
  onSaved: () => void;
}) {
  const [saisie, setSaisie] = useState<Record<string, string>>(
    Object.fromEntries(commerciaux.map((c) => [c, valeurs[c] !== undefined ? String(valeurs[c]) : ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [initiale] = useState(() => JSON.stringify(saisie));
  useUnsavedGuard(JSON.stringify(saisie) !== initiale);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const remplis = Object.entries(saisie).filter(([, v]) => v.trim() !== "");
    start(async () => {
      const res = await enregistrerObjectifs(mois, Object.fromEntries(remplis.map(([c, v]) => [c, Number(v)])));
      if (res.ok) onSaved();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="pr-12 text-xl font-bold">Objectifs {deMois(mois)}</h2>
      <p className="mt-1 mb-4 text-[14px] text-muted">Nombre de signatures visé par chaque commercial ce mois-ci.</p>
      {commerciaux.length === 0 && <p className="text-muted">Ajoute d’abord des commerciaux dans Administration.</p>}
      {commerciaux.map((c) => (
        <label key={c} className="mb-2.5 flex items-center gap-3">
          <span className="flex-1 font-semibold">{c}</span>
          <input
            className="input w-28 text-right tabular-nums"
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            placeholder="–"
            value={saisie[c]}
            onChange={(e) => setSaisie((s) => ({ ...s, [c]: e.target.value }))}
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}
      <button disabled={pending} className="mt-2 w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
        {pending ? "Enregistrement…" : "Enregistrer les objectifs"}
      </button>
    </form>
  );
}

/** Télécharge tous les dossiers en CSV (séparateur « ; » et BOM pour Excel en français). */
function exporterCsv(dossiers: Dossier[], today: string) {
  const etape = (d: Dossier) => FILTRES_ETAPE.find((f) => f.key === etapeDe(d))?.label ?? "";
  const jour = (ts: string | null) => (ts ? parisDay(ts) : "");
  const colonnes: [string, (d: Dossier) => string | null][] = [
    ["Restaurant", (d) => d.restaurant],
    ["Commercial", (d) => d.commercial],
    ["Étape", etape],
    ["SIREN / SIRET", (d) => d.siret],
    ["Gérant", (d) => d.gerant],
    ["Téléphone", (d) => d.telephone],
    ["E-mail", (d) => d.mail],
    ["Adresse", (d) => d.adresse],
    ["Source", (d) => (d.source ? SOURCES[d.source] : "")],
    ["Premier RDV le", (d) => d.rdv_le],
    ...EQUIPEMENTS.map(({ key, label }): [string, (d: Dossier) => string] => [`Devis : ${label}`, (d) => String(d[key])]),
    ["Devis envoyé le", (d) => jour(d.devis_fait_le)],
    ["Signé le", (d) => jour(d.signature_le)],
    ["Groupe SAV créé le", (d) => jour(d.groupe_sav_le)],
    ["Form le", (d) => jour(d.form_le)],
    ["TPE enrôlé le", (d) => jour(d.enrolement_tpe_le)],
    ["Installation le", (d) => d.date_installation],
    ["Accompagnement le", (d) => d.date_accompagnement],
    ["Perdu le", (d) => jour(d.perdu_le)],
    ["Raison de la perte", (d) => (d.raison_perte ? RAISONS_PERTE[d.raison_perte] : "")],
    ["Créé le", (d) => jour(d.created_at)],
  ];
  const cellule = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [colonnes.map(([t]) => cellule(t)), ...dossiers.map((d) => colonnes.map(([, f]) => cellule(f(d))))]
    .map((l) => l.join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `dossiers-mcaisse-${today}.csv`;
  a.click();
  // Différé : Safari sur iPhone annule le téléchargement si l'adresse est libérée tout de suite
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
