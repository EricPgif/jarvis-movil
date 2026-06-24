/* voice.js — Voz del navegador: STT (webkitSpeechRecognition) + TTS (speechSynthesis).
   STT no funciona en iPhone/Safari (limitación de Apple) → se avisa. Expone window.Voice. */
(function () {
  "use strict";

  // ── TTS ──
  var _voice = null, _unlocked = false;
  // Voz de JARVIS = MASCULINA en español (no la femenina por defecto). Best-effort por
  // nombre (varía según el móvil): prioriza es-ES masculina.
  var MALE = /(jorge|pablo|diego|enrique|carlos|miguel|alvaro|álvaro|male|hombre|masc)/i;
  function pickVoice() {
    try {
      var vs = speechSynthesis.getVoices() || [];
      var es = vs.filter(function (v) { return /^es/i.test(v.lang); });
      _voice =
        es.filter(function (v) { return /es[-_]ES/i.test(v.lang) && MALE.test(v.name); })[0] ||
        es.filter(function (v) { return MALE.test(v.name); })[0] ||
        es.filter(function (v) { return /es[-_]ES/i.test(v.lang); })[0] ||
        es[0] || vs[0] || null;
    } catch (e) {}
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  // Desbloquea el TTS en el primer gesto (necesario en móvil/iOS): tanto la voz del PC (Worker,
  // elemento <audio>) como la del sistema (speechSynthesis).
  function unlock() {
    try { if (window.PCVoice && window.PCVoice.unlock) window.PCVoice.unlock(); } catch (e) {}
    if (_unlocked || !("speechSynthesis" in window)) return;
    _unlocked = true;
    try { var u = new SpeechSynthesisUtterance(""); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  }

  function speakSystem(text, onstart, onend) {
    if (!text || !("speechSynthesis" in window)) { if (onend) onend(); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      if (_voice) u.voice = _voice;
      u.lang = (_voice && _voice.lang) || "es-ES";
      u.rate = 1.0; u.pitch = 1.0;   // respaldo natural (la voz buena la da edge-tts)
      u.onstart = function () { if (onstart) onstart(); };
      u.onend = function () { if (onend) onend(); };
      u.onerror = function () { if (onend) onend(); };
      speechSynthesis.speak(u);
    } catch (e) { if (onend) onend(); }
  }
  // Texto 'hablable': quita markdown/símbolos/CJK/emojis para que la voz NO los pronuncie
  // (no afecta a lo que se MUESTRA). Deja . , ? ! ¿ ¡ (el motor los hace pausa, no los dice).
  function cleanForTTS(text) {
    if (!text) return "";
    var t = String(text);
    t = t.replace(/```[\s\S]*?```/g, " ");                 // bloques de código
    t = t.replace(/`[^`]*`/g, " ");                         // código en línea
    t = t.replace(/https?:\/\/\S+/g, " ");                  // URLs
    t = t.replace(/J\.A\.R\.V\.I\.S\.?/g, "Jarvis");
    t = t.replace(/[#>*_~|^=]+/g, " ");                     // markdown que se pronuncia (asterisco…)
    t = t.replace(/[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/g, " ");  // CJK por si acaso
    try { t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu, " "); } catch (e) {} // emojis
    t = t.replace(/\s{2,}/g, " ").trim();
    return t;
  }
  function speak(text, onstart, onend) {
    if (!text) { if (onend) onend(); return; }
    cancel();
    var clean = cleanForTTS(text);
    if (!clean) { if (onend) onend(); return; }
    // 1) Voz del PC (es-ES-AlvaroNeural) por el Worker. Si falla ANTES de sonar → voz del sistema.
    if (window.PCVoice && window.PCVoice.available) {
      var begun = false;
      window.PCVoice.speak(clean, function () { begun = true; if (onstart) onstart(); }, onend)
        .catch(function () { if (!begun) speakSystem(clean, onstart, onend); else if (onend) onend(); });
      return;
    }
    speakSystem(clean, onstart, onend);
  }
  function cancel() {
    try { speechSynthesis.cancel(); } catch (e) {}
    try { if (window.PCVoice) window.PCVoice.stop(); } catch (e) {}
    try { if (window.EdgeTTS) window.EdgeTTS.stop(); } catch (e) {}
  }

  // ── STT ──
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false;
  var sttSupported = !!SR;
  if (SR) {
    rec = new SR();
    rec.lang = "es-ES"; rec.interimResults = false; rec.maxAlternatives = 1;
  }
  var _onResult = null, _onState = null, _onError = null, _guard = null;
  function clearGuard() { if (_guard) { clearTimeout(_guard); _guard = null; } }
  if (rec) {
    rec.onresult = function (e) {
      clearGuard();
      var t = e.results[0][0].transcript;
      listening = false; if (_onState) _onState(false);
      if (_onResult) _onResult(t);
    };
    rec.onend = function () { clearGuard(); listening = false; if (_onState) _onState(false); try { if (window.Clap) window.Clap.resume(); } catch (e) {} };
    rec.onerror = function (e) {
      clearGuard(); listening = false; if (_onState) _onState(false);
      if (_onError) _onError((e && e.error) || "error");
    };
  }

  function toggleListen(onResult, onState, onError) {
    _onResult = onResult; _onState = onState; _onError = onError;
    if (!rec) return { ok: false, reason: "no-stt" };
    if (listening) { try { rec.stop(); } catch (e) {} return { ok: true, stopped: true }; }
    cancel();
    try { if (window.Clap) window.Clap.pause(); } catch (e) {}   // suelta el micro de la palmada para poder escuchar
    try {
      rec.start(); listening = true; if (onState) onState(true);
      // Anti-cuelgue: si en 10 s no llega resultado ni fin (pasa en algunos móviles/PWA
      // instalada), forzamos parada y avisamos en vez de quedarnos colgados en verde.
      clearGuard();
      _guard = setTimeout(function () {
        if (!listening) return;
        try { rec.stop(); } catch (e) {}
        try { rec.abort(); } catch (e) {}
        listening = false; if (_onState) _onState(false);
        if (_onError) _onError("timeout");
      }, 10000);
      return { ok: true, started: true };
    } catch (e) { return { ok: false, reason: "start-failed" }; }
  }
  function stopListen() { if (rec && listening) { try { rec.stop(); } catch (e) {} } }
  function isListening() { return listening; }

  // ── Wake word "Jarvis" (escucha CONTINUA; solo se usa en Modo Super) ──
  var WSR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var wrec = null;
  if (WSR) { try { wrec = new WSR(); wrec.lang = "es-ES"; wrec.continuous = true; wrec.interimResults = true; wrec.maxAlternatives = 1; } catch (e) { wrec = null; } }
  var wakeOn = false, capturing = false, lastCmd = 0, _onCmd = null, _onWS = null;
  function wnorm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function wstart() { if (wakeOn && wrec) { try { wrec.start(); } catch (e) {} } }
  function fire(cmd) {
    cmd = (cmd || "").replace(/\bjarvis\b/gi, "").trim();
    var now = +new Date();
    if (!cmd || now - lastCmd < 1500) { capturing = false; if (_onWS) _onWS("idle"); return; }
    lastCmd = now; capturing = false;
    if (_onWS) _onWS("idle");
    if (_onCmd) _onCmd(cmd);
  }
  function startWake(onCommand, onState) {
    if (!wrec) { if (onState) onState("unsupported"); return false; }
    _onCmd = onCommand; _onWS = onState; wakeOn = true; capturing = false;
    try { if (window.Clap) window.Clap.pause(); } catch (e) {}   // el wake necesita el micro en exclusiva
    wrec.onresult = function (e) {
      var r = e.results[e.results.length - 1];
      var t = wnorm(r[0].transcript);
      if (capturing) { if (r.isFinal) fire(t); return; }       // ya en captura → la orden es esto
      var i = t.lastIndexOf("jarvis");
      if (i === -1) return;
      var after = t.slice(i + 6).trim();
      if (after.length >= 2) { if (r.isFinal) fire(after); }    // "jarvis abre spotify"
      else { capturing = true; if (_onWS) _onWS("listening"); } // solo "jarvis" → capturar la orden
    };
    wrec.onend = function () { if (wakeOn) setTimeout(wstart, 250); };   // Android corta solo → reiniciar
    wrec.onerror = function () { /* el onend reinicia */ };
    wstart();
    return true;
  }
  function stopWake() { wakeOn = false; capturing = false; if (wrec) { try { wrec.onend = null; wrec.onresult = null; wrec.abort(); } catch (e) {} } try { if (window.Clap) window.Clap.resume(); } catch (e) {} }
  function wakeCapture() { if (!wrec) return false; capturing = true; if (_onWS) _onWS("listening"); wstart(); return true; }  // clic esfera

  window.Voice = {
    speak: speak, cancel: cancel, unlock: unlock,
    toggleListen: toggleListen, stopListen: stopListen, isListening: isListening,
    sttSupported: sttSupported,
    startWake: startWake, stopWake: stopWake, wakeCapture: wakeCapture, wakeSupported: function () { return !!wrec; },
  };
})();
