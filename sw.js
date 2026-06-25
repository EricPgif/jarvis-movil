/* Service worker de la PWA móvil de JARVIS (standalone).
   Cachea el "app shell" para que abra offline; las llamadas a MiniMax (otro origen)
   van SIEMPRE directas a la red (no se cachean). */
const CACHE = "jarvis-movil-v39";
const CORE = [
  "./", "./index.html", "./manifest.json", "./version.json",
  "./sfx.js", "./sphere.js", "./appicons.js", "./memory.js", "./api.js", "./edgetts.js", "./pcvoice.js", "./elevenlabs.js", "./native.js", "./voice.js", "./deeplinks.js", "./weather.js",
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
  // App shell: SIEMPRE lo más nuevo. cache:"no-store" salta la caché del navegador.
  // Para la navegación/HTML añadimos ?cb=CACHE a la petición de RED para esquivar TAMBIÉN el
  // CDN de GitHub Pages (los .js/.png ya llevan ?v=N). La respuesta se guarda bajo la clave
  // ORIGINAL (sin ?cb), para que el respaldo offline siga funcionando.
  const isNav = e.request.mode === "navigate" || url.pathname === "/" ||
                url.pathname.endsWith("/") || url.pathname.endsWith(".html");
  const netHref = isNav ? url.href + (url.search ? "&" : "?") + "cb=" + CACHE : url.href;
  e.respondWith(
    fetch(new Request(netHref, { cache: "no-store" })).then((r) => {
      if (r && r.ok) {
        const c = r.clone();
        caches.open(CACHE).then((x) => x.put(e.request, c)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});
