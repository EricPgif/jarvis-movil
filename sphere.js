/* sphere.js — Esfera de red Fibonacci 3D (portada del JARVIS de escritorio).
   Reactiva al estado (idle cyan / listening verde / processing ámbar / speaking cyan).
   Sin parallax de ratón (en móvil no hay cursor). Expone window.Sphere. */
(function () {
  "use strict";

  // Estado global de la esfera (igual que el escritorio).
  var sphereState = { mode: "idle" };

  function colorForState(useState) {
    if (!useState) return null;
    switch (sphereState.mode) {
      case "listening":  return { stroke: "#00ff88", point: "#00ff88" };
      case "processing": return { stroke: "#ffaa00", point: "#ffaa00" };
      case "speaking":   return { stroke: "#00d4ff", point: "#7adfff" };
      default:           return { stroke: "#00d4ff", point: "#00d4ff" };
    }
  }

  // makeSphere(svgEl, {state, N, R, color, isSuper})
  function makeSphere(svg, opts) {
    if (!svg) return;
    opts = opts || {};
    var useState = !!opts.state;
    var fixed = opts.color || "#00d4ff";
    var N = opts.N || 92;
    var R = opts.R || 75;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var NS = "http://www.w3.org/2000/svg";

    svg.style.filter = "drop-shadow(0 0 2.4px " + fixed + ")";
    var g = document.createElementNS(NS, "g");
    svg.appendChild(g);

    var points = [];
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2;
      var rad = Math.sqrt(1 - y * y);
      var theta = golden * i;
      points.push({ x: Math.cos(theta) * rad * R, y: y * R, z: Math.sin(theta) * rad * R });
    }

    var lines = [];
    for (var a = 0; a < N; a++) {
      var dists = [];
      for (var b = 0; b < N; b++) {
        if (a === b) continue;
        var dx = points[a].x - points[b].x, dy = points[a].y - points[b].y, dz = points[a].z - points[b].z;
        dists.push({ j: b, d: Math.sqrt(dx * dx + dy * dy + dz * dz) });
      }
      dists.sort(function (m, n) { return m.d - n.d; });
      for (var k = 0; k < 3; k++) { var jj = dists[k].j; if (jj > a) lines.push([a, jj]); }
    }

    var lineEls = lines.map(function () {
      var el = document.createElementNS(NS, "line");
      el.setAttribute("stroke", fixed); el.setAttribute("stroke-width", "0.6");
      g.appendChild(el); return el;
    });
    var pointEls = points.map(function () {
      var el = document.createElementNS(NS, "circle");
      el.setAttribute("r", "1.4"); el.setAttribute("fill", fixed);
      g.appendChild(el); return el;
    });

    function project(p, ay, ax) {
      var cy = Math.cos(ay), sy = Math.sin(ay);
      var x = p.x * cy - p.z * sy, z = p.x * sy + p.z * cy;
      var cx = Math.cos(ax), sx = Math.sin(ax);
      var yy = p.y * cx - z * sx; z = p.y * sx + z * cx;
      return { x: x, y: yy, z: z };
    }

    var angleY = 0, angleX = 0, tick = 0, lastFrame = 0, lastMode = null;
    function frame(now) {
      requestAnimationFrame(frame);
      now = now || 0;
      if (document.hidden || now - lastFrame < 33) return;
      // En Modo Super solo anima la esfera del super; en Normal solo las de fondo.
      if (window.__superActive && !opts.isSuper) return;
      if (!window.__superActive && opts.isSuper) return;
      lastFrame = now; tick++;
      var mode = useState ? sphereState.mode : "idle";
      var base = mode === "processing" ? 0.018 : mode === "listening" ? 0.010 : mode === "speaking" ? 0.012 : 0.006;
      angleY += base; angleX += base * 0.35;

      var scale = mode === "speaking" ? 1 + 0.08 * Math.sin(tick * 0.18)
                : mode === "listening" ? 1 + 0.04 * Math.sin(tick * 0.12)
                : mode === "processing" ? 1 + 0.02 * Math.sin(tick * 0.25)
                : 1 + 0.015 * Math.sin(tick * 0.05);

      var col = colorForState(useState) || { stroke: fixed, point: fixed };
      if (useState && mode !== lastMode) {
        lastMode = mode;
        svg.style.filter = "drop-shadow(0 0 2.6px " + col.point + ")";
      }
      var proj = points.map(function (p) { return project(p, angleY, angleX); });
      lines.forEach(function (pair, idx) {
        var p1 = proj[pair[0]], p2 = proj[pair[1]], el = lineEls[idx];
        el.setAttribute("x1", p1.x * scale); el.setAttribute("y1", -p1.y * scale);
        el.setAttribute("x2", p2.x * scale); el.setAttribute("y2", -p2.y * scale);
        var depth = ((p1.z + p2.z) / 2 + R) / (2 * R);
        el.setAttribute("stroke-opacity", (0.15 + depth * 0.6).toFixed(2));
        el.setAttribute("stroke-width", (0.3 + depth * 0.7).toFixed(2));
        el.setAttribute("stroke", col.stroke);
      });
      proj.forEach(function (p, idx) {
        var el = pointEls[idx];
        el.setAttribute("cx", p.x * scale); el.setAttribute("cy", -p.y * scale);
        var depth = (p.z + R) / (2 * R);
        el.setAttribute("r", (0.8 + depth * 1.6).toFixed(2));
        var tw = 0.82 + 0.18 * Math.sin(tick * 0.25 + idx * 0.7);
        el.setAttribute("opacity", ((0.25 + depth * 0.75) * tw).toFixed(2));
        el.setAttribute("fill", col.point);
      });
    }
    requestAnimationFrame(frame);
  }

  // Cambia el modo y refleja en el <body> (clases sp-*) para HUD/reactor.
  function setMode(mode) {
    sphereState.mode = mode || "idle";
    var b = document.body;
    b.classList.remove("sp-listening", "sp-speaking", "sp-processing");
    if (mode === "listening") b.classList.add("sp-listening");
    else if (mode === "speaking") b.classList.add("sp-speaking");
    else if (mode === "processing") b.classList.add("sp-processing");
    // Refleja también en el overlay Super si está abierto.
    var sup = document.getElementById("view-super");
    if (sup) {
      sup.classList.remove("sst-listening", "sst-speaking", "sst-processing");
      if (mode === "listening") sup.classList.add("sst-listening");
      else if (mode === "speaking") sup.classList.add("sst-speaking");
      else if (mode === "processing") sup.classList.add("sst-processing");
    }
  }

  window.Sphere = { make: makeSphere, setMode: setMode, state: sphereState };
})();
