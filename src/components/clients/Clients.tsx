"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { mapsUrl } from "@/lib/agenda";
import { STEPS, niveau, telHref, villeDe } from "@/lib/dossiers";
import type { Dossier, Membre } from "@/lib/types";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { AppShell } from "../AppShell";
import { IconChevronRight, IconMail, IconPhone, IconRoute, IconSearch } from "../icons";

/** Client : contrat signé. En cours : pas encore signé. Perdu : classé perdu. */
type Statut = "client" | "en_cours" | "perdu";

const SIGNE = STEPS.findIndex((s) => s.key === "signature");

const statutDe = (d: Dossier): Statut => (d.perdu_le ? "perdu" : niveau(d) >= SIGNE ? "client" : "en_cours");

const FILTRES: { key: "tous" | Statut; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "client", label: "Clients signés" },
  { key: "en_cours", label: "En cours" },
  { key: "perdu", label: "Perdus" },
];

const BADGE: Record<Statut, { label: string; className: string }> = {
  client: { label: "Client", className: "bg-ok-soft text-ok-ink" },
  en_cours: { label: "En cours", className: "bg-brand-soft text-brand-ink" },
  perdu: { label: "Perdu", className: "bg-[#e6e8ef] text-ink-soft" },
};

type Filtres = { statut: "tous" | Statut; q: string };

/** Sans accents ni espaces, pour la recherche et le classement alphabétique. */
const normalise = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s/g, "");

/** Lettre du groupe : A à Z, « # » pour le reste (chiffres, symboles). */
const lettreDe = (nom: string) => {
  const c = nom.trim().normalize("NFD").charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
};

/** Garde les filtres dans l'URL : un lien partagé ou un rechargement retombe dessus. */
function syncUrl({ statut, q }: Filtres) {
  const p = new URLSearchParams();
  if (statut !== "tous") p.set("statut", statut);
  if (q.trim()) p.set("q", q.trim());
  window.history.replaceState(null, "", `/clients${p.size ? `?${p}` : ""}`);
}

type Props = {
  me: Membre;
  canAdmin: boolean;
  dossiers: Dossier[];
  initial: { statut: string; q: string };
};

export function Clients({ me, canAdmin, dossiers, initial }: Props) {
  const live = useRealtimeRefresh(["dossiers"]);
  const [filtres, setFiltres] = useState<Filtres>({
    statut: FILTRES.some((f) => f.key === initial.statut) ? (initial.statut as Filtres["statut"]) : "tous",
    q: initial.q,
  });
  const set = (patch: Partial<Filtres>) =>
    setFiltres((f) => {
      const next = { ...f, ...patch };
      syncUrl(next);
      return next;
    });

  const compte = useMemo(() => {
    const c: Record<string, number> = { tous: dossiers.length, client: 0, en_cours: 0, perdu: 0 };
    for (const d of dossiers) c[statutDe(d)] += 1;
    return c;
  }, [dossiers]);

  // Groupes par lettre, dans l'ordre alphabétique (sans tenir compte des accents)
  const groupes = useMemo(() => {
    const q = normalise(filtres.q);
    const liste = dossiers
      .filter((d) => filtres.statut === "tous" || statutDe(d) === filtres.statut)
      .filter(
        (d) =>
          !q ||
          [d.restaurant, d.gerant, d.adresse, d.telephone, d.mail, d.siret, d.commercial, d.activite].some((v) =>
            normalise(v).includes(q),
          ),
      )
      .sort((a, b) => normalise(a.restaurant).localeCompare(normalise(b.restaurant), "fr"));
    const map = new Map<string, Dossier[]>();
    for (const d of liste) {
      const l = lettreDe(d.restaurant);
      map.set(l, [...(map.get(l) ?? []), d]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  }, [dossiers, filtres]);

  const nbVisibles = groupes.reduce((n, [, l]) => n + l.length, 0);

  return (
    <AppShell
      me={me}
      canAdmin={canAdmin}
      live={live}
      page="clients"
      title="Clients"
      subtitle={`${compte.client} client${compte.client > 1 ? "s" : ""} signé${compte.client > 1 ? "s" : ""} · ${compte.en_cours} en cours`}
      action={{ label: "Ajouter un client", href: "/dossiers/nouveau" }}
    >
      <label className="relative block">
        <span className="sr-only">Rechercher un client</span>
        <IconSearch className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted" />
        <input
          type="search"
          value={filtres.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Nom, gérant, ville, téléphone…"
          autoComplete="off"
          spellCheck={false}
          className="input rounded-2xl pl-11"
        />
      </label>

      <div role="group" aria-label="Statut" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTRES.map(({ key, label }) => {
          const active = filtres.statut === key;
          return (
            <button
              key={key}
              onClick={() => set({ statut: key })}
              aria-pressed={active}
              className={`min-h-11 flex-none rounded-full border px-3.5 text-[14px] whitespace-nowrap ${
                active ? "border-brand bg-brand font-bold text-white" : "border-line bg-white font-semibold"
              }`}
            >
              {label} <span className={active ? "" : "text-muted"}>{compte[key]}</span>
            </button>
          );
        })}
      </div>

      {groupes.map(([lettre, liste]) => (
        <section key={lettre} aria-labelledby={`lettre-${lettre}`} className="mt-4">
          <h2 id={`lettre-${lettre}`} className="section-title">
            {lettre}
          </h2>
          <ul className="card overflow-hidden">
            {liste.map((d, i) => (
              <ClientLigne key={d.id} d={d} premier={i === 0} />
            ))}
          </ul>
        </section>
      ))}

      {nbVisibles === 0 && (
        <div className="px-5 py-9 text-center text-muted">
          {dossiers.length === 0 ? (
            <p>Aucun client pour l’instant. Touche «&nbsp;Ajouter un client&nbsp;» pour commencer.</p>
          ) : (
            <>
              <p>Aucun client ne correspond à cette recherche.</p>
              <button onClick={() => set({ statut: "tous", q: "" })} className="mt-2 min-h-11 font-semibold text-brand">
                Effacer les filtres
              </button>
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}

const RACCOURCI = "grid size-11 flex-none place-items-center rounded-full bg-canvas text-brand";

/** Une ligne du carnet : la fiche s'ouvre en touchant le nom, les raccourcis appellent ou ouvrent l'itinéraire. */
function ClientLigne({ d, premier }: { d: Dossier; premier: boolean }) {
  const statut = statutDe(d);
  const details = [d.gerant, villeDe(d.adresse), d.commercial && `Suivi par ${d.commercial}`].filter(Boolean).join(" · ");

  return (
    <li className={`flex items-center gap-1 pr-2.5 ${premier ? "" : "border-t border-line"}`}>
      <Link href={`/dossiers/${d.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5">
        <span aria-hidden className={`grid size-10 flex-none place-items-center rounded-full font-bold ${BADGE[statut].className}`}>
          {d.restaurant.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{d.restaurant}</span>
            <span className={`flex-none rounded-full px-2 py-0.5 text-[11.5px] font-bold ${BADGE[statut].className}`}>
              {BADGE[statut].label}
            </span>
          </span>
          {details && <span className="block truncate text-[13px] text-muted">{details}</span>}
        </span>
        <IconChevronRight className="size-4 text-muted lg:hidden" />
      </Link>
      <span className="flex gap-1.5">
        {d.telephone && (
          <a href={telHref(d.telephone)} aria-label={`Appeler ${d.restaurant}`} className={RACCOURCI}>
            <IconPhone className="size-[18px]" />
          </a>
        )}
        {d.mail && (
          <a href={`mailto:${d.mail}`} aria-label={`Écrire à ${d.restaurant}`} className={`${RACCOURCI} max-sm:hidden`}>
            <IconMail className="size-[18px]" />
          </a>
        )}
        {d.adresse && (
          <a
            href={mapsUrl(d.adresse)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Itinéraire vers ${d.restaurant}`}
            className={`${RACCOURCI} max-sm:hidden`}
          >
            <IconRoute className="size-[18px]" />
          </a>
        )}
      </span>
    </li>
  );
}
