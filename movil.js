/* movil.js — Orquestador de la app móvil JARVIS.
   Une: router de comandos → MiniMax, voz, dock de apps, clima, reloj, esfera, ajustes, instalar PWA.
   Sin backend Python; la key vive solo en este móvil (localStorage). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var busy = false;

  // Versión de la app (subir en cada cambio). Si cambia respecto a la guardada, avisa.
  var APP_VERSION = "5.4";
  var WHATS_NEW = "ARREGLADO LO IMPORTANTE: ahora SÍ funcionan abrir apps, llamadas, SMS, leer notificaciones, ver/controlar pantalla y alarmas (un fallo de carga tenía TODOS los plugins bloqueados). Además: FIRMA ESTABLE → a partir de ahora las actualizaciones se instalan ENCIMA, sin desinstalar; y botón «🔄 Buscar / instalar actualización» en Ajustes. OJO: esta vez aún hay que desinstalar el viejo (cambia la firma); desde la próxima, ya no.";
  window.JV_VERSION = APP_VERSION;   // para mostrarla en la intro

  // ── UI: mensajes y estado ──
  // Markdown LIGERO (negritas, código, listas, saltos). Escapa HTML primero (seguro).
  function renderRich(text) {
    var h = escapeHtml(String(text));
    h = h.replace(/```([\s\S]*?)```/g, function (_, c) { return "<pre>" + c.replace(/^\n+/, "") + "</pre>"; });
    h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
    h = h.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    h = h.replace(/(^|<br>)\s*[-*•]\s+/g, "$1• ");
    h = h.replace(/\n/g, "<br>");
    return h;
  }
  function addCopyBtn(el, text) {
    if (el.querySelector(".copy-btn")) return;
    var b = document.createElement("button");
    b.className = "copy-btn"; b.type = "button"; b.setAttribute("aria-label", "Copiar"); b.textContent = "⧉";
    b.addEventListener("click", function (e) {
      e.stopPropagation();
      var t = el.getAttribute("data-raw") || text;
      try { navigator.clipboard.writeText(t); } catch (err) {}
      b.textContent = "✓"; setTimeout(function () { b.textContent = "⧉"; }, 1200);
    });
    el.appendChild(b);
  }
  // Rellena una burbuja: markdown en las de JARVIS (jv), texto plano en el resto, + botón copiar (jv/me).
  function fillBubble(el, text) {
    el.setAttribute("data-raw", String(text));
    if (el.classList.contains("jv")) el.innerHTML = renderRich(text);
    else el.textContent = String(text);
    if (el.classList.contains("jv") || el.classList.contains("me")) addCopyBtn(el, text);
  }
  function addMsg(text, cls) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    fillBubble(d, text);
    var log = $("log");
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    // Espeja en el chat del Modo Super si está montado.
    var slog = $("super-log");
    if (slog) {
      var c = d.cloneNode(true);
      slog.appendChild(c);
      slog.scrollTop = slog.scrollHeight;
      d._mirror = c;   // para poder actualizar también el clon del Super (bug del "...")
    }
    return d;
  }
  // Actualiza el texto de un mensaje Y su clon en el chat del Super.
  function setMsg(el, text) {
    if (!el) return;
    el.classList.remove("agent"); fillBubble(el, text);
    if (el._mirror) { el._mirror.classList.remove("agent"); fillBubble(el._mirror, text); }
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Pinta una imagen generada en el chat (y la espeja en el Super). Tocar la imagen → lightbox a
  // pantalla completa con la imagen YA cargada (NO se vuelve a navegar a la URL firmada de OSS, que
  // daba "SignatureDoesNotMatch"). Con zoom por toque y descarga por blob.
  function addImage(url, caption) {
    var raw = String(url);
    function build() {
      var wrap = document.createElement("div");
      wrap.className = "msg jv img";
      var img = document.createElement("img");
      img.className = "genimg"; img.src = raw; img.alt = caption || "imagen"; img.loading = "lazy";
      img.addEventListener("click", function () { openLightbox(raw); });
      var dl = document.createElement("button");
      dl.className = "img-dl"; dl.type = "button"; dl.textContent = "🔍 Ver grande / Descargar";
      dl.addEventListener("click", function () { openLightbox(raw); });
      wrap.appendChild(img); wrap.appendChild(dl);
      return wrap;
    }
    var d = build();
    var log = $("log"); log.appendChild(d); log.scrollTop = log.scrollHeight;
    var slog = $("super-log");
    if (slog) { var c = build(); slog.appendChild(c); slog.scrollTop = slog.scrollHeight; }
    return d;
  }
  // Lightbox para ver imágenes grandes con zoom (doble función: tocar = zoom; tocar fondo = cerrar).
  var _lb = null;
  function openLightbox(url) {
    if (!_lb) {
      _lb = document.createElement("div");
      _lb.id = "img-lightbox";
      _lb.innerHTML = '<button class="lb-x" type="button" aria-label="Cerrar">✕</button><img alt="imagen"><button class="lb-dl" type="button">⬇ Descargar</button>';
      document.body.appendChild(_lb);
      var im = _lb.querySelector("img");
      _lb.querySelector(".lb-x").addEventListener("click", closeLightbox);
      _lb.addEventListener("click", function (e) { if (e.target === _lb) closeLightbox(); });   // tocar el fondo cierra
      im.addEventListener("click", function (e) { e.stopPropagation(); im.classList.toggle("zoom"); });  // tocar la imagen = zoom
      _lb.querySelector(".lb-dl").addEventListener("click", function (e) { e.stopPropagation(); downloadImage(im.src); });
    }
    var img = _lb.querySelector("img"); img.classList.remove("zoom"); img.src = url;
    _lb.classList.add("show");
  }
  function closeLightbox() { if (_lb) _lb.classList.remove("show"); }
  // Pinta un vídeo generado (reproductor + enlace). El download_url es una URL firmada (~9h).
  function addVideo(url, caption) {
    var raw = String(url);
    function build() {
      var wrap = document.createElement("div"); wrap.className = "msg jv img";
      var v = document.createElement("video"); v.className = "genvid"; v.src = raw; v.controls = true; v.setAttribute("playsinline", ""); v.setAttribute("preload", "metadata");
      var dl = document.createElement("a"); dl.className = "img-dl"; dl.href = raw; dl.target = "_blank"; dl.rel = "noopener"; dl.textContent = "⬇ Abrir / Descargar vídeo";
      wrap.appendChild(v); wrap.appendChild(dl); return wrap;
    }
    var d = build(); var log = $("log"); log.appendChild(d); log.scrollTop = log.scrollHeight;
    var slog = $("super-log"); if (slog) { var c = build(); slog.appendChild(c); slog.scrollTop = slog.scrollHeight; }
    return d;
  }
  // Pinta una web/HTML generada: preview en iframe + Abrir (blob) + Descargar .html.
  function addWeb(html, caption) {
    function build() {
      var wrap = document.createElement("div"); wrap.className = "msg jv web";
      var frame = document.createElement("iframe"); frame.className = "genweb"; frame.setAttribute("sandbox", "allow-scripts allow-same-origin"); frame.srcdoc = html;
      var row = document.createElement("div"); row.className = "web-actions";
      var open = document.createElement("button"); open.type = "button"; open.className = "img-dl"; open.textContent = "↗ Abrir";
      var dl = document.createElement("button"); dl.type = "button"; dl.className = "img-dl"; dl.textContent = "⬇ Descargar .html";
      open.addEventListener("click", function () { openHtml(html); });
      dl.addEventListener("click", function () { downloadHtml(html); });
      row.appendChild(open); row.appendChild(dl);
      wrap.appendChild(frame); wrap.appendChild(row); return wrap;
    }
    var d = build(); var log = $("log"); log.appendChild(d); log.scrollTop = log.scrollHeight;
    var slog = $("super-log"); if (slog) { var c = build(); slog.appendChild(c); slog.scrollTop = slog.scrollHeight; }
    return d;
  }
  function openHtml(html) { try { var b = new Blob([html], { type: "text/html" }); var u = URL.createObjectURL(b); window.open(u, "_blank"); setTimeout(function () { URL.revokeObjectURL(u); }, 30000); } catch (e) {} }
  function downloadHtml(html) { try { var b = new Blob([html], { type: "text/html" }); var u = URL.createObjectURL(b); var a = document.createElement("a"); a.href = u; a.download = "jarvis-web-" + Date.now() + ".html"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 5000); } catch (e) {} }
  // Descarga por blob (no caduca y evita el error de firma de la URL). Si OSS bloquea CORS, avisa.
  function downloadImage(url) {
    fetch(url).then(function (r) { if (!r.ok) throw new Error("http"); return r.blob(); }).then(function (b) {
      var u = URL.createObjectURL(b);
      var a = document.createElement("a"); a.href = u; a.download = "jarvis-" + Date.now() + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(u); } catch (e) {} }, 5000);
    }).catch(function () {
      addMsg("Para guardarla, mantén pulsada la imagen y elige «Descargar imagen», señor.", "sys");
    });
  }
  // ── Subir una imagen y que JARVIS la ANALICE (visión, como ChatGPT) ──
  // Escala la foto a máx 1024px (las fotos del móvil son enormes) → dataURL JPEG.
  function fileToScaledDataUrl(file, maxDim) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          var w = im.width, h = im.height, m = maxDim || 1024;
          if (w > m || h > m) { if (w >= h) { h = Math.round(h * m / w); w = m; } else { w = Math.round(w * m / h); h = m; } }
          try { var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(im, 0, 0, w, h); resolve(c.toDataURL("image/jpeg", 0.85)); }
          catch (e) { resolve(rd.result); }
        };
        im.onerror = function () { resolve(rd.result); };
        im.src = rd.result;
      };
      rd.onerror = reject;
      rd.readAsDataURL(file);
    });
  }
  function addUserImage(dataUrl) {
    function build() {
      var wrap = document.createElement("div"); wrap.className = "msg me img";
      var img = document.createElement("img"); img.className = "genimg"; img.src = dataUrl;
      img.addEventListener("click", function () { openLightbox(dataUrl); });
      wrap.appendChild(img); return wrap;
    }
    var d = build(); var log = $("log"); log.appendChild(d); log.scrollTop = log.scrollHeight;
    var slog = $("super-log"); if (slog) { var c = build(); slog.appendChild(c); slog.scrollTop = slog.scrollHeight; }
    return d;
  }
  function onImagePicked(e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!CFG.key) { addMsg("Falta tu API key de MiniMax, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
    if (busy) return;
    var question = ($("text").value || "").trim(); $("text").value = "";
    fileToScaledDataUrl(f, 1024).then(function (dataUrl) { analyzeUserImage(dataUrl, question); })
      .catch(function () { addMsg("No pude leer la imagen, señor.", "sys"); });
  }
  function analyzeUserImage(dataUrl, question) {
    Voice.unlock();
    addUserImage(dataUrl);
    if (question) addMsg(question, "me");
    if (window.Mem && question) { try { window.Mem.capture(question); } catch (e) {} }
    busy = true; setState("thinking");
    var card = addMsg("…", "jv"); setAgent(card, "Analizando la imagen…");
    API.analyzeImage(dataUrl, question || "").then(function (ans) {
      busy = false; setState(""); setMsg(card, ans);
      if (window.API && window.API.addExchange) API.addExchange((question || "[imagen]") + " (imagen adjunta)", ans);
      speak(ans);
    }).catch(function (e) {
      busy = false; setState("");
      var m = (e && e.message) || e;
      if (/no soporta|not support|invalid model|model not|2013|1004|does not exist|unknown model|sin acceso|no access|vision|multimodal/i.test(String(m)))
        m = "Tu plan de MiniMax no incluye el modelo con visión (M3), señor; por eso aún no puedo analizar imágenes. Lo dejo listo para cuando lo tengas.";
      setMsg(card, "No pude analizar la imagen, señor: " + m);
    });
  }
  // Convierte un globo en una tarjeta de "agente trabajando" (reactor girando + texto + puntos).
  function setAgent(el, label) {
    if (!el) return;
    var html = '<span class="agent-orb"></span><span class="agent-tx">' + escapeHtml(label) + '<span class="dots"></span></span>';
    el.classList.add("agent"); el.innerHTML = html;
    if (el._mirror) { el._mirror.classList.add("agent"); el._mirror.innerHTML = html; }
  }
  function setState(s) {   // '', 'listening', 'speaking', 'thinking'
    Sphere.setMode(s === "thinking" ? "processing" : (s || "idle"));
    var label = s === "listening" ? "ESCUCHANDO" : s === "speaking" ? "HABLANDO" :
      s === "thinking" ? "PROCESANDO…" : "EN LÍNEA";
    $("m-status").textContent = label;
    // Refleja el estado en el Modo Super (su esfera reacciona y su barra de estado).
    if (window.__superActive) {
      var ss = $("sup-status"); if (ss) ss.textContent = (s === "listening" ? "ESCUCHANDO…" : label);
    }
  }

  // ── Núcleo: procesar una orden (de voz o texto) ──
  function handle(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    addMsg(text, "me");
    $("text").value = "";

    // Memoria inteligente: aprende hechos del mensaje (nombre, gustos, temas…). Embudo único.
    if (window.Mem) { try { window.Mem.capture(text); } catch (e) {} }

    // ¿Pidió limpiar el chat? Se hace LOCALMENTE (antes lo mandaba a MiniMax y soltaba "código raro").
    var nrm = window.Router ? window.Router.norm(text) : text.toLowerCase();
    if (/\b(limpia|limpiar|borra|borrar|vacia|vaciar|resetea|resetear|elimina|eliminar)\b/.test(nrm) &&
        /\b(chat|conversacion|charla|historial|mensajes|memoria)\b/.test(nrm)) {
      clearChat(); return;
    }

    // ¿Alarmas/recordatorios? (HABLADOS, mientras la app esté abierta)
    if (/\b(borra|quita|elimina|cancela|para)\b.*\balarmas?\b|\bcancela.*recordatorios?\b/.test(nrm)) {
      try { var na0 = nativeAlarm(); if (na0) loadAlarms().forEach(function (x) { if (x.native) { try { na0.cancel({ id: x.id }).catch(function () {}); } catch (e) {} } }); } catch (e) {}
      saveAlarms([]); var rep = "Alarmas y recordatorios borrados, señor."; addMsg(rep, "jv"); speak(rep); return;
    }
    if (/\b(mis|cuantas|que|lista de)\s+alarmas?\b|\bque recordatorios\b/.test(nrm)) {
      var al = loadAlarms();
      if (!al.length) { addMsg("No tiene ninguna alarma puesta, señor.", "jv"); }
      else {
        var list = al.map(function (x) { var w = new Date(x.at); return "• " + pad2(w.getHours()) + ":" + pad2(w.getMinutes()) + (x.label ? (" — " + x.label.replace(/^le recuerdo: /, "")) : ""); }).join("\n");
        addMsg("Sus alarmas, señor:\n" + list, "jv");
      }
      return;
    }
    var alarmReply = parseAndSetAlarm(text);
    if (alarmReply) { addMsg(alarmReply, "jv"); speak(alarmReply); if (window.API && window.API.addExchange) API.addExchange(text, alarmReply); return; }

    // ¿Enviar un WhatsApp con texto? Abre WhatsApp con el mensaje escrito (el usuario pulsa enviar).
    var wp = parseWhatsApp(text);
    if (wp) {
      Voice.unlock();
      window.Links.sendWhatsApp(wp.msg, wp.number);
      var wrep = wp.msg ? "Abriendo WhatsApp con tu mensaje, señor. Solo pulsa enviar." : "Abriendo WhatsApp, señor.";
      addMsg(wrep, "jv"); speak(wrep);
      if (window.API && window.API.addExchange) API.addExchange(text, wrep);
      return;
    }

    // ── PODERES NATIVOS (solo en el APK JARVIS Max). En la web caen a MiniMax. ──
    if (window.Native && window.Native.isNative()) {
      // Leer notificaciones
      if (/\bnotificacion(es)?\b/.test(nrm) && /\b(mis|que|lee|leer|leeme|revisa|revisame|mira|tengo|nuevas|ultimas)\b/.test(nrm)) {
        busy = true; setState("thinking"); var ncard = addMsg("…", "jv"); setAgent(ncard, "Leyendo tus notificaciones…");
        Native.readNotifications().then(function (list) {
          busy = false; setState("");
          if (!list.length) { setMsg(ncard, "No tienes notificaciones nuevas, señor."); speak("No tienes notificaciones nuevas, señor."); return; }
          var lines = list.slice(0, 12).map(function (n) { return "• " + (n.title || n.packageName) + (n.text ? (": " + n.text) : ""); }).join("\n");
          setMsg(ncard, "Tienes " + list.length + " notificaciones, señor:\n" + lines);
          if (window.API && window.API.ask) API.ask("Resume en 1-2 frases, en español, estas notificaciones para Eric:\n" + lines, "Eres JARVIS, resume breve y útil.").then(function (s) { if (s) { addMsg(s, "jv"); speak(s); } }).catch(function(){});
        }).catch(function () { busy = false; setState(""); setMsg(ncard, "Activa primero «Leer notificaciones» en Ajustes, señor (acceso a notificaciones de Android)."); });
        return;
      }
      // Mirar la pantalla / «¿qué es esto?»
      if (/\b(mira|ver|analiza|captura)\b.*\b(pantalla|esto|viendo|app)\b/.test(nrm) || /\bque (es|estoy viendo|sale|pone) (esto|aqui|en pantalla)\b/.test(nrm) || /\bque mod\b/.test(nrm)) {
        busy = true; setState("thinking"); var scard = addMsg("…", "jv"); setAgent(scard, "Mirando tu pantalla…");
        Native.captureScreen().then(function (dataUrl) {
          if (!dataUrl) throw new Error("sin captura");
          return API.analyzeImage(dataUrl, text).then(function (ans) {
            busy = false; setState(""); setMsg(scard, ans); speak(ans);
          });
        }).catch(function (e) { busy = false; setState(""); setMsg(scard, "No pude ver la pantalla, señor: " + (e && e.message || e) + ". (Acepta el permiso de captura.)"); });
        return;
      }
      // Llamar a un número
      var mCall = nrm.match(/\b(llama|llamar|telefonea|marca)\b[^\d]*(\+?\d[\d\s]{5,}\d)/);
      if (mCall) {
        var num = mCall[2].replace(/\s/g, "");
        Native.call(num).then(function () { addMsg("Llamando al " + num + ", señor.", "jv"); }).catch(function (e) { addMsg("No pude llamar, señor: " + (e && e.message || e), "jv"); });
        return;
      }
    }

    // 0z) ¿Pide LANZAR AGENTES / crear contenido a partir de TENDENCIAS? Cadena: buscar → idea → crear.
    var ca = (window.API && window.API.asContentAgent) ? window.API.asContentAgent(text) : null;
    if (ca) {
      if (!CFG.key) { addMsg("Falta tu API key de MiniMax, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
      busy = true; setState("thinking");
      var acard = addMsg("…", "jv");
      setAgent(acard, "Agente 1 · buscando tendencias…");
      API.search("tendencias virales en redes sociales hoy").then(function (info) {
        setAgent(acard, "Agente 2 · pensando una idea…");
        return API.ask("Tendencias de hoy:\n" + (info || "(sin datos)") + "\n\nPropón UNA idea concreta para un " + ca.kind + " corto y viral para redes sociales. Responde SOLO con la descripción visual (el prompt), 1-2 frases, en español, sin preámbulos.",
          "Eres un creativo de contenido viral. Respondes solo con la idea/prompt visual, sin explicaciones.");
      }).then(function (idea) {
        idea = (idea || "").trim() || ("un " + ca.kind + " dinámico y llamativo sobre una tendencia actual");
        addMsg("💡 Idea: " + idea, "sys");
        setAgent(acard, "Agente 3 · creando el " + ca.kind + "…");
        if (ca.kind === "imagen") {
          return API.generateImage(idea, "9:16").then(function (urls) {
            busy = false; setState(""); setMsg(acard, "Aquí tienes el contenido, señor.");
            (urls || []).forEach(function (u) { addImage(u, idea); });
            addMsg("Para subirlo a redes, descárgalo y súbelo tú; la subida automática llegará con la app nativa, señor.", "sys");
            speak("Listo, señor.");
          });
        }
        return API.generateVideo(idea, function (s) { setAgent(acard, s); }).then(function (url) {
          busy = false; setState(""); setMsg(acard, "Aquí tienes tu vídeo, señor.");
          addVideo(url, idea);
          addMsg("Para subirlo a redes, descárgalo y súbelo tú; la subida automática llegará con la app nativa, señor.", "sys");
          speak("Listo, señor.");
        });
      }).catch(function (e) { busy = false; setState(""); setMsg(acard, "No pude completarlo, señor: " + (e && e.message || e)); });
      return;
    }

    // 0a) ¿Pide CREAR UN VÍDEO? → MiniMax Hailuo (asíncrono, tarda minutos). Antes que imagen.
    var vidPrompt = (window.API && window.API.asVideoPrompt) ? window.API.asVideoPrompt(text) : null;
    if (vidPrompt) {
      if (!CFG.key) { addMsg("Falta tu API key de MiniMax, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
      busy = true; setState("thinking");
      var vcard = addMsg("…", "jv");
      setAgent(vcard, "Creando tu vídeo (tarda unos minutos, señor)…");
      API.generateVideo(vidPrompt, function (s) { setAgent(vcard, s); }).then(function (url) {
        busy = false; setState("");
        setMsg(vcard, "Aquí tiene su vídeo, señor.");
        addVideo(url, vidPrompt);
        speak("Aquí tiene su vídeo, señor.");
      }).catch(function (e) {
        busy = false; setState("");
        setMsg(vcard, "No pude crear el vídeo, señor: " + (e && e.message || e));
      });
      return;
    }

    // 0b) ¿Pide CREAR UNA WEB / PÁGINA? → MiniMax genera el HTML (vía el chat) y lo mostramos.
    var webPrompt = (window.API && window.API.asWebPrompt) ? window.API.asWebPrompt(text) : null;
    if (webPrompt) {
      if (!CFG.key) { addMsg("Falta tu API key de MiniMax, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
      busy = true; setState("thinking");
      var wcard = addMsg("…", "jv");
      setAgent(wcard, "Creando tu web…");
      API.generateWeb(webPrompt).then(function (html) {
        busy = false; setState("");
        setMsg(wcard, "Aquí tiene su web, señor. Tóquela para abrirla o descárguela.");
        addWeb(html, webPrompt);
        speak("Aquí tiene su web, señor.");
      }).catch(function (e) {
        busy = false; setState("");
        setMsg(wcard, "No pude crear la web, señor: " + (e && e.message || e));
      });
      return;
    }

    // 0) ¿Pide CREAR UNA IMAGEN? → la generamos con MiniMax (image-01) vía el Worker, sin pasar por
    //    el modelo de texto (que diría "soy solo texto"). Mostramos la imagen en el chat.
    var imgPrompt = (window.API && window.API.asImagePrompt) ? window.API.asImagePrompt(text) : null;
    if (imgPrompt) {
      if (!CFG.key) { addMsg("Falta tu API key de MiniMax, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
      busy = true; setState("thinking");
      var icard = addMsg("…", "jv");
      setAgent(icard, "Creando tu imagen: " + imgPrompt.slice(0, 40));
      API.generateImage(imgPrompt, API.imageAspect ? API.imageAspect(text) : "1:1").then(function (urls) {
        busy = false; setState("");
        if (urls && urls.length) {
          setMsg(icard, "Aquí tiene su imagen, señor.");
          urls.forEach(function (u) { addImage(u, imgPrompt); });
          speak("Aquí tiene su imagen, señor.");
        } else {
          setMsg(icard, "No he podido generar la imagen, señor. Inténtelo de nuevo.");
        }
      }).catch(function (e) {
        busy = false; setState("");
        setMsg(icard, "No pude generar la imagen, señor: " + (e && e.message || e));
      });
      return;
    }

    // 1) ¿Acción local? (abrir app, Modo Super, Dexter, etc.)
    var routed = Router.routeCommand(text);
    if (routed.handled) {
      if (routed.say) { addMsg(routed.say, "jv"); speak(routed.say); }
      // Guarda el intercambio en el historial para que MiniMax tenga contexto luego.
      if (window.API && window.API.addExchange && routed.say) window.API.addExchange(text, routed.say);
      return;
    }
    // 2) Si no, va al cerebro (MiniMax).
    if (!CFG.key) { addMsg("Falta tu API key, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
    busy = true;
    setState("thinking");
    var thinking = addMsg("…", "jv");
    API.askMiniMax(text, function (status) { setAgent(thinking, status); }).then(function (reply) {
      setMsg(thinking, reply || "(sin respuesta)");
      $("log").scrollTop = $("log").scrollHeight;
      var sl = $("super-log"); if (sl) sl.scrollTop = sl.scrollHeight;
      busy = false;
      speak(reply);
    }).catch(function (e) {
      setMsg(thinking, "Error: " + (e.message || e));
      busy = false; setState("");
    });
  }

  var _speakSafety = null;
  function speak(text) {
    if (_speakSafety) { clearTimeout(_speakSafety); _speakSafety = null; }
    if (!text) { setState(""); return; }
    setState("speaking");
    var done = false;
    var clear = function () { if (done) return; done = true; if (_speakSafety) { clearTimeout(_speakSafety); _speakSafety = null; } setState(""); };
    // Red de seguridad: si el TTS no dispara onend (pasa en la PWA instalada), el estado "HABLANDO"
    // se quedaba pegado y NO se podía volver a hablar. Lo soltamos solo tras un máximo estimado.
    var ms = Math.min(30000, Math.max(6000, text.length * 90));
    _speakSafety = setTimeout(clear, ms);
    Voice.speak(text, null, clear);
  }

  // ── Alarmas / recordatorios HABLADOS (mientras la app esté abierta; en 2º plano cerrado → APK) ──
  function loadAlarms() { try { return JSON.parse(localStorage.getItem("mm_alarms") || "[]") || []; } catch (e) { return []; } }
  function saveAlarms(a) { try { localStorage.setItem("mm_alarms", JSON.stringify(a)); } catch (e) {} }
  function pad2(n) { return String(n).padStart(2, "0"); }
  // Si el plugin NATIVO de alarma falla al programarla, la degradamos a alarma JS (suena con la app
  // abierta) en vez de dejar una alarma FANTASMA marcada native:true que checkAlarms() ignora siempre.
  function downgradeAlarm(id) {
    var a = loadAlarms(), ch = false;
    for (var i = 0; i < a.length; i++) if (a[i].id === id && a[i].native) { a[i].native = false; ch = true; }
    if (ch) { saveAlarms(a); startAlarmWatch(); try { addMsg("La alarma en 2º plano no se pudo registrar, señor; sonará si la app está abierta.", "sys"); } catch (e) {} }
  }
  // Plugin NATIVO de alarmas (solo existe dentro del APK): suena/habla con la app cerrada.
  function nativeAlarm() {
    try {
      var C = window.Capacitor;
      if (!(C && C.isNativePlatform && C.isNativePlatform())) return null;
      if (C.Plugins && C.Plugins.JarvisAlarm) return C.Plugins.JarvisAlarm;   // vía que funciona (bridge)
      if (typeof C.registerPlugin === "function") return C.registerPlugin("JarvisAlarm");
    } catch (e) {}
    return null;
  }
  var _alarmTimer = null;
  function startAlarmWatch() { if (_alarmTimer) return; _alarmTimer = setInterval(checkAlarms, 15000); checkAlarms(); }
  function checkAlarms() {
    var now = Date.now(), a = loadAlarms();
    var due = a.filter(function (x) { return x.at <= now; });
    if (!due.length) return;
    saveAlarms(a.filter(function (x) { return x.at > now; }));
    due.forEach(function (al) {
      if (al.native) return;   // la alarma NATIVA ya habla sola (aunque la app esté cerrada): no duplicar
      var phrase = "Señor, " + (al.label || "tiene su aviso") + ".";
      addMsg("⏰ " + phrase, "jv");
      try { if (window.sfx && window.sfx.beep) window.sfx.beep(); } catch (e) {}
      try { if ("Notification" in window && Notification.permission === "granted") new Notification("JARVIS", { body: phrase }); } catch (e) {}
      speak(phrase);
    });
  }
  // Detecta y programa una alarma/recordatorio. Devuelve la frase de confirmación o null.
  function parseAndSetAlarm(text) {
    var n = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!/\b(alarma|recuerdame|recuerda|recordatorio|avisame|avisa|despiertame|despierta|programa)\b/.test(n)) return null;
    var at = null;
    var mRel = n.match(/\ben\s+(\d{1,3})\s*(segundos?|seg|minutos?|min|horas?|h)\b/);
    if (mRel) {
      var q = parseInt(mRel[1], 10), u = mRel[2];
      var ms = /seg/.test(u) ? q * 1000 : /(hora|h)/.test(u) ? q * 3600000 : q * 60000;
      at = Date.now() + ms;
    }
    if (!at) {
      var mAbs = n.match(/a\s+las?\s+(\d{1,2})(?:[:\.](\d{2}))?\s*(de la (?:manana|tarde|noche)|am|pm|h)?/);
      if (mAbs) {
        var hh = parseInt(mAbs[1], 10), mm = mAbs[2] ? parseInt(mAbs[2], 10) : 0, mod = mAbs[3] || "";
        if (/(tarde|noche|pm)/.test(mod) && hh < 12) hh += 12;
        if (/(manana|am)/.test(mod) && hh === 12) hh = 0;
        var d = new Date(); d.setHours(hh, mm, 0, 0);
        if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
        at = d.getTime();
      }
    }
    if (!at) return null;
    var label = "";
    var mL = text.match(/\b(?:para|de|que|a)\s+(.+?)(?:\s+(?:a las|en)\b.*)?$/i);
    if (mL && mL[1] && mL[1].trim().length > 2 && !/^\d/.test(mL[1].trim()) && !/^las?\b/i.test(mL[1].trim())) {
      label = "le recuerdo: " + mL[1].trim();
    }
    var id = "a" + Date.now();
    var w = new Date(at), hhmm = pad2(w.getHours()) + ":" + pad2(w.getMinutes());
    var labelTxt = label ? (" — " + label.replace(/^le recuerdo: /, "")) : "";
    var spoken = label ? label.replace(/^le recuerdo: /, "le recuerdo, ") : "tiene su aviso";
    // En el APK: alarma NATIVA (habla aunque la app esté cerrada).
    var na = nativeAlarm();
    if (na) {
      var an = loadAlarms(); an.push({ id: id, at: at, label: label, native: true }); saveAlarms(an);
      startAlarmWatch();
      try { na.set({ at: at, id: id, phrase: "Señor, " + spoken + "." }).catch(function () { downgradeAlarm(id); }); }
      catch (e) { downgradeAlarm(id); }
      return "Hecho, señor. Le avisaré a las " + hhmm + labelTxt + ", aunque cierre la app.";
    }
    // En la web: temporizador interno (solo con la app abierta).
    var a = loadAlarms(); a.push({ id: id, at: at, label: label }); saveAlarms(a);
    startAlarmWatch();
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {}
    return "Hecho, señor. Le avisaré a las " + hhmm + labelTxt + ". (Mientras JARVIS esté abierto; la alarma con la app cerrada va en la app instalable.)";
  }

  // Detecta "envía a X por WhatsApp: mensaje" → {msg, number}. Requiere mencionar WhatsApp.
  function parseWhatsApp(text) {
    var n = (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!/\bwhatsapp\b|\bwasap\b|\bguasap\b/.test(n)) return null;
    if (!/\b(envia|enviale|enviar|manda|mandale|mandar|escribe|escribele|escribir|dile|mensaje|mandame)\b/.test(n)) return null;
    var msg = "";
    var mC = text.match(/:\s*([\s\S]+)$/); if (mC) msg = mC[1].trim();
    if (!msg) { var mQ = text.match(/\b(?:que|diciendo|dile que|poniendo|ponle)\s+([\s\S]+)$/i); if (mQ) msg = mQ[1].trim(); }
    var mN = n.match(/(\+?\d[\d\s]{6,}\d)/); var num = mN ? mN[1].replace(/[^\d]/g, "") : "";
    return { msg: msg, number: num };
  }

  // Pone una alarma desde la herramienta crear_alarma ({hora,minuto,en_minutos,etiqueta}). Devuelve frase.
  function setAlarmFromTool(inp) {
    inp = inp || {};
    var at, label = inp.etiqueta || "tiene su aviso";
    if (inp.en_minutos != null) { at = Date.now() + (parseInt(inp.en_minutos, 10) || 1) * 60000; }
    else {
      var h = inp.hora != null ? parseInt(inp.hora, 10) : null, m = inp.minuto != null ? parseInt(inp.minuto, 10) : 0;
      if (h == null || isNaN(h)) return "Necesito la hora para la alarma, señor.";
      var d = new Date(); d.setHours(h, m || 0, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); at = d.getTime();
    }
    var id = "a" + Date.now(), spoken = "le recuerdo: " + label;
    var w = new Date(at), hhmm = pad2(w.getHours()) + ":" + pad2(w.getMinutes());
    var na = nativeAlarm();
    if (na) {
      var an = loadAlarms(); an.push({ id: id, at: at, label: spoken, native: true }); saveAlarms(an); startAlarmWatch();
      try { na.set({ at: at, id: id, phrase: "Señor, " + spoken + "." }).catch(function () { downgradeAlarm(id); }); }
      catch (e) { downgradeAlarm(id); }
      return "Hecho. Le avisaré a las " + hhmm + " — " + label + ", aunque cierre la app.";
    }
    var a = loadAlarms(); a.push({ id: id, at: at, label: spoken }); saveAlarms(a); startAlarmWatch();
    return "Hecho. Le avisaré a las " + hhmm + " — " + label + " (mientras la app esté abierta).";
  }

  // Borra la conversación ACTIVA (chat normal + Super) PERO conserva los hechos de Eric (mm_facts).
  function clearChat() {
    if (window.API && window.API.clearHistory) window.API.clearHistory();
    $("log").innerHTML = ""; var sl = $("super-log"); if (sl) sl.innerHTML = "";
    addMsg("Conversación borrada, señor. Sigo recordando lo importante de usted.", "sys");
  }

  // ── Conversaciones (varias, con nombre) ──
  function updateConvoName() { var el = $("cv-name"); if (el && window.API && API.activeName) el.textContent = API.activeName(); }
  function renderHistory(welcomeIfEmpty) {
    $("log").innerHTML = ""; var sl = $("super-log"); if (sl) sl.innerHTML = "";
    var hist = (window.API && API.getHistory) ? API.getHistory() : [];
    if (hist.length) hist.forEach(function (m) { addMsg(m.content, m.role === "user" ? "me" : "jv"); });
    else addMsg(welcomeIfEmpty || "Nueva conversación, señor. ¿En qué le ayudo?", "jv");
    updateConvoName();
  }
  function openConvos() { renderConvoList(); $("convo-modal").classList.add("show"); }
  function closeConvos() { $("convo-modal").classList.remove("show"); }
  function newConversation() { if (window.API) API.newConvo(); renderHistory(); closeConvos(); }
  function renderConvoList() {
    var box = $("convo-list"); if (!box || !window.API) return;
    box.innerHTML = API.listConvos().map(function (c) {
      return '<div class="cv-row' + (c.active ? " on" : "") + '">' +
        '<button class="cv-pick" data-id="' + c.id + '">' + escapeHtml(c.name) +
        '<small>' + c.count + ' mensajes</small></button>' +
        '<button class="cv-edit" data-id="' + c.id + '" aria-label="Renombrar">✎</button>' +
        '<button class="cv-del" data-id="' + c.id + '" aria-label="Borrar">🗑</button></div>';
    }).join("");
    Array.prototype.forEach.call(box.querySelectorAll(".cv-pick"), function (b) {
      b.addEventListener("click", function () { API.switchConvo(b.dataset.id); renderHistory(); closeConvos(); });
    });
    Array.prototype.forEach.call(box.querySelectorAll(".cv-edit"), function (b) {
      b.addEventListener("click", function () { var n = prompt("Nombre de la conversación:"); if (n) { API.renameConvo(b.dataset.id, n); renderConvoList(); updateConvoName(); } });
    });
    Array.prototype.forEach.call(box.querySelectorAll(".cv-del"), function (b) {
      b.addEventListener("click", function () { if (confirm("¿Borrar esta conversación, señor?")) { API.deleteConvo(b.dataset.id); renderConvoList(); renderHistory(); } });
    });
  }

  // ── Voz (micro) ──
  function toggleMic() {
    Voice.unlock();
    if (!Voice.sttSupported) {
      addMsg("El dictado por voz no está disponible en este navegador (iPhone/Safari no lo soporta). Escribe el mensaje y te responderé hablando, señor.", "sys");
      return;
    }
    Voice.toggleListen(
      function (t) { setState(""); handle(t); },
      function (on) {
        $("mic").classList.toggle("on", on);
        setState(on ? "listening" : "");
      },
      function (err) {
        var msg = err === "not-allowed" || err === "service-not-allowed"
            ? "Permiso de micrófono denegado, señor. Actívalo: toca el candado 🔒 de la barra del navegador → Micrófono → Permitir."
          : err === "no-speech" ? "No te he oído, señor. Inténtalo otra vez."
          : err === "network" ? "El dictado por voz necesita conexión y a veces falla en la app instalada; prueba abriéndola en Chrome, señor."
          : err === "timeout" ? "El micro no respondió, señor. En la app instalada el dictado suele fallar: ábrela en Chrome y permite el micrófono."
          : err === "aborted" ? null
          : "El dictado por voz no funcionó (" + err + "). En Android usa Chrome; en iPhone no está soportado, escribe y te respondo hablando.";
        if (msg) addMsg(msg, "sys");
      }
    );
  }

  // ── Reloj ──
  function tickClock() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, "0");
    var mm = String(now.getMinutes()).padStart(2, "0");
    var ss = String(now.getSeconds()).padStart(2, "0");
    $("m-clock").textContent = hh + ":" + mm + ":" + ss;
    var dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    var meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    $("m-date").textContent = dias[now.getDay()] + ", " + now.getDate() + " " + meses[now.getMonth()] + " " + now.getFullYear();
  }

  // ── Clima ──
  function loadWeather() {
    Weather.fetch().then(function (w) {
      if (w.temp != null) $("wx-temp").textContent = w.temp;
      $("wx-icon").textContent = w.icon;
      $("wx-desc").textContent = (w.desc + (w.city ? " · " + w.city : "")).toUpperCase();
    }).catch(function () { /* sin red: deja el placeholder */ });
  }

  // ── Estado online ──
  function refreshOnline() {
    var on = navigator.onLine !== false;
    var el = $("m-online");
    el.classList.toggle("off", !on);
    el.lastChild.textContent = on ? "ONLINE" : "SIN RED";
  }

  // ── Ajustes / instalación ──
  function openSettings() {
    $("cfg-key").value = CFG.key;
    $("cfg-base").value = CFG.base;
    $("cfg-model").value = CFG.model;
    $("cfg-tts").value = localStorage.getItem("mm_tts_worker") || "";
    if (window.Extras) window.Extras.init();   // Comandos / Mis Apps / Diagnóstico
    if (window.sfx) $("cfg-sfx").classList.toggle("on", window.sfx.enabled);
    $("cfg-clap").classList.toggle("on", CFG.clap);
    $("cfg-wake").classList.toggle("on", CFG.wake);
    try {
      $("cfg-el-key").value = localStorage.getItem("el_key") || "";
      $("cfg-el-voice").value = localStorage.getItem("el_voice") || "JBFqnCBsd6RMkjVDRZzb";
      $("cfg-el-on").classList.toggle("on", localStorage.getItem("el_on") === "1");
    } catch (e) {}
    var vl = $("ver-label"); if (vl) vl.textContent = "JARVIS móvil · v" + APP_VERSION;
    var ap = $("apk-powers"); if (ap) ap.style.display = (window.Native && window.Native.isNative()) ? "block" : "none";
    $("modal").classList.add("show");
  }
  function closeSettings() { $("modal").classList.remove("show"); }
  function saveSettings() {
    localStorage.setItem("mm_key", $("cfg-key").value.trim());
    localStorage.setItem("mm_base", ($("cfg-base").value.trim() || "https://api.minimax.io/anthropic"));
    localStorage.setItem("mm_model", ($("cfg-model").value.trim() || "MiniMax-M2"));
    localStorage.setItem("mm_tts_worker", ($("cfg-tts").value.trim().replace(/\/+$/, "")));
    try {
      localStorage.setItem("el_key", $("cfg-el-key").value.trim());
      localStorage.setItem("el_voice", $("cfg-el-voice").value);
      localStorage.setItem("el_on", $("cfg-el-on").classList.contains("on") ? "1" : "0");
    } catch (e) {}
    closeSettings();
    if (CFG.key) addMsg("Configuración guardada, señor. ¿En qué puedo ayudarle?", "jv");
  }

  // PWA install
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; });
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; });
    } else if (isStandalone()) {
      $("install-hint").textContent = "Ya tienes JARVIS instalado, señor. ✓";
    } else {
      // iOS Safari (sin beforeinstallprompt): instrucción manual.
      var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      $("install-hint").innerHTML = iOS
        ? "En iPhone: pulsa <b>Compartir</b> (el cuadro con la flecha ↑) y luego <b>«Añadir a pantalla de inicio»</b>."
        : "Abre el menú del navegador (⋮) y elige <b>«Instalar app»</b> o <b>«Añadir a pantalla de inicio»</b>.";
    }
  }

  // ── Dock de apps ──
  function wireDock() {
    document.querySelectorAll(".qbtn").forEach(function (b) {
      b.addEventListener("click", function () {
        Voice.unlock();
        if (b.dataset.cam) { $("cam").click(); return; }
        var say = Links.openApp(b.dataset.app);
        if (say) addMsg(say, "jv");
      });
    });
    $("cam").addEventListener("change", function () {
      if (this.files && this.files[0]) addMsg("Foto capturada, señor.", "sys");
    });
  }

  // ── Wire general ──
  var _sfxUnlocked = false, _clapTried = false;
  function wire() {
    // Sonido al tocar botones (y desbloqueo del audio en el primer gesto).
    document.addEventListener("pointerdown", function (e) {
      try { if (window.Voice && Voice.unlock) Voice.unlock(); } catch (e2) {}   // desbloquea audio (voz) en cualquier toque
      // Doble palmada: si está activada, arráncala en el primer toque (gesto necesario para el micro).
      if (!_clapTried && CFG.clap && window.Clap && !window.Clap.isRunning()) { _clapTried = true; try { window.Clap.start(); } catch (e3) {} }
      if (!window.sfx) return;
      if (!_sfxUnlocked) { window.sfx.unlock(); _sfxUnlocked = true; }
      var el = e.target && e.target.closest ? e.target.closest("button, .qbtn, .sup-app, .nav-item") : null;
      if (el) window.sfx.tap();
    }, { passive: true });
    $("send").addEventListener("click", function () { Voice.unlock(); handle($("text").value); });
    $("text").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); handle($("text").value); } });
    $("mic").addEventListener("click", toggleMic);
    $("attach").addEventListener("click", function () { Voice.unlock(); $("img-in").click(); });
    $("img-in").addEventListener("change", onImagePicked);
    $("gear").addEventListener("click", openSettings);
    $("cfg-cancel").addEventListener("click", closeSettings);
    $("cfg-x").addEventListener("click", closeSettings);
    $("cfg-save").addEventListener("click", saveSettings);
    $("cfg-install").addEventListener("click", doInstall);
    $("cfg-update").addEventListener("click", forceUpdate);
    $("cfg-clear").addEventListener("click", function () { closeSettings(); clearChat(); });
    // Conversaciones
    $("cv-open").addEventListener("click", openConvos);
    $("cv-new").addEventListener("click", newConversation);
    $("cv-clear").addEventListener("click", clearChat);
    $("cv-x").addEventListener("click", closeConvos);
    $("cv-add").addEventListener("click", newConversation);
    $("cfg-testvoice").addEventListener("click", function () {
      if (window.PCVoice) PCVoice.unlock();
      closeSettings();
      addMsg("Probando la voz de Álvaro, señor…", "sys");
      if (window.PCVoice) {
        PCVoice.speak("Hola señor. Soy Jarvis, esta es mi voz.", null, function () {})
          .then(function () { addMsg("✓ Voz de Álvaro reproducida. ¿La has oído?", "sys"); })
          .catch(function (e) { addMsg("✗ Falló la voz del PC: " + (e && e.message || e) + ". Por eso suena la del sistema. Dímelo y lo arreglo.", "sys"); });
      }
    });
    $("cfg-el-on").addEventListener("click", function () { this.classList.toggle("on"); });
    $("cfg-el-test").addEventListener("click", function () {
      var k = $("cfg-el-key").value.trim();
      if (!k) { addMsg("Mete primero la API key de ElevenLabs, señor.", "sys"); return; }
      // Guarda key/voz al momento para la prueba.
      try { localStorage.setItem("el_key", k); localStorage.setItem("el_voice", $("cfg-el-voice").value); } catch (e) {}
      if (window.ElevenTTS) ElevenTTS.unlock();
      closeSettings();
      addMsg("Probando la voz premium (ElevenLabs), señor…", "sys");
      if (window.ElevenTTS) {
        ElevenTTS.test()
          .then(function () { addMsg("✓ Voz premium reproducida. Actívala con el interruptor para usarla siempre.", "sys"); })
          .catch(function (e) { addMsg("✗ Falló ElevenLabs: " + (e && e.message || e) + ". Revisa la key o el saldo (10.000 caracteres/mes en el plan gratis).", "sys"); });
      }
    });
    // Poderes del APK (solo si estamos en la app nativa)
    if ($("cfg-notif")) $("cfg-notif").addEventListener("click", function () { if (window.Native) { Native.openNotifSettings(); addMsg("Activa «JARVIS» en Acceso a notificaciones, señor; luego dime «lee mis notificaciones».", "sys"); } });
    if ($("cfg-access")) $("cfg-access").addEventListener("click", function () { if (window.Native) { Native.openAccessibility(); addMsg("Activa «JARVIS» en Accesibilidad, señor; luego podré mirar/controlar la pantalla.", "sys"); } });
    if ($("cfg-mic-bg")) $("cfg-mic-bg").addEventListener("click", function () {
      var on = !this.classList.contains("on"); this.classList.toggle("on", on);
      if (window.Native) { if (on) Native.startMic(); else Native.stopMic(); }
      addMsg(on ? "Escucha en 2º plano activada, señor." : "Escucha en 2º plano desactivada.", "sys");
    });
    if ($("cfg-diag")) $("cfg-diag").addEventListener("click", function () {
      closeSettings();
      var d = (window.Native && window.Native.diagnose) ? window.Native.diagnose() : { isNative: false, plugins: {} };
      var lines = ["🩺 Diagnóstico, señor:", "- App nativa (APK): " + (d.isNative ? "SÍ" : "no (estás en la web)")];
      var ok = "✅", no = "❌";
      var labels = {
        JarvisOpen: "Abrir apps", JarvisCall: "Llamar / SMS", JarvisNotifications: "Leer notificaciones",
        JarvisScreen: "Ver pantalla", JarvisAccessibility: "Controlar pantalla", JarvisAlarm: "Alarmas habladas",
        SpeechRecognition: "Voz (reconocimiento)", Filesystem: "Crear archivos",
      };
      for (var k in labels) lines.push("- " + labels[k] + ": " + (d.plugins[k] ? ok + " cargado" : no + " NO cargado"));
      if (d.isNative) {
        var fails = []; for (var k2 in labels) if (!d.plugins[k2]) fails.push(labels[k2]);
        lines.push(fails.length
          ? "\nAlgo no cargó. Si acabas de actualizar: DESINSTALA el APK viejo y reinstala (un Service Worker o permiso cacheado sobrevive a la actualización)."
          : "\nTodo cargado. Concede los permisos (notificaciones, accesibilidad, micro) la primera vez y ya puedo usarlos.");
      } else {
        lines.push("\nEsto es la web; los poderes nativos (abrir apps, ver pantalla, SMS, llamar) solo van dentro del APK.");
      }
      addMsg(lines.join("\n"), "sys");
    });
    if ($("cfg-update")) $("cfg-update").addEventListener("click", function () {
      closeSettings(); doUpdate();
    });
    $("cfg-sfx").addEventListener("click", function () {
      if (!window.sfx) return;
      var on = !window.sfx.enabled; window.sfx.setEnabled(on);
      this.classList.toggle("on", on); if (on) window.sfx.beep();
    });
    $("cfg-clap").addEventListener("click", function () {
      var on = !CFG.clap; CFG.clap = on; this.classList.toggle("on", on);
      if (on) { if (window.Clap) window.Clap.start(); }              // arranca aquí (gesto → permite el micro)
      else { if (window.Clap) window.Clap.stop(); }
    });
    $("cfg-wake").addEventListener("click", function () {
      var on = !CFG.wake; CFG.wake = on; this.classList.toggle("on", on);
      // Si el Super está abierto, aplica el cambio al momento.
      if (window.Voice) {
        if (on && window.__superActive && window.Voice.startWake) { try { window.Voice.startWake(function (cmd) { if (window.APP) window.APP.handle(cmd); }, function () {}); } catch (e) {} }
        else if (!on && window.Voice.stopWake) { try { window.Voice.stopWake(); } catch (e) {} }
      }
    });
    $("btn-super").addEventListener("click", function () { Voice.unlock(); if (window.Super) window.Super.show(); });
    $("moon").addEventListener("click", function () { if (window.Standby) window.Standby.show(); });
    window.addEventListener("online", refreshOnline);
    window.addEventListener("offline", refreshOnline);
    wireDock();
  }

  // ── Actualización del APK (firma estable → se instala ENCIMA, sin desinstalar) ──
  var APK_URL = "https://ericpgif.github.io/jarvis-movil/jarvis.apk";
  function doUpdate() {
    addMsg("Descargando la última versión, señor. Cuando acabe la descarga, ÁBRELA e instálala — se instala encima, ya no hay que desinstalar.", "sys");
    try {
      if (window.Native && window.Native.isNative() && window.Native.openExternal)
        window.Native.openExternal(APK_URL).catch(function (e) { addMsg("No pude abrir la descarga, señor: " + (e && e.message || e), "sys"); });
      else window.open(APK_URL, "_blank");
    } catch (e) { addMsg("No pude abrir la descarga, señor.", "sys"); }
  }
  // En el APK, al arrancar comprueba si hay una versión más nueva publicada y avisa (no descarga solo).
  function checkNativeUpdate() {
    try {
      fetch("https://ericpgif.github.io/jarvis-movil/version.json?_=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (v) {
          var served = v && v.version;
          if (!served || served === APP_VERSION) return;
          addMsg("🔄 Hay una versión nueva de JARVIS (v" + served + "), señor. Ve a Ajustes → «Buscar / instalar actualización» para ponerla (se instala encima, sin desinstalar).", "sys");
        }).catch(function () {});
    } catch (e) {}
  }

  // ── Auto-actualización (sin reinstalar) ──
  var _swReg = null;
  function setupAutoUpdate() {
    // En el APK (Capacitor) el Service Worker SOBRA y puede ROMPER el bridge nativo (plugins no
    // cargan → "permisos a todo pero no va"). Lo desregistramos y NO lo activamos.
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { try { r.unregister(); } catch (e) {} }); }); } catch (e) {}
      try { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { try { caches.delete(k); } catch (e) {} }); }); } catch (e) {}
      setTimeout(checkNativeUpdate, 4000);   // avisa si hay APK más nuevo (tras cargar el chat)
      return;
    }
    if (!("serviceWorker" in navigator)) return;
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (refreshing) return;
      if (!hadController) { hadController = true; return; }   // 1ª instalación: no recargar
      refreshing = true;
      window.location.reload();                               // nueva versión lista → recarga sola
    });
    // updateViaCache:"none" → el navegador comprueba sw.js SIEMPRE fresco (no cacheado).
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
      _swReg = reg;
      try { reg.update(); } catch (e) {}
      checkVersion();   // ¿hay versión nueva? (esquiva el CDN)
      setInterval(function () { try { reg.update(); } catch (e) {} }, 60000);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { try { reg.update(); } catch (e) {} checkVersion(); }
      });
    }).catch(function () {});
  }
  // Botón manual CONTUNDENTE: borra todas las cachés + desregistra el SW + recarga.
  // Es la palanca fiable si una versión se quedara pegada.
  function forceUpdate() {
    addMsg("🔄 Forzando la última versión, señor…", "sys");
    var go = function () { try { window.location.reload(true); } catch (e) { window.location.reload(); } };
    var jobs = [];
    try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
        jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    } catch (e) {}
    Promise.all(jobs).then(function () { setTimeout(go, 300); }).catch(function () { setTimeout(go, 300); });
  }

  // Chequeo de versión que ESQUIVA el CDN de GitHub Pages (query única → siempre fresco).
  // Si hay versión nueva, auto-actualiza UNA vez por sesión (anti-bucle por si el CDN aún
  // sirve el shell viejo). Recarga silenciosa (decisión de Eric).
  function checkVersion() {
    fetch("version.json?_=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        var served = v && v.version;
        if (!served || served === APP_VERSION) return;          // ya estás en la última
        var tried = sessionStorage.getItem("jv_update_tried");
        if (tried === served) {                                  // ya lo intenté y el CDN sigue viejo
          addMsg("Hay una versión nueva (v" + served + "), señor; el servidor aún sirve la anterior por caché. Vuelva a abrir la app en unos minutos.", "sys");
          return;
        }
        try { sessionStorage.setItem("jv_update_tried", served); } catch (e) {}
        // Actualización AGRESIVA: borra las cachés (así la recarga trae los archivos NUEVOS, no los
        // viejos de la caché) + empuja el SW nuevo + recarga. Es la palanca fiable para que llegue.
        var finish = function () { try { window.location.reload(); } catch (e) {} };
        var jobs = [];
        try { if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
        if (_swReg) { try { _swReg.update().then(function () { if (_swReg.waiting) { try { _swReg.waiting.postMessage("skipWaiting"); } catch (e) {} } }).catch(function () {}); } catch (e) {} }
        Promise.all(jobs).then(function () { setTimeout(finish, 800); }).catch(function () { setTimeout(finish, 800); });
      }).catch(function () {});
  }
  function notifyVersion() {
    try {
      var prev = localStorage.getItem("jv_ver");
      if (prev && prev !== APP_VERSION) {
        addMsg("✨ JARVIS actualizado (v" + APP_VERSION + "): " + WHATS_NEW, "sys");
      }
      localStorage.setItem("jv_ver", APP_VERSION);
    } catch (e) {}
  }

  // ── Arranque ──
  function boot() {
    Sphere.make($("m-sphere"), { state: true, N: 84, R: 78 });
    tickClock(); setInterval(tickClock, 1000);
    refreshOnline();
    loadWeather(); setInterval(loadWeather, 10 * 60 * 1000);
    wire();
    // Hooks de UI para las herramientas (function-calling): que execTool pueda pintar y poner alarmas.
    if (window.API && window.API.setUI) window.API.setUI({
      image: addImage, video: addVideo, web: addWeb,
      sys: function (t) { addMsg(t, "sys"); },
      alarm: setAlarmFromTool,
    });
    if (window.Extras) window.Extras.renderDock();   // accesos directos de "Mis Apps" en el dock
    // Si ya está INSTALADA, oculta SOLO lo de instalar (no el bloque entero): "Buscar
    // actualización" y "Borrar conversación" deben seguir visibles en la app instalada.
    if (isStandalone()) {
      ["cfg-install", "install-hint"].forEach(function (id) { var e = $(id); if (e) e.style.display = "none"; });
      var tag = document.querySelector(".cfg-block .tag"); if (tag) tag.style.display = "none";
    }
    setupAutoUpdate();
    notifyVersion();
    startAlarmWatch();   // reanuda alarmas pendientes de sesiones anteriores


    // Saludo / pedir key — DESPUÉS de la intro.
    function start() {
      if (!CFG.key) {
        addMsg("Bienvenido, señor. Pulse el engranaje ⚙ e introduzca su API key de MiniMax para empezar.", "jv");
        openSettings();
        return;
      }
      // MEMORIA: si hay conversación guardada, la mostramos (JARVIS la recuerda).
      var hist = (window.API && window.API.getHistory) ? window.API.getHistory() : [];
      if (hist.length) {
        hist.forEach(function (m) { addMsg(m.content, m.role === "user" ? "me" : "jv"); });
        addMsg("Aquí seguimos, señor. Lo recuerdo todo.", "sys");
      } else {
        addMsg("J.A.R.V.I.S. a su servicio, señor. Hábleme o escriba.", "jv");
      }
      updateConvoName();
    }
    if (window.Standby && window.Standby.start) window.Standby.start();   // espera tras 2 min sin tocar
    if (window.Intro && window.Intro.play) window.Intro.play(start);
    else start();
  }

  // Exponer utilidades para otros módulos (super, intro).
  window.APP = { handle: handle, addMsg: addMsg, setState: setState, speak: speak, openSettings: openSettings, mic: toggleMic };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
