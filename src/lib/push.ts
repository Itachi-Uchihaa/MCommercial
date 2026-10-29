import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Emails des membres qui portent ces prénoms. */
export async function emailsDe(noms: string[]) {
  if (!noms.length) return [];
  const { data } = await createAdminClient().from("membres").select("email").in("nom", noms);
  return (data ?? []).map((m) => m.email as string);
}

/** Emails de la direction (tous les membres qui ne sont pas commerciaux), sauf celui donné. */
export async function emailsDirection(sauf?: string) {
  const { data } = await createAdminClient().from("membres").select("email").neq("role", "commercial");
  return (data ?? []).map((m) => m.email as string).filter((e) => e.toLowerCase() !== sauf?.toLowerCase());
}
