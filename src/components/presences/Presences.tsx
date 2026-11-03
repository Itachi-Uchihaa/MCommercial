"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ajouterAbsence, retirerAbsence } from "@/app/actions/absences";
import {
  MOTIFS,
  MOTIF_KEYS,
  REPETITIONS,
  absenceDe,
  fmtPeriode,
  joursOuvres,
  occurrences,
  type Repetition,
} from "@/lib/absences";
import { addDays, colorOf, fmtJourCourt, fmtSemaine, isoWeek, mondayOf } from "@/lib/agenda";
import type { Absence, Membre, MotifAbsence } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { ChoixSemaine } from "../agenda/ChoixSemaine";
import { AppShell } from "../AppShell";
import { BottomSheet, useUnsavedGuard } from "../BottomSheet";
import { IconChevronDown, IconChevronRight } from "../icons";
import { Toast, useToast } from "../Toast";

type Props = {
  me: Membre;
  canAdmin: boolean;
  /** Prénoms des commerciaux, dans l'ordre (couleur de chacun). */
  equipe: string[];
  today: string;
  /** Les absences chargées finissent ce jour-là ou après : avant, on recharge la page. */
  depuis: string;
  initialWeek: string;
  absences: Absence[];
};

/** Une ligne de « À venir » : une absence seule, ou toute une série répétée. */
type Prevue = {
  cle: string;
  commercial: string;
  motif: MotifAbsence;
  note: string | null;
  /** Prochaine période (en cours ou à venir). */
  prochaine: Absence;
  /** Série : toutes ses absences à venir, la prochaine comprise. */
  serie: Absence[] | null;
  /** 7 ou 14 jours entre deux absences de la série. */
  pas: number | null;
};

const jourCourt = (day: string) => {
  const s = new Date(`${day}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

export function Presences({ me, canAdmin, equipe, today, depuis, initialWeek, absences }: Props) {
  const router = useRouter();
  const live = useRealtimeRefresh(["absences"]);
  const { toast, showToast, showError } = useToast();
  const [week, setWeek] = useState(initialWeek);
  const [choix, setChoix] = useState({ open: false, key: 0 });
  const [ajout, setAjout] = useState({ open: false, key: 0 });
  const [detail, setDetail] = useState<Prevue | null>(null);

  /** La direction gère les absences de tout le monde ; un commercial, les siennes (même règle que la base). */
  const gereTout = me.role !== "commercial";
  const peutGerer = (commercial: string) => gereTout || commercial === me.nom;
  const personnes = equipe.length ? equipe : [me.nom];
  const currentWeek = mondayOf(today);
  const jours = Array.from({ length: 5 }, (_, i) => addDays(week, i));

  function goToWeek(monday: string) {
    if (monday < depuis) {
      router.push(`/presences?semaine=${monday}`); // plus ancien que ce qui est chargé
      return;
    }
    setWeek(monday);
    window.history.replaceState(null, "", monday === currentWeek ? "/presences" : `/presences?semaine=${monday}`);
  }

  const absentsDeLaSemaine = (lundi: string) =>
    personnes.filter((p) => Array.from({ length: 5 }, (_, i) => addDays(lundi, i)).some((j) => absenceDe(absences, p, j)));
  const absentsCetteSemaine = absentsDeLaSemaine(currentWeek);
  const absentsAffiches = absentsDeLaSemaine(week);

  const prevues = useMemo(() => aVenir(absences, today), [absences, today]);

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="presences"
      title="Présences"
      subtitle={
        absentsCetteSemaine.length
          ? `Cette semaine : ${absentsCetteSemaine.length} absent${absentsCetteSemaine.length > 1 ? "s" : ""} sur ${personnes.length}`
          : "Cette semaine : tout le monde est là"
      }
      action={{ label: "Ajouter une absence", onClick: () => setAjout((a) => ({ open: true, key: a.key + 1 })) }}
    >
      <div className="flex items-center gap-1 rounded-[18px] border border-line bg-white p-1.5">
        <button
          onClick={() => goToWeek(addDays(week, -7))}
          aria-label="Semaine précédente"
          className="grid size-11 flex-none place-items-center rounded-xl text-2xl text-brand"
        >
          ‹
        </button>
        <button
          onClick={() => setChoix((c) => ({ open: true, key: c.key + 1 }))}
          aria-label={`Semaine ${isoWeek(week)} (du ${fmtSemaine(week)}) : choisir une autre semaine`}
          className="min-w-0 flex-1 rounded-xl py-0.5 text-center hover:bg-canvas"
        >
          <span className="flex items-center justify-center gap-1 font-bold" aria-live="polite">
            Semaine {isoWeek(week)}
            <IconChevronDown className="size-4 text-brand" />
          </span>
          <span className="block text-[13px] text-muted">Du {fmtSemaine(week)}</span>
        </button>
        <button
          onClick={() => goToWeek(addDays(week, 7))}
          aria-label="Semaine suivante"
          className="grid size-11 flex-none place-items-center rounded-xl text-2xl text-brand"
        >
          ›
        </button>
      </div>
      {week !== currentWeek && (
        <button
          onClick={() => goToWeek(currentWeek)}
          className="mx-auto mt-1.5 block min-h-11 rounded-full px-3.5 text-[14px] font-semibold text-brand"
        >
          Revenir à cette semaine
        </button>
      )}

      <section aria-labelledby="qui-est-la" className="mt-4">
        <h2 id="qui-est-la" className="section-title">
          {absentsAffiches.length
            ? `Qui est là · ${personnes.length - absentsAffiches.length} sur ${personnes.length} toute la semaine`
            : "Qui est là · tout le monde"}
        </h2>
        <div className="card p-2 lg:p-3">
          <table className="w-full table-fixed border-separate border-spacing-1 text-[12.5px]">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="w-[86px] px-1 text-left font-bold lg:w-36">
                  <span className="sr-only">Commercial</span>
                </th>
                {jours.map((j) => (
                  <th key={j} scope="col" className={`px-0.5 text-center ${j === today ? "font-extrabold text-brand" : "font-bold"}`}>
                    {jourCourt(j)}
                    <span className="block tabular-nums">{Number(j.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnes.map((p) => (
                <tr key={p}>
                  <th scope="row" className="px-1 text-left">
                    {/* Prénom en entier : il passe à la ligne plutôt que d'être coupé */}
                    <span className={`flex min-w-0 items-center gap-1.5 leading-tight ${p === me.nom ? "font-extrabold" : "font-bold"}`}>
                      <span aria-hidden className="size-2 flex-none rounded-full" style={{ background: colorOf(p, equipe).bar }} />
                      <span className="min-w-0 break-words hyphens-auto">{p}</span>
                    </span>
                  </th>
                  {jours.map((j) => {
                    const a = absenceDe(absences, p, j);
                    return (
                      <td
                        key={j}
                        className={`h-11 rounded-[10px] px-0.5 text-center font-bold ${
                          a ? MOTIFS[a.motif].className : "bg-ok-soft text-ok-ink"
                        } ${j === today ? "ring-[1.5px] ring-brand ring-inset" : ""}`}
                      >
                        {a ? MOTIFS[a.motif].label : "Là"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-0.5 text-[12.5px] text-muted">
          <span>
            <b className="text-ok-ink">Là</b> : présent
          </span>
          {MOTIF_KEYS.map((m) => (
            <span key={m}>
              <b className={MOTIFS[m].className.split(" ").find((c) => c.startsWith("text-"))}>{MOTIFS[m].label}</b>
              {m === "ecole" ? " : alternance" : m === "conges" ? " : congés" : " : autre raison"}
            </span>
          ))}
        </p>
      </section>

      <section aria-labelledby="a-venir" className="mt-5">
        <h2 id="a-venir" className="section-title">
          {prevues.length ? `Absences en cours et à venir · ${prevues.length}` : "Absences en cours et à venir"}
        </h2>
        {prevues.length === 0 ? (
          <div className="card px-4 py-5 text-[14.5px] text-muted">
            <p>Aucune absence prévue : toute l’équipe est là.</p>
            <button
              onClick={() => setAjout((a) => ({ open: true, key: a.key + 1 }))}
              className="mt-1 min-h-11 font-semibold text-brand"
            >
              Ajouter une absence
            </button>
          </div>
        ) : (
          <ul className="card overflow-hidden">
            {prevues.map((v, i) => (
              <li key={v.cle} className={i ? "border-t border-line" : ""}>
                <LignePrevue v={v} equipe={equipe} today={today} peutGerer={peutGerer(v.commercial)} onOuvrir={() => setDetail(v)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChoixSemaine
        open={choix.open}
        sessionKey={choix.key}
        week={week}
        today={today}
        onClose={() => setChoix((c) => ({ ...c, open: false }))}
        onChoisir={(lundi) => {
          setChoix((c) => ({ ...c, open: false }));
          goToWeek(lundi);
        }}
      />

      <BottomSheet open={ajout.open} onClose={() => setAjout((a) => ({ ...a, open: false }))} label="Ajouter une absence">
        <AjoutForm
          key={ajout.key}
          me={me}
          personnes={gereTout ? personnes : [me.nom]}
          today={today}
          onSaved={(n) => {
            setAjout((a) => ({ ...a, open: false }));
            showToast(n > 1 ? `${n} absences ajoutées` : "Absence ajoutée");
          }}
        />
      </BottomSheet>

      <BottomSheet open={detail !== null} onClose={() => setDetail(null)} label="Absence">
        {detail && (
          <Detail
            key={detail.cle}
            v={detail}
            today={today}
            onDone={(texte) => {
              setDetail(null);
              showToast(texte);
            }}
            onError={showError}
          />
        )}
      </BottomSheet>

      <Toast message={toast} />
    </AppShell>
  );
}

/** Absences en cours ou à venir, une ligne par absence seule ou par série, la plus proche en premier. */
function aVenir(absences: Absence[], today: string): Prevue[] {
  const futures = absences.filter((a) => a.fin >= today).sort((a, b) => a.debut.localeCompare(b.debut));
  const series = new Map<string, Absence[]>();
  const out: Prevue[] = [];
  for (const a of futures) {
    if (!a.serie) {
      out.push({ cle: a.id, commercial: a.commercial, motif: a.motif, note: a.note, prochaine: a, serie: null, pas: null });
    } else series.set(a.serie, [...(series.get(a.serie) ?? []), a]);
  }
  for (const [serie, liste] of series) {
    const pas =
      liste.length > 1
        ? Math.round((Date.parse(`${liste[1].debut}T00:00:00Z`) - Date.parse(`${liste[0].debut}T00:00:00Z`)) / 864e5)
        : null;
    const [p] = liste;
    out.push({ cle: serie, commercial: p.commercial, motif: p.motif, note: p.note, prochaine: p, serie: liste, pas });
  }
  return out.sort((a, b) => a.prochaine.debut.localeCompare(b.prochaine.debut) || a.commercial.localeCompare(b.commercial));
}

const rythme = (pas: number | null) => (pas === 7 ? "chaque semaine" : pas === 14 ? "une semaine sur deux" : "en série");

function LignePrevue({
  v,
  equipe,
  today,
  peutGerer,
  onOuvrir,
}: {
  v: Prevue;
  equipe: string[];
  today: string;
  peutGerer: boolean;
  onOuvrir: () => void;
}) {
  const p = v.prochaine;
  const enCours = p.debut <= today;
  const nbJours = joursOuvres(p.debut, p.fin);
  const derniere = v.serie?.[v.serie.length - 1];
  const contenu = (
    <>
      <span aria-hidden className="mt-1.5 size-2.5 flex-none self-start rounded-full" style={{ background: colorOf(v.commercial, equipe).bar }} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <b>{v.commercial}</b>
          <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${MOTIFS[v.motif].className}`}>{MOTIFS[v.motif].label}</span>
          {enCours && <span className="rounded-full bg-brand px-2 py-0.5 text-[11.5px] font-bold text-white">En cours</span>}
        </span>
        <span className="mt-0.5 block text-[14px]">
          {fmtPeriode(p.debut, p.fin)}
          {nbJours > 1 && <span className="text-muted"> · {pluriel(nbJours, "jour")}</span>}
        </span>
        {v.serie && derniere && (
          <span className="block text-[13px] text-muted">
            {rythme(v.pas)}, jusqu’au {fmtJourCourt(derniere.debut)} · {pluriel(v.serie.length, "fois")}
          </span>
        )}
        {v.note && <span className="block text-[13px] break-words text-muted">{v.note}</span>}
      </span>
      {peutGerer && <IconChevronRight className="size-[18px] flex-none text-[#8e95a5]" />}
    </>
  );
  return peutGerer ? (
    <button onClick={onOuvrir} className="flex min-h-16 w-full items-center gap-3 py-2.5 pr-3.5 pl-4 text-left">
      {contenu}
    </button>
  ) : (
    <div className="flex min-h-16 items-center gap-3 py-2.5 pr-3.5 pl-4">{contenu}</div>
  );
}

function Detail({
  v,
  today,
  onDone,
  onError,
}: {
  v: Prevue;
  today: string;
  onDone: (texte: string) => void;
  onError: (texte: string) => void;
}) {
  const [pending, start] = useTransition();
  /** Retirer toute une série demande une seconde confirmation (plusieurs absences d'un coup). */
  const [confirmeSerie, setConfirmeSerie] = useState(false);
  const p = v.prochaine;
  const nbSerie = v.serie?.length ?? 0;
  const retirer = (toute: boolean) =>
    start(async () => {
      const res = await retirerAbsence(p.id, toute && v.serie ? { serie: p.serie as string, aPartirDu: today } : null);
      if (res.ok) onDone(toute ? "Absences retirées" : "Absence retirée");
      else onError(res.error);
    });

  return (
    <div className="pb-5">
      <h2 className="pr-12 text-xl font-bold">Absence de {v.commercial}</h2>
      <p className="mt-1 text-[15px]">
        <span className={`mr-2 rounded-full px-2 py-0.5 text-[12px] font-bold ${MOTIFS[v.motif].className}`}>{MOTIFS[v.motif].label}</span>
        {fmtPeriode(p.debut, p.fin)}
      </p>
      {v.serie && (
        <p className="mt-2 text-[14px] text-muted">
          Se répète {rythme(v.pas)} : encore {pluriel(v.serie.length, "fois")}, la dernière le {fmtJourCourt(v.serie[v.serie.length - 1].debut)}.
        </p>
      )}
      {v.note && <p className="mt-2 text-[14px] break-words">{v.note}</p>}

      {confirmeSerie ? (
        <div role="alertdialog" aria-labelledby="confirme-serie" className="mt-5 rounded-2xl border border-danger/40 p-3.5">
          <p id="confirme-serie" className="font-bold">
            Retirer les {nbSerie} absences à venir ?
          </p>
          <p className="mt-0.5 text-[14px] text-muted">{v.commercial} apparaîtra « Là » ces jours-là.</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmeSerie(false)}
              className="min-h-12 rounded-2xl border border-line font-bold disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => retirer(true)}
              className="min-h-12 rounded-2xl bg-danger font-bold text-white disabled:opacity-60"
            >
              {pending ? "Retrait…" : `Retirer les ${nbSerie}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            disabled={pending}
            onClick={() => retirer(false)}
            className="min-h-12 w-full rounded-2xl border border-danger/40 font-bold text-danger disabled:opacity-60"
          >
            {v.serie
              ? `Retirer seulement celle du ${fmtPeriode(p.debut, p.fin).replace(" → ", " au ")}`
              : "Retirer cette absence"}
          </button>
          {v.serie && (
            <button
              disabled={pending}
              onClick={() => setConfirmeSerie(true)}
              className="min-h-12 w-full rounded-2xl bg-danger font-bold text-white disabled:opacity-60"
            >
              Retirer toute la série à venir
            </button>
          )}
        </div>
      )}
      <p className="mt-2 text-[13px] text-muted">Les absences déjà passées restent dans l’historique.</p>
    </div>
  );
}

function AjoutForm({
  me,
  personnes,
  today,
  onSaved,
}: {
  me: Membre;
  /** Personnes pour qui on peut poser une absence : soi-même, ou toute l'équipe pour la direction. */
  personnes: string[];
  today: string;
  onSaved: (n: number) => void;
}) {
  const lundiProchain = addDays(mondayOf(today), 7);
  const [commercial, setCommercial] = useState(personnes.includes(me.nom) ? me.nom : (personnes[0] ?? ""));
  const [motif, setMotif] = useState<MotifAbsence>("ecole");
  const [debut, setDebut] = useState(today);
  const [fin, setFin] = useState(today);
  const [repetition, setRepetition] = useState<Repetition>("non");
  const [jusquau, setJusquau] = useState(addDays(today, 7 * 12));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useUnsavedGuard(debut !== today || fin !== today || note.trim() !== "" || repetition !== "non");

  const periodes = occurrences(debut, fin, repetition, repetition === "non" ? null : jusquau);
  const blocage = !commercial
    ? "Choisis la personne absente."
    : !debut || !fin
      ? "Indique le premier et le dernier jour."
      : fin < debut
        ? "Le dernier jour doit être le même jour ou après le premier."
        : repetition !== "non" && (!jusquau || jusquau < debut)
          ? "Indique jusqu’à quand l’absence se répète."
          : null;

  const raccourcis: { label: string; de: string; a: string }[] = [
    { label: "Aujourd’hui", de: today, a: today },
    { label: "Demain", de: addDays(today, 1), a: addDays(today, 1) },
    { label: "Semaine prochaine", de: lundiProchain, a: addDays(lundiProchain, 4) },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (blocage) return setError(blocage);
    start(async () => {
      const res = await ajouterAbsence({ commercial, debut, fin, motif, note, repetition, jusquau: repetition === "non" ? null : jusquau });
      if (res.ok) onSaved(periodes.length);
      else setError(res.error);
    });
  }

  const puce = (active: boolean) =>
    `min-h-11 flex-none rounded-full border px-3.5 text-[14px] whitespace-nowrap ${
      active ? "border-brand bg-brand font-bold text-white" : "border-line bg-white font-semibold"
    }`;

  return (
    <form onSubmit={submit} noValidate className="pb-4.5">
      <h2 className="pr-12 text-xl font-bold">Ajouter une absence</h2>
      <p className="mt-1 mb-4 text-[14px] text-muted">
        {personnes.length > 1 ? "Les jours où un commercial n’est pas là" : "Les jours où tu n’es pas là"} : école, congés… Toute
        l’équipe la verra.
      </p>

      {personnes.length > 1 && (
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-[14px] font-semibold">Qui est absent ?</legend>
          <div className="no-scrollbar -mx-4.5 flex gap-2 overflow-x-auto px-4.5 pb-1">
            {personnes.map((p) => (
              <button key={p} type="button" aria-pressed={commercial === p} onClick={() => setCommercial(p)} className={puce(commercial === p)}>
                {p}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[14px] font-semibold">Motif</legend>
        <div className="flex flex-wrap gap-2">
          {MOTIF_KEYS.map((m) => (
            <button key={m} type="button" aria-pressed={motif === m} onClick={() => setMotif(m)} className={puce(motif === m)}>
              {m === "autre" ? "Autre" : MOTIFS[m].label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[14px] font-semibold">Quand ?</legend>
        <div className="no-scrollbar -mx-4.5 mb-2.5 flex gap-2 overflow-x-auto px-4.5 pb-1">
          {raccourcis.map((r) => (
            <button
              key={r.label}
              type="button"
              aria-pressed={debut === r.de && fin === r.a}
              onClick={() => {
                setDebut(r.de);
                setFin(r.a);
              }}
              className={puce(debut === r.de && fin === r.a)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block min-w-0">
            <span className="mb-1 block text-[13px] text-muted">Premier jour</span>
            <input
              type="date"
              className="input"
              value={debut}
              onChange={(e) => {
                const d = e.target.value;
                setDebut(d);
                if (d && fin < d) setFin(d); // le dernier jour suit le premier
              }}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-[13px] text-muted">Dernier jour</span>
            <input
              type="date"
              className="input"
              min={debut}
              value={fin}
              aria-invalid={fin < debut || undefined}
              onChange={(e) => setFin(e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[14px] font-semibold">Ça se répète ?</legend>
        <div role="group" className="grid grid-cols-3 gap-0.5 rounded-xl bg-[#e6e8ef] p-[3px]">
          {REPETITIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={repetition === r.key}
              onClick={() => setRepetition(r.key)}
              className={`min-h-11 rounded-[9px] px-1 text-[13px] leading-tight ${
                repetition === r.key ? "bg-white font-bold shadow-[0_1px_3px_rgba(15,23,51,.12)]" : "font-semibold text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {repetition !== "non" && (
          <label className="mt-2.5 block">
            <span className="mb-1 block text-[13px] text-muted">Jusqu’au</span>
            <input type="date" className="input" min={debut} value={jusquau} onChange={(e) => setJusquau(e.target.value)} />
          </label>
        )}
      </fieldset>

      <label className="mb-4 block">
        <span className="mb-1.5 block text-[14px] font-semibold">
          Précision <span className="font-normal text-muted">(facultatif)</span>
        </span>
        <input
          className="input"
          name="note"
          autoComplete="off"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. partiels, joignable l’après-midi…"
        />
      </label>

      {!blocage && (
        <p className="mb-3 rounded-xl bg-canvas px-3.5 py-2.5 text-[14px]">
          {periodes.length > 1 ? (
            <>
              <b>{periodes.length} absences</b> seront ajoutées, du {fmtJourCourt(periodes[0].debut)} au{" "}
              {fmtJourCourt(periodes[periodes.length - 1].fin)}.
            </>
          ) : (
            <>
              Absence de <b>{commercial}</b> {debut === fin ? "le" : "du"} {fmtPeriode(debut, fin).replace(" → ", " au ")}.
            </>
          )}
        </p>
      )}
      {(error || blocage) && (
        <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
          {error ?? blocage}
        </p>
      )}
      <button
        disabled={pending || blocage !== null}
        className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : periodes.length > 1 ? `Ajouter les ${periodes.length} absences` : "Ajouter l’absence"}
      </button>
    </form>
  );
}
