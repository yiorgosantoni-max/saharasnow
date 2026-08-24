// Kill-switch service worker.
// Purpose: unregister any previously installed service worker on visitors'
// devices and clear its caches, so the browser stops serving stale content
// intercepted by an old SW registration. This file intentionally does NOT
// register a new service worker — it only cleans up old ones.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
