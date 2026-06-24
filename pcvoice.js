/* pcvoice.js — Voz del PC (es-ES-AlvaroNeural) vía el Cloudflare Worker de TTS.
   Si hay URL del Worker configurada (Ajustes), pide el MP3 y lo reproduce. Es la MISMA
   voz que el JARVIS del PC. Si falla, voice.js usa la voz del sistema. Expone window.PCVoice. */
(function () {
  "use strict";
  function base() { return (localStorage.getItem("mm_tts_worker") || "").replace(/\/+$/, ""); }
  var audio = null;

  var PC = {
    get available() { return !!base(); },
    stop: function () {
      try { if (audio) { audio.pause(); audio.src = ""; audio.load(); audio = null; } } catch (e) {}
    },
    // speak(text, onstart, onend) → Promise (rechaza si no suena, para caer a la voz del sistema)
    speak: function (text, onstart, onend) {
      var b = base();
      if (!b) return Promise.reject(new Error("sin worker"));
      var u = b + "/tts?voice=es-ES-AlvaroNeural&text=" + encodeURIComponent(text);
      return fetch(u).then(function (r) {
        if (!r.ok) throw new Error("tts " + r.status);
        return r.blob();
      }).then(function (blob) {
        return new Promise(function (resolve, reject) {
          PC.stop();
          var src = URL.createObjectURL(blob);
          audio = new Audio(src);
          audio.onplay = function () { if (onstart) onstart(); };
          audio.onended = function () { try { URL.revokeObjectURL(src); } catch (e) {} if (onend) onend(); resolve(); };
          audio.onerror = function () { try { URL.revokeObjectURL(src); } catch (e) {} reject(new Error("audio")); };
          var p = audio.play();
          if (p && p.catch) p.catch(reject);
        });
      });
    },
  };
  window.PCVoice = PC;
})();
