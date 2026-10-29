import type { Role } from "@/lib/types";

/** Ce qui peut déclencher une notification (choisi par chacun dans Paramètres). */
export type TypeNotif =
  | "rdv_pour_moi"
  | "recap_matin"
  | "nouveau_dossier"
  | "rdv_equipe"
  | "compte_rendu"
  | "devis_fait"
  | "devis_accepte"
  | "signature"
  | "enrolement_tpe"
  | "installe"
  | "perdu";

export const GROUPES_NOTIF: { titre: string; detail?: string; types: { key: TypeNotif; label: string }[] }[] = [
  {
    titre: "Pour moi",
    types: [
      { key: "rdv_pour_moi", label: "Un collègue m’ajoute ou me déplace un RDV" },
      { key: "recap_matin", label: "Récap du matin (RDV du jour, relances)" },
    ],
  },
  {
    titre: "Activité de l’équipe",
    detail: "Sauf ce que tu fais toi-même.",
    types: [
      { key: "nouveau_dossier", label: "Nouveau dossier" },
      { key: "rdv_equipe", label: "Nouveau RDV planifié" },
      { key: "compte_rendu", label: "Compte rendu de RDV" },
      { key: "devis_fait", label: "Devis envoyé" },
      { key: "devis_accepte", label: "Devis accepté" },
      { key: "signature", label: "Dossier signé" },
      { key: "enrolement_tpe", label: "TPE enrôlé" },
      { key: "installe", label: "Dossier installé" },
      { key: "perdu", label: "Dossier perdu" },
    ],
  },
];

export const TYPES_NOTIF: TypeNotif[] = GROUPES_NOTIF.flatMap((g) => g.types.map((t) => t.key));

/** Seules notifications possibles pour un commercial : l'activité de l'équipe est réservée à la direction. */
const TYPES_COMMERCIAL: TypeNotif[] = GROUPES_NOTIF[0].types.map((t) => t.key);

export const estTypeNotif = (s: string): s is TypeNotif => (TYPES_NOTIF as string[]).includes(s);

/** Groupes de choix proposés dans Paramètres selon le rôle (le récap du matin n'a pas le même contenu). */
export function groupesPour(role: Role) {
  const recap = role === "commercial" ? "Récap du matin (tes RDV du jour, tes relances)" : "Récap du matin (RDV de l’équipe, dossiers à débloquer)";
  const groupes = GROUPES_NOTIF.map((g) => ({ ...g, types: g.types.map((t) => (t.key === "recap_matin" ? { ...t, label: recap } : t)) }));
  return role === "commercial" ? groupes.slice(0, 1) : groupes;
}

/**
 * Notifications reçues par un membre : ses choix s'il en a fait, sinon tout ce que son rôle permet.
 * Un commercial ne reçoit jamais l'activité de l'équipe, même avec un ancien réglage.
 */
export function preferencesDe(m: { role: Role; notifications?: string[] | null }): TypeNotif[] {
  const permis = m.role === "commercial" ? TYPES_COMMERCIAL : TYPES_NOTIF;
  const choisis = m.notifications ? m.notifications.filter(estTypeNotif) : permis;
  return choisis.filter((t) => permis.includes(t));
}
