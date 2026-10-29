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
  /** Ancienne étape « Devis accepté », plus affichée. */
  devis_accepte: boolean;
  signature: boolean;
  /** Groupe SAV créé pour le client. */
  groupe_sav: boolean;
  form: boolean;
  enrolement_tpe: boolean;
  /** Dates des étapes, posées par la base quand la case est cochée. */
  devis_fait_le: string | null;
  devis_accepte_le: string | null;
  signature_le: string | null;
  groupe_sav_le: string | null;
  form_le: string | null;
  enrolement_tpe_le: string | null;
  /** Jour d'installation (AAAA-MM-JJ), choisi par le commercial : à venir = prévue. */
  date_installation: string | null;
  /** Jour d'accompagnement (AAAA-MM-JJ), choisi par le commercial : à venir = prévu. */
  date_accompagnement: string | null;
  /** Jour du premier RDV du dossier (tenu à jour par la base). */
  rdv_le: string | null;
  /** Équipements du devis : quantités (0 à 99). */
  devis_ipad: number;
  devis_imprimante: number;
  devis_tiroir_caisse: number;
  devis_tpe: number;
  devis_borne: number;
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

/** Quantités d'équipements prévues au devis. */
export type Equipements = Pick<Dossier, "devis_ipad" | "devis_imprimante" | "devis_tiroir_caisse" | "devis_tpe" | "devis_borne">;

/** Étapes affichées sur chaque carte, dans l'ordre du parcours commercial. */
export type StepKey =
  | "rdv"
  | "devis_fait"
  | "signature"
  | "groupe_sav"
  | "form"
  | "enrolement_tpe"
  | "installation"
  | "accompagnement";

/** Étapes datées : le commercial choisit la date, l'étape est faite le jour venu. */
export type EtapeDatee = "installation" | "accompagnement";

/** Étapes cochées à la main (« RDV » se coche toute seule, les étapes datées se font le jour venu). */
export type EtapeManuelle = Exclude<StepKey, "rdv" | EtapeDatee>;

/** Photo ou PDF du menu d'un restaurant (étape « Groupe SAV créé »). */
export type MenuFichier = {
  id: string;
  dossier_id: string;
  /** Chemin dans l'espace de stockage « menus » : <id du dossier>/<fichier>. */
  chemin: string;
  nom: string;
  type: string;
  taille: number;
  created_by: string | null;
  created_at: string;
};
