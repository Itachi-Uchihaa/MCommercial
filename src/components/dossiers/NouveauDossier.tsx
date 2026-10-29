"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Entreprise } from "@/app/api/entreprises/route";
import { creerDossier } from "@/app/actions/dossiers";
import { fmtSiret } from "@/lib/dossiers";
import type { DossierInfos, Membre } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { IconCheck, IconSearch } from "../icons";
import { DossierFields } from "./DossierFields";

type Existant = { id: string; restaurant: string; commercial: string; siret: string | null };

type Props = { me: Membre; canAdmin: boolean; equipe: string[]; existants: Existant[] };

export function NouveauDossier({ me, canAdmin, equipe, existants }: Props) {
  const router = useRouter();
  const live = useRealtimeRefresh(["dossiers"]);
  const commerciaux = equipe.length ? equipe : [me.nom];
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Entreprise[] | null>(null);
  const [etat, setEtat] = useState<"pret" | "recherche" | "erreur">("pret");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [manuel, setManuel] = useState(false);
  const [infos, setInfos] = useState<DossierInfos>({
    restaurant: "",
    commercial: commerciaux.includes(me.nom) ? me.nom : commerciaux[0],
    siret: null,
    mail: null,
    telephone: null,
    gerant: null,
    adresse: null,
    activite: null,
    source: null,
    notes: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const derniere = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const nomRef = useRef<HTMLInputElement>(null);
  const [nomInvalide, setNomInvalide] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const suiviPar = (siret: string | null) => (siret ? existants.find((x) => x.siret === siret.replace(/\D/g, "")) : undefined);
  const doublon = suiviPar(infos.siret);

  /** Interroge l'annuaire 350 ms après la dernière lettre tapée. */
  function chercher(q: string) {
    setRecherche(q);
    clearTimeout(timer.current);
    if (q.trim().length < 3) {
      setResultats(null);
      setEtat("pret");
      return;
    }
    timer.current = setTimeout(async () => {
      const n = ++derniere.current;
      setEtat("recherche");
      try {
        const res = await fetch(`/api/entreprises?q=${encodeURIComponent(q.trim())}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { results: Entreprise[] };
        if (n !== derniere.current) return;
        setResultats(json.results);
        setEtat("pret");
      } catch (e) {
        console.error("Recherche dans l’annuaire impossible", e);
        if (n === derniere.current) setEtat("erreur");
      }
    }, 350);
  }

  function choisir(e: Entreprise) {
    setChoisi(e.siret);
    setManuel(false);
    setError(null);
    setNomInvalide(false);
    setInfos((i) => ({ ...i, restaurant: e.nom, adresse: e.adresse, gerant: e.gerant, siret: e.siret, activite: e.activite }));
    // Sur téléphone, le formulaire apparaît sous la liste : on l'amène à l'écran
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!infos.restaurant.trim()) {
      setError("Indique le nom du restaurant.");
      setNomInvalide(true);
      return nomRef.current?.focus();
    }
    setError(null);
    start(async () => {
      const res = await creerDossier(infos);
      if (!res.ok) return setError(res.error);
      router.push(`/dossiers/${res.id}`);
    });
  }

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="dossiers"
      title="Nouveau dossier"
      back={{ href: "/dossiers", label: "Dossiers" }}
    >
      <div className="max-w-xl">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold">Nom du restaurant ou SIRET</span>
          <span className="relative block">
            <IconSearch className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted" />
            <input
              type="search"
              className="input pl-11"
              placeholder="Ex. petit zinc paris 11"
              value={recherche}
              onChange={(e) => chercher(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </span>
        </label>
        <p className="mt-1.5 text-[13px] text-muted">Recherche dans l’annuaire officiel des entreprises.</p>

        <div aria-live="polite" className="mt-2 text-[14px]">
          {etat === "recherche" && <p className="text-muted">Recherche…</p>}
          {etat === "erreur" && (
            <p className="text-danger">
              L’annuaire ne répond pas. Réessaie dans un instant, ou saisis le dossier à la main.{" "}
              <button type="button" onClick={() => chercher(recherche)} className="inline-flex min-h-11 items-center font-semibold text-brand">
                Réessayer
              </button>
            </p>
          )}
          {etat === "pret" && resultats?.length === 0 && (
            <p className="text-muted">Aucune entreprise trouvée. Essaie avec la ville, ou le SIRET.</p>
          )}
        </div>

        {!!resultats?.length && (
          <ul className="card mt-2 overflow-hidden">
            {/* Une fois un établissement choisi, on ne garde que lui */}
            {(choisi ? resultats.filter((r) => r.siret === choisi) : resultats).map((r, i) => {
              const actif = choisi === r.siret;
              const deja = suiviPar(r.siret);
              return (
                <li key={r.siret} className={i ? "border-t border-line" : ""}>
                  <button
                    type="button"
                    aria-pressed={actif}
                    onClick={() => choisir(r)}
                    className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left ${actif ? "bg-[#f5f8ff]" : ""}`}
                  >
                    {actif ? (
                      <span className="mt-0.5 grid size-5.5 flex-none place-items-center rounded-full bg-brand text-white">
                        <IconCheck className="size-3.5" />
                      </span>
                    ) : (
                      <span className="mt-0.5 size-5.5 flex-none rounded-full border-2 border-[#c4c8d2]" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-bold break-words">{r.nom}</span>
                      <span className="block text-[13px] text-muted">{r.adresse}</span>
                      <span className="block text-[12.5px] text-muted">
                        {[r.activite, r.nom !== r.raisonSociale && r.raisonSociale, `SIRET ${fmtSiret(r.siret)}`].filter(Boolean).join(" · ")}
                      </span>
                      {deja && (
                        <span className="mt-1 inline-block rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-bold text-warn">
                          Déjà suivi par {deja.commercial}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {choisi && (resultats?.length ?? 0) > 1 && (
          <button type="button" onClick={() => setChoisi(null)} className="mt-1 min-h-11 font-semibold text-brand">
            Choisir un autre établissement
          </button>
        )}

        {!choisi && !manuel && (
          <button type="button" onClick={() => setManuel(true)} className="mt-3 min-h-11 font-semibold text-brand">
            Je ne le trouve pas : saisir à la main
          </button>
        )}

        {(choisi || manuel) && (
          <form ref={formRef} onSubmit={submit} noValidate className="mt-5 scroll-mt-4">
            {choisi && (
              <p className="mb-3 flex items-center gap-1.5 text-[13.5px] font-semibold text-ok-ink">
                <IconCheck className="size-4" />
                Rempli depuis l’annuaire : vérifie et complète.
              </p>
            )}
            {doublon && (
              <p className="mb-3 rounded-xl border border-warn-line bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
                « {doublon.restaurant} » est déjà suivi par {doublon.commercial}.{" "}
                <Link href={`/dossiers/${doublon.id}`} className="font-bold underline">
                  Voir son dossier
                </Link>
              </p>
            )}
            <DossierFields
              value={infos}
              onChange={(p) => {
                setInfos((i) => ({ ...i, ...p }));
                if (p.restaurant !== undefined) setNomInvalide(false);
              }}
              commerciaux={commerciaux}
              meNom={me.nom}
              restaurantRef={nomRef}
              restaurantInvalide={nomInvalide}
            />
            {error && (
              <p role="alert" className="mb-2.5 text-[13.5px] text-danger">
                {error}
              </p>
            )}
            <button disabled={pending} className="w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60">
              {pending ? "Ajout…" : doublon ? "Ajouter quand même" : "Ajouter le dossier"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
