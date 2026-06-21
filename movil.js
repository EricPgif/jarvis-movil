/* J.A.R.V.I.S móvil — standalone (PC apagado).
   Habla DIRECTO con MiniMax (que está en la nube) desde el navegador del móvil.
   La API key se guarda SOLO en este móvil (localStorage), nunca en el código. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // ── Config (localStorage) ──
  var CFG = {
    get key()   { return localStorage.getItem("mm_key") || ""; },
    get base()  { return (localStorage.getItem("mm_base") || "https://api.minimax.io/anthropic").replace(/\/+$/, ""); },
    get model() { return localStorage.getItem("mm_model") || "MiniMax-M2"; },
  };

  var SYSTEM = "Eres J.A.R.V.I.S., el asistente personal de Eric, en español de España. " +
    "Educado (trátale de «señor»), inteligente y CONCISO. Te crearon Eric y Artur. " +
    "NO uses emojis. Responde directo y con naturalidad; el conocimiento general respóndelo " +
    "tú mismo (tu conocimiento llega hasta 2026). Estás en su móvil: puedes conversar y " +
    "ayudar, pero no controlas su PC desde aquí.";

  var history = [];           // [{role:'user'|'assistant', content:'...'}]
  var busy = false;

  // ── UI helpers ──
  function addMsg(text, cls) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    d.textContent = text;
    var log = $("log");
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function setState(s) {            // '', 'listening', 'speaking', 'thinking'
    document.body.classList.remove("sp-listening", "sp-speaking");
    if (s === "listening") document.body.classList.add("sp-listening");
    if (s === "speaking") document.body.classList.add("sp-speaking");
    $("status").textContent =
      s === "listening" ? "ESCUCHANDO" : s === "speaking" ? "HABLANDO" : s === "thinking" ? "PROCESANDO…" : "EN LÍNEA";
  }

  // ── Llamada DIRECTA a MiniMax (formato Anthropic, igual que jarvis_minimax.py) ──
  function askMiniMax(userText) {
    var key = CFG.key;
    if (!key) { openSettings(); return Promise.reject(new Error("sin key")); }
    history.push({ role: "user", content: userText });
    if (history.length > 16) history = history.slice(-16);
    var payload = {
      model: CFG.model,
      max_tokens: 1024,
      temperature: 0.4,
      system: SYSTEM,
      thinking: { type: "disabled" },   // M2 razona y gasta tokens → lo desactivamos
      messages: history,
    };
    return fetch(CFG.base + "/v1/messages", {
      method: "POST",
      headers: {
        // SOLO estas dos: el CORS de MiniMax no permite x-api-key ni anthropic-version
        // como cabeceras del navegador (el preflight las bloquearía → "Failed to fetch").
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
      },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok || data.error) {
          var msg = (data && data.error && (data.error.message || data.error)) || ("HTTP " + r.status);
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        var txt = "";
        (data.content || []).forEach(function (b) { if (b && b.type === "text") txt += (b.text || ""); });
        txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").trim();
        history.push({ role: "assistant", content: txt });
        return txt;
      });
    });
  }

  // ── Enviar (texto o voz) ──
  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    busy = true;
    addMsg(text, "me");
    $("text").value = "";
    setState("thinking");
    var thinking = addMsg("…", "jv");
    askMiniMax(text).then(function (reply) {
      thinking.textContent = reply || "(sin respuesta)";
      $("log").scrollTop = $("log").scrollHeight;
      busy = false;
      speak(reply);
    }).catch(function (e) {
      thinking.textContent = "Error: " + (e.message || e);
      thinking.classList.add("sys");
      busy = false;
      setState("");
    });
  }

  // ── TTS (voz del navegador) ──
  var _voice = null;
  function pickVoice() {
    try {
      var vs = speechSynthesis.getVoices() || [];
      _voice = vs.filter(function (v) { return /^es/i.test(v.lang); })[0] || vs[0] || null;
    } catch (e) {}
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!text || !("speechSynthesis" in window)) { setState(""); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      if (_voice) u.voice = _voice;
      u.lang = (_voice && _voice.lang) || "es-ES";
      u.rate = 1.0; u.pitch = 1.0;
      u.onstart = function () { setState("speaking"); };
      u.onend = function () { setState(""); };
      u.onerror = function () { setState(""); };
      speechSynthesis.speak(u);
    } catch (e) { setState(""); }
  }

  // ── STT (voz del navegador) ──
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false;
  if (SR) {
    rec = new SR();
    rec.lang = "es-ES";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = function (e) {
      var t = e.results[0][0].transcript;
      listening = false; $("mic").classList.remove("on");
      send(t);
    };
    rec.onend = function () { listening = false; $("mic").classList.remove("on"); if (!busy) setState(""); };
    rec.onerror = function (e) { listening = false; $("mic").classList.remove("on"); setState(""); };
  }
  function toggleMic() {
    if (!rec) { addMsg("Tu navegador no soporta dictado por voz; escribe el mensaje.", "sys"); return; }
    if (listening) { try { rec.stop(); } catch (e) {} return; }
    try { speechSynthesis.cancel(); } catch (e) {}
    try { rec.start(); listening = true; $("mic").classList.add("on"); setState("listening"); } catch (e) {}
  }

  // ── Ajustes (key) ──
  function openSettings() {
    $("cfg-key").value = CFG.key;
    $("cfg-base").value = CFG.base;
    $("cfg-model").value = CFG.model;
    $("modal").classList.add("show");
  }
  function closeSettings() { $("modal").classList.remove("show"); }
  function saveSettings() {
    var k = $("cfg-key").value.trim();
    localStorage.setItem("mm_key", k);
    localStorage.setItem("mm_base", ($("cfg-base").value.trim() || "https://api.minimax.io/anthropic"));
    localStorage.setItem("mm_model", ($("cfg-model").value.trim() || "MiniMax-M2"));
    closeSettings();
    if (k) addMsg("Listo, señor. Configuración guardada. ¿En qué puedo ayudarle?", "jv");
  }

  // ── Wire ──
  $("send").addEventListener("click", function () { send($("text").value); });
  $("text").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); send($("text").value); } });
  $("mic").addEventListener("click", toggleMic);
  $("gear").addEventListener("click", openSettings);
  $("cfg-cancel").addEventListener("click", closeSettings);
  $("cfg-save").addEventListener("click", saveSettings);

  // ── Arranque ──
  if (!CFG.key) {
    addMsg("Bienvenido, señor. Pulse el engranaje ⚙ e introduzca su API key de MiniMax para empezar.", "jv");
    openSettings();
  } else {
    addMsg("J.A.R.V.I.S. a su servicio, señor. Hábleme o escriba.", "jv");
  }

  // ── PWA service worker ──
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
