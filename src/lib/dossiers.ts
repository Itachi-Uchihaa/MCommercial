import type { Dossier, StepKey } from "@/lib/types";

export const STEPS: { key: StepKey; label: string }[] = [
  { key: "devis_fait", label: "Devis" },
  { key: "devis_accepte", label: "Accepté" },
  { key: "signature", label: "Signé" },
  { key: "enrolement_tpe", label: "TPE" },
  { key: "installe", label: "Installé" },
];

export function isDone(d: Dossier, key: StepKey) {
  return key === "installe" ? !!d.date_installation : d[key];
}

export function stats(list: Dossier[]) {
  const n = (k: StepKey) => list.filter((d) => isDone(d, k)).length;
  return {
    total: list.length,
    devis: n("devis_fait"),
    acc: n("devis_accepte"),
    sign: n("signature"),
    tpe: n("enrolement_tpe"),
    inst: n("installe"),
  };
}

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "–");

export const today = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ

export const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : "";

export const fmtSiret = (s: string | null) =>
  s ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4") : "";

/** Formatage pendant la saisie : « 123 456 789 01234 ». */
export const maskSiret = (raw: string) => {
  const v = raw.replace(/\D/g, "").slice(0, 14);
  return [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9), v.slice(9)].filter(Boolean).join(" ");
};
