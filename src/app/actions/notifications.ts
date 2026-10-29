"use server";

import { RDV_TYPES, fmtHeureLongue, fmtJour } from "@/lib/agenda";
import { estTypeNotif, preferencesDe } from "@/lib/notifications";
import { notifier, notifierEquipe, pushDisponible } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Membre, RendezVous } from "@/lib/types";
import type { Result } from "./dossiers";

/** Membre connecté (session vérifiée), ou null. */
async function moi() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const userId = data?.claims?.sub;
  if (!email || !userId) return null;
  const { data: me } = await supabase.from("membres").select("*").ilike("email", email).maybeSingle<Membre>();
  return me ? { me, email: email.toLowerCase(), userId, supabase } : null;
}

type Abonnement = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Enregistre l'appareil du membre connecté pour recevoir ses notifications. */
export async function sAbonner(sub: Abonnement, appareil: string): Promise<Result> {
  if (!pushDisponible()) return { ok: false, error: "Les notifications ne sont pas encore disponibles. Préviens ton responsable." };
  const session = await moi();
  if (!session) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Les notifications n’ont pas pu être activées sur ce navigateur. Recharge la page et réessaie." };
  }
  try {
    const admin = createAdminClient();
    // Le même appareil peut changer de compte : on remplace l'abonnement existant
    await admin.from("push_abonnements").delete().eq("endpoint", sub.endpoint);
    const { error } = await admin.from("push_abonnements").insert({
      user_id: session.userId,
      email: session.email,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      appareil: appareil.slice(0, 60),
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("Abonnement non enregistré", e);
    return { ok: false, error: "Les notifications n’ont pas pu être activées. Vérifie ta connexion et réessaie." };
  }
}

export async function seDesabonner(endpoint: string): Promise<Result> {
  const session = await moi();
  if (!session) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const { error } = await createAdminClient()
    .from("push_abonnements")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", session.userId);
  if (error) {
    console.error("Désabonnement impossible", error);
    return { ok: false, error: "Les notifications n’ont pas pu être désactivées. Réessaie." };
  }
  return { ok: true };
}

export async function notificationTest(): Promise<Result> {
  const session = await moi();
  if (!session) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  const n = await notifier([session.email], {
    title: "Notification de test",
    body: "Tout marche : tu recevras ici les notifications choisies dans Paramètres.",
    url: "/",
    tag: "test",
  });
  return n
    ? { ok: true }
    : { ok: false, error: "Aucun appareil n’a reçu la notification. Touche « Désactiver », puis « Activer les notifications »." };
}

/**
 * Après l'enregistrement d'un RDV dans l'agenda :
 * prévient son commercial si un collègue le lui a posé ou déplacé (« rdv_pour_moi »),
 * et, pour un nouveau RDV, ceux qui suivent les RDV de l'équipe (« rdv_equipe »).
 */
export async function notifierRdv(rdvId: string, changement: "nouveau" | "modifie"): Promise<void> {
  try {
    const session = await moi();
    if (!session) return;
    const { data: r } = await session.supabase.from("rendez_vous").select("*").eq("id", rdvId).maybeSingle<RendezVous>();
    if (!r) return;
    // Ex. « Démo le jeudi 30 octobre à 10 h » : le nom du client est dans le titre
    const quoi = `${RDV_TYPES[r.type]} le ${fmtJour(r.jour)} à ${fmtHeureLongue(r.debut)}`;

    if (r.commercial !== session.me.nom) {
      await notifierEquipe(
        "rdv_pour_moi",
        {
          title: changement === "nouveau" ? `Nouveau RDV pour toi : ${r.restaurant}` : `RDV modifié : ${r.restaurant}`,
          body:
            changement === "nouveau"
              ? `${quoi}. Ajouté par ${session.me.nom}.`
              : `Désormais : ${quoi}. Modifié par ${session.me.nom}.`,
          url: `/agenda?rdv=${r.id}`,
          tag: `rdv-${r.id}`,
        },
        { seulement: [r.commercial], sauf: session.email },
      );
    }
    if (changement === "nouveau") {
      await notifierEquipe(
        "rdv_equipe",
        {
          title: `Nouveau RDV : ${r.restaurant}`,
          body: `${quoi}. Commercial : ${r.commercial}.`,
          url: `/agenda?rdv=${r.id}`,
          tag: `rdv-equipe-${r.id}`,
        },
        { sauf: session.email, exclure: [r.commercial] },
      );
    }
  } catch (e) {
    console.error("Notification de RDV non envoyée", e);
  }
}

/** Enregistre les notifications choisies dans Paramètres (valables sur tous les appareils). */
export async function enregistrerPreferences(types: string[]): Promise<Result> {
  const session = await moi();
  if (!session) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  // Ne garde que ce que le rôle permet (un commercial ne suit pas l'activité de l'équipe)
  const permis = preferencesDe({ role: session.me.role });
  const { error } = await createAdminClient()
    .from("membres")
    .update({ notifications: types.filter(estTypeNotif).filter((t) => permis.includes(t)) })
    .eq("id", session.me.id);
  if (error) {
    console.error("Préférences de notification non enregistrées", error);
    return { ok: false, error: "Ton choix n’a pas pu être enregistré. Réessaie." };
  }
  return { ok: true };
}
