const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX =
  "metrobus-next-" + encodeURIComponent(SCOPE.pathname) + "-";
const CACHE = CACHE_PREFIX + __VERSION__;
const PRECACHE = __PRECACHE__;
const scopedUrl = (path) => new URL(path, SCOPE).href;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(
        PRECACHE.map((url) => new Request(url, { cache: "reload" })),
      );
      await cache.put(
        scopedUrl("__schedule-saved__"),
        new Response(new Date().toISOString()),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const oldCaches = (await caches.keys()).filter(
        (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE,
      );
      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "SCHEDULE_SAVED")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE),
          response = await cache.match(scopedUrl("__schedule-saved__"));
        event.ports[0]?.postMessage(response ? await response.text() : null);
      })(),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(SCOPE.pathname)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const path = url.pathname.slice(SCOPE.pathname.length);
      const navigation =
        event.request.mode === "navigate" ||
        path === "" ||
        path === "index.html";
      const immutableAsset =
        path.startsWith("assets/") &&
        /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/i.test(path) &&
        !path.endsWith(".map");
      const dataJson = path.startsWith("data/") && path.endsWith(".json");
      const options = { ignoreSearch: true, ignoreVary: true };
      if (path === "sw.js") return fetch(event.request, { cache: "no-store" });
      if (immutableAsset || dataJson) {
        const cached = await cache.match(event.request, options);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }
      // HTML and other unversioned resources must check the network first.
      const key = navigation ? scopedUrl("index.html") : event.request;
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        if (response.ok) {
          await cache.put(key, response.clone());
          return response;
        }
        return (await cache.match(key, options)) || response;
      } catch {
        return (await cache.match(key, options)) || Response.error();
      }
    })(),
  );
});
