/* pcvoice.js — Voz del PC (es-ES-AlvaroNeural) vía el Cloudflare Worker de TTS.
   Pide el MP3 al Worker y lo reproduce. Es la MISMA voz que el JARVIS del PC; si falla,
   voice.js usa la voz del sistema. Expone window.PCVoice.

   CLAVE en móvil: el navegador bloquea reproducir audio si pasó tiempo desde tu último toque
   (la respuesta tarda unos segundos). Solución: UN solo elemento <audio> que se DESBLOQUEA en
   el primer gesto (play silencioso) y se REUTILIZA — así suena aunque la respuesta llegue tarde. */
(function () {
  "use strict";
  // Worker de Eric ya desplegado: voz AlvaroNeural por defecto, sin pegar nada.
  var DEFAULT_WORKER = "https://rapid-sky-2af7.ericponceal.workers.dev";
  function base() {
    var saved = (localStorage.getItem("mm_tts_worker") || "").trim();
    return (saved || DEFAULT_WORKER).replace(/\/+$/, "");
  }

  // WAV silencioso mínimo (para desbloquear el elemento con un gesto del usuario).
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
  var audio = null, unlocked = false, curUrl = null;

  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.setAttribute("playsinline", "");   // iOS: no abrir pantalla completa
    }
    return audio;
  }
  function freeUrl() { if (curUrl) { try { URL.revokeObjectURL(curUrl); } catch (e) {} curUrl = null; } }

  var PC = {
    get available() { return !!base(); },
    // Desbloquea el audio en un gesto del usuario (toque/click). Idempotente.
    unlock: function () {
      if (unlocked) return;
      try {
        var a = ensureAudio();
        a.muted = true; a.src = SILENT;
        var p = a.play();
        if (p && p.then) p.then(function () { try { a.pause(); a.currentTime = 0; } catch (e) {} a.muted = false; unlocked = true; })
                           .catch(function () { a.muted = false; });
        else { unlocked = true; a.muted = false; }
      } catch (e) {}
    },
    stop: function () {
      try { if (audio) { audio.pause(); } } catch (e) {}
      freeUrl();
    },
    // speak(text, onstart, onend) → Promise (rechaza si NO suena → voice.js cae a la voz del sistema).
    speak: function (text, onstart, onend) {
      var b = base();
      if (!b) return Promise.reject(new Error("sin worker"));
      var u = b + "/tts?voice=es-ES-AlvaroNeural&text=" + encodeURIComponent(text);
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error("tts " + r.status);
        return r.blob();
      }).then(function (blob) {
        return new Promise(function (resolve, reject) {
          var a = ensureAudio();
          try { a.pause(); } catch (e) {}
          freeUrl();
          curUrl = URL.createObjectURL(blob);
          a.muted = false;
          a.onplay = function () { if (onstart) onstart(); };
          a.onended = function () { freeUrl(); if (onend) onend(); resolve(); };
          a.onerror = function () { freeUrl(); reject(new Error("audio")); };
          a.src = curUrl;
          var p = a.play();
          if (p && p.catch) p.catch(function (err) {
            // Reproducción bloqueada (gesto caducado) → que voice.js use la voz del sistema.
            freeUrl(); reject(err || new Error("blocked"));
          });
        });
      });
    },
  };
  window.PCVoice = PC;
})();
