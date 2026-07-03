/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);

// Les médias (photos/vidéos) sont immuables une fois envoyés : cache-first sans risque.
// Le reste de /api (auth, messages, conversations) doit toujours passer par le réseau :
// une réponse mise en cache par erreur casserait l'authentification ou afficherait des
// données périmées dans un salon de discussion en temps réel.
registerRoute(({ url }) => url.pathname.startsWith("/api/attachments/"), new CacheFirst({ cacheName: "media-cache" }));

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; conversationId?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = {};
  }

  const title = data.title ?? "FamilySpeak";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { conversationId: data.conversationId },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      const existing = clientsArr[0];
      if (existing) return existing.focus();
      return self.clients.openWindow("/");
    }),
  );
});
