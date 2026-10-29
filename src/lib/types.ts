export type Role = "commercial" | "directeur" | "admin";

export type Membre = {
  id: string;
  email: string;
  nom: string;
  role: Role;
  /** Notifications choisies dans Paramètres (null : choix par défaut du rôle). */
  notifications?: string[] | null;
  created_at: string;
};

export type RaisonPerte = "prix" | "deja_equipe" | "pas_le_moment" | "pas_interesse" | "autre";
export type Source = "terrain" | "recommandation" | "appel_entrant" | "salon" | "site_web" | "autre";

export type Dossier = {
  id: string;
  commercial: string;
  restaurant: string;
  siret: string | null;
  mail: string | null;
  telephone: string | null;
  gerant: string | null;
  adresse: string | null;
  /** Activité déclarée à l'annuaire des entreprises (ex. « Restauration traditionnelle »). */
  activite: string | null;
  source: Source | null;
  devis_fait: boolean;
  devis_accepte: boolean;
  signature: boolean;
  enrolement_tpe: boolean;
  /** Dates des étapes, posées par la base quand la case est cochée. */
  devis_fait_le: string | null;
  devis_accepte_le: string | null;
  signature_le: string | null;
  enrolement_tpe_le: string | null;
  date_installation: string | null;
  perdu_le: string | null;
  raison_perte: RaisonPerte | null;
  /** Jour où le commercial veut être rappelé de relancer le client. */
  relance_le: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Champs de la fiche « Infos », modifiables par le formulaire du dossier. */
export type DossierInfos = Pick<
  Dossier,
  "restaurant" | "commercial" | "siret" | "mail" | "telephone" | "gerant" | "adresse" | "activite" | "source" | "notes"
>;

/** Ce dont l'agenda a besoin pour proposer les dossiers dans la fiche RDV. */
export type DossierLite = Pick<Dossier, "id" | "restaurant" | "commercial">;

export type JournalEntry = {
  id: string;
  dossier_id: string;
  auteur: string;
  type: "note" | "historique" | "compte_rendu";
  texte: string;
  created_by: string | null;
  created_at: string;
};

export type Objectif = { commercial: string; mois: string; signatures: number };

export type RdvType = "decouverte" | "demo" | "signature" | "installation" | "relance" | "autre";
export type ResultatRdv = "positif" | "a_relancer" | "pas_interesse";
export type SuiteRdv = "devis" | "nouveau_rdv" | "rien";

export type RendezVous = {
  id: string;
  commercial: string;
  dossier_id: string | null;
  restaurant: string;
  type: RdvType;
  /** AAAA-MM-JJ */
  jour: string;
  /** HH:MM:SS (heure de Paris, sans fuseau) */
  debut: string;
  fin: string;
  adresse: string | null;
  notes: string | null;
  /** Compte rendu, rempli après le RDV. */
  resultat: ResultatRdv | null;
  suite: SuiteRdv | null;
  compte_rendu: string | null;
  compte_rendu_le: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RendezVousInput = Omit<
  RendezVous,
  "id" | "created_by" | "created_at" | "updated_at" | "resultat" | "suite" | "compte_rendu" | "compte_rendu_le"
>;

/** Étapes affichées sur chaque carte, dans l'ordre du parcours commercial. */
export type StepKey =
  | "devis_fait"
  | "devis_accepte"
  | "signature"
  | "enrolement_tpe"
  | "installe";
