/* memory.js — Memoria INTELIGENTE persistente del móvil (window.Mem).
   Separada del historial de chat (mm_history): aquí viven los HECHOS duraderos sobre Eric
   (nombre, preferencias, recordatorios, temas recurrentes). "Borrar conversación" NO toca esto.
   Patrón inspirado en jarvis_memory.py del PC, pero ligero y gratis (regex, sin llamar a MiniMax).
   Se inyecta en el system prompt vía Mem.block() para que JARVIS te recuerde siempre. */
(function () {
  "use strict";
  var KEY = "mm_facts";

  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }
  function clean(s) {   // quita puntuación final y espacios sobrantes de un valor
    return String(s || "").replace(/\s+/g, " ").trim().replace(/[.,;:!?¡¿"'»«\s]+$/g, "").trim();
  }
  function stripArt(s) {   // quita el artículo inicial de un valor de preferencia ("el rojo" → "rojo")
    return clean(s).replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "");
  }

  function empty() { return { personal: {}, preferences: {}, facts: [], topics: {} }; }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!o || typeof o !== "object") return empty();
      o.personal = o.personal || {}; o.preferences = o.preferences || {};
      o.facts = Array.isArray(o.facts) ? o.facts : []; o.topics = o.topics || {};
      return o;
    } catch (e) { return empty(); }
  }
  function save(o) {
    try {
      o.facts = o.facts.slice(-30);
      // recortar topics a los 15 con más cuenta
      var ks = Object.keys(o.topics);
      if (ks.length > 15) {
        ks.sort(function (a, b) { return o.topics[b] - o.topics[a]; });
        var keep = {}; ks.slice(0, 15).forEach(function (k) { keep[k] = o.topics[k]; });
        o.topics = keep;
      }
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) {}
  }

  // Palabras que NO son un nombre tras "soy".
  var NOT_NAME = ["de","un","una","el","la","muy","mas","menos","tu","su","mi","yo","aqui","asi",
                  "feliz","triste","bueno","buena","malo","mala","programador","autonomo","libre"];
  // Cosas válidas para "mi X es Y".
  var PREF_WHITELIST = ["color","comida","plato","bebida","equipo","pelicula","serie","cantante",
                        "grupo","banda","hobby","aficion","deporte","animal","mascota","ciudad",
                        "trabajo","profesion","coche","numero","juego","libro","artista"];
  // Temas recurrentes: regex (sobre texto normalizado) -> etiqueta.
  var TOPICS = [
    { re: /\bagente/, k: "agentes" },
    { re: /\b(web|pagina|landing|sitio)\b/, k: "webs" },
    { re: /\b(cliente|vender|negocio|presupuesto)\b/, k: "negocio" },
    { re: /\b(video|youtube)\b/, k: "videos" },
    { re: /\b(musica|spotify|cancion|tema)\b/, k: "musica" },
    { re: /\b(imagen|foto|diseñ|logo)\b/, k: "diseno" },
    { re: /\b(codigo|program|script|app)\b/, k: "programacion" },
    { re: /\bjarvis\b/, k: "JARVIS" },
  ];

  // Aprende hechos de un mensaje del usuario. Gratis, instantáneo, idempotente.
  function capture(userText) {
    var raw = String(userText || "").trim();
    if (!raw) return;
    var o = load(), changed = false;
    var low = raw.toLowerCase();
    var m;

    // Nombre (explícito).
    m = raw.match(/\b(?:me llamo|mi nombre es)\s+([a-záéíóúñ]{2,20})/i);
    if (!m) {
      var ms = raw.match(/\bsoy\s+([a-záéíóúñ]{2,20})\b/i);
      if (ms && NOT_NAME.indexOf(norm(ms[1])) === -1) m = ms;
    }
    if (m) {
      var nombre = clean(m[1]); nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1);
      if (nombre && o.personal.nombre !== nombre) { o.personal.nombre = nombre; changed = true; }
    }

    // Preferencia marcada: "mi X favorito/preferido es Y".
    m = raw.match(/\bmi\s+([a-záéíóúñ ]{2,30}?)\s+(?:favorit[oa]|preferid[oa])\s+(?:es|son)\s+(.+)/i);
    if (m) {
      var k1 = norm(m[1]).replace(/\s+/g, "_"), v1 = stripArt(m[2]);
      if (k1 && v1 && o.preferences[k1] !== v1) { o.preferences[k1] = v1; changed = true; }
    } else {
      // Preferencia simple: "mi X es Y" solo si X está en la whitelist.
      m = raw.match(/\bmi\s+([a-záéíóúñ]{2,20})\s+(?:es|son)\s+(.+)/i);
      if (m && PREF_WHITELIST.indexOf(norm(m[1])) !== -1) {
        var k2 = norm(m[1]), v2 = stripArt(m[2]);
        if (k2 && v2 && o.preferences[k2] !== v2) { o.preferences[k2] = v2; changed = true; }
      }
    }

    // Recordatorios explícitos: "recuerda/anota/apunta/memoriza que Z" / "no olvides que Z".
    m = raw.match(/\b(?:recuerda|recuérdate|acu[eé]rdate|anota|ap[uú]nta|memoriza|ten en cuenta)\s+(?:de\s+)?que\s+(.+)/i)
        || raw.match(/\bno\s+olvides\s+(?:de\s+)?que\s+(.+)/i);
    if (m) {
      var fact = clean(m[1]);
      if (fact && o.facts.indexOf(fact) === -1) { o.facts.push(fact); changed = true; }
    }

    // Temas recurrentes (contador).
    var nlow = norm(low);
    TOPICS.forEach(function (tp) {
      if (tp.re.test(nlow)) { o.topics[tp.k] = (o.topics[tp.k] || 0) + 1; changed = true; }
    });

    if (changed) save(o);
  }

  // Bloque de texto para inyectar en el system prompt (o "" si no hay nada).
  function block() {
    var o = load(), lines = [];
    if (o.personal.nombre) lines.push("- Se llama " + o.personal.nombre + ".");
    var pk = Object.keys(o.preferences);
    if (pk.length) {
      lines.push("- Preferencias: " + pk.map(function (k) {
        return k.replace(/_/g, " ") + " = " + o.preferences[k];
      }).slice(0, 8).join("; ") + ".");
    }
    var tk = Object.keys(o.topics);
    if (tk.length) {
      tk.sort(function (a, b) { return o.topics[b] - o.topics[a]; });
      var top = tk.slice(0, 5).filter(function (k) { return o.topics[k] >= 2; });
      if (top.length) lines.push("- Temas en los que anda últimamente: " + top.join(", ") + ".");
    }
    if (o.facts.length) lines.push("- Recuerda: " + o.facts.slice(-5).join("; ") + ".");
    if (!lines.length) return "";
    return "LO QUE SABES DE ERIC (memoria persistente; úsala con naturalidad, no la recites):\n" + lines.join("\n");
  }

  function clearProfile() { try { localStorage.removeItem(KEY); } catch (e) {} }
  function getAll() { return load(); }

  window.Mem = { capture: capture, block: block, clearProfile: clearProfile, getAll: getAll };
})();
