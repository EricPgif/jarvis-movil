/* Service worker de la PWA móvil de JARVIS (standalone).
   Cachea el "app shell" para que abra offline; las llamadas a MiniMax (otro origen)
   van SIEMPRE directas a la red (no se cachean). */
const CACHE = "jarvis-movil-v5";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./sphere.js", "./api.js", "./voice.js", "./deeplinks.js", "./weather.js",
  "./router.js", "./super.js", "./intro.js", "./clap.js", "./standby.js", "./extras.js", "./movil.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Solo gestionamos el MISMO origen (la app). MiniMax (cross-origin) va directo a la red.
  if (url.origin !== location.origin) return;
  // App shell: network-first con respaldo a caché (recibe updates y funciona offline).
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok && e.request.method === "GET") {
        const c = r.clone();
        caches.open(CACHE).then((x) => x.put(e.request, c)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});
