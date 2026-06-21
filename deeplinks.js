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
    whatsapp:   { frase: "Abriendo WhatsApp, señor.",  scheme: "whatsapp://",              https: "https://web.whatsapp.com" },
    telegram:   { frase: "Abriendo Telegram, señor.",  scheme: "tg://",                    https: "https://web.telegram.org" },
    gmail:      { frase: "Abriendo el correo, señor.", https: "https://mail.google.com" },
    correo:     { frase: "Abriendo el correo, señor.", https: "https://mail.google.com" },
    calendario: { frase: "Abriendo tu calendario, señor.", https: "https://calendar.google.com" },
    navegador:  { frase: "Abriendo el navegador, señor.",  https: "https://www.google.com" },
    chrome:     { frase: "Abriendo el navegador, señor.",  https: "https://www.google.com" },
    clima:      { frase: "Aquí tiene el tiempo, señor.",   https: "https://www.google.com/search?q=el+tiempo+hoy" },
    netflix:    { frase: "Abriendo Netflix, señor.",   https: "https://www.netflix.com" },
  };

  // Funciones solo-PC: no se pueden en el móvil. Mensaje honesto.
  var PC_ONLY = ["terminal", "cmd", "consola", "explorador", "archivos", "word", "excel",
                 "vs code", "vscode", "paint", "bloc de notas", "captura", "screenshot"];

  // Abre una URL/scheme. Para schemes (spotify:, tg:, whatsapp://) intenta el nativo y,
  // si tras un momento seguimos visibles (no se abrió la app), cae al https.
  function open(target, httpsFallback) {
    if (!target) return;
    var isScheme = !/^https?:/i.test(target);
    if (isScheme && httpsFallback) {
      var fell = false;
      var onVis = function () {
        if (document.hidden) { fell = true; document.removeEventListener("visibilitychange", onVis); }
      };
      document.addEventListener("visibilitychange", onVis);
      try { window.location.href = target; }
      catch (e) { fell = true; try { window.location.href = httpsFallback; } catch (e2) {} }
      // Si la app NO se abrió (seguimos visibles) tras ~1.1s, vamos a la web.
      setTimeout(function () {
        document.removeEventListener("visibilitychange", onVis);
        if (!fell && !document.hidden) { fell = true; try { window.location.href = httpsFallback; } catch (e) {} }
      }, 1100);
    } else {
      try { window.location.href = target; } catch (e) {}
    }
  }

  function openApp(key) {
    var a = APPS[key];
    if (!a) return null;
    open(a.scheme || a.https, a.https);
    return a.frase;
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
                   isPcOnly: isPcOnly, APPS: APPS, NAMED: NAMED, CLAP: NAMED.clap };
})();
