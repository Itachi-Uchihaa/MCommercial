// Service worker : rend l'app installable, garde les fichiers statiques (JS, CSS, icônes)
// en cache pour un démarrage rapide et affiche les notifications push.
// Les pages et les données Supabase passent toujours par le réseau.
const CACHE = "mcaisse-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // En développement, les fichiers changent sans changer de nom : pas de cache
  if (self.location.hostname === "localhost") return;

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (!isStatic) return;

  // Les fichiers /_next/static sont versionnés : cache d'abord.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Notification envoyée par le serveur (src/lib/push.ts) : { title, body, url, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "mcaisse", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

// Toucher la notification ouvre la page concernée, dans l'app déjà ouverte si possible
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const app = fenetres.find((f) => new URL(f.url).origin === self.location.origin);
      if (app) return app.focus().then((f) => f.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
