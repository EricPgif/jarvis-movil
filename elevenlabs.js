/* elevenlabs.js — Voz PREMIUM opcional (ElevenLabs). Voz tipo mayordomo británico con clase.
   Solo se usa si Eric mete su API key de ElevenLabs en Ajustes. Por defecto JARVIS usa la voz
   gratis e ilimitada (AlvaroNeural por el Worker). Plan Free de ElevenLabs ≈ 10.000 caracteres/mes.
   La key vive SOLO en este móvil (localStorage). Mismo contrato que PCVoice/EdgeTTS: speak/stop/unlock.
   Expone window.ElevenTTS. */
(function () {
  "use strict";
  var BASE = "https://api.elevenlabs.io/v1/text-to-speech/";
  // Voces (modelo multilingüe, hablan español manteniendo su timbre): George (británico cálido,
  // por defecto) y Daniel (británico autoritario). Configurable en Ajustes.
  var VOICES = { george: "JBFqnCBsd6RMkjVDRZzb", daniel: "onwK4e9ZLuTAKqWW03F9" };

  var _audio = null, _unlocked = false;
  function key()   { try { return (localStorage.getItem("el_key") || "").trim(); } catch (e) { return ""; } }
  function voice() { try { return localStorage.getItem("el_voice") || VOICES.george; } catch (e) { return VOICES.george; } }
  function enabled() { try { return localStorage.getItem("el_on") === "1"; } catch (e) { return false; } }
  function available() { return !!key(); }

  // Desbloquea el <audio> en el primer gesto (móvil): un audio persistente que ya puede sonar.
  function unlock() {
    if (_unlocked) return;
    try {
      _audio = _audio || new Audio();
      _audio.muted = true;
      _audio.play().then(function () { _audio.pause(); _audio.muted = false; _unlocked = true; })
        .catch(function () { _audio.muted = false; });
    } catch (e) {}
  }
  function stop() { try { if (_audio) { _audio.pause(); } } catch (e) {} }

  // speak(text,onstart,onend) → Promise. Lanza si falla (para que voice.js caiga a Edge/sistema).
  function speak(text, onstart, onend) {
    stop();
    var k = key();
    if (!k) return Promise.reject(new Error("sin key ElevenLabs"));
    return fetch(BASE + voice() + "?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": k, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text: String(text),
        model_id: "eleven_multilingual_v2",
        language_code: "es",
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true }
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("ElevenLabs HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        _audio = _audio || new Audio();
        _audio.src = url;
        _audio.onplay = function () { if (onstart) onstart(); };
        _audio.onended = function () { try { URL.revokeObjectURL(url); } catch (e) {} if (onend) onend(); resolve(); };
        _audio.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) {} reject(new Error("play error")); };
        _audio.play().catch(reject);
      });
    });
  }
  function test() { return speak("Hola, señor. Soy Jarvis, esta es mi voz premium.", null, function () {}).then(function () { return true; }); }

  window.ElevenTTS = {
    speak: speak, stop: stop, unlock: unlock, test: test,
    available: available, enabled: enabled, VOICES: VOICES,
  };
})();
