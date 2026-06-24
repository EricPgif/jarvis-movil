/* deeplinks.js — Abre apps del MÓVIL por deep link (con respaldo https).
   Datos sacados del memory.json del JARVIS de escritorio. Eric puede editarlos aquí.
   Expone window.Links. */
(function () {
  "use strict";

  // Disparadores con nombre (de memory.json). frase = lo que dice JARVIS al lanzarlo.
  var NAMED = {
    dexter:  { frase: "Dexter Morgan, señor: el protagonista de su serie favorita.", url: "https://www.tiktok.com/@dobri_696969/video/7624616247736470797" },
    brian:   { frase: "Brian Moser, el hermano biológico de Dexter, señor.", url: "https://www.tiktok.com/@rtdx68/video/7609468339882069256" },
    rita:    { frase: "Rita, la mujer de Dexter, señor.", url: "https://vm.tiktok.com/ZNR33Xkpb/" },
    cristina:{ frase: "Enseguida, señor.", scheme: "spotify:track:2sJfXiDnNZJi5HtwQkEutR", https: "https://open.spotify.com/track/2sJfXiDnNZJi5HtwQkEutR" },
    clap:    { frase: "Sí, señor. Poniendo música de Tony Stark.", scheme: "spotify:track:2iEGj7kAwH7HAa5epwYwLB", https: "https://open.spotify.com/track/2iEGj7kAwH7HAa5epwYwLB" },
  };

  // Apps por nombre ("abre X"). scheme = deep link nativo; https = respaldo web.
  var APPS = {
    spotify:    { frase: "Abriendo Spotify, señor.",   scheme: "spotify:",                 https: "https://open.spotify.com" },
    youtube:    { frase: "Abriendo YouTube, señor.",   https: "https://www.youtube.com" },
    whatsapp:   { frase: "Abriendo WhatsApp, señor.",  scheme: "whatsapp://", android: "com.whatsapp",            intentScheme: "whatsapp", appOnly: true },
    telegram:   { frase: "Abriendo Telegram, señor.",  scheme: "tg://",           android: "org.telegram.messenger", intentScheme: "tg",       appOnly: true },
    gmail:      { frase: "Abriendo Gmail, señor.", scheme: "googlegmail://", android: "com.google.android.gm", appOnly: true },
    correo:     { frase: "Abriendo Gmail, señor.", scheme: "googlegmail://", android: "com.google.android.gm", appOnly: true },
    calendario: { frase: "Abriendo tu calendario, señor.", https: "https://calendar.google.com" },
    navegador:  { frase: "Abriendo el navegador, señor.",  https: "https://www.google.com" },
    chrome:     { frase: "Abriendo Chrome, señor.",  scheme: "googlechrome://", https: "https://www.google.com" },
    clima:      { frase: "Aquí tiene el tiempo, señor.",   https: "https://www.google.com/search?q=el+tiempo+hoy" },
    netflix:    { frase: "Abriendo Netflix, señor.",   https: "https://www.netflix.com" },
    // Apps comunes (intenta la app y, si no está, cae a la web).
    discord:    { frase: "Abriendo Discord, señor.",   scheme: "discord://",    https: "https://discord.com/app" },
    instagram:  { frase: "Abriendo Instagram, señor.", scheme: "instagram://",  https: "https://instagram.com" },
    tiktok:     { frase: "Abriendo TikTok, señor.",    scheme: "snssdk1233://", https: "https://www.tiktok.com" },
    twitter:    { frase: "Abriendo X, señor.",         scheme: "twitter://",    https: "https://x.com" },
    reddit:     { frase: "Abriendo Reddit, señor.",    scheme: "reddit://",     https: "https://reddit.com" },
    twitch:     { frase: "Abriendo Twitch, señor.",    scheme: "twitch://",     https: "https://twitch.tv" },
    maps:       { frase: "Abriendo Maps, señor.",      scheme: "geo:0,0",       https: "https://maps.google.com" },
    mapas:      { frase: "Abriendo Maps, señor.",      scheme: "geo:0,0",       https: "https://maps.google.com" },
  };

  // Funciones solo-PC: no se pueden en el móvil. Mensaje honesto.
  var PC_ONLY = ["terminal", "cmd", "consola", "explorador", "archivos", "word", "excel",
                 "vs code", "vscode", "paint", "bloc de notas", "captura", "screenshot"];

  // ── Plataforma ──
  function isAndroid() { return /android/i.test(navigator.userAgent); }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  // Abre SOLO la app nativa en Android con un intent (sin browser_fallback_url → si no está
  // la app, el sistema avisa y NO abre la web). Es lo fiable en Android/MIUI.
  function openAndroidIntent(a) {
    // Lanza la app por su actividad LAUNCHER (MAIN) → abre la pantalla principal directamente.
    // (Con scheme+package, WhatsApp no resolvía y Android abría la Play Store.)
    var url = "intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=" + a.android + ";end";
    try { window.location.href = url; } catch (e) {}
  }

  // Última app abierta (para "vuelve a abrirlo").
  var lastAppKey = null;
  try { lastAppKey = localStorage.getItem("mm_last_app") || null; } catch (e) {}

  // Abre una URL/scheme. Para schemes (spotify:, tg:, whatsapp://) intenta el nativo y,
  // si tras un momento seguimos visibles (no se abrió la app), cae al https.
  function open(target, httpsFallback) {
    if (!target) return;
    var isScheme = !/^https?:/i.test(target);
    if (isScheme && httpsFallback) {
      var fell = false;
      function cleanup() {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("blur", mark);
        window.removeEventListener("pagehide", mark);
      }
      function mark() { fell = true; cleanup(); }              // la app se abrió → no caer a web
      var onVis = function () { if (document.hidden) mark(); };
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("blur", mark);
      window.addEventListener("pagehide", mark);
      try { window.location.href = target; }
      catch (e) { fell = true; cleanup(); try { window.location.href = httpsFallback; } catch (e2) {} }
      // Si tras 1.5s seguimos visibles (la app no se abrió), vamos a la web.
      setTimeout(function () {
        cleanup();
        if (!fell && !document.hidden) { try { window.location.href = httpsFallback; } catch (e) {} }
      }, 1500);
    } else {
      try { window.location.href = target; } catch (e) {}
    }
  }

  function openApp(key) {
    var a = APPS[key];
    if (!a) return null;
    if (a.appOnly) {
      // SOLO la app, nunca la web.
      if (isAndroid() && a.android) openAndroidIntent(a);   // intent (lo más fiable en Android/MIUI)
      else if (a.scheme) { try { window.location.href = a.scheme; } catch (e) {} }   // iOS u otros: scheme puro
    } else {
      open(a.scheme || a.https, a.https);
    }
    lastAppKey = key; try { localStorage.setItem("mm_last_app", key); } catch (e) {}
    return a.frase;
  }
  // Reabre la última app ("vuelve a abrirlo / otra vez").
  function reopenLast() {
    var k = lastAppKey || (function () { try { return localStorage.getItem("mm_last_app"); } catch (e) { return null; } })();
    return k ? openApp(k) : null;
  }
  function openNamed(key) {
    var n = NAMED[key];
    if (!n) return null;
    if (n.url) open(n.url);
    else open(n.scheme, n.https);
    return n.frase;
  }
  function searchMusic(q) {
    q = (q || "").trim();
    if (!q) return openApp("spotify");
    open("spotify:search:" + encodeURIComponent(q), "https://open.spotify.com/search/" + encodeURIComponent(q));
    return "Buscando " + q + " en Spotify, señor.";
  }
  function isPcOnly(text) {
    return PC_ONLY.some(function (w) { return text.indexOf(w) !== -1; });
  }

  window.Links = { open: open, openApp: openApp, openNamed: openNamed, searchMusic: searchMusic,
                   reopenLast: reopenLast, isPcOnly: isPcOnly, APPS: APPS, NAMED: NAMED, CLAP: NAMED.clap };
})();
