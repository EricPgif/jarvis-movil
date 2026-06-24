/* extras.js — Comandos + Mis Apps (accesos directos que añades TÚ, ya que el móvil no
   deja escanear las apps instaladas) + Diagnóstico del móvil. Se muestran en Ajustes;
   las apps añadidas también salen en el dock del dashboard. Expone window.Extras. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ── Comandos (disparadores) ──
  var COMMANDS = [
    { k: "«Dexter»", v: "Vídeo de Dexter (TikTok)" },
    { k: "«Brian»", v: "Vídeo de Brian Moser (TikTok)" },
    { k: "«Rita»", v: "Vídeo de Rita (TikTok)" },
    { k: "«Cristina»", v: "Su canción (Spotify)" },
    { k: "«activa/sal del modo super»", v: "Entra/sale del Modo Super" },
    { k: "«abre Spotify / YouTube / WhatsApp…»", v: "Abre esa app" },
    { k: "«pon música de …»", v: "Busca en Spotify" },
    { k: "doble palmada 👏👏", v: "Pone música (Tony Stark)" },
    { k: "(cualquier otra cosa)", v: "Responde JARVIS (MiniMax)" },
  ];
  function renderCommands() {
    var box = $("cmd-list"); if (!box) return;
    box.innerHTML = COMMANDS.map(function (c) {
      return '<div class="ex-row"><b>' + c.k + '</b><span>' + c.v + '</span></div>';
    }).join("");
  }

  // ── Mis Apps (localStorage) ──
  function getApps() { try { return JSON.parse(localStorage.getItem("my_apps") || "[]"); } catch (e) { return []; } }
  function setApps(a) { localStorage.setItem("my_apps", JSON.stringify(a)); }
  function renderApps() {
    var box = $("myapps-list"); if (!box) return;
    var apps = getApps();
    box.innerHTML = apps.length ? apps.map(function (a, i) {
      return '<div class="ex-row"><b>' + esc(a.name) + '</b><button data-del="' + i + '" class="ex-del">✕</button></div>';
    }).join("") : '<div class="hint">Aún no has añadido apps, señor.</div>';
    Array.prototype.forEach.call(box.querySelectorAll(".ex-del"), function (b) {
      b.addEventListener("click", function () { var a = getApps(); a.splice(+b.dataset.del, 1); setApps(a); renderApps(); renderSuggest(); renderDock(); });
    });
  }
  function addApp() {
    var n = ($("app-name").value || "").trim(), u = ($("app-url").value || "").trim();
    if (!n || !u) return;
    var a = getApps(); a.push({ name: n, url: u, web: /^https?:/.test(u) ? u : "" }); setApps(a);
    $("app-name").value = ""; $("app-url").value = "";
    renderApps(); renderSuggest(); renderDock();
  }
  function renderDock() {
    var dock = $("dock"); if (!dock) return;
    Array.prototype.forEach.call(dock.querySelectorAll("[data-myapp]"), function (e) { e.remove(); });
    getApps().forEach(function (a, i) {
      var b = document.createElement("button");
      b.className = "qbtn"; b.setAttribute("data-myapp", i);
      b.innerHTML = '<span class="qi">▣</span><span class="ql">' + esc(a.name.slice(0, 9)) + '</span>';
      b.addEventListener("click", function () {
        if (window.Links) window.Links.open(a.url, a.web || (/^https?:/.test(a.url) ? a.url : null));
        else window.location.href = a.url;
      });
      dock.appendChild(b);
    });
  }

  // ── Diagnóstico del móvil ──
  function renderDiag() {
    var box = $("diag-box"); if (!box) return;
    var conn = navigator.connection || {};
    var ram = navigator.deviceMemory;
    box.innerHTML =
      '<div class="ex-row"><b>Batería</b><span id="diag-bat">—</span></div>' +
      '<div class="ex-row"><b>Conexión</b><span>' + ((conn.effectiveType || "?").toUpperCase()) + (navigator.onLine ? "" : " · SIN RED") + '</span></div>' +
      '<div class="ex-row"><b>RAM aprox</b><span>' + (ram ? ram + " GB" : "n/d") + '</span></div>' +
      '<div class="ex-row"><b>Núcleos CPU</b><span>' + (navigator.hardwareConcurrency || "n/d") + '</span></div>' +
      '<div class="ex-row"><b>Tokens MiniMax</b><span>en minimax.io</span></div>';
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        var el = $("diag-bat"); if (el) el.textContent = Math.round(b.level * 100) + "%" + (b.charging ? " ⚡" : "");
      }).catch(function () {});
    } else { var el = $("diag-bat"); if (el) el.textContent = "n/d"; }
  }

  // Apps populares para AÑADIR con un toque (no se pueden escanear las del móvil → sandbox
  // del navegador; el usuario elige de esta lista o añade una a mano). url=scheme, web=respaldo.
  var COMMON = [
    { name: "Discord",   url: "discord://",    web: "https://discord.com/app" },
    { name: "Instagram", url: "instagram://",  web: "https://instagram.com" },
    { name: "TikTok",    url: "snssdk1233://", web: "https://www.tiktok.com" },
    { name: "Pinterest", url: "pinterest://",  web: "https://pinterest.com" },
    { name: "X",         url: "twitter://",    web: "https://x.com" },
    { name: "Reddit",    url: "reddit://",     web: "https://reddit.com" },
    { name: "Twitch",    url: "twitch://",     web: "https://twitch.tv" },
    { name: "Netflix",   url: "nflx://",       web: "https://www.netflix.com" },
    { name: "Maps",      url: "geo:0,0",       web: "https://maps.google.com" },
    { name: "Fotos",     url: "",              web: "" },
  ];
  function renderSuggest() {
    var box = $("app-suggest"); if (!box) return;
    var have = {}; getApps().forEach(function (a) { have[a.name.toLowerCase()] = 1; });
    box.innerHTML = COMMON.filter(function (c) { return c.url && !have[c.name.toLowerCase()]; })
      .map(function (c) { return '<button class="app-chip" data-app="' + esc(c.name) + '">+ ' + esc(c.name) + '</button>'; }).join("");
    Array.prototype.forEach.call(box.querySelectorAll(".app-chip"), function (b) {
      b.addEventListener("click", function () {
        var c = COMMON.filter(function (x) { return x.name === b.dataset.app; })[0];
        if (!c) return;
        var a = getApps(); a.push({ name: c.name, url: c.url, web: c.web }); setApps(a);
        renderApps(); renderSuggest(); renderDock();
      });
    });
  }
  function init() {
    renderCommands(); renderApps(); renderSuggest(); renderDiag(); renderDock();
    var add = $("app-add"); if (add && !add._wired) { add._wired = true; add.addEventListener("click", addApp); }
  }
  window.Extras = { init: init, renderDock: renderDock };
})();
