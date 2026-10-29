"use server";

import { RDV_TYPES, fmtHeure, fmtJourCourt, mondayOf } from "@/lib/agenda";
import { emailsDe, notifier, pushDisponible } from "@/lib/push";
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
  if (!pushDisponible()) return { ok: false, error: "Les notifications ne sont pas encore configurées sur le serveur." };
  const session = await moi();
  if (!session) return { ok: false, error: "Ta session a expiré : reconnecte-toi." };
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Ce navigateur a renvoyé un abonnement invalide. Réessaie." };
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
    title: "Notifications activées",
    body: "Tu recevras ici tes nouveaux RDV et le récap du matin.",
    url: "/",
    tag: "test",
  });
  return n ? { ok: true } : { ok: false, error: "Aucun appareil n’a reçu la notification. Désactive puis réactive-les." };
}

/**
 * Prévient le commercial d'un RDV qu'un collègue vient de lui ajouter ou de lui déplacer.
 * Appelé par l'agenda après l'enregistrement ; ne fait rien si c'est son propre RDV.
 */
export async function notifierRdv(rdvId: string, changement: "nouveau" | "modifie"): Promise<void> {
  try {
    const session = await moi();
    if (!session) return;
    const { data: r } = await session.supabase.from("rendez_vous").select("*").eq("id", rdvId).maybeSingle<RendezVous>();
    if (!r || r.commercial === session.me.nom) return;
    await notifier(await emailsDe([r.commercial]), {
      title: changement === "nouveau" ? "Nouveau RDV" : "RDV modifié",
      body: `${fmtJourCourt(r.jour)} à ${fmtHeure(r.debut)} · ${RDV_TYPES[r.type]} chez ${r.restaurant} (par ${session.me.nom})`,
      url: `/agenda?semaine=${mondayOf(r.jour)}`,
      tag: `rdv-${r.id}`,
    });
  } catch (e) {
    console.error("Notification de RDV non envoyée", e);
  }
}
