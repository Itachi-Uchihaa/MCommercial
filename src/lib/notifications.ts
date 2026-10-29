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
      { key: "signature", label: "Signature" },
      { key: "enrolement_tpe", label: "TPE enrôlé" },
      { key: "installe", label: "Installation" },
      { key: "perdu", label: "Dossier perdu" },
    ],
  },
];

export const TYPES_NOTIF: TypeNotif[] = GROUPES_NOTIF.flatMap((g) => g.types.map((t) => t.key));

export const estTypeNotif = (s: string): s is TypeNotif => (TYPES_NOTIF as string[]).includes(s);

/**
 * Notifications reçues par un membre : ses choix s'il en a fait,
 * sinon par défaut tout pour la direction, l'essentiel pour un commercial.
 */
export function preferencesDe(m: { role: Role; notifications?: string[] | null }): TypeNotif[] {
  if (m.notifications) return m.notifications.filter(estTypeNotif);
  return m.role === "commercial" ? ["rdv_pour_moi", "recap_matin"] : [...TYPES_NOTIF];
}
