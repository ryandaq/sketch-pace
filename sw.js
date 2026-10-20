const CACHE = "sketch-pace-shell-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./lab.css", "./ipad.css", "./app.js", "./lab.js", "./manifest.webmanifest", "./icon.svg", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("sketch-pace-shell-") && key !== CACHE).map(key => caches.delete(key)))), self.clients.claim()]));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return await caches.match(event.request) || (event.request.mode === "navigate" ? await caches.match("./index.html") : Response.error());
    }
  })());
});
