/* movil.js — Orquestador de la app móvil JARVIS.
   Une: router de comandos → MiniMax, voz, dock de apps, clima, reloj, esfera, ajustes, instalar PWA.
   Sin backend Python; la key vive solo en este móvil (localStorage). */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var busy = false;

  // Versión de la app (subir en cada cambio). Si cambia respecto a la guardada, avisa.
  var APP_VERSION = "1.9";
  var WHATS_NEW = "Sonidos de interfaz (ticks al colocarse las apps en la intro y al tocar). Toggle en Ajustes.";

  // ── UI: mensajes y estado ──
  function addMsg(text, cls) {
    var d = document.createElement("div");
    d.className = "msg " + cls;
    d.textContent = text;
    var log = $("log");
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    // Espeja en el chat del Modo Super si está montado.
    var slog = $("super-log");
    if (slog) {
      var c = d.cloneNode(true);
      slog.appendChild(c);
      slog.scrollTop = slog.scrollHeight;
    }
    return d;
  }
  function setState(s) {   // '', 'listening', 'speaking', 'thinking'
    Sphere.setMode(s === "thinking" ? "processing" : (s || "idle"));
    $("m-status").textContent =
      s === "listening" ? "ESCUCHANDO" : s === "speaking" ? "HABLANDO" :
      s === "thinking" ? "PROCESANDO…" : "EN LÍNEA";
  }

  // ── Núcleo: procesar una orden (de voz o texto) ──
  function handle(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    addMsg(text, "me");
    $("text").value = "";

    // 1) ¿Acción local? (abrir app, Modo Super, Dexter, etc.)
    var routed = Router.routeCommand(text);
    if (routed.handled) {
      if (routed.say) { addMsg(routed.say, "jv"); speak(routed.say); }
      return;
    }
    // 2) Si no, va al cerebro (MiniMax).
    if (!CFG.key) { addMsg("Falta tu API key, señor. Pulsa el engranaje ⚙.", "jv"); openSettings(); return; }
    busy = true;
    setState("thinking");
    var thinking = addMsg("…", "jv");
    API.askMiniMax(text).then(function (reply) {
      thinking.textContent = reply || "(sin respuesta)";
      $("log").scrollTop = $("log").scrollHeight;
      busy = false;
      speak(reply);
    }).catch(function (e) {
      thinking.textContent = "Error: " + (e.message || e);
      thinking.classList.add("sys");
      busy = false; setState("");
    });
  }

  function speak(text) {
    if (!text) { setState(""); return; }
    setState("speaking");
    Voice.speak(text, null, function () { setState(""); });
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
    if (window.Extras) window.Extras.init();   // Comandos / Mis Apps / Diagnóstico
    if (window.sfx) $("cfg-sfx").classList.toggle("on", window.sfx.enabled);
    var vl = $("ver-label"); if (vl) vl.textContent = "JARVIS móvil · v" + APP_VERSION;
    $("modal").classList.add("show");
  }
  function closeSettings() { $("modal").classList.remove("show"); }
  function saveSettings() {
    localStorage.setItem("mm_key", $("cfg-key").value.trim());
    localStorage.setItem("mm_base", ($("cfg-base").value.trim() || "https://api.minimax.io/anthropic"));
    localStorage.setItem("mm_model", ($("cfg-model").value.trim() || "MiniMax-M2"));
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
  var _sfxUnlocked = false;
  function wire() {
    // Sonido al tocar botones (y desbloqueo del audio en el primer gesto).
    document.addEventListener("pointerdown", function (e) {
      if (!window.sfx) return;
      if (!_sfxUnlocked) { window.sfx.unlock(); _sfxUnlocked = true; }
      var el = e.target && e.target.closest ? e.target.closest("button, .qbtn, .sup-app, .nav-item") : null;
      if (el) window.sfx.tap();
    }, { passive: true });
    $("send").addEventListener("click", function () { Voice.unlock(); handle($("text").value); });
    $("text").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); handle($("text").value); } });
    $("mic").addEventListener("click", toggleMic);
    $("gear").addEventListener("click", openSettings);
    $("cfg-cancel").addEventListener("click", closeSettings);
    $("cfg-x").addEventListener("click", closeSettings);
    $("cfg-save").addEventListener("click", saveSettings);
    $("cfg-install").addEventListener("click", doInstall);
    $("cfg-update").addEventListener("click", forceUpdate);
    $("cfg-sfx").addEventListener("click", function () {
      if (!window.sfx) return;
      var on = !window.sfx.enabled; window.sfx.setEnabled(on);
      this.classList.toggle("on", on); if (on) window.sfx.beep();
    });
    $("btn-super").addEventListener("click", function () { Voice.unlock(); if (window.Super) window.Super.show(); });
    $("moon").addEventListener("click", function () { if (window.Standby) window.Standby.show(); });
    window.addEventListener("online", refreshOnline);
    window.addEventListener("offline", refreshOnline);
    wireDock();
  }

  // ── Auto-actualización (sin reinstalar) ──
  var _swReg = null;
  function setupAutoUpdate() {
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
      setInterval(function () { try { reg.update(); } catch (e) {} }, 60000);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) { try { reg.update(); } catch (e) {} }
      });
    }).catch(function () {});
  }
  // Botón manual: fuerza la búsqueda + recarga a la última versión.
  function forceUpdate() {
    addMsg("🔄 Buscando versión nueva, señor…", "sys");
    var go = function () { try { window.location.reload(true); } catch (e) { window.location.reload(); } };
    if (_swReg) {
      _swReg.update().then(function () {
        if (_swReg.waiting) { try { _swReg.waiting.postMessage("skipWaiting"); } catch (e) {} }
        setTimeout(go, 900);
      }).catch(go);
    } else { go(); }
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
    if (window.Extras) window.Extras.renderDock();   // accesos directos de "Mis Apps" en el dock
    if (isStandalone()) { var blk = document.querySelector(".cfg-block"); if (blk) blk.style.display = "none"; }
    setupAutoUpdate();
    notifyVersion();


    // Saludo / pedir key — DESPUÉS de la intro.
    function start() {
      if (!CFG.key) {
        addMsg("Bienvenido, señor. Pulse el engranaje ⚙ e introduzca su API key de MiniMax para empezar.", "jv");
        openSettings();
      } else {
        addMsg("J.A.R.V.I.S. a su servicio, señor. Hábleme o escriba.", "jv");
      }
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
