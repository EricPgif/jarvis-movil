/* api.js — Config (localStorage) + llamada DIRECTA a MiniMax (formato Anthropic).
   La API key vive SOLO en este móvil. Expone window.API y window.CFG. */
(function () {
  "use strict";

  var CFG = {
    get key()   { return localStorage.getItem("mm_key") || ""; },
    get base()  { return (localStorage.getItem("mm_base") || "https://api.minimax.io/anthropic").replace(/\/+$/, ""); },
    get model() { return localStorage.getItem("mm_model") || "MiniMax-M2"; },
    // Modelo MULTIMODAL para analizar imágenes (M2 es solo texto). Configurable por si el plan usa otro id.
    get visionModel() { return localStorage.getItem("mm_vision_model") || "MiniMax-M3"; },
    get clap()  { return localStorage.getItem("mm_clap") === "1"; },
    set clap(v) { localStorage.setItem("mm_clap", v ? "1" : "0"); },
    // Escucha continua «Jarvis» en Modo Super. APAGADA por defecto: en la PWA instalada de Android
    // el reconocimiento continuo hace un "tic" del micro en bucle y se interrumpe. Lo normal es
    // TOCAR la esfera. Quien quiera manos-libres la activa aquí.
    get wake()  { return localStorage.getItem("mm_wake") === "1"; },
    set wake(v) { localStorage.setItem("mm_wake", v ? "1" : "0"); },
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
  // Mantiene MUCHOS mensajes para VERLOS (no se "para en 15"); a MiniMax solo se le envían los
  // últimos ~24 (CTX_MAX) por coste/contexto. Recorta a 200 EN SITIO (mantiene la referencia).
  var DISPLAY_MAX = 200, CTX_MAX = 24;
  function saveHist() {
    var c = active();
    if (c.history.length > DISPLAY_MAX) c.history.splice(0, c.history.length - DISPLAY_MAX);
    saveStore();
  }

  // ── Cerebro JARVIS (Core orquestador): personalidad fija + uso de HERRAMIENTAS reales ──
  var BASE_PROMPT = [
    "Eres J.A.R.V.I.S., el asistente personal de Eric dentro de su movil Android. Trátale de 'senor'.",
    "Te crearon Eric y Artur. Personalidad FIJA: cercano, ingenioso, con humor seco e inteligente,",
    "directo, con clase (como el JARVIS de Iron Man). Espanol de Espana. Sin emojis. Eres UNO SOLO:",
    "el usuario nunca debe percibir 'varios agentes', solo a ti.",
    "",
    "TIENES HERRAMIENTAS REALES que SI ejecutan acciones en el movil. Cuando una peticion necesite una",
    "accion, USA la herramienta (no digas que no puedes): buscar_web, generar_imagen, generar_video,",
    "crear_web, ver_pantalla, analizar_imagen, abrir_app, enviar_whatsapp, mandar_sms, llamar,",
    "crear_alarma, leer_notificaciones, operar_app, crear_archivo, recordar, guardar_memoria.",
    "",
    "COMO ACTUAS EN CADA MENSAJE:",
    "1. Clasifica: charla, pregunta de conocimiento, accion sobre el movil, o tarea compuesta (varios pasos).",
    "2. Si es charla o algo que sabes, responde directo SIN herramientas.",
    "3. Si es una accion concreta, usa la herramienta exacta.",
    "4. Si es compuesta ('organiza mi dia', 'busca tendencias y hazme un video'), planifica y usa varias",
    "   herramientas en orden, reutilizando lo que ya sepas.",
    "5. Si te falta UN dato imprescindible (a quien, a que hora), pregunta SOLO esa cosa.",
    "6. Antes de una accion CRITICA (enviar mensaje/SMS, llamar, borrar, gastar): resume lo que vas a",
    "   hacer y pide confirmacion. Lo reversible y trivial (abrir app, buscar, alarma), hazlo sin preguntar.",
    "",
    "CONOCIMIENTO Y BUSQUEDA: responde con tu propio conocimiento (llega a 2026). Para algo RECIENTE,",
    "noticias, tiempo real, o que no sepas con certeza, usa buscar_web TU MISMO, sin pedir permiso, sin",
    "decir que no tienes internet. Para imagenes/videos/webs usa la herramienta; NUNCA digas que solo eres texto.",
    "",
    "HONESTIDAD: si una herramienta falla, dilo claro y ofrece alternativa; nunca finjas que hiciste algo.",
    "Si algo solo va en el movil instalado (APK) y no esta disponible, dilo en una frase, sin drama.",
    "",
    "FORMATO: responde SOLO con texto natural para Eric. NUNCA muestres el resultado crudo de una",
    "herramienta ni etiquetas XML/JSON/tool_call/invoke/parameter. Alfabeto latino, nada de chino/japones/coreano.",
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

  // ── HERRAMIENTAS (function-calling). El modelo DECIDE cuál usar; el APK la ejecuta de verdad. ──
  var O = function (t, props, req) { return { type: t, properties: props, required: req || [] }; };
  var S = function (d) { return { type: "string", description: d }; };
  var TOOLS = [
    { name: "buscar_web", description: "Busca info ACTUAL en internet (noticias, tiempo, precios, resultados, tendencias, algo reciente o que no sepas con certeza). Úsala TÚ MISMO sin pedir permiso.",
      input_schema: O("object", { consulta: S("La consulta, concisa.") }, ["consulta"]) },
    { name: "generar_imagen", description: "Crea una IMAGEN a partir de una descripción y la muestra al usuario en el chat. Para 'hazme/créame/dibuja una imagen/foto/logo de…'.",
      input_schema: O("object", { prompt: S("Descripción detallada de la imagen."), formato: { type: "string", enum: ["cuadrado", "vertical", "horizontal"], description: "Por defecto cuadrado." } }, ["prompt"]) },
    { name: "generar_video", description: "Crea un VÍDEO corto a partir de una descripción (tarda varios minutos) y lo muestra. Para 'hazme un vídeo de…'.",
      input_schema: O("object", { prompt: S("Descripción de la escena del vídeo.") }, ["prompt"]) },
    { name: "crear_web", description: "Genera una página WEB/HTML autocontenida y la muestra (preview + descargar). Para 'hazme una web/página/landing de…'.",
      input_schema: O("object", { descripcion: S("Qué web/página crear.") }, ["descripcion"]) },
    { name: "analizar_imagen", description: "Analiza una imagen que el usuario HA ADJUNTADO (con el clip 📎). No la uses si no hay imagen adjunta.",
      input_schema: O("object", { pregunta: S("Qué quiere saber de la imagen.") }, ["pregunta"]) },
    { name: "ver_pantalla", description: "Captura la PANTALLA del móvil y la analiza (solo APK). Para «mira la pantalla / ¿qué es esto? / ¿qué mod es este vídeo?».",
      input_schema: O("object", { pregunta: S("Qué quiere saber de la pantalla.") }, []) },
    { name: "abrir_app", description: "Abre una app del móvil. apps: spotify, youtube, whatsapp, telegram, gmail, chrome, instagram, tiktok, twitter, reddit, twitch, netflix, discord, maps, calendario, camara.",
      input_schema: O("object", { app: S("Nombre de la app.") }, ["app"]) },
    { name: "enviar_whatsapp", description: "Abre WhatsApp con un mensaje ya escrito para que el usuario lo envíe (o lo manda solo si hay accesibilidad). CRÍTICA: confirma antes.",
      input_schema: O("object", { numero: S("Número con prefijo si lo hay (opcional)."), mensaje: S("Texto del mensaje.") }, ["mensaje"]) },
    { name: "mandar_sms", description: "Envía un SMS (solo APK con permiso SMS). CRÍTICA: confirma antes.",
      input_schema: O("object", { numero: S("Número de teléfono."), mensaje: S("Texto del SMS.") }, ["numero", "mensaje"]) },
    { name: "llamar", description: "Inicia una llamada telefónica (solo APK). CRÍTICA: confirma antes.",
      input_schema: O("object", { numero: S("Número a llamar.") }, ["numero"]) },
    { name: "crear_alarma", description: "Crea una alarma/recordatorio que JARVIS HABLA a una hora. Reversible.",
      input_schema: O("object", { hora: { type: "integer", description: "Hora 0-23." }, minuto: { type: "integer", description: "Minuto 0-59." }, en_minutos: { type: "integer", description: "Alternativa: dentro de X minutos." }, etiqueta: S("Qué recordar / decir.") }, ["etiqueta"]) },
    { name: "leer_notificaciones", description: "Lee y resume las notificaciones del móvil (WhatsApp/Discord…) (solo APK con permiso).",
      input_schema: O("object", {}, []) },
    { name: "operar_app", description: "Abre otra app y ejecuta una tarea DENTRO de ella por accesibilidad (escribir, pulsar). LENTO/FRÁGIL: solo si no hay forma directa. CRÍTICA si tiene efectos.",
      input_schema: O("object", { app: S("App o paquete."), objetivo: S("Qué lograr dentro de la app, en lenguaje natural.") }, ["app", "objetivo"]) },
    { name: "crear_archivo", description: "Crea un archivo de texto en el móvil con el contenido dado (solo APK).",
      input_schema: O("object", { nombre: S("Nombre con extensión (txt/md/csv)."), contenido: S("Contenido del archivo.") }, ["nombre", "contenido"]) },
    { name: "recordar", description: "Recupera lo que sabes del usuario relevante a algo (su nombre, gustos, rutinas…).",
      input_schema: O("object", { consulta: S("Sobre qué recordar.") }, ["consulta"]) },
    { name: "guardar_memoria", description: "Guarda un hecho estable del usuario para futuras conversaciones (nombre, preferencias, rutinas, contactos).",
      input_schema: O("object", { hecho: S("El hecho, autocontenido."), categoria: { type: "string", enum: ["preferencia", "contacto", "rutina", "dato_personal", "otro"] } }, ["hecho"]) },
  ];
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
    return /\b(noticias?|hoy|ayer|manana|reciente|recientemente|ultim[oa]s?|ultima hora|en directo|en vivo|ahora mismo|este ano|2024|2025|2026|falleci|ha muerto|murio|que le paso|que paso|que ha pasado|resultados?|marcador|partidos?|mundial|liga|champions|clasico|gol(es)?|gano|ganador|juega|jugo|clima|tiempo|temperatura|llover|lluvia|grados|pronostico|precio|cuanto cuesta|cotiza|bolsa|estreno|estrenos|cartelera|peliculas?|series?|cuando sale|salido|sacado|sacan|cuando es|cuando empieza|horario|ultima version|version nueva|nuevo modelo|populares?|mas vist[oa]s?|mejores|top|ranking|tendencia|tendencias|recomienda(me)?|que ver)\b/.test(t)
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
  // Hooks de UI que registra movil.js (renderizar imagen/vídeo/web, poner alarma, etc.). En la web
  // y el APK son los mismos; aquí solo se invocan.
  var UI = {};
  function setUI(o) { if (o) for (var k in o) UI[k] = o[k]; }
  function isApk() { try { return !!(window.Native && window.Native.isNative()); } catch (e) { return false; } }
  function P(v) { return Promise.resolve(v); }

  // Ejecuta una herramienta → devuelve texto para el tool_result. El modelo lo funde en su respuesta.
  function execTool(tu, onStatus) {
    var name = tu.name, inp = tu.input || {};
    function st(m) { if (onStatus) { try { onStatus(m); } catch (e) {} } }
    try {
      switch (name) {
        case "buscar_web": case "web_search":
          st("Buscando en la web: " + (inp.consulta || inp.query || ""));
          return doSearch(inp.consulta || inp.query || "", onStatus).then(function (info) { return info || "Sin resultados."; });

        case "generar_imagen": {
          st("Creando la imagen…");
          var asp = inp.formato === "vertical" ? "9:16" : inp.formato === "horizontal" ? "16:9" : "1:1";
          return generateImage(inp.prompt, asp).then(function (urls) {
            (urls || []).forEach(function (u) { if (UI.image) UI.image(u, inp.prompt); });
            return "Imagen creada y mostrada al usuario.";
          }).catch(function (e) { return "No se pudo crear la imagen: " + (e && e.message || e); });
        }
        case "generar_video":
          st("Creando el vídeo (tarda minutos)…");
          return generateVideo(inp.prompt, onStatus).then(function (url) {
            if (UI.video) UI.video(url, inp.prompt); return "Vídeo creado y mostrado al usuario.";
          }).catch(function (e) { return "No se pudo crear el vídeo: " + (e && e.message || e); });

        case "crear_web":
          st("Creando la web…");
          return generateWeb(inp.descripcion || inp.prompt || "").then(function (html) {
            if (UI.web) UI.web(html); return "Web creada y mostrada (preview + descargar).";
          }).catch(function (e) { return "No se pudo crear la web: " + (e && e.message || e); });

        case "analizar_imagen":
          return P("Para analizar una imagen, dile al usuario que la adjunte con el clip 📎 del chat.");

        case "ver_pantalla":
          if (!isApk()) return P("Ver la pantalla solo funciona en la app Android (APK).");
          st("Mirando la pantalla…");
          return window.Native.captureScreen().then(function (d) {
            if (!d) throw new Error("sin captura");
            return analyzeImage(d, inp.pregunta || "¿Qué hay en esta pantalla? Sé concreto.");
          }).catch(function (e) { return "No pude ver la pantalla: " + (e && e.message || e) + " (acepta el permiso de captura)."; });

        case "abrir_app": {
          var said = (window.Links && window.Links.openApp) ? window.Links.openApp((inp.app || "").toLowerCase()) : null;
          return P(said ? ("Abriendo " + inp.app + ".") : ("No conozco la app '" + inp.app + "'."));
        }
        case "enviar_whatsapp":
          if (window.Links && window.Links.sendWhatsApp) window.Links.sendWhatsApp(inp.mensaje || "", inp.numero || inp.destinatario || "");
          return P("WhatsApp abierto con el mensaje preparado; el usuario lo envía.");

        case "mandar_sms":
          if (isApk() && window.Native.sendSms) return window.Native.sendSms(inp.numero, inp.mensaje).then(function () { return "SMS enviado a " + inp.numero + "."; }).catch(function (e) { return "No pude enviar el SMS: " + (e && e.message || e); });
          return P("El SMS solo funciona en la app Android (APK) con permiso de SMS.");

        case "llamar":
          if (isApk() && window.Native.call) return window.Native.call(inp.numero).then(function () { return "Llamando al " + inp.numero + "."; }).catch(function (e) { return "No pude llamar: " + (e && e.message || e); });
          return P("Las llamadas solo funcionan en la app Android (APK).");

        case "crear_alarma":
          if (UI.alarm) return P(UI.alarm(inp));
          return P("No pude poner la alarma.");

        case "leer_notificaciones":
          if (!isApk()) return P("Leer notificaciones solo en la app Android (APK).");
          return window.Native.readNotifications().then(function (list) {
            if (!list || !list.length) return "No hay notificaciones nuevas.";
            return list.slice(0, 15).map(function (n) { return "- " + (n.title || n.packageName) + (n.text ? (": " + n.text) : ""); }).join("\n");
          }).catch(function () { return "Falta el permiso de acceso a notificaciones (Ajustes → Poderes del APK)."; });

        case "operar_app":
          if (UI.operarApp) return UI.operarApp(inp.app, inp.objetivo);
          if (window.Links && window.Links.openApp) window.Links.openApp((inp.app || "").toLowerCase());
          return P("Abrí " + (inp.app || "la app") + ". El control automático dentro de la app está en pruebas.");

        case "crear_archivo":
          if (isApk() && window.Native.writeFile)
            return window.Native.writeFile(inp.nombre, inp.contenido)
              .then(function (n) { return "Archivo '" + n + "' guardado en Documentos."; })
              .catch(function (e) { return "No pude crear el archivo: " + (e && e.message || e); });
          return P("Crear archivos solo en la app Android (APK).");

        case "recordar":
          try {
            var b = "";
            if (window.Mem && window.Mem.search) b = window.Mem.search(inp.consulta || "");
            else if (window.Mem && window.Mem.block) b = window.Mem.block();
            return P(b || "No tengo nada guardado sobre eso todavía.");
          } catch (e) { return P("No tengo memoria disponible."); }

        case "guardar_memoria":
          try {
            if (window.Mem && window.Mem.add) window.Mem.add(inp.hecho, inp.categoria);
            else if (window.Mem && window.Mem.capture) window.Mem.capture(inp.hecho);
          } catch (e) {}
          return P("Guardado en memoria, señor.");

        default:
          return P("Herramienta '" + name + "' no disponible.");
      }
    } catch (e) { return P("Error ejecutando " + name + ": " + (e && e.message || e)); }
  }

  // Parsea una tool-call que MiniMax-M2 a veces suelta como TEXTO (no formato formal):
  // <minimax:tool_call><invoke name="X"><parameter name="Y">Z</parameter>...</invoke>...
  function parseTextToolCall(raw) {
    if (!raw) return null;
    var m = raw.match(/<invoke\s+name\s*=\s*["']?([a-zA-Z_]+)["']?\s*>([\s\S]*?)<\/invoke>/i);
    if (!m) { var m2 = raw.match(/["']?name["']?\s*[:=]\s*["']([a-zA-Z_]+)["'][\s\S]*?(?:parameters|input|arguments)["']?\s*[:=]\s*(\{[\s\S]*?\})/i); if (m2) { try { return { name: m2[1], input: JSON.parse(m2[2]) }; } catch (e) {} } return null; }
    var input = {}, re = /<parameter\s+name\s*=\s*["']?([a-zA-Z_]+)["']?\s*>([\s\S]*?)<\/parameter>/gi, p;
    while ((p = re.exec(m[2]))) input[p[1]] = p[2].trim();
    return { name: m[1], input: input };
  }
  // Limpia el texto de una respuesta: markup de tool_call (código raro), CJK, espacios; abre app si lo pidió por markup.
  function cleanText(blocks) {
    var txt = "";
    (blocks || []).forEach(function (bl) { if (bl && bl.type === "text") txt += (bl.text || ""); });
    txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
        // Limpia cualquier markup de tool_call que se cuele en el texto final (ya se ejecutó en el bucle).
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
    var messages = H().slice(-CTX_MAX);   // a MiniMax solo las últimas ~24 (coste); el resto se ve igual
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
        // MiniMax-M2 a veces suelta la tool como TEXTO (no formato formal). La parseamos y ejecutamos igual.
        var rawText = blocks.filter(function (b) { return b && b.type === "text"; }).map(function (b) { return b.text || ""; }).join(" ");
        var tc = parseTextToolCall(rawText);
        if (tc && depth < 3) {
          didSearch = true;
          messages.push({ role: "assistant", content: rawText });
          return execTool({ name: tc.name, input: tc.input, id: "t" + depth }, onStatus).then(function (res) {
            messages.push({ role: "user", content: "[Resultado de la herramienta " + tc.name + "]:\n" + String(res).slice(0, 4000) + "\n\nResponde ahora al usuario en español de España, con texto natural, sin mostrar la herramienta ni su resultado crudo." });
            return loop(depth + 1);
          });
        }
        return cleanText(blocks);   // puede ser "" → lo maneja la red de "respuesta vacía"
      });
    }
    // 1) Pre-búsqueda si la pregunta es claramente de info reciente.
    var pre = needsWeb(userText) ? doSearch(userText, onStatus).then(injectSearch) : Promise.resolve();
    return pre.then(function () { return loop(0); })
      .then(function (txt) {
        // 2) Red de seguridad: si NO buscó y la respuesta es un "no puedo / no tengo acceso" → busca y reintenta.
        if (!didSearch && txt && isRefusal(txt)) {
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
      .then(function (txt) {
        // 3) Red de "respuesta VACÍA": MiniMax-M2 a veces devuelve solo herramientas/markup → texto vacío
        //    (era el "A su servicio, señor" sin sentido). Reintenta UNA vez pidiendo texto natural.
        if (txt && txt.trim()) return txt;
        messages.push({ role: "user", content: "Responde AHORA en español de España, con texto natural, claro y útil, contestando a mi última pregunta. NO uses herramientas, tool_call, invoke ni XML; solo texto." });
        return loop(0).then(function (t2) { return (t2 && t2.trim()) ? t2 : "Disculpe, señor, no me ha salido la respuesta. ¿Puede repetírmelo?"; });
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
  // Host raíz de MiniMax (sin el sufijo /anthropic) para los endpoints nativos (image_generation).
  function mmHost() { return CFG.base.replace(/\/anthropic\/?$/i, "").replace(/\/+$/, ""); }
  function imgBody(prompt, aspect) {
    return JSON.stringify({ model: "image-01", prompt: prompt, aspect_ratio: aspect || "1:1", response_format: "url", n: 1, prompt_optimizer: true });
  }
  // 1) Intento DIRECTO navegador→MiniMax. El host es el mismo que /v1/messages (que SÍ va por CORS),
  //    así que puede funcionar sin Worker. Si CORS lo bloquea → fetch lanza → caemos al Worker.
  function directImage(prompt, aspect, signal) {
    return fetch(mmHost() + "/v1/image_generation", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.key },
      body: imgBody(prompt, aspect), signal: signal,
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
      var sc = d && d.base_resp && d.base_resp.status_code;
      if (sc && sc !== 0) throw new Error("mm:" + (d.base_resp.status_msg || sc));   // error real de MiniMax (key/saldo)
      var urls = (d && d.data && (d.data.image_urls || d.data.image_base64)) || [];
      if (!urls.length) throw new Error("sin-imagen-directa");
      return urls;
    });
  }
  // 2) Vía Worker (necesita la ruta /image desplegada).
  function workerImage(prompt, aspect, signal) {
    return fetch(workerBase() + "/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, aspect_ratio: aspect || "1:1", n: 1, key: CFG.key }), signal: signal,
    }).then(function (r) {
      return r.text().then(function (txt) {
        var d = null; try { d = JSON.parse(txt); } catch (e) {}
        if (!d) throw new Error("worker-no-image");
        if (d.error) throw new Error("mm:" + d.error);
        return d.images || [];
      });
    });
  }
  function generateImage(prompt, aspect) {
    if (!CFG.key) return Promise.reject(new Error("Falta la API key, señor."));
    if (!prompt) return Promise.reject(new Error("Sin descripción para la imagen."));
    var ctrl, to, timedOut = false, sig;
    try { ctrl = new AbortController(); sig = ctrl.signal; to = setTimeout(function () { timedOut = true; ctrl.abort(); }, 90000); } catch (e) {}
    return directImage(prompt, aspect, sig)
      .catch(function (e) {
        if (timedOut) throw e;
        var m = (e && e.message) || "";
        if (m.indexOf("mm:") === 0) throw e;          // error real de MiniMax → el Worker daría lo mismo
        return workerImage(prompt, aspect, sig);      // CORS u otro → probamos por el Worker
      })
      .then(function (urls) { if (to) clearTimeout(to); if (!urls || !urls.length) throw new Error("No he podido generar la imagen, señor."); return urls; })
      .catch(function (err) {
        if (to) clearTimeout(to);
        if (timedOut || (err && err.name === "AbortError")) throw new Error("La imagen tardó demasiado, señor. Inténtelo otra vez.");
        var m = (err && err.message) || String(err);
        if (m === "worker-no-image") m = "Las imágenes necesitan que despliegues el Worker una vez (worker.js en Cloudflare), señor.";
        else if (m.indexOf("mm:") === 0) m = m.slice(3);   // muestra el error real de MiniMax
        throw new Error(m);
      });
  }

  // ── GENERACIÓN DE VÍDEO (MiniMax Hailuo, ASÍNCRONO: submit → poll → retrieve). Directo→Worker. ──
  function asVideoPrompt(text) {
    var raw = (text || "").trim(); if (!raw) return null;
    var n = " " + raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
    if (!/\bvideos?\b|\bvideoclip\b|\bclip\b|\breel\b/.test(n)) return null;
    if (!/\b(haz|hazme|haces|hacer|hacerme|crea|creame|genera|generame|gener|monta|montame|quiero|necesito|ponme|dame|generar|crear|grabame|grabar)\b/.test(n)) return null;
    var p = raw.trim()
      .replace(/^[¿¡\s]+/, "")
      .replace(/^(?:oye|venga|por favor|porfa|jarvis)[\s,]+/i, "")
      .replace(/^(?:me\s+)?(?:puedes?\s+|podrias?\s+)?(?:haz(?:me|le)?|haces|hacer(?:me)?|cr[eé][ae](?:me)?|gener[ae](?:me)?|g[eé]ner[ae]me|mont[ae](?:me)?|grab[ae](?:me)?|quiero|necesito|ponme|dame|generar|crear)\s+/i, "")
      .replace(/^(?:un|una|el|la)\s+(?:video|videoclip|clip|reel)\s+(?:de\s+|sobre\s+|que\s+)?/i, "")
      .replace(/^[\s:,.\-]+/, "").trim();
    if (p.length < 2) p = raw;
    return p.slice(0, 1800);
  }
  function mmGet(path) {   // GET directo a MiniMax (con la key)
    return fetch(mmHost() + path, { headers: { "Authorization": "Bearer " + CFG.key } }).then(function (r) { return r.json(); });
  }
  function vidSubmitDirect(prompt) {
    return fetch(mmHost() + "/v1/video_generation", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.key },
      body: JSON.stringify({ model: "MiniMax-Hailuo-02", prompt: prompt }),
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
      var sc = d && d.base_resp && d.base_resp.status_code;
      if (sc && sc !== 0) throw new Error("mm:" + (d.base_resp.status_msg || sc));
      if (!d.task_id) throw new Error("sin-task");
      return d.task_id;
    });
  }
  function vidSubmitWorker(prompt) {
    return fetch(workerBase() + "/video", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, key: CFG.key }),
    }).then(function (r) { return r.text(); }).then(function (t) {
      var d = null; try { d = JSON.parse(t); } catch (e) {}
      if (!d) throw new Error("worker-no-video");
      if (d.error) throw new Error("mm:" + d.error);
      if (!d.task_id) throw new Error("sin-task");
      return d.task_id;
    });
  }
  function generateVideo(prompt, onStatus) {
    if (!CFG.key) return Promise.reject(new Error("Falta la API key, señor."));
    if (!prompt) return Promise.reject(new Error("Sin descripción para el vídeo."));
    var useWorker = false;
    function st(m) { if (onStatus) { try { onStatus(m); } catch (e) {} } }
    function status(taskId) {
      if (useWorker) return fetch(workerBase() + "/video-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task_id: taskId, key: CFG.key }) }).then(function (r) { return r.json(); });
      return mmGet("/v1/query/video_generation?task_id=" + encodeURIComponent(taskId));
    }
    function fileUrl(fileId) {
      if (useWorker) return fetch(workerBase() + "/video-file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: fileId, key: CFG.key }) }).then(function (r) { return r.json(); }).then(function (d) { return d.url || d.download_url || ""; });
      return mmGet("/v1/files/retrieve?file_id=" + encodeURIComponent(fileId)).then(function (d) { var f = (d && d.file) || {}; return f.download_url || f.backup_download_url || ""; });
    }
    st("Encargando tu vídeo a MiniMax…");
    return vidSubmitDirect(prompt).catch(function (e) {
      var m = (e && e.message) || ""; if (m.indexOf("mm:") === 0) throw e;   // error real → no insistir
      useWorker = true; return vidSubmitWorker(prompt);
    }).then(function (taskId) {
      var tries = 0, max = 80;   // ~80 × 8s ≈ 10-11 min
      return new Promise(function (resolve, reject) {
        function tick() {
          tries++;
          status(taskId).then(function (d) {
            var s = (d && (d.status || d.Status)) || "";
            var fid = (d && (d.file_id || d.fileId)) || "";
            if (/success/i.test(s) && fid) { st("Descargando tu vídeo…"); fileUrl(fid).then(function (u) { u ? resolve(u) : reject(new Error("Sin URL de vídeo, señor.")); }).catch(reject); return; }
            if (/fail/i.test(s)) { reject(new Error("MiniMax no pudo crear el vídeo, señor.")); return; }
            if (tries >= max) { reject(new Error("El vídeo tardó demasiado, señor.")); return; }
            st("Generando tu vídeo… (" + (s || "en cola") + " · " + (tries * 8) + "s)");
            setTimeout(tick, 8000);
          }).catch(function (e) { if (tries >= max) { reject(e); return; } setTimeout(tick, 8000); });
        }
        setTimeout(tick, 6000);
      });
    });
  }

  // ── GENERACIÓN DE WEBS / HTML (usa el CHAT /v1/messages, que ya va por CORS; NO necesita Worker) ──
  function asWebPrompt(text) {
    var raw = (text || "").trim(); if (!raw) return null;
    var n = " " + raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
    if (!/\b(web|pagina|paginas|landing|sitio web|html|portfolio|portafolio|pagina web)\b/.test(n)) return null;
    if (!/\b(haz|hazme|haces|hacer|hacerme|crea|creame|genera|generame|gener|monta|montame|disena|disename|programa|programame|construye|construyeme|quiero|necesito|dame|crear|generar|disenar|programar|construir)\b/.test(n)) return null;
    return raw.slice(0, 1000);
  }
  function extractHtml(txt) {
    if (!txt) return "";
    var m = txt.match(/```(?:html)?\s*([\s\S]*?)```/i);
    var code = (m ? m[1] : txt).trim();
    if (!/<html[\s>]/i.test(code) && /<(?:!doctype|div|section|body|h1|main|header|nav)/i.test(code)) {
      code = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + code + '</body></html>';
    }
    return /<[a-z!]/i.test(code) ? code : "";
  }
  function generateWeb(description) {
    if (!CFG.key) return Promise.reject(new Error("Falta la API key, señor."));
    var sys = "Eres un desarrollador web experto. Devuelve EXCLUSIVAMENTE el codigo de UN UNICO archivo HTML completo, " +
      "autocontenido y funcional: TODO el CSS dentro de <style> y TODO el JS dentro de <script>, en el mismo archivo, " +
      "SIN dependencias externas (salvo imagenes de https://picsum.photos si hacen falta). Diseno moderno, bonito y responsive. " +
      "Texto en espanol. NO des explicaciones; envuelve el codigo en un bloque ```html ... ```.";
    var msgs = [{ role: "user", content: "Crea esto como una pagina web (un solo archivo HTML autocontenido y terminado): " + description }];
    var ctrl, to, timedOut = false;
    try { ctrl = new AbortController(); to = setTimeout(function () { timedOut = true; ctrl.abort(); }, 75000); } catch (e) {}
    return fetch(CFG.base + "/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.key },
      body: JSON.stringify({ model: CFG.model, max_tokens: 8000, temperature: 0.6, system: sys, thinking: { type: "disabled" }, messages: msgs }),
      signal: ctrl && ctrl.signal,
    }).then(function (r) { if (to) clearTimeout(to); return r.json(); }).then(function (data) {
      if (data.error) throw new Error((data.error.message || data.error));
      var txt = (data.content || []).filter(function (b) { return b && b.type === "text"; }).map(function (b) { return b.text || ""; }).join("");
      var html = extractHtml(txt);
      if (!html) throw new Error("No me salió el HTML, señor. Inténtelo otra vez.");
      return html;
    }).catch(function (err) {
      if (to) clearTimeout(to);
      if (timedOut || (err && err.name === "AbortError")) throw new Error("La web tardó demasiado, señor. Inténtelo otra vez.");
      throw err;
    });
  }

  // ── VISIÓN: analizar una imagen del usuario (MiniMax-M3 multimodal, formato OpenAI chat). ──
  function visionMessages(dataUrl, question) {
    return [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url: dataUrl } }] }];
  }
  function pickVisionText(d) {
    var t = ""; try { t = d.choices[0].message.content; if (Array.isArray(t)) t = t.map(function (p) { return (p && p.text) || ""; }).join(" "); } catch (e) {}
    // Igual que el chat: el modelo de visión a veces suelta su razonamiento en INGLÉS
    // dentro de <think>…</think>/<reasoning>…</reasoning> y luego la respuesta buena.
    // Limpiamos con la MISMA lógica que cleanText (incluido el barrido CJK).
    return cleanText([{ type: "text", text: String(t || "") }]);
  }
  function analyzeImageDirect(dataUrl, question) {
    return fetch(mmHost() + "/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.key },
      body: JSON.stringify({ model: CFG.visionModel, messages: visionMessages(dataUrl, question) }),
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
      var sc = d && d.base_resp && d.base_resp.status_code;
      if (sc && sc !== 0) throw new Error("mm:" + (d.base_resp.status_msg || sc));
      var t = pickVisionText(d); if (!t) throw new Error("sin-texto-directo"); return t;
    });
  }
  function analyzeImageWorker(dataUrl, question) {
    return fetch(workerBase() + "/vision", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, question: question, key: CFG.key, model: CFG.visionModel }),
    }).then(function (r) { return r.text(); }).then(function (t) {
      var d = null; try { d = JSON.parse(t); } catch (e) {}
      if (!d) throw new Error("worker-no-vision");
      if (d.error) throw new Error("mm:" + d.error);
      // Mismo limpiado que la vía directa: fuera <think>/<reasoning> y CJK.
      return cleanText([{ type: "text", text: String(d.text || "") }]);
    });
  }
  function analyzeImage(dataUrl, question) {
    if (!CFG.key) return Promise.reject(new Error("Falta la API key, señor."));
    if (!dataUrl) return Promise.reject(new Error("Sin imagen."));
    var q = question || "¿Qué hay en esta imagen? Descríbela en español de España, con detalle pero conciso.";
    return analyzeImageDirect(dataUrl, q).catch(function (e) {
      var m = (e && e.message) || ""; if (m.indexOf("mm:") === 0) throw e;   // error real de MiniMax → el Worker daría igual
      return analyzeImageWorker(dataUrl, q);
    }).then(function (txt) {
      if (!txt || !txt.trim()) throw new Error("No he podido leer la imagen, señor.");
      return txt.trim();
    }).catch(function (err) {
      var m = (err && err.message) || String(err);
      if (m === "worker-no-vision") m = "El Worker aún no tiene la visión: vuelve a desplegar worker.js, señor.";
      else if (m.indexOf("mm:") === 0) m = m.slice(3);
      throw new Error(m);
    });
  }

  // ── MULTI-AGENTE DE CONTENIDO (buscar tendencias → idea → crear imagen/vídeo) ──
  // Una llamada suelta al cerebro (sin tocar el historial), p.ej. para sintetizar una idea.
  function askOnce(userContent, system) {
    if (!CFG.key) return Promise.reject(new Error("sin key"));
    return fetch(CFG.base + "/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + CFG.key },
      body: JSON.stringify({ model: CFG.model, max_tokens: 600, temperature: 0.7, system: system || buildSystem(), thinking: { type: "disabled" }, messages: [{ role: "user", content: userContent }] }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) throw new Error(d.error.message || d.error);
      return cleanText(d.content || []);
    });
  }
  // ¿Pide lanzar agentes / crear contenido a partir de TENDENCIAS? Devuelve {kind:'video'|'imagen'} o null.
  function asContentAgent(text) {
    var n = " " + (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + " ";
    var wantsCreate = /\b(haz|hazme|crea|creame|genera|generame|monta|montame|sube|subir|publica|publicar)\b/.test(n);
    var media = (/\bvideos?\b|\breel\b|\bclip\b/.test(n)) ? "video" : ((/\bimagen|imagenes|foto|fotos|post\b/.test(n)) ? "imagen" : "");
    var trends = /\btendencia|tendencias|en tendencia|viral|virales|de moda|trending|lo que se lleva|redes sociales\b/.test(n);
    var agents = /\bagentes?\b/.test(n);
    if ((agents || trends) && (wantsCreate || media)) return { kind: media || "video" };
    return null;
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
    askMiniMax: askMiniMax, SYSTEM: SYSTEM, addExchange: addExchange, setUI: setUI, execTool: execTool,
    asImagePrompt: asImagePrompt, imageAspect: imageAspect, generateImage: generateImage,
    asVideoPrompt: asVideoPrompt, generateVideo: generateVideo,
    asWebPrompt: asWebPrompt, generateWeb: generateWeb,
    asContentAgent: asContentAgent, ask: askOnce, search: function (q, cb) { return doSearch(q, cb); },
    analyzeImage: analyzeImage,
    getHistory: function () { return H().slice(); },     // para mostrar el chat pasado
    clearHistory: function () { active().history.length = 0; saveStore(); },   // limpia SOLO la conversación activa
    // conversaciones
    listConvos: listConvos, newConvo: newConvo, switchConvo: switchConvo,
    renameConvo: renameConvo, deleteConvo: deleteConvo,
    activeName: function () { return active().name; },
  };
})();
