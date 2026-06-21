/* intro.js — Intro cinematográfica (estilo el vídeo de referencia): la esfera aparece en
   el CENTRO y de ella SALEN los iconos (que aterrizan en un dock abajo) y el reloj (sube
   arriba); al terminar resuelve en el dashboard. Técnica FLIP (solo transform/opacity).
   Saltable con un toque. Expone window.Intro. Tiempos en CFG_INTRO para iterar. */
(function () {
  "use strict";

  // Parámetros para afinar contra el vídeo (sin tocar lógica).
  var CFG_INTRO = {
    sphereIn: 900,     // ms de aparición de la esfera
    iconStart: 700,    // cuándo empiezan a salir los iconos
    iconStagger: 95,   // ms entre iconos
    iconDur: 620,      // duración del vuelo de cada icono
    hold: 520,         // pausa antes de resolver
    fade: 600,         // fundido final
  };

  var APPS = [
    { ico: "♪" }, { ico: "▶" }, { ico: "✆" }, { ico: "✈" },
    { ico: "🌐" }, { ico: "✉" }, { ico: "▦" }, { ico: "📷" },
  ];

  var CSS = `
  #view-intro{display:none;background:radial-gradient(circle at 50% 44%,#061a2b 0%,#02060d 64%,#01040b 100%);z-index:80;overflow:hidden;}
  #view-intro.show{display:block;}
  #view-intro.fade{opacity:0;transition:opacity ${CFG_INTRO.fade}ms ease;}
  .intro-grid{position:absolute;inset:0;background-image:radial-gradient(rgba(0,212,255,.10) 1px,transparent 1px);background-size:30px 30px;-webkit-mask-image:radial-gradient(circle at 50% 44%,#000 30%,transparent 72%);mask-image:radial-gradient(circle at 50% 44%,#000 30%,transparent 72%);opacity:0;animation:introGrid 1.4s ease forwards;}
  @keyframes introGrid{to{opacity:1}}
  .intro-core{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:clamp(220px,58vmin,360px);height:clamp(220px,58vmin,360px);display:flex;align-items:center;justify-content:center;}
  .intro-sphere{width:100%;height:100%;overflow:visible;transform:scale(.55);opacity:0;animation:introSphere ${CFG_INTRO.sphereIn}ms cubic-bezier(.2,.8,.2,1) forwards;}
  @keyframes introSphere{to{transform:scale(1);opacity:1}}
  .intro-title{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-weight:700;color:#eafaff;white-space:nowrap;
    font-size:clamp(18px,5vmin,40px);letter-spacing:34px;filter:blur(6px);opacity:0;animation:introTitle 1100ms ease 400ms forwards;text-shadow:0 0 18px rgba(0,212,255,.9);}
  @keyframes introTitle{to{letter-spacing:clamp(4px,1.6vmin,10px);filter:blur(0);opacity:1}}
  .intro-sub{position:absolute;left:0;right:0;top:calc(44% + clamp(130px,30vmin,200px));text-align:center;font-size:10px;letter-spacing:4px;color:var(--text-muted);text-transform:uppercase;opacity:0;animation:introGrid 1s ease 900ms forwards;}
  .intro-clock{position:absolute;left:50%;top:44%;font-weight:700;font-size:26px;color:#eafaff;font-variant-numeric:tabular-nums;text-shadow:0 0 14px rgba(0,212,255,.7);
    transform:translate(-50%,-50%) scale(.2);opacity:0;}
  .intro-dock{position:absolute;left:0;right:0;bottom:calc(40px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:clamp(8px,3vw,16px);}
  .intro-ic{width:clamp(42px,12vw,54px);height:clamp(42px,12vw,54px);border-radius:15px;border:1px solid var(--border-hi);background:rgba(10,23,38,.85);
    color:var(--cyan);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 0 16px rgba(0,212,255,.2);opacity:0;}
  .intro-skip{position:absolute;bottom:calc(8px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:10px;letter-spacing:2px;color:var(--text-muted);opacity:.7;}
  `;

  var played = false;

  function play(onDone) {
    if (played) { if (onDone) onDone(); return; }
    played = true;

    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);

    var v = document.getElementById("view-intro");
    v.innerHTML =
      '<div class="intro-grid"></div>' +
      '<div class="intro-core"><svg class="intro-sphere" id="intro-sphere" viewBox="-100 -100 200 200"></svg></div>' +
      '<div class="intro-title">J.A.R.V.I.S</div>' +
      '<div class="intro-sub">JUST A RATHER VERY INTELLIGENT SYSTEM</div>' +
      '<div class="intro-clock" id="intro-clock">--:--</div>' +
      '<div class="intro-dock" id="intro-dock"></div>' +
      '<div class="intro-skip">toca para saltar</div>';
    v.style.display = "block";
    v.classList.add("show");

    Sphere.make(document.getElementById("intro-sphere"), { state: false, N: 96, R: 84, color: "#00d4ff" });
    if (window.sfx) { window.sfx.unlock(); window.sfx.whoosh(); }   // arranque

    // Reloj de la intro
    var now = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    document.getElementById("intro-clock").textContent = p(now.getHours()) + ":" + p(now.getMinutes());

    // Construir iconos en su sitio FINAL (dock). Luego FLIP: los llevamos al centro y los soltamos.
    var dock = document.getElementById("intro-dock");
    var els = APPS.map(function (a) {
      var el = document.createElement("div");
      el.className = "intro-ic";
      el.textContent = a.ico;
      dock.appendChild(el);
      return el;
    });

    var cx = window.innerWidth / 2, cy = window.innerHeight * 0.44;
    // INVERT: cada icono parte del centro (scale ~0). El reloj también.
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      el.style.transform = "translate(" + dx + "px," + dy + "px) scale(.15)";
      el.dataset.dx = dx; el.dataset.dy = dy;
    });
    // PLAY: tras un momento, cada icono vuela a su sitio (transform→none) con cascada.
    void v.offsetWidth; // reflow
    setTimeout(function () {
      els.forEach(function (el, i) {
        setTimeout(function () {
          el.style.transition = "transform " + CFG_INTRO.iconDur + "ms cubic-bezier(.2,.8,.2,1), opacity 300ms ease";
          el.style.transform = "translate(0,0) scale(1)";
          el.style.opacity = "1";
          if (window.sfx) window.sfx.place(i);   // "tick" al colocarse cada app
        }, i * CFG_INTRO.iconStagger);
      });
      // El reloj sube del centro a su sitio (arriba).
      var clk = document.getElementById("intro-clock");
      clk.style.transition = "transform 760ms cubic-bezier(.2,.8,.2,1), opacity 400ms ease, top 760ms cubic-bezier(.2,.8,.2,1)";
      clk.style.opacity = "1";
      clk.style.top = "calc(12px + env(safe-area-inset-top) + 14px)";
      clk.style.transform = "translate(-50%,0) scale(1)";
    }, CFG_INTRO.iconStart);

    var total = CFG_INTRO.iconStart + APPS.length * CFG_INTRO.iconStagger + CFG_INTRO.iconDur + CFG_INTRO.hold;
    var finishTimer = setTimeout(finish, total);

    function finish() {
      clearTimeout(finishTimer);
      v.removeEventListener("click", finish);
      if (window.sfx) window.sfx.chord();   // acorde de arranque al resolver
      v.classList.add("fade");
      setTimeout(function () { v.classList.remove("show", "fade"); v.style.display = "none"; if (onDone) onDone(); }, CFG_INTRO.fade);
    }
    v.addEventListener("click", finish);
  }

  window.Intro = { play: play };
})();
