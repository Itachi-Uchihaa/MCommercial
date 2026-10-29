"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ajouterNote, changerEtape, marquerPerdu, rouvrirDossier, supprimerDossier } from "@/app/actions/dossiers";
import { RDV_TYPES, colorOf, fmtHeure, fmtJourCourt, mapsUrl } from "@/lib/agenda";
import { depuis, fmtMoment, joursEntre, parisDay } from "@/lib/dates";
import {
  DATE_PREVUE,
  EQUIPEMENTS,
  RAISONS_PERTE,
  SOURCES,
  STEPS,
  datePrevue,
  estDatee,
  fmtDate,
  fmtSiret,
  isDone,
  jourEtape,
  patchEtape,
  peutSupprimer,
  prochaineEtape,
  telHref,
  villeDe,
} from "@/lib/dossiers";
import { rdvPasse } from "@/lib/relances";
import type { Dossier, EtapeManuelle, JournalEntry, Membre, RaisonPerte, RendezVous, ResultatRdv } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { BottomSheet } from "../BottomSheet";
import { CompteRenduSheet } from "../CompteRenduSheet";
import { IconCalendar, IconCheck, IconChevronRight, IconClock, IconMail, IconPhone, IconRoute } from "../icons";
import { Toast, useToast } from "../Toast";
import { DossierSheet } from "./DossierSheet";
import { DateEtape } from "./DateEtape";
import { EquipementsDevis } from "./EquipementsDevis";
import { MenuSav, type FichierMenu } from "./MenuSav";

type Props = {
  me: Membre;
  canAdmin: boolean;
  equipe: string[];
  today: string;
  nowTime: string;
  dossier: Dossier;
  /** RDV du dossier, du plus ancien au plus récent. */
  rdvs: RendezVous[];
  /** Journal, du plus récent au plus ancien. */
  journal: JournalEntry[];
  /** Photos ou PDF du menu (étape « Groupe SAV créé »), avec leur lien signé. */
  menu: FichierMenu[];
};

const ACTION_ETAPE: Record<EtapeManuelle, string> = {
  devis_fait: "Marquer le devis envoyé",
  signature: "Marquer le dossier signé",
  groupe_sav: "Marquer le groupe SAV créé",
  form: "Marquer le Form fait",
  enrolement_tpe: "Marquer le TPE enrôlé",
};

const RESULTATS: Record<ResultatRdv, string> = { positif: "positif", a_relancer: "à relancer", pas_interesse: "pas intéressé" };

export function Fiche({ me, canAdmin, equipe, today, nowTime, dossier, rdvs, journal, menu }: Props) {
  const live = useRealtimeRefresh(["dossiers", "rendez_vous", "journal", "menu_fichiers"]);
  const [d, appliquer] = useOptimistic(dossier, (cur: Dossier, patch: Partial<Dossier>) => ({ ...cur, ...patch }));
  const [pending, start] = useTransition();
  const [notePending, startNote] = useTransition();
  const [note, setNote] = useState("");
  const [sheet, setSheet] = useState<{ edit: boolean; key: number }>({ edit: false, key: 0 });
  const [perte, setPerte] = useState({ open: false, key: 0 });
  const [cr, setCr] = useState<RendezVous | null>(null);
  const { toast, showToast, showError } = useToast();
  const router = useRouter();
  const [suppression, startSuppression] = useTransition();
  const supprimable = peutSupprimer(me, d);

  function supprimer() {
    if (!confirm(`Supprimer le dossier « ${d.restaurant} » ? Son journal est supprimé avec lui, ses RDV restent dans l’agenda. Cette action est définitive.`)) return;
    setSheet((s) => ({ ...s, edit: false }));
    startSuppression(async () => {
      const res = await supprimerDossier(d.id);
      if (!res.ok) return showError(res.error);
      router.push("/dossiers");
    });
  }

  const suivante = prochaineEtape(d);
  const futurs = rdvs.filter((r) => !rdvPasse(r, today, nowTime));
  const passes = rdvs.filter((r) => rdvPasse(r, today, nowTime)).reverse();
  const premier = rdvs[0];
  const ville = villeDe(d.adresse);

  function etape(key: EtapeManuelle, fait: boolean) {
    const nom = STEPS.find((s) => s.key === key)!.long;
    if (!fait && !confirm(`Décocher « ${nom} » ? La date de l’étape sera effacée.`)) return;
    // Sauter des étapes arrive surtout par erreur (un appui sur « TPE enrôlé ») : on demande. « RDV » se coche toute seule.
    const avant = STEPS.slice(0, STEPS.findIndex((s) => s.key === key)).filter((s) => s.key !== "rdv" && !isDone(d, s.key));
    if (fait && avant.length && !confirm(`Cocher « ${nom} » alors que « ${avant[0].long} » n’est pas encore coché ?`)) return;
    start(async () => {
      appliquer(patchEtape(key, fait));
      const res = await changerEtape(d.id, key, fait);
      if (res.ok) showToast(`Étape « ${nom} » ${fait ? "cochée" : "décochée"}`);
      else showError(res.error);
    });
  }

  function rouvrir() {
    start(async () => {
      appliquer({ perdu_le: null, raison_perte: null });
      const res = await rouvrirDossier(d.id);
      if (res.ok) showToast("Dossier rouvert");
      else showError(res.error);
    });
  }

  function envoyerNote(e: React.FormEvent) {
    e.preventDefault();
    startNote(async () => {
      const res = await ajouterNote(d.id, note);
      if (res.ok) setNote("");
      else showError(res.error);
    });
  }

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="dossiers"
      title={d.restaurant}
      subtitle={[d.activite, ville].filter(Boolean).join(" · ") || undefined}
      back={{ href: "/dossiers", label: "Dossiers" }}
    >
      <div className="flex flex-wrap gap-1.5">
        <span
          className="rounded-full px-2.5 py-1 text-[12.5px] font-bold"
          style={{ background: colorOf(d.commercial, equipe).soft, color: colorOf(d.commercial, equipe).ink }}
        >
          {d.commercial}
        </span>
        {d.source && (
          <span className="rounded-full bg-[#e6e8ef] px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft">{SOURCES[d.source]}</span>
        )}
      </div>

      {d.perdu_le && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 bg-[#f7f8fa] px-4 py-3">
          <p className="min-w-0 flex-1 text-[14.5px]">
            <b>Dossier perdu</b> le {fmtDate(parisDay(d.perdu_le))}
            {d.raison_perte && ` · ${RAISONS_PERTE[d.raison_perte]}`}
          </p>
          <button onClick={rouvrir} disabled={pending} className="min-h-11 rounded-xl border border-line bg-white px-3.5 font-semibold">
            Rouvrir le dossier
          </button>
        </div>
      )}

      <div className="mt-4 grid auto-cols-fr grid-flow-col gap-2">
        {d.telephone && (
          <a href={telHref(d.telephone)} className={RACCOURCI}>
            <IconPhone />
            Appeler
          </a>
        )}
        {d.mail && (
          <a href={`mailto:${d.mail}`} className={RACCOURCI}>
            <IconMail />
            E-mail
          </a>
        )}
        {d.adresse && (
          <a href={mapsUrl(d.adresse)} target="_blank" rel="noopener noreferrer" className={RACCOURCI}>
            <IconRoute />
            Itinéraire
          </a>
        )}
        <Link href={`/agenda?dossier=${d.id}`} className={RACCOURCI}>
          <IconCalendar />
          Planifier
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <section aria-labelledby="avancement" className="card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="avancement" className="text-[17px] font-bold">
                Avancement
              </h2>
              <p className="text-[13px] text-muted">Ouvert {depuis(joursEntre(parisDay(d.created_at), today))}</p>
            </div>
            <ol className="mt-3.5">
              {STEPS.map((s, i) => {
                const fait = isDone(d, s.key);
                const jour = jourEtape(d, s.key);
                const courante = !d.perdu_le && suivante?.key === s.key;
                // « RDV fait » se coche toute seule le jour du premier RDV de l'agenda
                if (s.key === "rdv") {
                  return (
                    <Etape
                      key={s.key}
                      fait={fait}
                      courante={courante}
                      dernier={false}
                      titre={courante ? `${s.long} · étape en cours` : s.long}
                      detail={
                        fait && premier
                          ? `${fmtJourCourt(premier.jour)} · ${RDV_TYPES[premier.type]} avec ${premier.commercial}`
                          : futurs[0]
                            ? `RDV prévu ${fmtJourCourt(futurs[0].jour)} à ${fmtHeure(futurs[0].debut)}`
                            : "Se coche toute seule après le premier RDV"
                      }
                    />
                  );
                }
                // Installation, accompagnement : une date à choisir ; à venir = prévue, faite le jour venu
                if (estDatee(s.key)) {
                  const choisie = d[DATE_PREVUE[s.key]];
                  const prevue = datePrevue(d, s.key);
                  return (
                    <Etape
                      key={s.key}
                      fait={fait}
                      courante={courante}
                      dernier={i === STEPS.length - 1}
                      titre={courante ? `${s.long} · étape en cours` : s.long}
                      detail={
                        fait && jour
                          ? fmtJourCourt(jour)
                          : prevue
                            ? `${s.key === "installation" ? "Prévue" : "Prévu"} le ${fmtJourCourt(prevue)}`
                            : undefined
                      }
                      extra={
                        !d.perdu_le && (fait || courante || choisie) ? (
                          <DateEtape
                            key={choisie ?? "aucune"}
                            dossierId={d.id}
                            etape={s.key}
                            valeur={choisie}
                            onMessage={showToast}
                            onErreur={showError}
                          />
                        ) : undefined
                      }
                    />
                  );
                }
                return (
                  <Etape
                    key={s.key}
                    fait={fait}
                    courante={courante}
                    dernier={i === STEPS.length - 1}
                    titre={courante ? `${s.long} · étape en cours` : s.long}
                    detail={
                      fait && jour
                        ? fmtJourCourt(jour)
                        : courante && futurs[0]
                          ? `RDV prévu ${fmtJourCourt(futurs[0].jour)} à ${fmtHeure(futurs[0].debut)}`
                          : undefined
                    }
                    onToggle={d.perdu_le ? undefined : () => etape(s.key as EtapeManuelle, !fait)}
                    disabled={pending}
                    extra={
                      // Équipements du devis : toujours proposés (quantités à 0 par défaut)
                      s.key === "devis_fait" ? (
                        <EquipementsDevis
                          key={EQUIPEMENTS.map((e) => d[e.key]).join("-")}
                          dossierId={d.id}
                          valeurs={d}
                          onMessage={showToast}
                          onErreur={showError}
                        />
                      ) : // Menu du restaurant, facultatif : proposé dès que le dossier en est à cette étape
                      s.key === "groupe_sav" && (fait || courante || menu.length > 0) ? (
                        <MenuSav
                          dossierId={d.id}
                          restaurant={d.restaurant}
                          fichiers={menu}
                          peutSupprimer={supprimable}
                          onMessage={showToast}
                          onErreur={showError}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </ol>
            {!d.perdu_le && suivante?.key === "rdv" && !futurs.length && (
              <Link
                href={`/agenda?dossier=${d.id}`}
                className="mt-4 flex h-13 w-full items-center justify-center rounded-[14px] bg-brand font-bold text-white"
              >
                Planifier un RDV
              </Link>
            )}
            {/* Étapes datées : la date se choisit directement sous l'étape, pas de gros bouton */}
            {!d.perdu_le && suivante && suivante.key !== "rdv" && !estDatee(suivante.key) && (
              <button
                onClick={() => etape(suivante.key as EtapeManuelle, true)}
                disabled={pending}
                className="mt-4 h-13 w-full rounded-[14px] bg-brand font-bold text-white disabled:opacity-60"
              >
                {ACTION_ETAPE[suivante.key as EtapeManuelle]}
              </button>
            )}
            {!d.perdu_le && (
              <button
                onClick={() => setPerte((p) => ({ open: true, key: p.key + 1 }))}
                className="mt-1.5 min-h-11 w-full rounded-[14px] font-semibold text-muted"
              >
                Classer perdu…
              </button>
            )}
          </section>

          <section aria-labelledby="rdv" className="card p-4">
            <div className="flex items-center justify-between">
              <h2 id="rdv" className="text-[17px] font-bold">
                RDV
              </h2>
              <Link href={`/agenda?dossier=${d.id}`} className="flex min-h-11 items-center text-[14px] font-bold text-brand">
                + Planifier
              </Link>
            </div>
            {rdvs.length === 0 && (
              <Link
                href={`/agenda?dossier=${d.id}`}
                className="flex min-h-12 items-center justify-between gap-2 rounded-[14px] border border-dashed border-line px-3.5 py-2.5 text-[14.5px] text-muted hover:border-brand/40"
              >
                Aucun RDV pour ce dossier
                <span className="font-semibold text-brand">+ Planifier</span>
              </Link>
            )}
            <ul className="space-y-2">
              {[...futurs, ...passes].map((r) => {
                const passe = rdvPasse(r, today, nowTime);
                return (
                  <li key={r.id} className={`rounded-xl ${passe ? "bg-[#f7f8fa]" : "bg-[#f5f8ff]"}`}>
                    {/* Ouvre le RDV dans l'agenda, prêt à être modifié */}
                    <Link href={`/agenda?rdv=${r.id}`} className="flex items-center gap-2 p-3">
                      <span className="min-w-0 flex-1">
                        <span className={`block font-bold ${passe ? "text-ink-soft" : ""}`}>
                          {fmtJourCourt(r.jour)} · {fmtHeure(r.debut)} – {fmtHeure(r.fin)}
                        </span>
                        <span className="block text-[13px] text-muted">
                          {RDV_TYPES[r.type]} · {r.commercial}
                        </span>
                      </span>
                      <IconChevronRight className="size-5 text-[#8e95a5]" />
                    </Link>
                    {passe &&
                      (r.compte_rendu_le ? (
                        <p className="px-3 pb-3 text-[13.5px] text-ink-soft">
                          <b className="font-semibold">Compte rendu :</b> {r.resultat ? RESULTATS[r.resultat] : "fait"}
                          {r.compte_rendu && `. ${r.compte_rendu}`}
                        </p>
                      ) : (
                        <button onClick={() => setCr(r)} className="mx-3 mb-3 min-h-11 rounded-xl bg-warn-soft px-3.5 text-[14px] font-bold text-warn">
                          Faire le compte rendu
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-3">
          <section aria-labelledby="journal" className="card p-4">
            <h2 id="journal" className="text-[17px] font-bold">
              Journal
            </h2>
            <form onSubmit={envoyerNote} className="mt-3 flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Nouvelle note</span>
                <input className="input" placeholder="Ajouter une note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </label>
              <button
                disabled={notePending || !note.trim()}
                className="min-h-12 flex-none rounded-xl bg-brand-soft px-4 font-bold text-brand disabled:opacity-50"
              >
                {notePending ? "Ajout…" : "Ajouter"}
              </button>
            </form>
            {journal.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">Les étapes, les notes et les comptes rendus s’afficheront ici.</p>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {journal.map((j) => (
                  <Ligne key={j.id} j={j} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="infos" className="card p-4">
            <div className="flex items-center justify-between">
              <h2 id="infos" className="text-[17px] font-bold">
                Infos
              </h2>
              <button
                onClick={() => setSheet((s) => ({ edit: true, key: s.key + 1 }))}
                className="min-h-11 px-1 text-[14px] font-bold text-brand"
              >
                Modifier
              </button>
            </div>
            <dl className="mt-1 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14.5px]">
              <Info label="Gérant">{d.gerant}</Info>
              <Info label="Téléphone">
                {d.telephone && (
                  <a href={telHref(d.telephone)} className="text-brand">
                    {d.telephone}
                  </a>
                )}
              </Info>
              <Info label="E-mail">
                {d.mail && (
                  <a href={`mailto:${d.mail}`} className="break-all text-brand">
                    {d.mail}
                  </a>
                )}
              </Info>
              <Info label="Adresse">{d.adresse}</Info>
              <Info label="SIRET">{d.siret && <span className="tabular-nums">{fmtSiret(d.siret)}</span>}</Info>
              <Info label="Activité">{d.activite}</Info>
              <Info label="Source">{d.source && SOURCES[d.source]}</Info>
              <Info label="Créé le">{fmtDate(parisDay(d.created_at))}</Info>
              {d.notes && <Info label="Remarque">{d.notes}</Info>}
            </dl>
          </section>

          {supprimable && (
            <button
              onClick={supprimer}
              disabled={suppression}
              className="min-h-12 w-full rounded-2xl border border-line bg-white font-bold text-danger disabled:opacity-60"
            >
              {suppression ? "Suppression…" : "Supprimer ce dossier"}
            </button>
          )}
        </div>
      </div>

      <DossierSheet
        open={sheet.edit}
        sessionKey={sheet.key}
        dossier={d}
        commerciaux={[...new Set([...equipe, d.commercial])]}
        meNom={me.nom}
        onSupprimer={supprimable ? supprimer : undefined}
        onClose={() => setSheet((s) => ({ ...s, edit: false }))}
        onSaved={(message) => {
          setSheet((s) => ({ ...s, edit: false }));
          showToast(message);
        }}
      />

      <PerteSheet
        key={perte.key}
        open={perte.open}
        onClose={() => setPerte((p) => ({ ...p, open: false }))}
        onConfirm={(raison) =>
          start(async () => {
            setPerte((p) => ({ ...p, open: false }));
            appliquer({ perdu_le: new Date().toISOString(), raison_perte: raison });
            const res = await marquerPerdu(d.id, raison);
            if (res.ok) showToast("Dossier classé perdu");
            else showError(res.error);
          })
        }
      />

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

const RACCOURCI =
  "card flex h-17 flex-col items-center justify-center gap-1 text-[12.5px] font-semibold text-brand hover:border-[#c9cfdc]";

function Etape({
  fait,
  courante = false,
  dernier,
  titre,
  detail,
  onToggle,
  disabled,
  extra,
}: {
  fait: boolean;
  courante?: boolean;
  dernier: boolean;
  titre: string;
  detail?: string;
  onToggle?: () => void;
  disabled?: boolean;
  /** Contenu sous l'étape, hors du bouton (ex. le menu à l'étape « Groupe SAV créé »). */
  extra?: React.ReactNode;
}) {
  const pastille = fait ? (
    <span className="grid size-6 place-items-center rounded-full bg-ok text-white">
      <IconCheck className="size-3.5" />
    </span>
  ) : courante ? (
    <span className="size-6 rounded-full border-[7px] border-brand bg-white" />
  ) : (
    <span className="size-6 rounded-full border-2 border-[#c4c8d2] bg-white" />
  );
  const contenu = (
    <>
      <span className="flex flex-col items-center">
        {pastille}
        {!dernier && <span className={`min-h-5 w-0.5 flex-1 ${fait ? "bg-ok" : "bg-line"}`} />}
      </span>
      <span className={`text-left ${dernier ? "" : "pb-3.5"}`}>
        <span className={`block ${courante ? "font-extrabold text-brand" : fait ? "font-semibold" : "font-semibold text-muted"}`}>
          {titre}
        </span>
        {detail && <span className="block text-[13px] text-muted">{detail}</span>}
      </span>
    </>
  );
  return (
    <li>
      {onToggle ? (
        <button onClick={onToggle} disabled={disabled} aria-pressed={fait} className="flex w-full gap-3 disabled:opacity-70">
          {contenu}
        </button>
      ) : (
        <div className="flex gap-3">{contenu}</div>
      )}
      {extra && (
        // Le trait du parcours continue à gauche du contenu ajouté
        <div className="flex gap-3">
          <span aria-hidden className="flex w-6 flex-none justify-center">
            {!dernier && <span className={`w-0.5 ${fait ? "bg-ok" : "bg-line"}`} />}
          </span>
          <div className="-mt-2 min-w-0 flex-1 pb-3.5">{extra}</div>
        </div>
      )}
    </li>
  );
}

function Ligne({ j }: { j: JournalEntry }) {
  const note = j.type === "note";
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={`grid size-8 flex-none place-items-center rounded-full text-[13px] font-bold ${
          note ? "bg-brand-soft text-brand" : "bg-[#e6e8ef] text-ink-soft"
        }`}
      >
        {note ? j.auteur.charAt(0).toUpperCase() : j.type === "compte_rendu" ? <IconCheck className="size-4" /> : <IconClock className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] text-muted">
          <b className="font-semibold text-ink">{j.type === "historique" ? "Historique" : j.auteur}</b>
          {j.type === "compte_rendu" && " · compte rendu"} · {fmtMoment(j.created_at)}
        </span>
        <span className="mt-0.5 block text-[14.5px] break-words whitespace-pre-line">
          {j.type === "historique" ? `${j.auteur} ${j.texte}.` : j.texte}
        </span>
      </span>
    </li>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted">—</span>}</dd>
    </>
  );
}

function PerteSheet({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (r: RaisonPerte) => void }) {
  const [raison, setRaison] = useState<RaisonPerte | null>(null);
  return (
    <BottomSheet open={open} onClose={onClose} label="Classer le dossier perdu">
      <div className="pb-4.5">
        <h2 className="pr-12 text-xl font-bold">Classer le dossier perdu</h2>
        <p className="mt-1 text-[14px] text-muted">Il sort des relances et des chiffres en cours. Tu pourras le rouvrir.</p>
        <p id="raison" className="mt-4 mb-2 text-[14px] font-semibold">
          Pourquoi ?
        </p>
        <div role="group" aria-labelledby="raison" className="grid grid-cols-2 gap-2">
          {(Object.keys(RAISONS_PERTE) as RaisonPerte[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={raison === r}
              onClick={() => setRaison(r)}
              className={`min-h-12 rounded-xl px-2 text-[14.5px] ${
                raison === r ? "border-2 border-brand bg-brand-soft font-bold text-brand-ink" : "border border-line font-semibold"
              }`}
            >
              {RAISONS_PERTE[r]}
            </button>
          ))}
        </div>
        <button
          disabled={!raison}
          onClick={() => raison && onConfirm(raison)}
          className="mt-4 w-full rounded-2xl bg-ink py-4 font-bold text-white disabled:opacity-40"
        >
          Classer perdu
        </button>
        <button onClick={onClose} className="mt-1 min-h-12 w-full font-semibold text-muted">
          Annuler
        </button>
      </div>
    </BottomSheet>
  );
}
