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
    var key = n.toLowerCase();
    if (DEFAULT_APPS.indexOf(key) !== -1) { alert("«" + n + "» ya está fija en el dock, señor."); return; }
    if (getApps().some(function (a) { return a.name.toLowerCase() === key; })) { alert("«" + n + "» ya la tienes añadida, señor."); return; }
    var domain = ""; try { if (/^https?:/.test(u)) domain = new URL(u).hostname.replace(/^www\./, ""); } catch (e) {}
    var a = getApps(); a.push({ name: n, url: u, web: /^https?:/.test(u) ? u : "", domain: domain }); setApps(a);
    $("app-name").value = ""; $("app-url").value = "";
    renderApps(); renderSuggest(); renderDock();
  }
  function renderDock() {
    var dock = $("dock"); if (!dock) return;
    Array.prototype.forEach.call(dock.querySelectorAll("[data-myapp]"), function (e) { e.remove(); });
    getApps().forEach(function (a, i) {
      var b = document.createElement("button");
      b.className = "qbtn"; b.setAttribute("data-myapp", i);
      var ic = window.AppIcons ? window.AppIcons.html(a.name, a.domain) : "▣";   // logo real o pastilla
      b.innerHTML = '<span class="qi">' + ic + '</span><span class="ql">' + esc(a.name.slice(0, 9)) + '</span>';
      b.addEventListener("click", function () {
        if (window.Links && window.Links.openDirect) window.Links.openDirect({ android: a.android || pkgFor(a.name), scheme: a.scheme, url: a.url, web: a.web });
        else { var t = a.url || a.web; window.location.href = t; }
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
  // Catálogo de apps para AÑADIR con un toque (cada uno pone las SUYAS; no se pueden escanear
  // las instaladas → sandbox). url=cómo abrir, web=respaldo, domain=para sacar el logo real.
  var COMMON = [
    { name: "Spotify",     url: "spotify:",        web: "https://open.spotify.com", domain: "spotify.com" },
    { name: "YouTube",     url: "https://www.youtube.com", web: "https://www.youtube.com", domain: "youtube.com" },
    { name: "WhatsApp",    url: "whatsapp://",     web: "https://web.whatsapp.com", domain: "whatsapp.com" },
    { name: "Telegram",    url: "tg://",           web: "https://web.telegram.org", domain: "telegram.org" },
    { name: "Instagram",   url: "instagram://",    web: "https://instagram.com",    domain: "instagram.com" },
    { name: "TikTok",      url: "snssdk1233://",   web: "https://www.tiktok.com",   domain: "tiktok.com" },
    { name: "X",           url: "twitter://",      web: "https://x.com",            domain: "x.com" },
    { name: "Facebook",    url: "fb://",           web: "https://facebook.com",     domain: "facebook.com" },
    { name: "Discord",     url: "discord://",      web: "https://discord.com/app",  domain: "discord.com" },
    { name: "Reddit",      url: "reddit://",       web: "https://reddit.com",       domain: "reddit.com" },
    { name: "Twitch",      url: "twitch://",       web: "https://twitch.tv",        domain: "twitch.tv" },
    { name: "Pinterest",   url: "pinterest://",    web: "https://pinterest.com",    domain: "pinterest.com" },
    { name: "Snapchat",    url: "snapchat://",     web: "https://snapchat.com",     domain: "snapchat.com" },
    { name: "Netflix",     url: "nflx://",         web: "https://www.netflix.com",  domain: "netflix.com" },
    { name: "Alexa",       url: "https://alexa.amazon.com", web: "https://alexa.amazon.com", domain: "" },
    { name: "Amazon",      url: "https://www.amazon.es",  web: "https://www.amazon.es",   domain: "amazon.com" },
    { name: "Steam",       url: "steam://open/main", web: "https://store.steampowered.com", domain: "steampowered.com" },
    { name: "Epic Games",  url: "https://store.epicgames.com", web: "https://store.epicgames.com", domain: "epicgames.com" },
    { name: "ChatGPT",     url: "https://chatgpt.com", web: "https://chatgpt.com",  domain: "openai.com" },
    { name: "Canva",       url: "https://www.canva.com", web: "https://www.canva.com", domain: "canva.com" },
    { name: "Gemini",      url: "https://gemini.google.com", web: "https://gemini.google.com", domain: "gemini.google.com" },
    { name: "Gmail",       url: "googlegmail://",  web: "https://mail.google.com",  domain: "" },
    { name: "Drive",       url: "https://drive.google.com", web: "https://drive.google.com", domain: "drive.google.com" },
    { name: "Maps",        url: "geo:0,0",         web: "https://maps.google.com",  domain: "" },
    { name: "Fotos",       url: "https://photos.google.com", web: "https://photos.google.com", domain: "photos.google.com" },
    { name: "Calendar",    url: "https://calendar.google.com", web: "https://calendar.google.com", domain: "calendar.google.com" },
    { name: "Traductor",   url: "https://translate.google.com", web: "https://translate.google.com", domain: "translate.google.com" },
    { name: "Google",      url: "https://www.google.com", web: "https://www.google.com", domain: "google.com" },
    { name: "Chrome",      url: "googlechrome://", web: "https://www.google.com/chrome", domain: "" },
    { name: "Proton Mail", url: "https://mail.proton.me", web: "https://mail.proton.me", domain: "proton.me" },
    { name: "Proton VPN",  url: "https://protonvpn.com", web: "https://protonvpn.com", domain: "protonvpn.com" },
    { name: "Revolut",     url: "https://revolut.com", web: "https://revolut.com", domain: "revolut.com" },
    { name: "Yuka",        url: "https://yuka.io", web: "https://yuka.io",          domain: "yuka.io" },
    { name: "Meta Horizon",url: "https://www.meta.com", web: "https://www.meta.com", domain: "meta.com" },
    { name: "Play Store",  url: "market://",       web: "https://play.google.com",  domain: "" },
    { name: "Google One",  url: "https://one.google.com", web: "https://one.google.com", domain: "one.google.com" },
    { name: "Lens",        url: "https://lens.google.com", web: "https://lens.google.com", domain: "lens.google.com" },
    { name: "Meet",        url: "https://meet.google.com", web: "https://meet.google.com", domain: "meet.google.com" },
    { name: "Keep",        url: "https://keep.google.com", web: "https://keep.google.com", domain: "keep.google.com" },
    { name: "Google TV",   url: "https://tv.google.com", web: "https://tv.google.com", domain: "tv.google.com" },
    { name: "Wallet",      url: "https://wallet.google.com", web: "https://wallet.google.com", domain: "pay.google.com" },
    { name: "JBL",         url: "https://www.jbl.com", web: "https://www.jbl.com", domain: "jbl.com" },
    { name: "Mi Fitness",  url: "https://www.mi.com", web: "https://www.mi.com", domain: "mi.com" },
    { name: "MixerBox",    url: "https://www.mixerbox.com", web: "https://www.mixerbox.com", domain: "mixerbox.com" },
    { name: "Booking",     url: "https://www.booking.com", web: "https://www.booking.com", domain: "booking.com" },
    { name: "PayPal",      url: "https://www.paypal.com", web: "https://www.paypal.com", domain: "paypal.com" },
  ];
  // Apps FIJAS del dock (predeterminadas): no se pueden añadir de nuevo (evita un 2º Gmail, etc.).
  var DEFAULT_APPS = ["spotify", "youtube", "whatsapp", "telegram", "chrome", "gmail", "navegador", "calendario", "agenda"];

  // Package de Android por app (para abrir SOLO la app, nunca la web). De los agentes + verificado.
  var PKG = {
    spotify: "com.spotify.music", youtube: "com.google.android.youtube", whatsapp: "com.whatsapp",
    telegram: "org.telegram.messenger", instagram: "com.instagram.android", tiktok: "com.zhiliaoapp.musically",
    x: "com.twitter.android", facebook: "com.facebook.katana", discord: "com.discord", reddit: "com.reddit.frontpage",
    twitch: "tv.twitch.android.app", pinterest: "com.pinterest", snapchat: "com.snapchat.android",
    netflix: "com.netflix.mediaclient", alexa: "com.amazon.dee.app", amazon: "com.amazon.mShop.android.shopping",
    steam: "com.valvesoftware.android.steam.community", "epic games": "com.epicgames.portal", chatgpt: "com.openai.chatgpt",
    canva: "com.canva.editor", gemini: "com.google.android.apps.bard", gmail: "com.google.android.gm",
    drive: "com.google.android.apps.docs", maps: "com.google.android.apps.maps", fotos: "com.google.android.apps.photos",
    calendar: "com.google.android.calendar", traductor: "com.google.android.apps.translate",
    google: "com.google.android.googlequicksearchbox", chrome: "com.android.chrome",
    "proton mail": "ch.protonmail.android", "proton vpn": "ch.protonvpn.android", revolut: "com.revolut.revolut",
    yuka: "io.yuka.android", "meta horizon": "com.oculus.twilight", "play store": "com.android.vending",
    "google one": "com.google.android.apps.subscriptions.red", lens: "com.google.ar.lens",
    meet: "com.google.android.apps.tachyon", keep: "com.google.android.keep", "google tv": "com.google.android.videos",
    wallet: "com.google.android.apps.walletnfcrel", "mi fitness": "com.xiaomi.wearable", booking: "com.booking",
    paypal: "com.paypal.android.p2pmobile",
  };
  function pkgFor(name) { return PKG[String(name || "").toLowerCase().trim()] || ""; }
  function renderSuggest() {
    var box = $("app-suggest"); if (!box) return;
    var have = {}; getApps().forEach(function (a) { have[a.name.toLowerCase()] = 1; });
    box.innerHTML = COMMON.filter(function (c) { return c.url && !have[c.name.toLowerCase()] && DEFAULT_APPS.indexOf(c.name.toLowerCase()) === -1; })
      .map(function (c) { var ic = window.AppIcons ? window.AppIcons.html(c.name, c.domain) : ""; return '<button class="app-chip" data-app="' + esc(c.name) + '">' + ic + esc(c.name) + '</button>'; }).join("");
    Array.prototype.forEach.call(box.querySelectorAll(".app-chip"), function (b) {
      b.addEventListener("click", function () {
        var c = COMMON.filter(function (x) { return x.name === b.dataset.app; })[0];
        if (!c) return;
        var a = getApps(); a.push({ name: c.name, url: c.url, web: c.web, domain: c.domain || "" }); setApps(a);
        renderApps(); renderSuggest(); renderDock();
      });
    });
  }
  function init() {
    renderCommands(); renderApps(); renderSuggest(); renderDiag(); renderDock();
    var add = $("app-add"); if (add && !add._wired) { add._wired = true; add.addEventListener("click", addApp); }
  }
  window.Extras = {
    init: init, renderDock: renderDock,
    getApps: getApps, setApps: setApps, catalog: COMMON, defaults: DEFAULT_APPS, pkgFor: pkgFor,
    refresh: function () { renderApps(); renderSuggest(); renderDock(); },
  };
})();
