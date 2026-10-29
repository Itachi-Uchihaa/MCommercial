import type { RdvType } from "@/lib/types";

export const RDV_TYPES: Record<RdvType, string> = {
  decouverte: "Découverte",
  demo: "Démo",
  signature: "Signature",
  installation: "Installation",
  relance: "Relance",
  autre: "Autre",
};

/** Date du jour à Paris (AAAA-MM-JJ), identique côté serveur (UTC sur Vercel) et navigateur. */
export const todayParis = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

export const isIsoDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// Les dates AAAA-MM-JJ sont calculées en UTC : pas de décalage au passage à l'heure d'été.
const utc = (day: string) => new Date(`${day}T00:00:00Z`);

export function addDays(day: string, n: number) {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine qui contient ce jour. */
export const mondayOf = (day: string) => addDays(day, -((utc(day).getUTCDay() + 6) % 7));

/** Numéro de semaine ISO (celui des agendas papier). */
export function isoWeek(monday: string) {
  const thursday = utc(addDays(monday, 3));
  const jan4 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  utc(day).toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });

/** « lundi 2 novembre » */
export const fmtJour = (day: string) => fmt(day, { weekday: "long", day: "numeric", month: "long" });

/** « lun. 2 nov. » */
export const fmtJourCourt = (day: string) => fmt(day, { weekday: "short", day: "numeric", month: "short" });

/** « 2 au 8 novembre » ou « 30 nov. au 6 déc. » */
export function fmtSemaine(monday: string) {
  const sunday = addDays(monday, 6);
  return monday.slice(0, 7) === sunday.slice(0, 7)
    ? `${fmt(monday, { day: "numeric" })} au ${fmt(sunday, { day: "numeric", month: "long" })}`
    : `${fmt(monday, { day: "numeric", month: "short" })} au ${fmt(sunday, { day: "numeric", month: "short" })}`;
}

/** « 09:30 » (Postgres renvoie « 09:30:00 »). */
export const fmtHeure = (t: string) => t.slice(0, 5);

/** « 10 h » ou « 10 h 30 » (notifications) */
export const fmtHeureLongue = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
};

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const mapsUrl = (adresse: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

// Une couleur par commercial, dans l'ordre de l'équipe : on le repère d'un coup d'œil en vue « Tous ».
const PALETTE = [
  { bar: "#115ef5", soft: "#e8f0ff", ink: "#0b3fa8" },
  { bar: "#e8710a", soft: "#fff1e3", ink: "#8f4500" },
  { bar: "#9334e6", soft: "#f3e8ff", ink: "#6a1fb0" },
  { bar: "#0f9d58", soft: "#e3f5ec", ink: "#0b6b3c" },
  { bar: "#d01884", soft: "#fde7f3", ink: "#9b0f60" },
  { bar: "#00897b", soft: "#e0f4f1", ink: "#00665b" },
];

export type CommercialColor = (typeof PALETTE)[number];

export function colorOf(nom: string, equipe: string[]): CommercialColor {
  let i = equipe.indexOf(nom);
  if (i === -1) i = [...nom].reduce((h, c) => h + c.charCodeAt(0), 0);
  return PALETTE[i % PALETTE.length];
}
