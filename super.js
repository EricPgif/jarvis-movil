/* super.js — MODO SUPER móvil: esfera grande con ANILLOS concéntricos + "J.A.R.V.I.S",
   apps orbitando con iconos minimalistas (tap = abrir), HUD, y ABAJO barra para ESCRIBIR
   + botón de VOZ (micrófono limpio, 2ª esfera) que palpita al hablar / verde al escuchar.
   Expone window.Super. */
(function () {
  "use strict";

  // Iconos de línea minimalistas (24x24, stroke=currentColor).
  var ICONS = {
    music:    '<path d="M9 17V6l10-2v9"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="15" r="2"/>',
    play:     '<path d="M8 5l11 7-11 7z"/>',
    phone:    '<path d="M5 4h3l2 5-2.3 1.2a11 11 0 0 0 5.1 5.1L14 13l5 2v3a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    send:     '<path d="M21 3L3 11l7 2 2 7z"/><path d="M21 3l-9 10"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    mail:     '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    camera:   '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
    mic:      '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17.5V21M8.5 21h7"/>',
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || "") + '</svg>';
  }

  var TILES = [
    { icon: "music",    label: "Música",   kind: "deeplink", app: "spotify" },
    { icon: "play",     label: "YouTube",  kind: "deeplink", app: "youtube" },
    { icon: "phone",    label: "WhatsApp", kind: "deeplink", app: "whatsapp" },
    { icon: "send",     label: "Telegram", kind: "deeplink", app: "telegram" },
    { icon: "globe",    label: "Web",      kind: "deeplink", app: "navegador" },
    { icon: "mail",     label: "Correo",   kind: "deeplink", app: "gmail" },
    { icon: "calendar", label: "Agenda",   kind: "deeplink", app: "calendario" },
    { icon: "camera",   label: "Cámara",   kind: "cam" },
  ];

  var CSS = `
  #view-super{background:radial-gradient(circle at 50% 44%,#061a2b 0%,#02060d 66%,#01040b 100%);overflow:hidden;}
  #view-super.show{display:block;}
  .sup-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(0,212,255,.08) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(circle at 50% 44%,#000 36%,transparent 74%);mask-image:radial-gradient(circle at 50% 44%,#000 36%,transparent 74%);}
  .sup-hud{position:absolute;font-size:10px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;z-index:3;}
  .sup-tl{top:calc(12px + env(safe-area-inset-top));left:16px;}
  .sup-tl .t{font-size:22px;font-weight:700;color:#eafaff;letter-spacing:1px;font-variant-numeric:tabular-nums;}
  .sup-tr{top:calc(12px + env(safe-area-inset-top));right:16px;text-align:right;}
  .sup-tr .wx{font-size:20px;font-weight:700;color:#eafaff;}
  .sup-bl{bottom:calc(96px + env(safe-area-inset-bottom));left:16px;}
  .sup-br{bottom:calc(96px + env(safe-area-inset-bottom));right:16px;text-align:right;color:var(--cyan);}
  .sup-close{position:absolute;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);
    width:42px;height:42px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);color:var(--cyan);font-size:18px;z-index:6;}
  .sup-core{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:clamp(250px,62vmin,400px);height:clamp(250px,62vmin,400px);display:flex;align-items:center;justify-content:center;z-index:1;}
  .sup-rings{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
  .sup-rings .rr{fill:none;stroke:rgba(0,212,255,.5);transform-box:fill-box;transform-origin:center;}
  .sup-rings .r1{stroke-width:.5;stroke-dasharray:2 9;animation:supSpin 90s linear infinite;}
  .sup-rings .r2{stroke-width:1;stroke-dasharray:34 14;opacity:.55;animation:supSpin 64s linear infinite reverse;}
  .sup-rings .r3{stroke-width:.7;stroke-dasharray:2 7;opacity:.5;animation:supSpin 46s linear infinite;}
  .sup-sphere{width:84%;height:84%;overflow:visible;}
  .sup-title{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-weight:700;letter-spacing:clamp(2px,1vmin,6px);font-size:clamp(16px,4.6vmin,34px);color:#eafaff;text-shadow:0 0 18px rgba(0,212,255,.9);pointer-events:none;white-space:nowrap;z-index:2;}
  .sup-ring{position:absolute;left:50%;top:44%;width:10px;height:10px;pointer-events:none;z-index:2;}
  .sup-app{position:absolute;left:50%;top:50%;width:64px;margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;
    border:0;background:transparent;padding:0;-webkit-appearance:none;appearance:none;pointer-events:auto;z-index:3;
    --orbit-r:min(37vmin,186px);animation:supOrbit 130s linear infinite;animation-delay:var(--phase,0s);}
  .sup-app .si{width:48px;height:48px;border-radius:15px;border:1px solid var(--border-hi);background:rgba(10,23,38,.82);color:var(--cyan);display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(0,212,255,.16);transition:transform .12s cubic-bezier(.2,.7,.2,1), background .12s ease, border-color .12s ease;}
  .sup-app .si svg{width:24px;height:24px;}
  .sup-app .sl{font-size:10px;color:var(--text-dim);letter-spacing:.3px;}
  .sup-app:active .si{background:var(--cyan-soft);border-color:var(--cyan);filter:brightness(1.3);transform:scale(.88);box-shadow:0 0 22px var(--cyan-glow);}
  @keyframes supOrbit{from{transform:translate(-50%,-50%) rotate(0deg) translate(var(--orbit-r)) rotate(0deg);}
    to{transform:translate(-50%,-50%) rotate(360deg) translate(var(--orbit-r)) rotate(-360deg);}}
  @keyframes supSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  #view-super.paused .sup-app{animation-play-state:paused;}
  #super-log{position:absolute;left:10px;right:10px;bottom:calc(74px + env(safe-area-inset-bottom));max-height:14vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;z-index:2;pointer-events:none;-webkit-mask-image:linear-gradient(transparent,#000 38%);mask-image:linear-gradient(transparent,#000 38%);}
  #super-log .msg{pointer-events:auto;}
  #super-log .msg{max-width:86%;padding:8px 12px;border-radius:13px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}
  #super-log .me{align-self:flex-end;background:var(--cyan-soft);border:1px solid var(--border-hi);color:var(--text);}
  #super-log .jv{align-self:flex-start;background:rgba(10,23,38,.9);border:1px solid var(--border);color:var(--text);}
  #super-log .sys{align-self:center;color:var(--text-muted);font-size:12px;}
  .sup-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--border);background:rgba(3,9,16,.82);z-index:5;}
  .sup-voice{flex:0 0 auto;width:50px;height:50px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);padding:0;display:flex;align-items:center;justify-content:center;color:var(--cyan);}
  .sup-voice svg{width:24px;height:24px;}
  #view-super.sst-speaking .sup-voice{animation:supPulse .5s ease-in-out infinite;border-color:var(--cyan);box-shadow:0 0 16px var(--cyan-glow);}
  @keyframes supPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
  #view-super.sst-listening .sup-voice{border-color:var(--green);color:var(--green);box-shadow:0 0 14px rgba(0,255,136,.5);}
  #view-super.sst-processing .sup-voice{border-color:var(--amber);color:var(--amber);}
  .sup-bar input{flex:1;min-width:0;padding:12px 14px;font-size:16px;border-radius:12px;background:var(--bg);border:1px solid var(--border);color:var(--text);outline:none;}
  .sup-bar input:focus{border-color:var(--cyan);}
  .sup-send{flex:0 0 auto;width:48px;height:48px;border-radius:12px;border:1px solid var(--border);background:var(--cyan-soft);color:var(--cyan);font-size:18px;}
  `;

  var built = false, sphereMade = false, clockTimer = null;

  function build() {
    if (built) return;
    built = true;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    var v = document.getElementById("view-super");
    v.innerHTML =
      '<div class="sup-grid"></div>' +
      '<div class="sup-hud sup-tl"><div class="t" id="sup-clock">--:--</div><div id="sup-date">—</div></div>' +
      '<div class="sup-hud sup-tr"><div class="wx"><span id="sup-wx-ico">🌡️</span> <span id="sup-wx-temp">--</span>°</div><div id="sup-wx-desc">CLIMA</div></div>' +
      '<div class="sup-hud sup-bl" id="sup-status">EN LÍNEA</div>' +
      '<div class="sup-hud sup-br">J.A.R.V.I.S<br>MODO SUPER · v' + (window.JV_VERSION || "?") + '</div>' +
      '<button class="sup-close" id="sup-close" aria-label="Salir">✕</button>' +
      '<div class="sup-core">' +
        '<svg class="sup-rings" viewBox="0 0 300 300"><circle class="rr r1" cx="150" cy="150" r="146"/><circle class="rr r2" cx="150" cy="150" r="126"/><circle class="rr r3" cx="150" cy="150" r="108"/></svg>' +
        '<svg class="sup-sphere" id="sup-sphere" viewBox="-100 -100 200 200"></svg>' +
      '</div>' +
      '<div class="sup-title">J.A.R.V.I.S</div>' +
      '<div class="sup-ring" id="sup-ring"></div>' +
      '<div id="super-log"></div>' +
      '<div class="sup-bar">' +
        '<button class="sup-voice" id="sup-voice" aria-label="Voz">' + svg("mic") + '</button>' +
        '<input id="sup-text" name="jvmsg2" placeholder="Escribe o di «Jarvis»…" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" />' +
        '<button class="sup-send" id="sup-send" aria-label="Enviar">➤</button>' +
      '</div>';

    var ring = document.getElementById("sup-ring");
    var DUR = 130;
    TILES.forEach(function (t, i) {
      var a = document.createElement("button");
      a.className = "sup-app";
      a.style.setProperty("--phase", (-(i / TILES.length) * DUR) + "s");
      a.innerHTML = '<span class="si">' + svg(t.icon) + '</span><span class="sl">' + t.label + '</span>';
      a.addEventListener("click", function () { activate(t); });
      ring.appendChild(a);
    });

    document.getElementById("sup-close").addEventListener("click", hide);
    document.getElementById("sup-send").addEventListener("click", sendText);
    document.getElementById("sup-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); sendText(); }
    });
    document.getElementById("sup-voice").addEventListener("click", function () {
      Voice.unlock();
      var sst = document.getElementById("view-super").className;
      if (sst.indexOf("sst-speaking") !== -1) { Voice.cancel(); APP.setState(""); }
      else if (APP.mic) APP.mic();
    });
  }

  function activate(t) {
    Voice.unlock();
    if (t.kind === "deeplink") { var say = Links.openApp(t.app); if (say) APP.addMsg(say, "jv"); return; }
    if (t.kind === "cam") { var c = document.getElementById("cam"); if (c) c.click(); }
  }

  function sendText() {
    var inp = document.getElementById("sup-text");
    var txt = (inp.value || "").trim();
    if (!txt) return;
    inp.value = "";
    APP.handle(txt);
  }

  function tick() {
    var n = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    var c = document.getElementById("sup-clock"); if (c) c.textContent = p(n.getHours()) + ":" + p(n.getMinutes()) + ":" + p(n.getSeconds());
    var dias = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
    var d = document.getElementById("sup-date"); if (d) d.textContent = dias[n.getDay()] + " · " + n.getDate();
    var wt = document.getElementById("wx-temp"), wi = document.getElementById("wx-icon"), wd = document.getElementById("wx-desc");
    if (wt) document.getElementById("sup-wx-temp").textContent = wt.textContent;
    if (wi) document.getElementById("sup-wx-ico").textContent = wi.textContent;
    if (wd) document.getElementById("sup-wx-desc").textContent = wd.textContent;
  }

  function show() {
    build();
    document.getElementById("view-super").classList.add("show");
    window.__superActive = true;
    if (!sphereMade) { Sphere.make(document.getElementById("sup-sphere"), { state: true, isSuper: true, N: 96, R: 84 }); sphereMade = true; }
    tick(); if (!clockTimer) clockTimer = setInterval(tick, 1000);
  }
  function hide() {
    document.getElementById("view-super").classList.remove("show");
    window.__superActive = false;
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }
  function isOpen() { return window.__superActive === true; }

  window.Super = { show: show, hide: hide, isOpen: isOpen, build: build };
})();
