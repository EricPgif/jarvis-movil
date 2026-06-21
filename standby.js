/* standby.js — MODO ESPERA móvil (como la captura): esfera grande con «JARVIS» dentro +
   reloj ENORME y fecha. Se activa solo tras 2 min sin tocar nada, o con el botón ☾.
   Sale al tocar. Expone window.Standby. */
(function () {
  "use strict";

  var IDLE_MS = 120000;   // 2 minutos de inactividad
  var idleTimer = null, clockTimer = null, built = false, sphereMade = false;

  var CSS = `
  #view-standby{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 38%,#061523 0%,#02060d 70%,#01040b 100%);}
  #view-standby.show{display:flex;}
  .sb-core{position:relative;width:clamp(220px,64vw,330px);height:clamp(220px,64vw,330px);display:flex;align-items:center;justify-content:center;}
  .sb-sphere{width:100%;height:100%;overflow:visible;}
  .sb-brand{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-weight:700;letter-spacing:8px;font-size:clamp(15px,4vmin,22px);color:#eafaff;text-shadow:0 0 16px rgba(0,212,255,.9);pointer-events:none;}
  .sb-clock{margin-top:28px;font-size:clamp(46px,15vw,78px);font-weight:700;letter-spacing:2px;color:#eafaff;font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(0,212,255,.45);line-height:1;}
  .sb-date{margin-top:8px;font-size:clamp(12px,3.4vw,16px);letter-spacing:3px;color:var(--text-dim);text-transform:uppercase;}
  .sb-hint{position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:11px;letter-spacing:2px;color:var(--text-muted);}
  `;

  function build() {
    if (built) return;
    built = true;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var v = document.createElement("div");
    v.id = "view-standby";
    v.innerHTML =
      '<div class="sb-core"><svg class="sb-sphere" id="sb-sphere" viewBox="-100 -100 200 200"></svg><div class="sb-brand">JARVIS</div></div>' +
      '<div class="sb-clock" id="sb-clock">--:--:--</div>' +
      '<div class="sb-date" id="sb-date">—</div>' +
      '<div class="sb-hint">toca para volver</div>';
    document.body.appendChild(v);
    v.addEventListener("click", hide);
  }

  function tick() {
    var n = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    var c = document.getElementById("sb-clock");
    if (c) c.textContent = p(n.getHours()) + ":" + p(n.getMinutes()) + ":" + p(n.getSeconds());
    var dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
    var meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    var d = document.getElementById("sb-date");
    if (d) d.textContent = dias[n.getDay()] + ", " + n.getDate() + " DE " + meses[n.getMonth()];
  }

  function show() {
    build();
    document.getElementById("view-standby").classList.add("show");
    if (!sphereMade) { Sphere.make(document.getElementById("sb-sphere"), { state: false, N: 96, R: 84, color: "#00d4ff" }); sphereMade = true; }
    tick(); if (!clockTimer) clockTimer = setInterval(tick, 1000);
  }
  function hide() {
    var v = document.getElementById("view-standby");
    if (v) v.classList.remove("show");
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
    resetIdle();
  }
  function isOpen() { var v = document.getElementById("view-standby"); return !!v && v.classList.contains("show"); }

  // Temporizador de inactividad (2 min). Cualquier toque/tecla lo reinicia.
  function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      // No entrar en espera si ya está, o si está en Modo Super.
      if (!isOpen() && !window.__superActive) show();
    }, IDLE_MS);
  }
  function startWatch() {
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      document.addEventListener(ev, function () { if (isOpen()) return; resetIdle(); }, { passive: true });
    });
    resetIdle();
  }

  window.Standby = { show: show, hide: hide, isOpen: isOpen, start: startWatch };
})();
