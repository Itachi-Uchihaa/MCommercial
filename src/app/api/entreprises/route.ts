import { NextResponse, type NextRequest } from "next/server";
import { titre } from "@/lib/dossiers";

/**
 * Recherche dans l'annuaire officiel des entreprises (recherche-entreprises.api.gouv.fr,
 * gratuit, sans clé, 7 requêtes par seconde). Réservé aux membres connectés (voir proxy.ts).
 * ?q=petit zinc paris 11  ou  ?q=12345678900012
 */

export type Entreprise = {
  siret: string;
  /** Enseigne si elle existe, sinon raison sociale. */
  nom: string;
  raisonSociale: string;
  adresse: string;
  activite: string | null;
  gerant: string | null;
};

// Codes NAF utiles pour la restauration
const NAF: Record<string, string> = {
  "56.10A": "Restauration traditionnelle",
  "56.10B": "Cafétéria, libre-service",
  "56.10C": "Restauration rapide",
  "56.21Z": "Traiteur",
  "56.29A": "Restauration collective",
  "56.29B": "Restauration",
  "56.30Z": "Bar, débit de boissons",
  "10.71C": "Boulangerie-pâtisserie",
  "10.71D": "Pâtisserie",
  "55.10Z": "Hôtel",
};

type Etablissement = {
  siret: string;
  adresse: string;
  etat_administratif: string;
  activite_principale: string | null;
  liste_enseignes: string[] | null;
  nom_commercial: string | null;
};

type Resultat = {
  nom_complet: string;
  activite_principale: string | null;
  siege: Etablissement;
  matching_etablissements?: Etablissement[];
  dirigeants?: { nom?: string; prenoms?: string; denomination?: string; type_dirigeant: string }[];
};

function versEntreprise(r: Resultat): Entreprise {
  // L'établissement qui correspond à la recherche s'il est ouvert, sinon le siège
  const etab = r.matching_etablissements?.find((e) => e.etat_administratif === "A") ?? r.siege;
  const enseigne = etab.liste_enseignes?.[0] ?? etab.nom_commercial;
  const dirigeant = r.dirigeants?.find((x) => x.type_dirigeant === "personne physique" && x.nom);
  return {
    siret: etab.siret,
    nom: titre(enseigne ?? r.nom_complet),
    raisonSociale: titre(r.nom_complet),
    adresse: etab.adresse,
    activite: NAF[etab.activite_principale ?? r.activite_principale ?? ""] ?? null,
    gerant: dirigeant ? titre(`${dirigeant.prenoms?.split(" ")[0] ?? ""} ${dirigeant.nom}`.trim()) : null,
  };
}

export async function GET(request: NextRequest) {
  const brut = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const chiffres = brut.replace(/\s/g, "");
  const q = /^\d{9,14}$/.test(chiffres) ? chiffres : brut;
  if (q.length < 3) return NextResponse.json({ results: [] });

  const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", "6");
  url.searchParams.set("etat_administratif", "A");

  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { results: Resultat[] };
    return NextResponse.json({ results: json.results.map(versEntreprise) });
  } catch (e) {
    console.error("Annuaire des entreprises indisponible", e);
    return NextResponse.json({ error: "indisponible" }, { status: 502 });
  }
}
