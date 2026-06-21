/* voice.js — Voz del navegador: STT (webkitSpeechRecognition) + TTS (speechSynthesis).
   STT no funciona en iPhone/Safari (limitación de Apple) → se avisa. Expone window.Voice. */
(function () {
  "use strict";

  // ── TTS ──
  var _voice = null, _unlocked = false;
  function pickVoice() {
    try {
      var vs = speechSynthesis.getVoices() || [];
      _voice = vs.filter(function (v) { return /^es/i.test(v.lang); })[0] || vs[0] || null;
    } catch (e) {}
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  // Desbloquea el TTS en el primer gesto (necesario en iOS).
  function unlock() {
    if (_unlocked || !("speechSynthesis" in window)) return;
    _unlocked = true;
    try { var u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  }

  function speak(text, onstart, onend) {
    if (!text || !("speechSynthesis" in window)) { if (onend) onend(); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/J\.A\.R\.V\.I\.S\.?/g, "Jarvis"));
      if (_voice) u.voice = _voice;
      u.lang = (_voice && _voice.lang) || "es-ES";
      u.rate = 1.0; u.pitch = 1.0;
      u.onstart = function () { if (onstart) onstart(); };
      u.onend = function () { if (onend) onend(); };
      u.onerror = function () { if (onend) onend(); };
      speechSynthesis.speak(u);
    } catch (e) { if (onend) onend(); }
  }
  function cancel() { try { speechSynthesis.cancel(); } catch (e) {} }

  // ── STT ──
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false;
  var sttSupported = !!SR;
  if (SR) {
    rec = new SR();
    rec.lang = "es-ES"; rec.interimResults = false; rec.maxAlternatives = 1;
  }
  var _onResult = null, _onState = null, _onError = null;
  if (rec) {
    rec.onresult = function (e) {
      var t = e.results[0][0].transcript;
      listening = false; if (_onState) _onState(false);
      if (_onResult) _onResult(t);
    };
    rec.onend = function () { listening = false; if (_onState) _onState(false); };
    rec.onerror = function (e) {
      listening = false; if (_onState) _onState(false);
      if (_onError) _onError((e && e.error) || "error");
    };
  }

  function toggleListen(onResult, onState, onError) {
    _onResult = onResult; _onState = onState; _onError = onError;
    if (!rec) return { ok: false, reason: "no-stt" };
    if (listening) { try { rec.stop(); } catch (e) {} return { ok: true, stopped: true }; }
    cancel();
    try { rec.start(); listening = true; if (onState) onState(true); return { ok: true, started: true }; }
    catch (e) { return { ok: false, reason: "start-failed" }; }
  }
  function stopListen() { if (rec && listening) { try { rec.stop(); } catch (e) {} } }
  function isListening() { return listening; }

  window.Voice = {
    speak: speak, cancel: cancel, unlock: unlock,
    toggleListen: toggleListen, stopListen: stopListen, isListening: isListening,
    sttSupported: sttSupported,
  };
})();
