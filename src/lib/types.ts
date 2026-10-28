export type Role = "commercial" | "directeur" | "admin";

export type Membre = {
  id: string;
  email: string;
  nom: string;
  role: Role;
  created_at: string;
};

export type Dossier = {
  id: string;
  commercial: string;
  restaurant: string;
  siret: string | null;
  mail: string | null;
  date_rdv: string | null;
  devis_fait: boolean;
  devis_accepte: boolean;
  signature: boolean;
  enrolement_tpe: boolean;
  date_installation: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DossierInput = Omit<
  Dossier,
  "id" | "created_by" | "created_at" | "updated_at"
>;

/** Étapes affichées sur chaque carte, dans l'ordre du parcours commercial. */
export type StepKey =
  | "devis_fait"
  | "devis_accepte"
  | "signature"
  | "enrolement_tpe"
  | "installe";
