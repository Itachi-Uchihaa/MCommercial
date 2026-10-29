"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { notificationTest, sAbonner, seDesabonner } from "@/app/actions/notifications";

type Support = "chargement" | "ok" | "ios" | "non";

/** Ce que permet cet appareil (lu une fois, côté navigateur seulement). */
function detecter(): Support {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  // Sur iPhone, les notifications ne marchent que dans l'app ajoutée à l'écran d'accueil
  if (ios && !installee) return "ios";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "non";
  return "ok";
}
const rien = () => () => {};

/** Clé publique VAPID (base64url) → octets, comme l'attend pushManager.subscribe. */
function cleVapid() {
  const b64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const brut = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

const appareil = () => {
  const ua = navigator.userAgent;
  return /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /mac/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "PC" : "Navigateur";
};

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }))
  );
}

/** Section « Notifications » des Paramètres : abonner ou désabonner cet appareil. */
export function NotificationsReglage() {
  const support = useSyncExternalStore(rien, detecter, () => "chargement" as const);
  const [actif, setActif] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (support !== "ok") return;
    let annule = false;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => !annule && setActif(!!sub))
      .catch(() => !annule && setActif(false));
    return () => {
      annule = true;
    };
  }, [support]);

  const bloquees = support === "ok" && Notification.permission === "denied";

  function activer() {
    start(async () => {
      setMessage(null);
      // Demandée tout de suite après l'appui : sinon le navigateur refuse d'afficher la question
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage({ texte: "Tu n’as pas autorisé les notifications. Tu peux réessayer quand tu veux.", erreur: true });
        return;
      }
      try {
        const reg = await registration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleVapid() }));
        const json = sub.toJSON();
        const res = await sAbonner({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } }, appareil());
        if (!res.ok) return setMessage({ texte: res.error, erreur: true });
        setActif(true);
        setMessage({ texte: "Notifications activées sur cet appareil.", erreur: false });
      } catch (e) {
        console.error("Abonnement aux notifications impossible", e);
        setMessage({ texte: "Les notifications n’ont pas pu être activées. Recharge la page et réessaie.", erreur: true });
      }
    });
  }

  function desactiver() {
    start(async () => {
      setMessage(null);
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) {
        const res = await seDesabonner(sub.endpoint);
        if (!res.ok) return setMessage({ texte: res.error, erreur: true });
        await sub.unsubscribe();
      }
      setActif(false);
      setMessage({ texte: "Notifications désactivées sur cet appareil.", erreur: false });
    });
  }

  function tester() {
    start(async () => {
      const res = await notificationTest();
      setMessage(
        res.ok
          ? { texte: "Notification envoyée : elle arrive dans quelques secondes.", erreur: false }
          : { texte: res.error, erreur: true },
      );
    });
  }

  return (
    <section aria-labelledby="notifications" className="mt-6">
      <h2 id="notifications" className="section-title">
        Notifications
      </h2>
      <div className="card p-3.5">
        <p className="text-[14.5px]">
          Sur cet appareil : un RDV ajouté pour toi par un collègue, et chaque matin ta journée (RDV et relances). La direction reçoit aussi
          les signatures.
        </p>

        {support === "ios" && (
          <p className="mt-3 rounded-xl bg-brand-soft px-3.5 py-3 text-[14px] text-brand-ink">
            Sur iPhone, ajoute d’abord l’app à l’écran d’accueil : bouton Partager, puis « Sur l’écran d’accueil ». Ouvre-la ensuite depuis son
            icône et reviens ici.
          </p>
        )}
        {support === "non" && (
          <p className="mt-3 text-[14px] text-muted">
            Ce navigateur ne gère pas les notifications. Ouvre l’app dans Chrome, ou sur iPhone depuis l’écran d’accueil.
          </p>
        )}
        {bloquees && (
          <p className="mt-3 text-[14px] text-warn">
            Les notifications sont bloquées pour cette app. Autorise-les dans les réglages du navigateur ou du téléphone, puis recharge la page.
          </p>
        )}

        {support === "ok" && !bloquees && actif === false && (
          <button
            onClick={activer}
            disabled={pending}
            className="mt-3.5 w-full rounded-2xl bg-brand py-4 font-bold text-white disabled:opacity-60"
          >
            {pending ? "Activation…" : "Activer les notifications"}
          </button>
        )}
        {support === "ok" && actif && (
          <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
            <button onClick={tester} disabled={pending} className="min-h-12 flex-1 rounded-2xl bg-brand-soft px-4 font-bold text-brand disabled:opacity-60">
              M’envoyer une notification de test
            </button>
            <button onClick={desactiver} disabled={pending} className="min-h-12 rounded-2xl border border-line px-4 font-semibold disabled:opacity-60">
              Désactiver
            </button>
          </div>
        )}

        <p aria-live="polite" className={`mt-2.5 text-[13.5px] ${message?.erreur ? "text-danger" : "text-ok-ink"}`}>
          {message?.texte}
        </p>
      </div>
    </section>
  );
}
