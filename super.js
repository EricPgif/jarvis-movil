/* super.js — MODO SUPER móvil v2: SOLO VOZ. La esfera del medio es el micrófono (clic → escucha),
   y di "Jarvis" para activarla (wake word, micro vivo mientras el Super está abierto). Las apps se
   colocan ALREDEDOR de la esfera y se ARRASTRAN para organizarlas (mantén pulsada y mueve; suéltala
   en "Quitar" para sacarla). Botón ＋ para añadir apps. Fondo HUD. Expone window.Super. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Apps por defecto del Super (las mismas del dock). Descriptores: app=clave deeplink / cam=cámara.
  var DEFAULTS = [
    { name: "Spotify", app: "spotify" }, { name: "YouTube", app: "youtube" },
    { name: "WhatsApp", app: "whatsapp" }, { name: "Telegram", app: "telegram" },
    { name: "Chrome", app: "chrome" }, { name: "Gmail", app: "gmail" },
    { name: "Agenda", app: "calendario" }, { name: "Cámara", cam: true },
  ];
  function myApps() { return (window.Extras && window.Extras.getApps) ? window.Extras.getApps() : []; }
  // Conjunto colocado del Super (propio: se siembra de defaults+my_apps, luego se gestiona aquí).
  function getSet() {
    var raw; try { raw = JSON.parse(localStorage.getItem("super_set") || "null"); } catch (e) {}
    if (Array.isArray(raw)) return raw;
    var s = DEFAULTS.map(function (d) { return { name: d.name, app: d.app, cam: d.cam, domain: d.domain || "" }; });
    myApps().forEach(function (a) {
      if (!s.some(function (x) { return x.name.toLowerCase() === a.name.toLowerCase(); }))
        s.push({ name: a.name, url: a.url, web: a.web, domain: a.domain || "" });
    });
    setSet(s); return s;
  }
  function setSet(s) { try { localStorage.setItem("super_set", JSON.stringify(s)); } catch (e) {} }
  function openDesc(d) {
    if (d.cam) { var c = $("cam"); if (c) c.click(); return null; }
    if (d.app) return window.Links.openApp(d.app);
    return window.Links.open(d.url || d.web, d.web || (/^https?:/.test(d.url) ? d.url : null));
  }
  function iconFor(a) { return window.AppIcons ? window.AppIcons.html(a.name, a.domain) : esc(a.name.charAt(0)); }
  function getPos() { try { return JSON.parse(localStorage.getItem("super_pos") || "{}") || {}; } catch (e) { return {}; } }
  function setPos(p) { try { localStorage.setItem("super_pos", JSON.stringify(p)); } catch (e) {} }

  var CSS = `
  #view-super{background:radial-gradient(circle at 50% 44%,#061a2b 0%,#02060d 66%,#01040b 100%);overflow:hidden;}
  #view-super.show{display:block;}
  .sup-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(0,212,255,.08) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(circle at 50% 44%,#000 30%,transparent 76%);mask-image:radial-gradient(circle at 50% 44%,#000 30%,transparent 76%);}
  .sup-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,212,255,.35),transparent);animation:supScan 5.5s linear infinite;pointer-events:none;}
  @keyframes supScan{0%{top:6%}50%{top:86%}100%{top:6%}}
  .sup-br2{position:absolute;width:26px;height:26px;border:1.5px solid rgba(0,212,255,.4);pointer-events:none;}
  .sup-br2.tl{top:8px;left:8px;border-right:0;border-bottom:0;} .sup-br2.tr{top:8px;right:8px;border-left:0;border-bottom:0;}
  .sup-br2.bl{bottom:8px;left:8px;border-right:0;border-top:0;} .sup-br2.br{bottom:8px;right:8px;border-left:0;border-top:0;}
  .sup-hud{position:absolute;font-size:10px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;z-index:3;}
  .sup-tl{top:calc(12px + env(safe-area-inset-top));left:16px;}
  .sup-tl .t{font-size:22px;font-weight:700;color:#eafaff;letter-spacing:1px;font-variant-numeric:tabular-nums;}
  .sup-tr{top:calc(12px + env(safe-area-inset-top));right:16px;text-align:right;max-width:38vw;}
  .sup-tr .wx{font-size:20px;font-weight:700;color:#eafaff;white-space:nowrap;}
  #sup-wx-desc{white-space:normal;line-height:1.25;}
  .sup-br{bottom:calc(12px + env(safe-area-inset-bottom));right:16px;text-align:right;color:var(--cyan);}
  .sup-close{position:absolute;top:calc(10px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);
    width:42px;height:42px;border-radius:50%;border:1px solid var(--border-hi);background:rgba(10,23,38,.7);color:var(--cyan);font-size:18px;z-index:6;}
  .sup-core{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:clamp(230px,56vmin,360px);height:clamp(230px,56vmin,360px);display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer;}
  .sup-rings{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
  .sup-rings .rr{fill:none;stroke:rgba(0,212,255,.5);transform-box:fill-box;transform-origin:center;}
  .sup-rings .r1{stroke-width:.5;stroke-dasharray:2 9;animation:supSpin 90s linear infinite;}
  .sup-rings .r2{stroke-width:1;stroke-dasharray:34 14;opacity:.55;animation:supSpin 64s linear infinite reverse;}
  .sup-rings .r3{stroke-width:.7;stroke-dasharray:2 7;opacity:.5;animation:supSpin 46s linear infinite;}
  .sup-sphere{width:84%;height:84%;overflow:visible;pointer-events:none;}
  #view-super.sst-speaking .sup-core{animation:supPulse .6s ease-in-out infinite;}
  #view-super.sst-listening .sup-core{filter:drop-shadow(0 0 18px rgba(0,255,136,.6));}
  @keyframes supPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.05)}}
  .sup-title{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-weight:700;letter-spacing:clamp(2px,1vmin,6px);font-size:clamp(15px,4.4vmin,30px);color:#eafaff;text-shadow:0 0 18px rgba(0,212,255,.9);pointer-events:none;white-space:nowrap;z-index:3;}
  .sup-hint{position:absolute;left:50%;bottom:calc(64px + env(safe-area-inset-bottom));transform:translateX(-50%);font-size:11px;letter-spacing:1.2px;color:var(--text-dim);text-transform:uppercase;pointer-events:none;z-index:5;text-align:center;width:90%;}
  .sup-ring{position:absolute;left:50%;top:44%;width:10px;height:10px;z-index:4;}
  .sup-app{position:absolute;left:50%;top:50%;width:58px;margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;
    border:0;background:transparent;padding:0;-webkit-appearance:none;appearance:none;touch-action:none;z-index:4;
    --x:0px;--y:0px;
    transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y)));
    will-change:transform;}
  .sup-app.drag{z-index:9;}
  .sup-app .si{width:46px;height:46px;border-radius:14px;border:1px solid var(--border-hi);background:rgba(10,23,38,.85);color:var(--cyan);display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(0,212,255,.16);transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;overflow:hidden;}
  .sup-app .si svg,.sup-app .si .qi-wrap{width:30px;height:30px;}
  .sup-app .si .lt{font-size:15px;border-radius:8px;}
  .sup-app.drag .si{transform:scale(1.2);border-color:var(--cyan);box-shadow:0 0 26px var(--cyan-glow);}
  .sup-app:active .si{transform:scale(.9);}
  .sup-app .sl{font-size:10px;color:var(--text-dim);letter-spacing:.3px;max-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  /* Logos a TODO COLOR (como en el dock) — fondo claro para que se vean bien */
  .sup-app .si{background:#0c1826;}
  @keyframes supSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  #super-log{position:absolute;left:10px;right:10px;bottom:calc(96px + env(safe-area-inset-bottom));max-height:12vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;z-index:5;pointer-events:none;-webkit-mask-image:linear-gradient(transparent,#000 38%);mask-image:linear-gradient(transparent,#000 38%);}
  #super-log .msg{pointer-events:auto;max-width:86%;padding:8px 12px;border-radius:13px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word;}
  #super-log .me{align-self:flex-end;background:var(--cyan-soft);border:1px solid var(--border-hi);color:var(--text);}
  #super-log .jv{align-self:flex-start;background:rgba(10,23,38,.9);border:1px solid var(--border);color:var(--text);}
  #super-log .sys{align-self:center;color:var(--text-muted);font-size:12px;}
  #super-log .msg.agent{display:flex;align-items:center;gap:10px;background:rgba(0,212,255,.07);}
  .sup-add{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);
    display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:22px;border:1px solid var(--border-hi);
    background:rgba(10,23,38,.8);color:var(--cyan);font-size:13px;font-weight:600;letter-spacing:.5px;z-index:6;}
  .sup-add:active{background:var(--cyan-soft);}
  .sup-trash{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);
    display:none;align-items:center;gap:8px;padding:12px 22px;border-radius:16px;border:1px dashed var(--red);
    background:rgba(40,10,12,.7);color:var(--red);font-size:13px;font-weight:600;z-index:7;}
  .sup-trash.show{display:flex;}
  .sup-trash.hot{background:rgba(255,68,68,.25);border-style:solid;transform:translateX(-50%) scale(1.08);}
  /* drawer de apps */
  #sup-apps{position:fixed;inset:0;background:rgba(2,6,13,.92);display:none;align-items:flex-end;justify-content:center;z-index:70;}
  #sup-apps.show{display:flex;}
  #sup-apps .sheet2{width:100%;max-width:480px;max-height:74vh;overflow-y:auto;background:var(--panel);border:1px solid var(--border-hi);border-radius:18px 18px 0 0;padding:16px;}
  #sup-apps h3{margin:0 0 4px;color:var(--cyan);font-size:15px;letter-spacing:1px;}
  #sup-apps p{margin:0 0 12px;font-size:12px;color:var(--text-dim);}
  .sup-pick{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 8px;}
  .sup-pick button{display:flex;flex-direction:column;align-items:center;gap:5px;background:transparent;border:0;color:var(--text-dim);font-size:10px;}
  .sup-pick .pi{width:46px;height:46px;border-radius:13px;border:1px solid var(--border);background:var(--card);display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .sup-pick .pi svg,.sup-pick .pi .qi-wrap{width:28px;height:28px;} .sup-pick .pi .lt{font-size:14px;border-radius:7px;}
  #sup-apps .closex{display:block;width:100%;margin-top:14px;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--cyan-soft);color:var(--cyan);font-weight:600;}
  `;

  var built = false, sphereMade = false, clockTimer = null;

  function build() {
    if (built) return;
    built = true;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    var v = $("view-super");
    v.innerHTML =
      '<div class="sup-grid"></div><div class="sup-scan"></div>' +
      '<i class="sup-br2 tl"></i><i class="sup-br2 tr"></i><i class="sup-br2 bl"></i><i class="sup-br2 br"></i>' +
      '<div class="sup-hud sup-tl"><div class="t" id="sup-clock">--:--</div><div id="sup-date">—</div></div>' +
      '<div class="sup-hud sup-tr"><div class="wx"><span id="sup-wx-ico">🌡️</span> <span id="sup-wx-temp">--</span>°</div><div id="sup-wx-desc">CLIMA</div></div>' +
      '<div class="sup-hud sup-br" id="sup-status">EN LÍNEA</div>' +
      '<button class="sup-close" id="sup-close" aria-label="Salir">✕</button>' +
      '<div class="sup-core" id="sup-core">' +
        '<svg class="sup-rings" viewBox="0 0 300 300"><circle class="rr r1" cx="150" cy="150" r="146"/><circle class="rr r2" cx="150" cy="150" r="126"/><circle class="rr r3" cx="150" cy="150" r="108"/></svg>' +
        '<svg class="sup-sphere" id="sup-sphere" viewBox="-100 -100 200 200"></svg>' +
      '</div>' +
      '<div class="sup-title">J.A.R.V.I.S</div>' +
      '<div class="sup-hint" id="sup-hint">Toca la esfera o di «Jarvis» para hablar</div>' +
      '<div class="sup-ring" id="sup-ring"></div>' +
      '<div id="super-log"></div>' +
      '<button class="sup-add" id="sup-add">＋ Apps</button>' +
      '<div class="sup-trash" id="sup-trash">🗑 Soltar aquí para quitar</div>';

    $("sup-close").addEventListener("click", hide);
    $("sup-core").addEventListener("click", micTap);
    $("sup-add").addEventListener("click", openApps);

    // Drawer de apps (al final del body)
    var d = document.createElement("div"); d.id = "sup-apps";
    d.innerHTML = '<div class="sheet2"><h3>Tus apps</h3><p>Toca una para colocarla alrededor de JARVIS. Mantén pulsada una app de la esfera para moverla; suéltala en «Quitar» para sacarla.</p><div class="sup-pick" id="sup-pick"></div><button class="closex" id="sup-clear" style="border-color:var(--red);color:var(--red);background:transparent;margin-bottom:8px">🗑 Limpiar todo (empezar de cero)</button><button class="closex" id="sup-apps-x">Cerrar</button></div>';
    document.body.appendChild(d);
    $("sup-apps-x").addEventListener("click", function () { d.classList.remove("show"); });
    $("sup-clear").addEventListener("click", function () { if (confirm("¿Quitar TODAS las apps de la esfera, señor? Podrás añadir las que quieras.")) clearAllApps(); });
    d.addEventListener("click", function (e) { if (e.target === d) d.classList.remove("show"); });
  }

  // ── La esfera = micrófono ──
  function micTap() {
    if (window.Voice && window.Voice.wakeSupported && window.Voice.wakeSupported()) {
      window.Voice.wakeCapture();
    } else if (window.APP && window.APP.mic) { window.APP.mic(); }
  }
  function onWakeState(state) {
    var s = $("sup-status");
    if (state === "listening") { if (s) s.textContent = "ESCUCHANDO…"; if (window.Sphere) Sphere.setMode("listening"); }
    else if (state === "unsupported") { if (window.APP) APP.addMsg("Tu navegador no reconoce la voz (en iPhone no va). Usa Android/Chrome, señor.", "sys"); }
    else { if (s) s.textContent = "EN LÍNEA"; if (window.Sphere && Sphere.state && Sphere.state.mode === "listening") Sphere.setMode("idle"); }
  }

  // ── Apps que ORBITAN alrededor de la esfera (girando) + clicables + arrastrables ──
  var MAX_APPS = 15;
  var ORBIT = { tiles: [], rot: 0, raf: 0, paused: false };
  function orbitR() { return Math.min(Math.min(window.innerWidth, window.innerHeight) * 0.37, 178); }
  function renderTiles() {
    var ring = $("sup-ring"); if (!ring) return;
    if (ORBIT.raf) { cancelAnimationFrame(ORBIT.raf); ORBIT.raf = 0; }
    ring.innerHTML = ""; ORBIT.tiles = [];
    var apps = getSet(), pos = getPos(), n = apps.length;
    apps.forEach(function (a, i) {
      var b = document.createElement("button");
      b.className = "sup-app";
      b.innerHTML = '<span class="si">' + iconFor(a) + '</span><span class="sl">' + esc(a.name) + '</span>';
      // ángulo base guardado (número) o repartido en círculo (auto-organizado)
      var baseAng = (typeof pos[a.name] === "number") ? pos[a.name] : Math.round((i / Math.max(n, 1)) * 360 - 90);
      var t = { el: b, app: a, baseAng: baseAng, dragging: false };
      attachDrag(t);
      ORBIT.tiles.push(t);
      ring.appendChild(b);
    });
    startOrbit();
  }
  function startOrbit() {
    if (ORBIT.raf) return;
    (function frame() {
      if (!isOpen()) { ORBIT.raf = 0; return; }
      if (!ORBIT.paused) ORBIT.rot = (ORBIT.rot + 0.05) % 360;   // giro lento (~120 s/vuelta)
      var R = orbitR();
      ORBIT.tiles.forEach(function (t) {
        if (t.dragging) return;
        var a = (t.baseAng + ORBIT.rot) * Math.PI / 180;
        t.el.style.setProperty("--x", Math.round(Math.cos(a) * R) + "px");
        t.el.style.setProperty("--y", Math.round(Math.sin(a) * R) + "px");
      });
      ORBIT.raf = requestAnimationFrame(frame);
    })();
  }
  function removeApp(a) {
    var s = getSet().filter(function (x) { return x.name.toLowerCase() !== a.name.toLowerCase(); });
    setSet(s);
    var p = getPos(); delete p[a.name]; setPos(p);
    renderTiles();
  }
  function trashHot(x, y, on) {
    var t = $("sup-trash"); if (!t) return false;
    if (on === undefined) { var r = t.getBoundingClientRect(); return x >= r.left - 30 && x <= r.right + 30 && y >= r.top - 30 && y <= r.bottom + 30; }
    t.classList.toggle("show", on);
  }
  function attachDrag(t) {
    var el = t.el, hold = null, dragging = false, moved = false, cx = 0, cy = 0, sx = 0, sy = 0;
    el.addEventListener("pointerdown", function (ev) {
      moved = false; dragging = false; sx = ev.clientX; sy = ev.clientY;
      var r = $("sup-ring").getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      try { el.setPointerCapture(ev.pointerId); } catch (e) {}   // capturar el dedo YA
      hold = setTimeout(function () {
        dragging = true; t.dragging = true; ORBIT.paused = true; el.classList.add("drag");   // pausa la órbita al cogerla
        try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) {}
        trashHot(0, 0, true);
      }, 280);
    });
    el.addEventListener("pointermove", function (ev) {
      if (!dragging) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 12) { moved = true; if (hold) { clearTimeout(hold); hold = null; } }
        return;
      }
      // Sigue al dedo SIN límite (así llega a la papelera o a cualquier sitio).
      el.style.setProperty("--x", Math.round(ev.clientX - cx) + "px");
      el.style.setProperty("--y", Math.round(ev.clientY - cy) + "px");
      var tt = $("sup-trash"); if (tt) tt.classList.toggle("hot", trashHot(ev.clientX, ev.clientY));
    });
    function end(ev) {
      if (hold) { clearTimeout(hold); hold = null; }
      try { el.releasePointerCapture(ev.pointerId); } catch (e) {}
      if (dragging) {
        dragging = false; t.dragging = false; ORBIT.paused = false; el.classList.remove("drag"); trashHot(0, 0, false);
        if (trashHot(ev.clientX, ev.clientY)) { removeApp(t.app); return; }
        // Vuelve al anillo: ángulo = el del dedo MENOS la rotación actual (sigue orbitando desde ahí).
        var ang = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI - ORBIT.rot;
        t.baseAng = ang;
        var p = getPos(); p[t.app.name] = Math.round(ang); setPos(p);
      } else if (!moved) {
        var say = openDesc(t.app);
        if (say && window.APP) APP.addMsg(say, "jv");
      }
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", function () { if (hold) { clearTimeout(hold); hold = null; } if (dragging) { dragging = false; t.dragging = false; ORBIT.paused = false; el.classList.remove("drag"); trashHot(0, 0, false); } });
  }

  // ── Drawer: añadir apps ──
  function allCatalog() {
    var out = DEFAULTS.map(function (d) { return { name: d.name, app: d.app, cam: d.cam, domain: d.domain || "" }; });
    var cat = (window.Extras && window.Extras.catalog) ? window.Extras.catalog : [];
    cat.forEach(function (c) {
      if (!out.some(function (x) { return x.name.toLowerCase() === c.name.toLowerCase(); }))
        out.push({ name: c.name, url: c.url, web: c.web, domain: c.domain || "" });
    });
    return out;
  }
  function openApps() {
    var pick = $("sup-pick"); if (!pick) return;
    var placed = {}; getSet().forEach(function (a) { placed[a.name.toLowerCase()] = 1; });
    var avail = allCatalog().filter(function (c) { return !placed[c.name.toLowerCase()]; });
    pick.innerHTML = avail.map(function (c) {
      return '<button data-app="' + esc(c.name) + '"><span class="pi">' + (window.AppIcons ? window.AppIcons.html(c.name, c.domain) : "▣") + '</span>' + esc(c.name) + '</button>';
    }).join("") || '<p style="grid-column:1/-1">Ya están todas colocadas, señor.</p>';
    Array.prototype.forEach.call(pick.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        var c = avail.filter(function (x) { return x.name === b.dataset.app; })[0];
        if (!c) return;
        var s = getSet();
        if (s.length >= MAX_APPS) { alert("Máximo " + MAX_APPS + " apps en la esfera, señor. Quita alguna primero (arrástrala a la papelera)."); return; }
        s.push(c); setSet(s);
        renderTiles(); openApps();   // refresca para poder añadir varias seguidas
      });
    });
    $("sup-apps").classList.add("show");
  }
  function clearAllApps() { setSet([]); setPos({}); renderTiles(); openApps(); }

  function tick() {
    var n = new Date(), p = function (x) { return String(x).padStart(2, "0"); };
    var c = $("sup-clock"); if (c) c.textContent = p(n.getHours()) + ":" + p(n.getMinutes()) + ":" + p(n.getSeconds());
    var dias = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
    var d = $("sup-date"); if (d) d.textContent = dias[n.getDay()] + " · " + n.getDate();
    var wt = $("wx-temp"), wi = $("wx-icon"), wd = $("wx-desc");
    if (wt && $("sup-wx-temp")) $("sup-wx-temp").textContent = wt.textContent;
    if (wi && $("sup-wx-ico")) $("sup-wx-ico").textContent = wi.textContent;
    if (wd && $("sup-wx-desc")) $("sup-wx-desc").textContent = wd.textContent;
  }

  function show() {
    build();
    $("view-super").classList.add("show");
    window.__superActive = true;
    if (!sphereMade) { window.Sphere.make($("sup-sphere"), { state: true, isSuper: true, N: 96, R: 84 }); sphereMade = true; }
    renderTiles();
    tick(); if (!clockTimer) clockTimer = setInterval(tick, 1000);
    try { if (window.Voice && window.Voice.startWake) window.Voice.startWake(function (cmd) { if (window.APP) window.APP.handle(cmd); }, onWakeState); } catch (e) {}
  }
  function hide() {
    $("view-super").classList.remove("show");
    window.__superActive = false;
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    try { if (window.Voice && window.Voice.stopWake) window.Voice.stopWake(); } catch (e) {}
    var sa = $("sup-apps"); if (sa) sa.classList.remove("show");
  }
  function isOpen() { return window.__superActive === true; }

  window.Super = { show: show, hide: hide, isOpen: isOpen, build: build };
})();
