/* router.js — Enruta lo que dices/escribes: ¿acción local (abrir app) o chat MiniMax?
   Espejo reducido de _local_parse del escritorio, solo con lo posible en un móvil.
   Expone window.Router. Devuelve {handled, say} o {handled:false} (→ va a MiniMax). */
(function () {
  "use strict";

  var DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");   // tildes/acentos combinantes
  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
  }

  // Cada regla: {re, run(textNorm, matches) -> frase hablable | null}.
  // Se prueban EN ORDEN; la primera que casa gana.
  var RULES = [
    // Modo Super
    { re: /\b(activa|entra|abre|pon|modo)\s+(el\s+)?(modo\s+)?super\b/,
      run: function () { if (window.Super) window.Super.show(); return "Activando el modo Super, señor."; } },
    { re: /\b(sal|salir|cierra|quita|desactiva)\s+(del\s+)?(modo\s+)?super\b/,
      run: function () { if (window.Super) window.Super.hide(); return "Saliendo del modo Super, señor."; } },

    // Reabrir la última app ("vuelve a abrirlo / ábrelo otra vez"). ANTES de la regla genérica "abre".
    { re: /(vuelve a abrir|reabr[ae]|abrelo|abre lo|abrir (?:de nuevo|otra vez))/,
      run: function () { return window.Links.reopenLast() || "No recuerdo qué abrir, señor. Dígame qué app."; } },

    // Disparadores con nombre (Dexter / Brian / Rita / Cristina)
    { re: /\bdexter\b/,        run: function () { return window.Links.openNamed("dexter"); } },
    { re: /\b(brian|brayan)\b/, run: function () { return window.Links.openNamed("brian"); } },
    { re: /\brita\b/,          run: function () { return window.Links.openNamed("rita"); } },
    { re: /\bcristina\b/,      run: function () { return window.Links.openNamed("cristina"); } },

    // Poner música de X (antes que "abre" para captar "pon música de ...")
    { re: /\b(?:pon|ponme|reproduce|escuchar?)\s+(?:musica|la\s+cancion|cancion|tema)\s+(?:de\s+|del\s+)?(.+)/,
      run: function (t, m) { return window.Links.searchMusic(m[1]); } },
    { re: /\bbuenos dias\b/,   run: function () { return window.Links.searchMusic("música clásica"); } },

    // Abrir apps por nombre. OJO: "lanza"/"ejecuta" quitados (que "lanza 2 agentes" NO abra una app)
    // y "videos?" quitado (que "hazme un vídeo" NO abra YouTube). La creación se intercepta antes.
    { re: /\b(abre|abrir|abreme|ponme)\b/,
      run: function (t) {
        var keys = Object.keys(window.Links.APPS);
        for (var i = 0; i < keys.length; i++) { if (t.indexOf(keys[i]) !== -1) return window.Links.openApp(keys[i]); }
        if (/\bmusica\b|\bspotify\b/.test(t)) return window.Links.openApp("spotify");
        if (/\byoutube\b/.test(t)) return window.Links.openApp("youtube");
        return null;   // "abre <algo>" desconocido → cae a MiniMax / PC-only
      } },
  ];

  function routeCommand(rawText) {
    var t = norm(rawText);
    if (!t) return { handled: false };

    // Funciones solo-PC: aviso honesto, sin ir a MiniMax.
    if (window.Links.isPcOnly(t) && /\b(abre|abrir|pon|lanza|ejecuta|terminal|cmd|consola)\b/.test(t)) {
      return { handled: true, say: "Eso necesita el JARVIS de escritorio, señor; aquí en el móvil no puedo." };
    }

    for (var i = 0; i < RULES.length; i++) {
      var m = t.match(RULES[i].re);
      if (m) {
        try {
          var say = RULES[i].run(t, m);
          if (say) return { handled: true, say: say };
        } catch (e) { /* si una regla falla, caemos a MiniMax */ }
      }
    }
    return { handled: false };
  }

  window.Router = { routeCommand: routeCommand, norm: norm };
})();
