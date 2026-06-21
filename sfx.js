/* sfx.js — Sonidos de interfaz (Web Audio, sin archivos), portado del JARVIS de PC.
   tick/tap (toques), place (apps colocándose en la intro), whoosh (transición),
   chord (acorde de arranque). Silenciable y persistente. Expone window.sfx. */
(function () {
  "use strict";
  var ctx = null, enabled = true;
  try { var s = localStorage.getItem("jarvis_sfx"); if (s !== null) enabled = s === "1"; } catch (e) {}

  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function tone(freq, dur, type, gain, when) {
    var c = ac(); if (!c) return;
    var t0 = when || c.currentTime;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function noiseSweep(dur, f0, f1, gain) {
    var c = ac(); if (!c) return;
    var n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
    var t0 = c.currentTime;
    bp.frequency.setValueAtTime(f0 || 300, t0);
    bp.frequency.exponentialRampToValueAtTime(f1 || 2200, t0 + dur);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  var sfx = {
    get enabled() { return enabled; },
    setEnabled: function (v) { enabled = !!v; try { localStorage.setItem("jarvis_sfx", enabled ? "1" : "0"); } catch (e) {} if (enabled) ac(); },
    unlock: function () { try { ac(); } catch (e) {} },
    tap: function ()  { if (enabled) tone(520 + Math.random() * 80, 0.04, "triangle", 0.05); },   // toque UI
    tick: function () { if (enabled) tone(640 + Math.random() * 120, 0.05, "square", 0.05); },
    place: function (i) {  // app colocándose en la intro (pitch sube con el índice → "subida")
      if (!enabled) return;
      var f = 360 + (i || 0) * 28;
      tone(f, 0.07, "triangle", 0.08);
      tone(f * 2, 0.05, "sine", 0.04);
    },
    beep: function ()  { if (enabled) tone(880, 0.12, "sine", 0.15); },
    whoosh: function () { if (enabled) noiseSweep(0.5, 200, 2600, 0.10); },
    chord: function () {
      if (!enabled) return;
      var c = ac(); if (!c) return; var base = c.currentTime;
      [392.0, 523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, 0.9, "sine", 0.09, base + i * 0.06); });
      noiseSweep(0.6, 400, 3000, 0.06);
    },
  };
  window.sfx = sfx;
})();
