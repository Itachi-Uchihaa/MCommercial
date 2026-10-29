// Dates et heures affichées à l'heure de Paris, identiques côté serveur (UTC sur Vercel) et navigateur.
const TZ = "Europe/Paris";

/** Jour à Paris (AAAA-MM-JJ) d'un horodatage. */
export const parisDay = (ts: string | number | Date) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: TZ });

const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Heure à Paris, « HH:MM » (maintenant par défaut). */
export const parisTime = (ts: string | number | Date = new Date()) => heure.format(new Date(ts));

/** Nombre de jours entre deux dates AAAA-MM-JJ (positif si `a` est après `de`). */
export const joursEntre = (de: string, a: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 864e5);

/** « aujourd’hui », « hier », « il y a 9 j » */
export const depuis = (jours: number) => (jours <= 0 ? "aujourd’hui" : jours === 1 ? "hier" : `il y a ${jours} j`);

/** « 26 oct. à 18:12 » */
export const fmtMoment = (ts: string) =>
  `${new Date(ts).toLocaleDateString("fr-FR", { timeZone: TZ, day: "numeric", month: "short" })} à ${parisTime(ts)}`;

/** « octobre » */
export const nomDuMois = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long" });

/** « de novembre », « d’octobre » */
export const deMois = (day: string) => {
  const m = nomDuMois(day);
  return /^[aeiouy]/i.test(m) ? `d’${m}` : `de ${m}`;
};

/** Premier jour du mois (AAAA-MM-01). */
export const debutDuMois = (day: string) => `${day.slice(0, 7)}-01`;

/** Dernier jour du mois (AAAA-MM-JJ). */
export function finDuMois(day: string) {
  const d = new Date(`${debutDuMois(day)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
