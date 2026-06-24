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

  // ── CONVERSACIONES: varias, con nombre (como en Claude). Cada una con su historial. Los HECHOS
  //    sobre Eric ([[Mem]], mm_facts) son GLOBALES: no se pierden al cambiar de conversación. ──
  function genId() { return "c" + Math.random().toString(36).slice(2, 9); }
  function loadStore() {
    try {
      var raw = JSON.parse(localStorage.getItem("mm_convos") || "null");
      if (raw && raw.convos && raw.convos.length) return raw;
    } catch (e) {}
    // Migración del historial único antiguo (mm_history) → primera conversación.
    var old = [];
    try { var h = JSON.parse(localStorage.getItem("mm_history") || "[]"); if (h && h.length) old = h; } catch (e) {}
    var id = genId();
    return { active: id, convos: [{ id: id, name: "Chat principal", history: old }] };
  }
  var STORE = loadStore();
  function saveStore() { try { localStorage.setItem("mm_convos", JSON.stringify(STORE)); } catch (e) {} }
  function active() {
    for (var i = 0; i < STORE.convos.length; i++) if (STORE.convos[i].id === STORE.active) return STORE.convos[i];
    STORE.active = STORE.convos[0].id; return STORE.convos[0];
  }
  function H() { return active().history; }          // historial de la conversación ACTIVA
  function saveHist() {                              // recorta a 30 EN SITIO (mantiene referencia) + guarda
    var c = active();
    if (c.history.length > 30) c.history.splice(0, c.history.length - 30);
    saveStore();
  }

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
    "BUSQUEDA WEB: TIENES una herramienta de busqueda (web_search). Cuando te pregunten por algo",
    "RECIENTE, noticias, eventos, un youtuber/personaje y que le ha pasado, datos en tiempo real, o",
    "algo que no sepas con certeza, USALA TU MISMO directamente: NO pidas permiso, NO digas que no",
    "tienes internet, NO ofrezcas 'abrir el navegador'. Busca y responde con lo que encuentres,",
    "citando la fuente brevemente. Para lo que ya sabes de sobra, responde sin buscar.",
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

  // ── Herramientas (la base de los "agentes"). De momento: búsqueda web (la hace el Worker). ──
  var TOOLS = [{
    name: "web_search",
    description: "Busca información ACTUAL en internet: noticias de hoy, datos en tiempo real, precios, " +
      "resultados, o cualquier cosa reciente/posterior a tu conocimiento o que no sepas con certeza. " +
      "NO la uses para cosas que ya sabes; solo cuando de verdad haga falta info reciente o verificable.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "La consulta a buscar, concisa." } },
      required: ["query"],
    },
  }];
  function workerBase() {
    var w = (localStorage.getItem("mm_tts_worker") || "").trim();
    if (w && (/tunombre|ejemplo|example/i.test(w) || !/^https?:\/\/.+\..+/i.test(w))) w = "";
    return (w || "https://rapid-sky-2af7.ericponceal.workers.dev").replace(/\/+$/, "");
  }
  // ¿La pregunta pide info RECIENTE/en tiempo real? → buscamos en la web ANTES de responder, así no
  // depende de que MiniMax decida usar la herramienta (a veces no la usa).
  function needsWeb(t) {
    // Normaliza (sin acentos) → el \b de regex es ASCII y "pasó"/"falleció" rompían el match.
    t = " " + (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
    return /\b(noticias?|hoy|ayer|manana|reciente|recientemente|ultim[oa]s?|ultima hora|en directo|en vivo|ahora mismo|este ano|2024|2025|2026|falleci|ha muerto|murio|que le paso|que paso|que ha pasado|resultados?|marcador|partidos?|mundial|liga|champions|clasico|gol(es)?|gano|ganador|juega|jugo|clima|tiempo|temperatura|llover|lluvia|grados|pronostico|precio|cuanto cuesta|cotiza|bolsa|estreno|cartelera|cuando sale|cuando es|cuando empieza|horario|ultima version|version nueva|nuevo modelo)\b/.test(t)
        || /\b(busca|buscame|googlea|en internet|en la web|que se sabe de|informacion (de|sobre|actual))\b/.test(t);
  }
  // ¿La respuesta es un "no puedo / no tengo acceso"? → buscaremos y reintentaremos.
  function isRefusal(t) {
    t = (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return /(no tengo acceso|no puedo acceder|no dispongo de|en tiempo real|fecha limite|fecha de corte|no tengo (informacion|datos|acceso|forma de|manera de|la capacidad)|no puedo (buscar|navegar|consultar|acceder)|no estoy conectad|no tengo conexion|mi conocimiento (llega|tiene)|no tengo acceso a internet)/.test(t);
  }
  function doSearch(q, onStatus) {
    if (onStatus) { try { onStatus("Buscando en la web: " + q.slice(0, 60)); } catch (e) {} }
    return fetch(workerBase() + "/search?q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var rs = (d && d.results) || [];
        if (!rs.length) return "";
        return rs.slice(0, 5).map(function (x, i) { return (i + 1) + ". " + x.title + " — " + (x.snippet || "") + " (" + x.url + ")"; }).join("\n");
      }).catch(function () { return ""; });
  }
  // Ejecuta una herramienta → devuelve texto para el tool_result.
  function execTool(tu, onStatus) {
    if (tu.name === "web_search") {
      var q = (tu.input && tu.input.query) || "";
      if (onStatus) { try { onStatus("Buscando en la web: " + q); } catch (e) {} }
      return fetch(workerBase() + "/search?q=" + encodeURIComponent(q))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var rs = (d && d.results) || [];
          if (!rs.length) return "No se encontraron resultados para esa búsqueda.";
          return rs.slice(0, 5).map(function (x, i) {
            return (i + 1) + ". " + x.title + " — " + (x.snippet || "") + " (" + x.url + ")";
          }).join("\n");
        })
        .catch(function () { return "La búsqueda web no respondió (sin conexión o Worker no disponible)."; });
    }
    return Promise.resolve("Herramienta no disponible.");
  }
  // Limpia el texto de una respuesta: markup de tool_call (código raro), CJK, espacios; abre app si lo pidió por markup.
  function cleanText(blocks) {
    var txt = "";
    (blocks || []).forEach(function (bl) { if (bl && bl.type === "text") txt += (bl.text || ""); });
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
    return txt;
  }

  // Una llamada a MiniMax (con herramientas). Devuelve los datos crudos.
  function callMiniMax(messages) {
    var key = CFG.key;
    var payload = {
      model: CFG.model, max_tokens: 1536, temperature: 0.55,
      system: buildSystem(), thinking: { type: "disabled" }, messages: messages, tools: TOOLS,
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
        return data;
      });
    }).catch(function (err) {
      if (to) clearTimeout(to);
      if (err && err.name === "AbortError") throw new Error("La respuesta tardó demasiado, señor. Inténtelo de nuevo.");
      throw err;
    });
  }

  // Pregunta a MiniMax con BUCLE de herramientas (la base del agente). onStatus(texto) para avisos
  // tipo "Buscando en la web…". Máx 3 rondas de herramienta para no encadenar sin fin.
  function askMiniMax(userText, onStatus) {
    if (!CFG.key) return Promise.reject(new Error("sin key"));
    H().push({ role: "user", content: userText });
    saveHist();
    var messages = H().slice();   // copia de trabajo (crece con bloques de herramienta)
    var didSearch = false;
    function injectSearch(info) {
      var i = messages.length - 1;
      if (info && messages[i] && messages[i].role === "user" && typeof messages[i].content === "string") {
        messages[i] = { role: "user", content: messages[i].content +
          "\n\n[Resultados de búsqueda web de AHORA para responderme; úsalos y cita la fuente brevemente, NO digas que no tienes internet]:\n" + info };
        didSearch = true;
      }
    }
    // Una "ronda" del agente. Devuelve el TEXTO final (sin guardarlo en el historial todavía).
    function loop(depth) {
      return callMiniMax(messages).then(function (data) {
        var blocks = data.content || [];
        var toolUses = blocks.filter(function (b) { return b && b.type === "tool_use"; });
        if (toolUses.length && depth < 3) {
          didSearch = true;
          messages.push({ role: "assistant", content: blocks });
          return Promise.all(toolUses.map(function (tu) {
            return execTool(tu, onStatus).then(function (res) {
              return { type: "tool_result", tool_use_id: tu.id, content: String(res).slice(0, 4000) };
            });
          })).then(function (results) { messages.push({ role: "user", content: results }); return loop(depth + 1); });
        }
        // MiniMax-M2 a veces pide la búsqueda como TEXTO en vez del formato formal. La ejecutamos igual.
        var rawText = blocks.filter(function (b) { return b && b.type === "text"; }).map(function (b) { return b.text || ""; }).join(" ");
        var ts = rawText.match(/web_search[\s\S]*?name\s*=\s*["']?query["']?\s*>\s*([^<]+?)\s*<\/parameter>/i);
        if (ts && depth < 3) {
          var q = ts[1].trim(); didSearch = true;
          return doSearch(q, onStatus).then(function (info) {
            messages.push({ role: "assistant", content: "(buscando en la web: " + q + ")" });
            messages.push({ role: "user", content: "Resultados de la búsqueda web para \"" + q + "\":\n" + (info || "Sin resultados.") + "\n\nResponde ahora con esto, en español de España, sin mostrar este bloque ni enlaces largos." });
            return loop(depth + 1);
          });
        }
        return cleanText(blocks) || "A su servicio, señor.";
      });
    }
    // 1) Pre-búsqueda si la pregunta es claramente de info reciente.
    var pre = needsWeb(userText) ? doSearch(userText, onStatus).then(injectSearch) : Promise.resolve();
    return pre.then(function () { return loop(0); })
      .then(function (txt) {
        // 2) Red de seguridad: si NO buscó y la respuesta es un "no puedo / no tengo acceso" → busca y reintenta.
        if (!didSearch && isRefusal(txt)) {
          return doSearch(userText, onStatus).then(function (info) {
            if (!info) return txt;
            didSearch = true;
            messages.push({ role: "assistant", content: txt });
            messages.push({ role: "user", content: "Eso SÍ lo puedes saber con esto (búsqueda web de ahora). Responde mi pregunta usando estos datos y cita la fuente; NO digas que no tienes acceso:\n" + info });
            return loop(0);
          });
        }
        return txt;
      })
      .then(function (finalTxt) {
        H().push({ role: "assistant", content: finalTxt });
        saveHist();
        return finalTxt;
      });
  }

  // Añade al historial un intercambio resuelto LOCALMENTE (deep links, Modo Super…), para que
  // MiniMax tenga contexto en lo siguiente ("abre WhatsApp" → "vuelve a abrirlo").
  function addExchange(userText, assistantText) {
    if (!userText) return;
    H().push({ role: "user", content: String(userText) });
    H().push({ role: "assistant", content: String(assistantText || "") });
    saveHist();
  }

  // ── GENERACIÓN DE IMÁGENES (MiniMax image-01 vía el Worker; el navegador no puede directo: CORS) ──
  // ¿El mensaje pide CREAR una imagen? Devuelve el prompt (la descripción) o null.
  function asImagePrompt(text) {
    var raw = (text || "").trim();
    if (!raw) return null;
    var n = " " + raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
    var noun = /\b(imagen|imagenes|foto|fotos|fotografia|dibujo|dibujos|ilustracion|ilustraciones|logo|logotipo|wallpaper|fondo de pantalla|render|poster|cartel|avatar|retrato|arte|wallpapers|imagina(te)?)\b/;
    var verb = /\b(haz|hazme|hazle|haces|hacer|hacerme|crea|creame|crea me|genera|generame|gener|dibuja|dibujame|pinta|pintame|disena|disename|quiero|necesito|ponme|muestrame|enseiame|ensename|dame|generar|crear|disenar|dibujar)\b/;
    var drawVerb = /\b(dibuja|dibujame|pintame|pinta|ilustra|ilustrame)\b/;
    if (!(drawVerb.test(n) || (noun.test(n) && verb.test(n)))) return null;
    // Quita SOLO el mando del principio ("hazme/créame/genera/dibuja…") y pasa el resto tal cual.
    // "una imagen de un gato", "un logo para una barbería" son prompts válidos para image-01.
    var p = raw.trim()
      .replace(/^[¿¡\s]+/, "")
      .replace(/^(?:oye|venga|por favor|porfa|jarvis)[\s,]+/i, "")
      .replace(/^(?:me\s+)?(?:puedes?\s+|podrias?\s+)?(?:haz(?:me|le)?|haces|hacer(?:me)?|cr[eé][ae](?:me)?|gener[ae](?:me)?|g[eé]ner[ae]me|dibuj[ae](?:me)?|dib[uú]jame|pint[ae](?:me)?|p[ií]ntame|imagina(?:te)?|dis[eé][nñ][ae](?:me)?|quiero|necesito|ponme|dame|mu[eé]strame|ens[eé][nñ]ame|generar|crear|dise[nñ]ar|dibujar|ilustra(?:me)?)\s+/i, "")
      .replace(/^[\s:,.\-]+/, "")
      .trim();
    if (p.length < 2) p = raw;   // si quedó vacío, usa el texto original (image-01 lo entiende igual)
    return p.slice(0, 1400);
  }
  // Relación de aspecto según pistas del texto.
  function imageAspect(text) {
    var n = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (/\b(fondo de pantalla|wallpaper|vertical|movil|story|stories|tiktok|9:16)\b/.test(n)) return "9:16";
    if (/\b(horizontal|panoramic|banner|portada|16:9|paisaje|cinematic)\b/.test(n)) return "16:9";
    if (/\b(cuadrad|1:1|perfil|avatar)\b/.test(n)) return "1:1";
    return "1:1";
  }
  // Genera la imagen llamando al Worker (/image), que añade la key y llama a MiniMax server-side.
  function generateImage(prompt, aspect) {
    if (!CFG.key) return Promise.reject(new Error("Falta la API key, señor."));
    if (!prompt) return Promise.reject(new Error("Sin descripción para la imagen."));
    var url = workerBase() + "/image";
    var ctrl, to;
    try { ctrl = new AbortController(); to = setTimeout(function () { ctrl.abort(); }, 90000); } catch (e) {}
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, aspect_ratio: aspect || "1:1", n: 1, key: CFG.key }),
      signal: ctrl && ctrl.signal,
    }).then(function (r) {
      if (to) clearTimeout(to);
      return r.text().then(function (txt) {
        var d = null; try { d = JSON.parse(txt); } catch (e) {}
        if (!d) throw new Error("El Worker aún no tiene la función de imágenes. Vuelve a desplegar worker.js en Cloudflare, señor.");
        if (d.error) throw new Error(d.error);
        return d.images || [];
      });
    }).catch(function (err) {
      if (to) clearTimeout(to);
      if (err && err.name === "AbortError") throw new Error("La imagen tardó demasiado, señor. Inténtelo otra vez.");
      throw err;
    });
  }

  // ── API de conversaciones ──
  function listConvos() {
    return STORE.convos.map(function (c) {
      return { id: c.id, name: c.name, active: c.id === STORE.active, count: c.history.length };
    });
  }
  function newConvo(name) {
    var c = { id: genId(), name: (name || "").trim() || ("Chat " + (STORE.convos.length + 1)), history: [] };
    STORE.convos.push(c); STORE.active = c.id; saveStore(); return c.id;
  }
  function switchConvo(id) {
    for (var i = 0; i < STORE.convos.length; i++) if (STORE.convos[i].id === id) { STORE.active = id; saveStore(); return true; }
    return false;
  }
  function renameConvo(id, name) {
    name = (name || "").trim(); if (!name) return;
    for (var i = 0; i < STORE.convos.length; i++) if (STORE.convos[i].id === id) { STORE.convos[i].name = name.slice(0, 40); saveStore(); return; }
  }
  function deleteConvo(id) {
    STORE.convos = STORE.convos.filter(function (c) { return c.id !== id; });
    if (!STORE.convos.length) STORE.convos.push({ id: genId(), name: "Chat principal", history: [] });
    if (!STORE.convos.some(function (c) { return c.id === STORE.active; })) STORE.active = STORE.convos[0].id;
    saveStore();
  }

  window.CFG = CFG;
  window.API = {
    askMiniMax: askMiniMax, SYSTEM: SYSTEM, addExchange: addExchange,
    asImagePrompt: asImagePrompt, imageAspect: imageAspect, generateImage: generateImage,
    getHistory: function () { return H().slice(); },     // para mostrar el chat pasado
    clearHistory: function () { active().history.length = 0; saveStore(); },   // limpia SOLO la conversación activa
    // conversaciones
    listConvos: listConvos, newConvo: newConvo, switchConvo: switchConvo,
    renameConvo: renameConvo, deleteConvo: deleteConvo,
    activeName: function () { return active().name; },
  };
})();
