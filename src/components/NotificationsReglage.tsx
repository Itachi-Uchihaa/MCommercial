"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { enregistrerPreferences, notificationTest, sAbonner, seDesabonner } from "@/app/actions/notifications";
import { groupesPour, type TypeNotif } from "@/lib/notifications";
import type { Role } from "@/lib/types";

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

/** Section « Notifications » des Paramètres : abonner cet appareil, choisir ce qui déclenche une notification. */
export function NotificationsReglage({ preferences, role }: { preferences: TypeNotif[]; role: Role }) {
  const support = useSyncExternalStore(rien, detecter, () => "chargement" as const);
  const [actif, setActif] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [choix, setChoix] = useState(() => new Set(preferences));
  const [choixMessage, setChoixMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [, startChoix] = useTransition();

  function basculer(t: TypeNotif) {
    const avant = choix;
    const next = new Set(choix);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setChoix(next);
    startChoix(async () => {
      const res = await enregistrerPreferences([...next]);
      if (!res.ok) setChoix(avant); // la case revient comme avant : rien n'a été enregistré
      setChoixMessage(res.ok ? { texte: "Choix enregistré.", erreur: false } : { texte: res.error, erreur: true });
    });
  }

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
        // Refus : le bandeau « bloquées » s'affiche à la place du bouton et explique quoi faire
        setMessage(
          permission === "denied"
            ? null
            : { texte: "Tu n’as pas répondu à la demande du navigateur. Touche à nouveau « Activer les notifications ».", erreur: true },
        );
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
        <h3 className="text-[15px] font-bold">Sur cet appareil</h3>
        <p className="mt-0.5 text-[14px] text-muted">Active-les sur chaque téléphone ou ordinateur où tu veux les recevoir.</p>

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

        {(support === "chargement" || (support === "ok" && !bloquees && actif === null)) && (
          <p role="status" className="mt-3 text-[14px] text-muted">
            Vérification…
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

      <div className="card mt-3 p-3.5">
        <h3 className="text-[15px] font-bold">Me prévenir pour</h3>
        <p className="mt-0.5 text-[14px] text-muted">Tes choix valent pour tous tes appareils.</p>
        {groupesPour(role).map((g) => (
          <fieldset key={g.titre} className="mt-4">
            <legend className="text-[13px] font-bold tracking-wider text-muted uppercase">{g.titre}</legend>
            {g.detail && <p className="text-[13px] text-muted">{g.detail}</p>}
            <div className="mt-2 overflow-hidden rounded-xl border border-line">
              {g.types.map((t, i) => (
                <label key={t.key} className={`flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-2 text-[15px] ${i ? "border-t border-line" : ""}`}>
                  <input type="checkbox" className="size-5 flex-none accent-brand" checked={choix.has(t.key)} onChange={() => basculer(t.key)} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <p aria-live="polite" className={`mt-2.5 min-h-5 text-[13.5px] ${choixMessage?.erreur ? "text-danger" : "text-ok-ink"}`}>
          {choixMessage?.texte}
        </p>
      </div>
    </section>
  );
}
