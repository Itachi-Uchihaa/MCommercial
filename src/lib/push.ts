import "server-only";
import webpush from "web-push";
import { preferencesDe, type TypeNotif } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Membre } from "@/lib/types";

/** Contenu d'une notification ; `url` est la page ouverte quand on la touche. */
export type Notif = { title: string; body: string; url?: string; tag?: string };

let configure = false;

export const pushDisponible = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

function configurer() {
  if (!pushDisponible()) return false;
  if (!configure) {
    // Contact demandé par les services de notification (Apple, Google, Mozilla) : une adresse https ou mailto
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "https://mcaisse.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configure = true;
  }
  return true;
}

/**
 * Envoie la notification à tous les appareils abonnés de ces emails.
 * Les appareils désabonnés entre-temps (404, 410) sont oubliés. Renvoie le nombre d'envois réussis.
 */
export async function notifier(emails: string[], notif: Notif) {
  if (!emails.length || !configurer()) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_abonnements")
    .select("id, endpoint, p256dh, auth")
    .in("email", emails.map((e) => e.toLowerCase()));
  if (error) {
    console.error("Abonnements non lus", error);
    return 0;
  }

  const payload = JSON.stringify(notif);
  const perimes: string[] = [];
  const envois = await Promise.all(
    (data ?? []).map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
          TTL: 12 * 3600,
        });
        return true;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) perimes.push(a.id);
        else console.error("Notification non envoyée", code, e);
        return false;
      }
    }),
  );
  if (perimes.length) await admin.from("push_abonnements").delete().in("id", perimes);
  return envois.filter(Boolean).length;
}

/**
 * Envoie la notification aux membres qui ont choisi ce type dans Paramètres,
 * jamais à l'auteur de l'action (`sauf`, son email).
 * `seulement` / `exclure` : prénoms des membres à viser ou à écarter.
 */
export async function notifierEquipe(
  type: TypeNotif,
  notif: Notif,
  { sauf, seulement, exclure }: { sauf?: string | null; seulement?: string[]; exclure?: string[] } = {},
) {
  if (!pushDisponible()) return 0;
  const { data, error } = await createAdminClient().from("membres").select("*");
  if (error) {
    console.error("Membres non lus", error);
    return 0;
  }
  const emails = ((data ?? []) as Membre[])
    .filter((m) => m.email.toLowerCase() !== sauf?.toLowerCase())
    .filter((m) => !seulement || seulement.includes(m.nom))
    .filter((m) => !exclure?.includes(m.nom))
    .filter((m) => preferencesDe(m).includes(type))
    .map((m) => m.email);
  return notifier(emails, notif);
}
