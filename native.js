/* native.js — Puente con los plugins NATIVOS del APK (solo existen dentro de JARVIS Max APK).
   En la web todo esto es no-op (Native.isNative() === false) y los comandos caen a MiniMax.
   Plugins: JarvisNotifications (B4), JarvisScreen (B5), JarvisAccessibility + JarvisCall (B6). */
(function () {
  "use strict";
  function isNative() { try { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) { return false; } }
  function reg(name) { try { return (isNative() && window.Capacitor.registerPlugin) ? window.Capacitor.registerPlugin(name) : null; } catch (e) { return null; } }
  var P = {};
  function plugins() {
    if (!isNative()) return P;
    P.Notifs = P.Notifs || reg("JarvisNotifications");
    P.Screen = P.Screen || reg("JarvisScreen");
    P.Access = P.Access || reg("JarvisAccessibility");
    P.Call   = P.Call   || reg("JarvisCall");
    return P;
  }
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

  window.Native = {
    isNative: isNative, plugins: plugins,
    readNotifications: readNotifications, openNotifSettings: openNotifSettings,
    captureScreen: captureScreen, startMic: startMic, stopMic: stopMic,
    openAccessibility: openAccessibility, readScreen: readScreen, setText: setText, clickByText: clickByText, call: call,
  };
})();
