/* super.js — MODO SUPER móvil: esfera grande central + "J.A.R.V.I.S", reactor en la
   esquina (palpita al hablar), tiles que orbitan (tap = activar), chat flotante,
   estados de color. Entra/sale por botón ✕ o por voz. Expone window.Super. */
(function () {
  "use strict";

  // Tiles del Super móvil (solo lo posible en un móvil). kind: deeplink | voice | chat | super-off
  var TILES = [
    { ico: "🎙", label: "Voz",       kind: "voice" },
    { ico: "♪",  label: "Música",    kind: "deeplink", app: "spotify" },
    { ico: "▶",  label: "YouTube",   kind: "deeplink", app: "youtube" },
    { ico: "✆",  label: "WhatsApp",  kind: "deeplink", app: "whatsapp" },
    { ico: "💬", label: "Chat",      kind: "chat" },
    { ico: "✈",  label: "Telegram",  kind: "deeplink", app: "telegram" },
    { ico: "🌐", label: "Web",       kind: "deeplink", app: "navegador" },
    { ico: "📷", label: "Cámara",    kind: "cam" },
  ];

  var CSS = `
  #view-super{background:radial-gradient(circle at 50% 50%,#061a2b 0%,#02060d 66%,#01040b 100%);}
  #view-super.show{display:block;}
  .sup-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(0,212,255,.10) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 40%,transparent 78%);mask-image:radial-gradient(circle at 50% 50%,#000 40%,transparent 78%);}
  .sup-hud{position:absolute;font-size:11px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;}
  .sup-tl{top:calc(12px + env(safe-area-inset-top));left:14px;}
  .sup-tl .t{font-size:24px;font-weight:700;color:#eafaff;letter-spacing:1px;font-variant-numeric:tabular-nums;}
  .sup-tr{top:calc(12px + env(safe-area-inset-top));right:14px;text-align:right;}
  .sup-tr .wx{font-size:22px;font-weight:700;color:#eafaff;}
  .sup-bl{bottom:calc(14px + env(safe-area-inset-bottom));left:14px;}
  .sup-close{position:absolute;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);
    width:40px;height:40px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);color:var(--cyan);font-size:18px;z-index:6;}
  .sup-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:clamp(260px,64vmin,420px);height:clamp(260px,64vmin,420px);display:flex;align-items:center;justify-content:center;}
  .sup-sphere{width:100%;height:100%;overflow:visible;}
  .sup-title{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:700;letter-spacing:clamp(3px,1.4vmin,8px);font-size:clamp(20px,5.4vmin,42px);color:#eafaff;text-shadow:0 0 18px rgba(0,212,255,.9);pointer-events:none;white-space:nowrap;}
  .sup-ring{position:absolute;left:50%;top:50%;width:10px;height:10px;pointer-events:none;}
  .sup-app{position:absolute;left:50%;top:50%;width:74px;margin:-37px 0 0 -37px;display:flex;flex-direction:column;align-items:center;gap:4px;
    --orbit-r:min(40vmin,230px);animation:supOrbit 120s linear infinite;animation-delay:var(--phase,0s);}
  .sup-app .si{width:50px;height:50px;border-radius:15px;border:1px solid var(--border-hi);background:rgba(10,23,38,.82);color:var(--cyan);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 14px rgba(0,212,255,.18);}
  .sup-app .sl{font-size:10px;color:var(--text-dim);letter-spacing:.3px;}
  .sup-app:active .si{background:var(--cyan-soft);border-color:var(--cyan);filter:brightness(1.3);}
  @keyframes supOrbit{from{transform:translate(-50%,-50%) rotate(0deg) translate(var(--orbit-r)) rotate(0deg);}
    to{transform:translate(-50%,-50%) rotate(360deg) translate(var(--orbit-r)) rotate(-360deg);}}
  #view-super.paused .sup-app{animation-play-state:paused;}
  /* reactor esquina */
  .sup-corner{position:absolute;right:clamp(12px,5vw,40px);bottom:clamp(70px,14vh,130px);width:clamp(86px,24vw,120px);height:clamp(86px,24vw,120px);filter:drop-shadow(0 0 14px rgba(0,212,255,.5));}
  .sup-corner svg{width:100%;height:100%;overflow:visible;}
  .sup-corner .rk{fill:none;stroke:#2fe3ff;stroke-linecap:round;transform-box:fill-box;transform-origin:center;}
  .rkA{stroke-width:1;stroke-dasharray:30 14;opacity:.6;animation:supSpin 40s linear infinite;}
  .rkB{stroke-width:3;stroke-dasharray:1.4 6;opacity:.7;animation:supSpin 26s linear infinite reverse;}
  .rkC{stroke-width:1.6;stroke-dasharray:60 8 10 8;opacity:1;animation:supSpin 18s linear infinite;}
  @keyframes supSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  #view-super.sst-speaking .sup-corner{animation:supPulse .5s ease-in-out infinite;}
  @keyframes supPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 14px rgba(0,212,255,.5))}50%{transform:scale(1.1);filter:drop-shadow(0 0 24px rgba(0,212,255,.9))}}
  #view-super.sst-listening .sup-corner .rk{stroke:var(--green);}
  #view-super.sst-processing .sup-corner .rk{stroke:var(--amber);}
  /* boton parar (rojo) */
  .sup-stop{position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;align-items:center;gap:7px;padding:9px 16px;border-radius:13px;border:1px solid var(--red);background:rgba(255,68,68,.14);color:#ffb4b4;font-size:13px;font-weight:600;z-index:6;}
  #view-super.sst-speaking .sup-stop{display:flex;}
  /* chat flotante */
  .sup-chat{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,420px);height:min(64vh,460px);background:rgba(5,14,24,.95);border:1px solid var(--border-hi);border-radius:16px;display:none;flex-direction:column;z-index:8;box-shadow:0 18px 60px rgba(0,0,0,.6);}
  .sup-chat.show{display:flex;}
  .sup-chat-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);cursor:grab;touch-action:none;}
  .sup-chat-bar b{color:var(--cyan);font-size:13px;letter-spacing:1px;}
  .sup-chat-bar button{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--cyan);}
  #super-log{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:7px;}
  .sup-chat-in{display:flex;gap:7px;padding:10px;border-top:1px solid var(--border);}
  .sup-chat-in input{flex:1;min-width:0;padding:10px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-size:15px;outline:none;}
  .sup-chat-in button{width:44px;border-radius:10px;border:1px solid var(--border);background:var(--cyan-soft);color:var(--cyan);font-size:17px;}
  `;

  var built = false, sphereMade = false;

  function build() {
    if (built) return;
    built = true;
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    var v = document.getElementById("view-super");
    v.innerHTML =
      '<div class="sup-grid"></div>' +
      '<div class="sup-hud sup-tl"><div class="t" id="sup-clock">--:--</div><div id="sup-date">—</div></div>' +
      '<div class="sup-hud sup-tr"><div class="wx"><span id="sup-wx-ico">🌡️</span> <span id="sup-wx-temp">--</span>°</div><div id="sup-wx-desc">CLIMA</div></div>' +
      '<div class="sup-hud sup-bl" id="sup-status">EN LÍNEA</div>' +
      '<button class="sup-close" id="sup-close" aria-label="Salir">✕</button>' +
      '<div class="sup-core"><svg class="sup-sphere" id="sup-sphere" viewBox="-100 -100 200 200"></svg><div class="sup-title">J.A.R.V.I.S</div></div>' +
      '<div class="sup-ring" id="sup-ring"></div>' +
      '<div class="sup-corner"><svg viewBox="0 0 200 200"><circle class="rk rkA" cx="100" cy="100" r="92"/><circle class="rk rkB" cx="100" cy="100" r="74"/><circle class="rk rkC" cx="100" cy="100" r="54"/></svg></div>' +
      '<button class="sup-stop" id="sup-stop">■ Parar</button>' +
      '<div class="sup-chat" id="sup-chat">' +
        '<div class="sup-chat-bar" id="sup-chat-bar"><b>CONVERSACIÓN</b><button id="sup-chat-close">✕</button></div>' +
        '<div id="super-log"></div>' +
        '<div class="sup-chat-in"><input id="sup-chat-text" placeholder="Escribe…" /><button id="sup-chat-send">➤</button></div>' +
      '</div>';

    // Tiles orbitando
    var ring = document.getElementById("sup-ring");
    var DUR = 120;
    TILES.forEach(function (t, i) {
      var a = document.createElement("button");
      a.className = "sup-app";
      a.style.setProperty("--phase", (-(i / TILES.length) * DUR) + "s");
      a.innerHTML = '<span class="si">' + t.ico + '</span><span class="sl">' + t.label + '</span>';
      a.addEventListener("click", function () { activate(t); });
      ring.appendChild(a);
    });

    // Wiring
    document.getElementById("sup-close").addEventListener("click", hide);
    document.getElementById("sup-stop").addEventListener("click", function () {
      Voice.cancel(); APP.setState("");
    });
    document.getElementById("sup-chat-close").addEventListener("click", function () {
      document.getElementById("sup-chat").classList.remove("show");
    });
    document.getElementById("sup-chat-send").addEventListener("click", superChatSend);
    document.getElementById("sup-chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); superChatSend(); }
    });
    makeDraggable(document.getElementById("sup-chat"), document.getElementById("sup-chat-bar"));
  }

  function activate(t) {
    Voice.unlock();
    if (t.kind === "voice") { if (APP.mic) APP.mic(); return; }
    if (t.kind === "deeplink") { var say = Links.openApp(t.app); if (say) APP.addMsg(say, "jv"); return; }
    if (t.kind === "cam") { var c = document.getElementById("cam"); if (c) c.click(); return; }
    if (t.kind === "chat") { document.getElementById("sup-chat").classList.add("show"); }
  }

  function superChatSend() {
    var inp = document.getElementById("sup-chat-text");
    var txt = (inp.value || "").trim();
    if (!txt) return;
    inp.value = "";
    APP.handle(txt);   // mismo pipeline (router → MiniMax); addMsg refleja en #super-log
  }

  // Arrastre con Pointer Events (dedo)
  function makeDraggable(panel, handle) {
    var ox = 0, oy = 0, sx = 0, sy = 0, drag = false;
    handle.addEventListener("pointerdown", function (e) {
      drag = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.transform = "none"; panel.style.left = ox + "px"; panel.style.top = oy + "px";
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    });
    handle.addEventListener("pointermove", function (e) {
      if (!drag) return;
      panel.style.left = (ox + e.clientX - sx) + "px";
      panel.style.top = (oy + e.clientY - sy) + "px";
    });
    handle.addEventListener("pointerup", function () { drag = false; });
  }

  // Reloj/clima del HUD del super (cada segundo mientras está abierto)
  var clockTimer = null;
  function tick() {
    var n = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    var c = document.getElementById("sup-clock"); if (c) c.textContent = p(n.getHours()) + ":" + p(n.getMinutes()) + ":" + p(n.getSeconds());
    var dias = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
    var d = document.getElementById("sup-date"); if (d) d.textContent = dias[n.getDay()] + " · " + n.getDate();
    // Espeja el clima del dashboard
    var wt = document.getElementById("wx-temp"), wi = document.getElementById("wx-icon"), wd = document.getElementById("wx-desc");
    if (wt) document.getElementById("sup-wx-temp").textContent = wt.textContent;
    if (wi) document.getElementById("sup-wx-ico").textContent = wi.textContent;
    if (wd) document.getElementById("sup-wx-desc").textContent = wd.textContent;
  }

  function show() {
    build();
    var v = document.getElementById("view-super");
    v.classList.add("show");
    window.__superActive = true;
    if (!sphereMade) { Sphere.make(document.getElementById("sup-sphere"), { state: true, isSuper: true, N: 96, R: 84 }); sphereMade = true; }
    tick(); if (!clockTimer) clockTimer = setInterval(tick, 1000);
  }
  function hide() {
    var v = document.getElementById("view-super");
    v.classList.remove("show");
    window.__superActive = false;
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }
  function isOpen() { return window.__superActive === true; }

  window.Super = { show: show, hide: hide, isOpen: isOpen, build: build };
})();
