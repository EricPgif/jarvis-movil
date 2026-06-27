/* native.js — Puente con los plugins NATIVOS del APK (solo existen dentro de JARVIS Max APK).
   En la web todo esto es no-op (Native.isNative() === false) y los comandos caen a MiniMax.
   Plugins: JarvisNotifications (B4), JarvisScreen (B5), JarvisAccessibility + JarvisCall (B6). */
(function () {
  "use strict";
  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }
  // Obtiene un plugin nativo por nombre. El bridge de Capacitor 8 expone los plugins REGISTRADOS en
  // `Capacitor.Plugins` (proxy) — es la vía que SÍ funciona (igual que SpeechRecognition/Filesystem).
  // `registerPlugin` se queda como respaldo. (Antes usábamos solo registerPlugin → no resolvía los
  // plugins propios y "no cargaba nada": abrir apps, llamar, SMS, notificaciones, pantalla, alarmas.)
  function reg(name) {
    try {
      if (!isNative()) return null;
      var C = window.Capacitor || {};
      if (C.Plugins && C.Plugins[name]) return C.Plugins[name];
      if (typeof C.registerPlugin === "function") return C.registerPlugin(name);
      return null;
    } catch (e) { return null; }
  }
  var P = {};
  function plugins() {
    if (!isNative()) return P;
    P.Notifs = P.Notifs || reg("JarvisNotifications");
    P.Screen = P.Screen || reg("JarvisScreen");
    P.Access = P.Access || reg("JarvisAccessibility");
    P.Call   = P.Call   || reg("JarvisCall");
    P.Open   = P.Open   || reg("JarvisOpen");
    return P;
  }
  // ── Abrir apps/URLs de forma NATIVA (en el WebView window.location.href no abre apps) ──
  function openExternal(url, fallbackUrl) { var p = plugins(); if (!p.Open) return Promise.reject(new Error("no-native")); return p.Open.openExternal({ url: url, fallbackUrl: fallbackUrl || "" }); }
  // Descarga el APK nuevo y lanza el instalador de Android (un toque; con firma estable, instala encima).
  function installUpdate(url) { var p = plugins(); if (!p.Open || !p.Open.installUpdate) return Promise.reject(new Error("no-native")); return p.Open.installUpdate({ url: url }); }
  function openPackage(pkg, fallbackUrl) { var p = plugins(); if (!p.Open) return Promise.reject(new Error("no-native")); return p.Open.open({ package: pkg, fallbackUrl: fallbackUrl || "" }); }
  // ── B4: notificaciones ──
  function readNotifications() {
    var p = plugins(); if (!p.Notifs) return Promise.reject(new Error("no-native"));
    return p.Notifs.getActive().then(function (r) { return (r && r.notifications) || []; });
  }
  function openNotifSettings() { var p = plugins(); if (p.Notifs) p.Notifs.openSettings(); }
  // ── B5: capturar la pantalla → data URI (para la visión) ──
  function captureScreen() {
    var p = plugins(); if (!p.Screen) return Promise.reject(new Error("no-native"));
    return p.Screen.captureScreen().then(function (r) { return (r && r.base64) || ""; });
  }
  function startMic() { var p = plugins(); if (p.Screen) p.Screen.startMic(); }
  function stopMic() { var p = plugins(); if (p.Screen) p.Screen.stopMic(); }
  // ── B6: accesibilidad + llamadas ──
  function openAccessibility() { var p = plugins(); if (p.Access) p.Access.openAccessibilitySettings(); }
  function readScreen() { var p = plugins(); if (!p.Access) return Promise.reject(new Error("no-native")); return p.Access.readScreen().then(function (r) { return (r && r.text) || ""; }); }
  function setText(t) { var p = plugins(); if (!p.Access) return Promise.reject(new Error("no-native")); return p.Access.setText({ text: t }); }
  function clickByText(t) { var p = plugins(); if (!p.Access) return Promise.reject(new Error("no-native")); return p.Access.clickByText({ text: t }); }
  function call(number) { var p = plugins(); if (!p.Call) return Promise.reject(new Error("no-native")); return p.Call.call({ number: number }); }
  function sendSms(number, message) { var p = plugins(); if (!p.Call) return Promise.reject(new Error("no-native")); return p.Call.sendSms({ number: number, message: message || "" }); }
  // ── Archivos: crea un .txt/.md/.csv en Documentos (vía @capacitor/filesystem) ──
  function writeFile(name, content) {
    try {
      var FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
      if (!FS) return Promise.reject(new Error("no-native"));
      return FS.writeFile({ path: name, data: String(content == null ? "" : content), directory: "DOCUMENTS", encoding: "utf8", recursive: true })
        .then(function () { return name; });
    } catch (e) { return Promise.reject(e); }
  }

  // ── Diagnóstico: qué plugins han cargado de verdad (para el bloque de Ajustes del APK) ──
  function diagnose() {
    var p = plugins();
    return {
      isNative: isNative(),
      plugins: {
        JarvisOpen: !!p.Open, JarvisNotifications: !!p.Notifs, JarvisScreen: !!p.Screen,
        JarvisAccessibility: !!p.Access, JarvisCall: !!p.Call,
        JarvisAlarm: !!reg("JarvisAlarm"),
        SpeechRecognition: !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition),
        Filesystem: !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem),
      },
    };
  }

  window.Native = {
    isNative: isNative, plugins: plugins, diagnose: diagnose,
    openExternal: openExternal, openPackage: openPackage, installUpdate: installUpdate,
    readNotifications: readNotifications, openNotifSettings: openNotifSettings,
    captureScreen: captureScreen, startMic: startMic, stopMic: stopMic,
    openAccessibility: openAccessibility, readScreen: readScreen, setText: setText, clickByText: clickByText,
    call: call, sendSms: sendSms, writeFile: writeFile,
  };
})();
