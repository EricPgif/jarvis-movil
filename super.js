/* super.js — MODO SUPER móvil (como la maqueta): esfera grande central + "J.A.R.V.I.S",
   apps orbitando (tap = abrir), HUD en las esquinas, y ABAJO una barra para ESCRIBIR +
   el botón de VOZ como SEGUNDA ESFERA (reactor que palpita al hablar / verde al escuchar).
   Entra/sale por la X o por voz. Expone window.Super. */
(function () {
  "use strict";

  // Tiles del Super (solo lo posible en un móvil). kind: deeplink | cam
  var TILES = [
    { ico: "♪",  label: "Música",   kind: "deeplink", app: "spotify" },
    { ico: "▶",  label: "YouTube",  kind: "deeplink", app: "youtube" },
    { ico: "✆",  label: "WhatsApp", kind: "deeplink", app: "whatsapp" },
    { ico: "✈",  label: "Telegram", kind: "deeplink", app: "telegram" },
    { ico: "🌐", label: "Web",      kind: "deeplink", app: "navegador" },
    { ico: "✉",  label: "Correo",   kind: "deeplink", app: "gmail" },
    { ico: "▦",  label: "Agenda",   kind: "deeplink", app: "calendario" },
    { ico: "📷", label: "Cámara",   kind: "cam" },
  ];

  var CSS = `
  #view-super{background:radial-gradient(circle at 50% 42%,#061a2b 0%,#02060d 66%,#01040b 100%);overflow:hidden;}
  #view-super.show{display:block;}
  .sup-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(0,212,255,.10) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(circle at 50% 42%,#000 38%,transparent 76%);mask-image:radial-gradient(circle at 50% 42%,#000 38%,transparent 76%);}
  .sup-hud{position:absolute;font-size:10px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;z-index:3;}
  .sup-tl{top:calc(12px + env(safe-area-inset-top));left:16px;}
  .sup-tl .t{font-size:22px;font-weight:700;color:#eafaff;letter-spacing:1px;font-variant-numeric:tabular-nums;}
  .sup-tr{top:calc(12px + env(safe-area-inset-top));right:16px;text-align:right;}
  .sup-tr .wx{font-size:20px;font-weight:700;color:#eafaff;}
  .sup-bl{bottom:calc(96px + env(safe-area-inset-bottom));left:16px;}
  .sup-br{bottom:calc(96px + env(safe-area-inset-bottom));right:16px;text-align:right;color:var(--cyan);}
  .sup-close{position:absolute;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);
    width:42px;height:42px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);color:var(--cyan);font-size:18px;z-index:6;}
  .sup-core{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);width:clamp(220px,52vmin,340px);height:clamp(220px,52vmin,340px);display:flex;align-items:center;justify-content:center;z-index:1;}
  .sup-sphere{width:100%;height:100%;overflow:visible;}
  .sup-title{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);font-weight:700;letter-spacing:clamp(2px,1vmin,6px);font-size:clamp(16px,4.6vmin,34px);color:#eafaff;text-shadow:0 0 18px rgba(0,212,255,.9);pointer-events:none;white-space:nowrap;z-index:2;}
  .sup-ring{position:absolute;left:50%;top:42%;width:10px;height:10px;pointer-events:none;z-index:2;}
  .sup-app{position:absolute;left:50%;top:50%;width:66px;margin:-44px 0 0 -33px;display:flex;flex-direction:column;align-items:center;gap:4px;
    border:0;background:transparent;padding:0;-webkit-appearance:none;appearance:none;
    --orbit-r:min(33vmin,168px);animation:supOrbit 130s linear infinite;animation-delay:var(--phase,0s);}
  .sup-app .si{width:50px;height:50px;border-radius:15px;border:1px solid var(--border-hi);background:rgba(10,23,38,.82);color:var(--cyan);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 14px rgba(0,212,255,.18);}
  .sup-app .sl{font-size:10px;color:var(--text-dim);letter-spacing:.3px;}
  .sup-app:active .si{background:var(--cyan-soft);border-color:var(--cyan);filter:brightness(1.3);}
  @keyframes supOrbit{from{transform:translate(-50%,-50%) rotate(0deg) translate(var(--orbit-r)) rotate(0deg);}
    to{transform:translate(-50%,-50%) rotate(360deg) translate(var(--orbit-r)) rotate(-360deg);}}
  #view-super.paused .sup-app{animation-play-state:paused;}
  /* log compacto sobre la barra */
  #super-log{position:absolute;left:10px;right:10px;bottom:calc(74px + env(safe-area-inset-bottom));max-height:30vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;z-index:4;-webkit-mask-image:linear-gradient(transparent,#000 22%);mask-image:linear-gradient(transparent,#000 22%);}
  #super-log .msg{max-width:86%;padding:8px 12px;border-radius:13px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}
  #super-log .me{align-self:flex-end;background:var(--cyan-soft);border:1px solid var(--border-hi);color:var(--text);}
  #super-log .jv{align-self:flex-start;background:rgba(10,23,38,.9);border:1px solid var(--border);color:var(--text);}
  #super-log .sys{align-self:center;color:var(--text-muted);font-size:12px;}
  /* barra inferior: reactor-voz (2ª esfera) + input + enviar */
  .sup-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--border);background:rgba(3,9,16,.82);z-index:5;}
  .sup-voice{flex:0 0 auto;width:50px;height:50px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);padding:0;position:relative;}
  .sup-voice svg{width:100%;height:100%;overflow:visible;}
  .sup-voice .rk{fill:none;stroke:#2fe3ff;stroke-linecap:round;transform-box:fill-box;transform-origin:center;}
  .rkA{stroke-width:5;stroke-dasharray:1.4 6;opacity:.7;animation:supSpin 22s linear infinite reverse;}
  .rkB{stroke-width:7;stroke-dasharray:64 8;opacity:1;animation:supSpin 14s linear infinite;}
  .sup-voice .core{fill:#2fe3ff;opacity:.9;}
  #view-super.sst-speaking .sup-voice{animation:supPulse .5s ease-in-out infinite;}
  @keyframes supPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
  #view-super.sst-listening .sup-voice{border-color:var(--green);box-shadow:0 0 14px rgba(0,255,136,.5);}
  #view-super.sst-listening .sup-voice .rk{stroke:var(--green);}
  #view-super.sst-listening .sup-voice .core{fill:var(--green);}
  #view-super.sst-processing .sup-voice .rk{stroke:var(--amber);}
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
      '<div class="sup-hud sup-br">J.A.R.V.I.S<br>MODO SUPER · v8.0</div>' +
      '<button class="sup-close" id="sup-close" aria-label="Salir">✕</button>' +
      '<div class="sup-core"><svg class="sup-sphere" id="sup-sphere" viewBox="-100 -100 200 200"></svg></div>' +
      '<div class="sup-title">J.A.R.V.I.S</div>' +
      '<div class="sup-ring" id="sup-ring"></div>' +
      '<div id="super-log"></div>' +
      '<div class="sup-bar">' +
        '<button class="sup-voice" id="sup-voice" aria-label="Voz">' +
          '<svg viewBox="0 0 100 100"><circle class="rk rkA" cx="50" cy="50" r="42"/><circle class="rk rkB" cx="50" cy="50" r="30"/><circle class="core" cx="50" cy="50" r="8"/></svg>' +
        '</button>' +
        '<input id="sup-text" placeholder="Escribe o di «Jarvis»…" autocomplete="off" />' +
        '<button class="sup-send" id="sup-send" aria-label="Enviar">➤</button>' +
      '</div>';

    // Tiles orbitando
    var ring = document.getElementById("sup-ring");
    var DUR = 130;
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
    document.getElementById("sup-send").addEventListener("click", sendText);
    document.getElementById("sup-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); sendText(); }
    });
    document.getElementById("sup-voice").addEventListener("click", function () {
      Voice.unlock();
      // Si está hablando, el toque corta; si no, escucha (la 2ª esfera = botón de voz).
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
    APP.handle(txt);   // router → MiniMax; addMsg refleja en #super-log
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
