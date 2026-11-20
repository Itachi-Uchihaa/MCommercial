"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { addDays, fmtHeureLongue, fmtJour, isIsoDate, todayParis } from "@/lib/agenda";
import { joursEntre } from "@/lib/dates";
import { acteur } from "@/lib/acteur";
import { DATE_PREVUE, EQUIPEMENTS, ETAPES_MANUELLES, PAIEMENTS, RAISONS_PERTE, STEPS, estPaiement, jourEtape, peutSupprimer } from "@/lib/dossiers";
import { getCurrentMembre, peutAdministrer } from "@/lib/auth";
import { notifierEquipe } from "@/lib/push";
import { DEVIS_SANS_REPONSE_JOURS } from "@/lib/relances";
import { createClient } from "@/lib/supabase/server";
import type { Dossier, DossierInfos, EtapeDatee, EtapeManuelle, Equipements, Paiement, RaisonPerte, Source } from "@/lib/types";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const SOURCES: Source[] = ["terrain", "recommandation", "appel_entrant", "salon", "site_web", "autre"];
const RAISONS: RaisonPerte[] = ["prix", "deja_equipe", "pas_le_moment", "pas_interesse", "autre"];
/** Erreur montrée telle quelle (validation) ; toute autre erreur reste dans les logs. */
class Refus extends Error {}

async function run(echec: string, fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn();
    refresh();
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    if (e instanceof Refus) return { ok: false, error: e.message };
    console.error(echec, e);
    return { ok: false, error: `${echec} Vérifie ta connexion et réessaie.` };
  }
}

const vide = (s: string | null | undefined) => (s ?? "").trim() || null;

/** Nettoie et contrôle les infos saisies dans le formulaire du dossier. */
function infosValides(input: DossierInfos): DossierInfos {
  const restaurant = input.restaurant.trim();
  const siret = (input.siret ?? "").replace(/\D/g, "") || null;
  const mail = vide(input.mail);
  if (!restaurant) throw new Refus("Indique le nom du restaurant.");
  if (!input.commercial) throw new Refus("Choisis le commercial qui suit ce dossier.");
  if (siret && siret.length !== 9 && siret.length !== 14)
    throw new Refus("Indique un SIREN (9 chiffres) ou un SIRET (14 chiffres).");
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Refus("Cette adresse e-mail n’est pas valide. Vérifie-la.");
  if (input.source && !SOURCES.includes(input.source)) throw new Refus("Source du contact inconnue. Recharge la page et réessaie.");
  return {
    restaurant,
    commercial: input.commercial,
    siret,
    mail,
    telephone: vide(input.telephone),
    gerant: vide(input.gerant),
    adresse: vide(input.adresse),
    activite: vide(input.activite),
    source: input.source ?? null,
    notes: vide(input.notes),
  };
}

export async function creerDossier(input: DossierInfos): Promise<Result> {
  return run("Le dossier n’a pas pu être ajouté.", async () => {
    const supabase = await createClient();
    const infos = infosValides(input);
    const { data, error } = await supabase.from("dossiers").insert(infos).select("id").single();
    if (error) throw error;
    const id = data.id as string;
    // Notifications envoyées après la réponse, pour ne pas ralentir l'écran
    after(async () => {
      const a = await acteur(supabase);
      await notifierEquipe(
        "nouveau_dossier",
        {
          title: `Nouveau dossier : ${infos.restaurant}`,
          body: infos.commercial !== a.nom ? `Ajouté par ${a.nom}, suivi par ${infos.commercial}.` : `Ajouté et suivi par ${a.nom}.`,
          url: `/dossiers/${id}`,
          tag: `dossier-${id}`,
        },
        { sauf: a.email },
      );
    });
    return id;
  });
}

export async function modifierDossier(id: string, input: DossierInfos): Promise<Result> {
  return run("Le dossier n’a pas pu être enregistré.", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("dossiers").update(infosValides(input)).eq("id", id);
    if (error) throw error;
  });
}

/**
 * Fixe (ou retire, avec null) la date d'installation ou d'accompagnement,
 * avec une heure facultative (HH:MM, heure de Paris).
 * L'étape est faite le jour venu ; la base l'écrit dans le journal.
 */
export async function fixerDate(id: string, key: EtapeDatee, jour: string | null, heure: string | null = null): Promise<Result> {
  return run("La date n’a pas pu être enregistrée.", async () => {
    if (!(key in DATE_PREVUE)) throw new Refus("Étape inconnue. Recharge la page et réessaie.");
    if (jour !== null && !isIsoDate(jour)) throw new Refus("Cette date n’est pas valide.");
    if (heure !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) throw new Refus("Cette heure n’est pas valide.");
    // L'heure disparaît avec la date
    const h = jour ? heure : null;
    const patch =
      key === "installation" ? { date_installation: jour, heure_installation: h } : { date_accompagnement: jour, heure_accompagnement: h };
    const supabase = await createClient();
    const { data: d, error } = await supabase
      .from("dossiers")
      .update(patch)
      .eq("id", id)
      .select("restaurant, commercial")
      .single();
    if (error) throw error;

    if (jour) {
      after(async () => {
        const a = await acteur(supabase);
        const [nom, prevu, fait] = key === "installation" ? ["Installation", "Prévue", "Faite"] : ["Accompagnement", "Prévu", "Fait"];
        await notifierEquipe(
          key,
          {
            title: `${nom} : ${d.restaurant}`,
            body: `${jour > todayParis() ? prevu : fait} le ${fmtJour(jour)}${h ? ` à ${fmtHeureLongue(h)}` : ""}. Dossier de ${d.commercial}${d.commercial !== a.nom ? `, daté par ${a.nom}` : ""}.`,
            url: `/dossiers/${id}`,
            tag: `etape-${id}-${key}`,
          },
          { sauf: a.email },
        );
      });
    }
  });
}

/**
 * Étape « Devis payé » : payé, en plusieurs fois ou en attente (null : retire le choix).
 * Les trois font avancer le dossier ; la base date l'étape et l'écrit dans le journal.
 */
export async function fixerPaiement(id: string, paiement: Paiement | null): Promise<Result> {
  return run("Le paiement n’a pas pu être enregistré.", async () => {
    if (paiement !== null && !estPaiement(paiement)) throw new Refus("Choix inconnu. Recharge la page et réessaie.");
    const supabase = await createClient();
    const { data: d, error } = await supabase
      .from("dossiers")
      .update({ paiement, relance_le: null })
      .eq("id", id)
      .select("restaurant, commercial")
      .single();
    if (error) throw error;

    if (paiement) {
      after(async () => {
        const a = await acteur(supabase);
        await notifierEquipe(
          "paiement",
          {
            title: `${PAIEMENTS.find((p) => p.key === paiement)!.detail} : ${d.restaurant}`,
            body: d.commercial !== a.nom ? `Dossier de ${d.commercial}, mis à jour par ${a.nom}.` : `Dossier de ${a.nom}.`,
            url: `/dossiers/${id}`,
            tag: `etape-${id}-paiement`,
          },
          { sauf: a.email },
        );
      });
    }
  });
}

/** Prix de l'abonnement (euros par mois ; null : l'efface). Direction et admins seulement. */
export async function enregistrerAbonnement(id: string, prix: number | null): Promise<Result> {
  return run("Le prix de l’abonnement n’a pas pu être enregistré.", async () => {
    const { me } = await getCurrentMembre();
    if (!me || !peutAdministrer(me)) throw new Refus("Réservé à la direction.");
    if (prix !== null && (!Number.isFinite(prix) || prix < 0 || prix >= 100000)) throw new Refus("Indique un prix valide, en euros.");
    const supabase = await createClient();
    const { error } =
      prix === null
        ? await supabase.from("abonnements").delete().eq("dossier_id", id)
        : await supabase
            .from("abonnements")
            .upsert({ dossier_id: id, prix: Math.round(prix * 100) / 100, updated_at: new Date().toISOString(), updated_by: me.nom });
    if (error) throw error;
  });
}

/** Quantités d'équipements du devis (0 à 99 chacune). La base l'écrit dans le journal. */
export async function enregistrerEquipements(id: string, input: Equipements): Promise<Result> {
  return run("Les équipements n’ont pas pu être enregistrés.", async () => {
    const patch = {} as Equipements;
    for (const { key } of EQUIPEMENTS) {
      const n = Number(input[key]);
      if (!Number.isInteger(n) || n < 0 || n > 99) throw new Refus("Chaque quantité doit être un nombre entre 0 et 99.");
      patch[key] = n;
    }
    const supabase = await createClient();
    const { error } = await supabase.from("dossiers").update(patch).eq("id", id);
    if (error) throw error;
  });
}

export async function supprimerDossier(id: string): Promise<Result> {
  return run("Le dossier n’a pas pu être supprimé.", async () => {
    const supabase = await createClient();
    const [{ me }, { data: d, error: readError }] = await Promise.all([
      getCurrentMembre(),
      supabase.from("dossiers").select("commercial").eq("id", id).maybeSingle(),
    ]);
    if (readError) throw readError;
    if (!d) throw new Refus("Ce dossier a déjà été supprimé. Recharge la page.");
    if (!me || !peutSupprimer(me, d)) throw new Refus("Tu ne peux supprimer que tes propres dossiers.");
    // Les fichiers du menu d'abord : la règle de suppression du stockage a besoin du dossier
    const { data: fichiers } = await supabase.from("menu_fichiers").select("chemin").eq("dossier_id", id);
    if (fichiers?.length) {
      const { error: stockage } = await supabase.storage.from("menus").remove(fichiers.map((f) => f.chemin));
      if (stockage) console.error("Fichiers du menu non supprimés", stockage);
    }
    const { error } = await supabase.from("dossiers").delete().eq("id", id);
    if (error) throw error;
  });
}

/** Coche ou décoche une étape. La base date l'étape et l'écrit dans le journal. */
export async function changerEtape(id: string, key: EtapeManuelle, fait: boolean): Promise<Result> {
  return run("L’étape n’a pas pu être enregistrée.", async () => {
    // « RDV » se coche toute seule, à partir de l'agenda
    if (!ETAPES_MANUELLES.includes(key)) throw new Refus("Étape inconnue. Recharge la page et réessaie.");
    const supabase = await createClient();
    const patch: Partial<Dossier> = { [key]: fait };
    // Signé ou plus loin : plus rien à relancer
    if (fait && key !== "devis_prepare" && key !== "devis_fait") patch.relance_le = null;
    const { data: d, error } = await supabase.from("dossiers").update(patch).eq("id", id).select("restaurant, commercial").single();
    if (error) throw error;

    // Étape franchie : prévient ceux qui suivent cette étape, après la réponse
    if (fait) {
      after(async () => {
        const a = await acteur(supabase);
        await notifierEquipe(
          key,
          {
            title: `${STEPS.find((s) => s.key === key)!.long} : ${d.restaurant}`,
            body: d.commercial !== a.nom ? `Dossier de ${d.commercial}, mis à jour par ${a.nom}.` : `Dossier de ${a.nom}.`,
            url: `/dossiers/${id}`,
            tag: `etape-${id}-${key}`,
          },
          { sauf: a.email },
        );
      });
    }
  });
}

export async function marquerPerdu(id: string, raison: RaisonPerte): Promise<Result> {
  return run("Le dossier n’a pas pu être classé perdu.", async () => {
    if (!RAISONS.includes(raison)) throw new Refus("Choisis une raison.");
    const supabase = await createClient();
    const { data: d, error } = await supabase
      .from("dossiers")
      .update({ perdu_le: new Date().toISOString(), raison_perte: raison, relance_le: null })
      .eq("id", id)
      .select("restaurant")
      .single();
    if (error) throw error;
    after(async () => {
      const a = await acteur(supabase);
      await notifierEquipe(
        "perdu",
        {
          title: `Dossier perdu : ${d.restaurant}`,
          body: `${RAISONS_PERTE[raison]}, classé par ${a.nom}.`,
          url: `/dossiers/${id}`,
          tag: `perdu-${id}`,
        },
        { sauf: a.email },
      );
    });
  });
}

export async function rouvrirDossier(id: string): Promise<Result> {
  return run("Le dossier n’a pas pu être rouvert.", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("dossiers").update({ perdu_le: null, raison_perte: null }).eq("id", id);
    if (error) throw error;
  });
}

/**
 * Relance faite : un devis toujours sans réponse revient dans 7 jours, un simple rappel disparaît.
 * La relance est notée dans le journal.
 */
export async function relanceFaite(id: string): Promise<Result> {
  return run("La relance n’a pas pu être enregistrée.", async () => {
    const supabase = await createClient();
    const { data: d, error: readError } = await supabase.from("dossiers").select("*").eq("id", id).single<Dossier>();
    if (readError) throw readError;
    const today = todayParis();
    const enAttente = d.devis_fait && !d.signature;
    const devisLe = jourEtape(d, "devis_fait");
    const encoreDue = enAttente && devisLe && joursEntre(devisLe, today) >= DEVIS_SANS_REPONSE_JOURS;
    const { error } = await supabase
      .from("dossiers")
      .update({ relance_le: encoreDue ? addDays(today, DEVIS_SANS_REPONSE_JOURS) : null })
      .eq("id", id);
    if (error) throw error;
    await supabase.from("journal").insert({ dossier_id: id, auteur: "", type: "note", texte: "Relance faite." });
  });
}

export async function ajouterNote(dossierId: string, texte: string): Promise<Result> {
  return run("La note n’a pas pu être ajoutée.", async () => {
    const t = texte.trim();
    if (!t) throw new Refus("Écris d’abord ta note.");
    if (t.length > 2000) throw new Refus("La note doit faire 2 000 caractères maximum.");
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const { error } = await supabase
      .from("journal")
      // L'auteur est recalculé par la base à partir du compte connecté
      .insert({ dossier_id: dossierId, auteur: "", type: "note", texte: t, created_by: claims?.claims?.sub });
    if (error) throw error;
  });
}

export async function supprimerNote(id: string): Promise<Result> {
  return run("La note n’a pas pu être supprimée.", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("journal").delete().eq("id", id);
    if (error) throw error;
  });
}
