/* clap.js — Doble palmada con Web Audio API (opt-in en Ajustes).
   Detecta DOS transitorios fuertes y cortos (palmadas) con silencio entre ellos,
   0.15–0.95 s aparte → abre música (spotify:track de "Tony Stark", de memory.json).
   Se pausa mientras el dictado (STT) usa el micro y cuando la app está en background.
   Expone window.Clap. */
(function () {
  "use strict";

  var ctx = null, stream = null, analyser = null, buf = null, raf = 0, running = false;
  var lastPeak = 0, prevQuiet = true, peaks = [], cooldown = 0;

  // Umbrales (escala Web Audio 0–1). Recalibrables si hace falta.
  var THRESH = 0.16;      // pico de palmada
  var QUIET = 0.05;       // silencio entre palmadas (para exigir transitorio)
  var MIN_GAP = 150;      // ms mínimos entre dos palmadas
  var MAX_GAP = 950;      // ms máximos
  var REPEAT_GUARD = 120; // ms para no contar la misma palmada dos veces

  function rmsNow() {
    analyser.getFloatTimeDomainData(buf);
    var s = 0;
    for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    // No interferir con el dictado ni gastar en background.
    if (document.hidden || (window.Voice && window.Voice.isListening())) return;
    var now = (window.performance && performance.now) ? performance.now() : new Date().getTime();
    if (now < cooldown) return;
    var rms = rmsNow();
    if (rms > THRESH && prevQuiet && (now - lastPeak) > REPEAT_GUARD) {
      lastPeak = now; prevQuiet = false;
      peaks.push(now);
      peaks = peaks.filter(function (t) { return now - t <= MAX_GAP + 50; });
      // ¿dos palmadas con separación válida?
      for (var i = peaks.length - 2; i >= 0; i--) {
        var gap = now - peaks[i];
        if (gap >= MIN_GAP && gap <= MAX_GAP) { trigger(); break; }
      }
    } else if (rms < QUIET) {
      prevQuiet = true;   // hubo silencio → la próxima subida cuenta como nueva palmada
    }
  }

  function trigger() {
    peaks = []; prevQuiet = true;
    var now = (window.performance && performance.now) ? performance.now() : new Date().getTime();
    cooldown = now + 1600;
    try { if (window.Voice) window.Voice.unlock(); } catch (e) {}
    var say = window.Links.openNamed("clap");
    if (say && window.APP) { window.APP.addMsg("👏👏 " + say, "jv"); window.APP.speak(say); }
  }

  function start() {
    if (running) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (window.APP) window.APP.addMsg("Tu navegador no permite escuchar palmadas, señor.", "sys");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }).then(function (s) {
      stream = s;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      var src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      buf = new Float32Array(analyser.fftSize);
      src.connect(analyser);
      running = true; peaks = []; prevQuiet = true;
      loop();
      if (window.APP) window.APP.addMsg("Escucha de palmadas activada, señor. 👏👏 = música.", "sys");
    }).catch(function () {
      if (window.APP) window.APP.addMsg("Necesito permiso de micrófono para las palmadas, señor.", "sys");
    });
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
  }

  window.Clap = { start: start, stop: stop, isRunning: function () { return running; } };
})();
