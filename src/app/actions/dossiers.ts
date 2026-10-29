"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { addDays, todayParis } from "@/lib/agenda";
import { joursEntre } from "@/lib/dates";
import { acteur } from "@/lib/acteur";
import { RAISONS_PERTE, STEPS, jourEtape } from "@/lib/dossiers";
import { notifierEquipe } from "@/lib/push";
import { DEVIS_SANS_REPONSE_JOURS } from "@/lib/relances";
import { createClient } from "@/lib/supabase/server";
import type { Dossier, DossierInfos, RaisonPerte, Source, StepKey } from "@/lib/types";

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const SOURCES: Source[] = ["terrain", "recommandation", "appel_entrant", "salon", "site_web", "autre"];
const RAISONS: RaisonPerte[] = ["prix", "deja_equipe", "pas_le_moment", "pas_interesse", "autre"];
const STEP_KEYS: StepKey[] = ["devis_fait", "devis_accepte", "signature", "enrolement_tpe", "installe"];

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
  if (siret && siret.length !== 14) throw new Refus("Le SIRET doit faire 14 chiffres.");
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

export async function supprimerDossier(id: string): Promise<Result> {
  return run("Le dossier n’a pas pu être supprimé.", async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("dossiers").delete().eq("id", id);
    if (error) throw error;
  });
}

/** Coche ou décoche une étape. La base date l'étape et l'écrit dans le journal. */
export async function changerEtape(id: string, key: StepKey, fait: boolean): Promise<Result> {
  return run("L’étape n’a pas pu être enregistrée.", async () => {
    if (!STEP_KEYS.includes(key)) throw new Refus("Étape inconnue. Recharge la page et réessaie.");
    const supabase = await createClient();
    const patch: Partial<Dossier> =
      key === "installe" ? { date_installation: fait ? todayParis() : null } : { [key]: fait };
    // Le devis accepté ou signé : plus rien à relancer
    if (fait && key !== "devis_fait") patch.relance_le = null;
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
    const enAttente = d.devis_fait && !d.devis_accepte && !d.signature;
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
