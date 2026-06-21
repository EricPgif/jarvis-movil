/* Service worker de la PWA móvil de JARVIS (standalone).
   Cachea el "app shell" para que abra offline; las llamadas a MiniMax (otro origen)
   van SIEMPRE directas a la red (no se cachean). */
const CACHE = "jarvis-movil-v9";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./sfx.js", "./sphere.js", "./api.js", "./edgetts.js", "./voice.js", "./deeplinks.js", "./weather.js",
  "./router.js", "./super.js", "./intro.js", "./clap.js", "./standby.js", "./extras.js", "./movil.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

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
  if (e.request.method !== "GET") return;
  // App shell: SIEMPRE lo más nuevo. cache:"no-store" salta la caché HTTP/CDN del navegador
  // (antes podía servir HTML/JS viejo aunque hubiera versión nueva → no se actualizaba).
  // Respaldo a caché solo si no hay red (offline).
  e.respondWith(
    fetch(new Request(url.href, { cache: "no-store" })).then((r) => {
      if (r && r.ok) {
        const c = r.clone();
        caches.open(CACHE).then((x) => x.put(e.request, c)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});
