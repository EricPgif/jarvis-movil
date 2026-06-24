/* api.js — Config (localStorage) + llamada DIRECTA a MiniMax (formato Anthropic).
   La API key vive SOLO en este móvil. Expone window.API y window.CFG. */
(function () {
  "use strict";

  var CFG = {
    get key()   { return localStorage.getItem("mm_key") || ""; },
    get base()  { return (localStorage.getItem("mm_base") || "https://api.minimax.io/anthropic").replace(/\/+$/, ""); },
    get model() { return localStorage.getItem("mm_model") || "MiniMax-M2"; },
    get clap()  { return localStorage.getItem("mm_clap") === "1"; },
    set clap(v) { localStorage.setItem("mm_clap", v ? "1" : "0"); },
  };

  var SYSTEM =
    "Eres J.A.R.V.I.S., el asistente personal de Eric, en español de España. " +
    "Educado (trátale de «señor»), inteligente y CONCISO. Te crearon Eric y Artur. " +
    "NO uses emojis. Responde directo y con naturalidad; el conocimiento general respóndelo " +
    "tú mismo (tu conocimiento llega hasta 2026). Estás en su móvil: puedes conversar, abrir " +
    "apps del teléfono y ayudar, pero no controlas su PC desde aquí.";

  // MEMORIA: el historial se GUARDA en el móvil (localStorage) y se restaura al abrir,
  // así JARVIS recuerda la conversación (tu nombre, tu color favorito…) como en el PC.
  function loadHist() {
    try { var h = JSON.parse(localStorage.getItem("mm_history") || "[]"); return Array.isArray(h) ? h : []; }
    catch (e) { return []; }
  }
  function saveHist() {
    try { localStorage.setItem("mm_history", JSON.stringify(history.slice(-30))); } catch (e) {}
  }
  var history = loadHist();   // [{role, content}]

  // ── Cerebro: personalidad brillante + natural, y CONTEXTO real de ahora ──
  var BASE_PROMPT = [
    "Eres J.A.R.V.I.S., el asistente personal de Eric (trátale de senor), en espanol de Espana.",
    "Te crearon Eric y Artur. Eres BRILLANTE, resolutivo y con clase, como el JARVIS de Iron Man:",
    "ingenioso, calido, seguro y siempre util.",
    "",
    "COMO RESPONDES:",
    "- Responde a CUALQUIER cosa con tu propio conocimiento, con seguridad y de forma util. NUNCA",
    "  digas solo 'no lo se': razona, explica, aconseja y da tu mejor respuesta como una IA de primer nivel.",
    "- Habla NATURAL y conversacional: charla, opina, bromea si encaja, da consejos. Sin relleno, pero",
    "  tampoco respuestas secas; el punto justo. Sin emojis. Espanol de Espana.",
    "- Escribe SIEMPRE en alfabeto latino. NUNCA uses caracteres chinos, japoneses ni coreanos.",
    "- NUNCA uses formato de herramientas, tool_call, invoke, parameter ni etiquetas XML/JSON; ni",
    "  «<minimax:tool_call>» ni nada parecido. Responde SOLO con texto natural para Eric. Si te piden",
    "  abrir una app o algo del móvil que no puedes ejecutar, dilo en una frase corta y natural.",
    "",
    "QUE PUEDES HACER EN ESTE MOVIL (dilo con naturalidad si viene a cuento):",
    "- Abrir apps del telefono: Spotify (musica), YouTube, WhatsApp, Telegram, correo, calendario,",
    "  navegador, camara. Si te piden 'pon musica' o 'abre X', se abre solo.",
    "- El control del PC (archivos, programas) necesita el JARVIS de escritorio; dilo sin drama.",
    "",
    "LIMITES: aqui no tienes internet en vivo, asi que para NOTICIAS DE HOY o datos en tiempo real",
    "avisalo con naturalidad y ofrece abrir una web; para todo lo demas responde TU con tu conocimiento.",
  ].join("\n");

  function buildSystem() {
    var n = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
    var dias = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];
    var meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    var ahora = dias[n.getDay()] + " " + n.getDate() + " de " + meses[n.getMonth()] + " de " + n.getFullYear() +
                ", " + p(n.getHours()) + ":" + p(n.getMinutes());
    var wx = "";
    try {
      var t = document.getElementById("wx-temp"), d = document.getElementById("wx-desc");
      if (t && t.textContent && t.textContent !== "--")
        wx = " Tiempo ahora donde esta el: " + t.textContent + " grados, " + (d ? d.textContent : "") + ".";
    } catch (e) {}
    var mem = "";
    try { if (window.Mem && window.Mem.block) { var b = window.Mem.block(); if (b) mem = "\n\n" + b; } } catch (e) {}
    return BASE_PROMPT + "\n\nCONTEXTO REAL DE AHORA MISMO: es " + ahora + "." + wx +
           " Usa estos datos cuando pregunte por la fecha, la hora o el tiempo (no inventes fechas)." + mem;
  }

  function askMiniMax(userText) {
    var key = CFG.key;
    if (!key) return Promise.reject(new Error("sin key"));
    history.push({ role: "user", content: userText });
    if (history.length > 30) history = history.slice(-30);
    var payload = {
      model: CFG.model, max_tokens: 1536, temperature: 0.55,
      system: buildSystem(), thinking: { type: "disabled" }, messages: history,
    };
    var ctrl, to;
    try { ctrl = new AbortController(); to = setTimeout(function () { ctrl.abort(); }, 45000); } catch (e) {}
    return fetch(CFG.base + "/v1/messages", {
      method: "POST",
      // SOLO estas dos cabeceras: el CORS de MiniMax bloquea x-api-key y anthropic-version.
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify(payload),
      signal: ctrl && ctrl.signal,
    }).then(function (r) {
      if (to) clearTimeout(to);
      return r.json().then(function (data) {
        if (!r.ok || data.error) {
          var msg = (data && data.error && (data.error.message || data.error)) || ("HTTP " + r.status);
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
        var txt = "";
        (data.content || []).forEach(function (bl) { if (bl && bl.type === "text") txt += (bl.text || ""); });
        txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
        // MiniMax-M2 a veces intenta "tool calls" (aún NO soportados aquí) y los suelta como TEXTO
        // (el "código raro": <minimax:tool_call><invoke ...>). Si pidió abrir una app, la abrimos de
        // verdad; y SIEMPRE limpiamos ese markup para que NO se vea nunca.
        try {
          var iv = txt.match(/open_app[\s\S]*?name\s*=\s*["']?(?:app|name)["']?\s*>\s*([^<]+?)\s*<\/parameter>/i);
          if (iv && window.Links && window.Links.openApp) {
            var said = window.Links.openApp(iv[1].trim().toLowerCase());
            if (said) txt = said;
          }
        } catch (e) {}
        txt = txt.replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/gi, "");
        txt = txt.replace(/<invoke\b[\s\S]*?<\/invoke>/gi, "");
        txt = txt.replace(/<parameter\b[\s\S]*?<\/parameter>/gi, "");
        txt = txt.replace(/<\/?(?:minimax:)?(?:tool_call|invoke|parameter)\b[^>]*>/gi, "");
        // MiniMax a veces cuela caracteres chinos/japoneses/coreanos aunque hable español → fuera.
        txt = txt.replace(/[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/g, "");
        txt = txt.replace(/[ \t]{2,}/g, " ").trim();
        if (!txt) txt = "A su servicio, señor.";   // si solo había markup, no dejes el globo vacío
        history.push({ role: "assistant", content: txt });
        saveHist();   // recordar la conversación (memoria)
        return txt;
      });
    }).catch(function (err) {
      if (to) clearTimeout(to);
      if (err && err.name === "AbortError") throw new Error("La respuesta tardó demasiado, señor. Inténtelo de nuevo.");
      throw err;
    });
  }

  // Añade al historial un intercambio resuelto LOCALMENTE (deep links, Modo Super…), para que
  // MiniMax tenga contexto en lo siguiente ("abre WhatsApp" → "vuelve a abrirlo").
  function addExchange(userText, assistantText) {
    if (!userText) return;
    history.push({ role: "user", content: String(userText) });
    history.push({ role: "assistant", content: String(assistantText || "") });
    if (history.length > 30) history = history.slice(-30);
    saveHist();
  }

  window.CFG = CFG;
  window.API = {
    askMiniMax: askMiniMax, SYSTEM: SYSTEM, addExchange: addExchange,
    getHistory: function () { return history.slice(); },     // para mostrar el chat pasado
    clearHistory: function () { history = []; try { localStorage.removeItem("mm_history"); } catch (e) {} },
  };
})();
