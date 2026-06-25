/* ─────────────────────────────────────────────────────────────────────────
   JARVIS TTS Worker — voz del PC (es-ES-AlvaroNeural) para el móvil.
   Genera la voz de Microsoft Edge TTS DESDE EL SERVIDOR (el navegador no puede,
   Microsoft bloquea ese canal). El móvil llama:  GET /tts?text=Hola&voice=es-ES-AlvaroNeural
   y recibe un MP3. Gratis en Cloudflare Workers. Despliegue: ver README.md.

   Alineado con la implementación verificada en Cloudflare (DIYgod/cloudflare-edge-tts)
   y con el código actual de edge-tts (rany2, Chromium 143). El 403 anterior era por:
   versión Sec-MS-GEC vieja, falta de ConnectionId y de cabeceras del handshake.
   ───────────────────────────────────────────────────────────────────────── */

const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
// Cloudflare Workers exige http(s):// en fetch para el upgrade a WebSocket (no acepta wss://).
const WSS = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const GEC_VERSION = "1-" + CHROMIUM_FULL_VERSION;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    // ── Agente: búsqueda web (la hace el servidor; el navegador no puede por CORS) ──
    if (url.pathname === "/search") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return jsonRes({ results: [] });
      try { return jsonRes({ results: await webSearch(q) }); }
      catch (e) { return jsonRes({ results: [], error: String((e && e.message) || e) }); }
    }

    // ── Generación de IMÁGENES: MiniMax image-01 (el navegador no puede directo por CORS y
    //    expondría la key). El móvil POSTea { prompt, aspect_ratio, n, key }; aquí llamamos a
    //    MiniMax con la key y devolvemos las URLs con CORS. ──
    if (url.pathname === "/image") {
      let prompt = "", aspect = "1:1", n = 1, mmKey = "";
      try {
        const body = await request.json();
        prompt = String((body && body.prompt) || "").trim().slice(0, 1400);
        aspect = String((body && body.aspect_ratio) || "1:1");
        n = Math.max(1, Math.min(9, parseInt((body && body.n) || 1, 10) || 1));
        mmKey = String((body && body.key) || "").trim();
      } catch (e) {}
      if (!mmKey)  return jsonRes({ error: "Falta la API key." });
      if (!prompt) return jsonRes({ error: "Falta la descripción de la imagen." });
      try {
        const mmRes = await fetch("https://api.minimax.io/v1/image_generation", {
          method: "POST",
          headers: { "Authorization": "Bearer " + mmKey, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "image-01", prompt, aspect_ratio: aspect, response_format: "url", n, prompt_optimizer: true }),
        });
        const data = await mmRes.json();
        const urls = (data && data.data && (data.data.image_urls || data.data.image_base64)) || [];
        const ok = mmRes.ok && (!data.base_resp || data.base_resp.status_code === 0);
        if (!ok || !urls.length) {
          return jsonRes({ error: (data && data.base_resp && data.base_resp.status_msg) || ("MiniMax error " + mmRes.status) });
        }
        return jsonRes({ images: urls });
      } catch (e) {
        return jsonRes({ error: "No se pudo generar la imagen: " + String((e && e.message) || e) });
      }
    }

    // ── VÍDEO (MiniMax Hailuo, asíncrono). 3 rutas: encargar / consultar / obtener archivo. ──
    if (url.pathname === "/video" || url.pathname === "/video-status" || url.pathname === "/video-file") {
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const mmKey = String((body && body.key) || "").trim();
      if (!mmKey) return jsonRes({ error: "Falta la API key." });
      const auth = { "Authorization": "Bearer " + mmKey };
      try {
        if (url.pathname === "/video") {
          const prompt = String((body && body.prompt) || "").trim().slice(0, 1800);
          if (!prompt) return jsonRes({ error: "Falta la descripción del vídeo." });
          const model = String((body && body.model) || "MiniMax-Hailuo-02");
          const r = await fetch("https://api.minimax.io/v1/video_generation", {
            method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, auth),
            body: JSON.stringify({ model, prompt }),
          });
          const d = await r.json();
          if (d.base_resp && d.base_resp.status_code !== 0) return jsonRes({ error: d.base_resp.status_msg || "MiniMax error" });
          return jsonRes({ task_id: d.task_id || "" });
        }
        if (url.pathname === "/video-status") {
          const taskId = String((body && body.task_id) || "").trim();
          if (!taskId) return jsonRes({ error: "Falta task_id." });
          const r = await fetch("https://api.minimax.io/v1/query/video_generation?task_id=" + encodeURIComponent(taskId), { headers: auth });
          const d = await r.json();
          return jsonRes({ status: d.status || "", file_id: d.file_id || "" });
        }
        // /video-file
        const fileId = String((body && body.file_id) || "").trim();
        if (!fileId) return jsonRes({ error: "Falta file_id." });
        const r = await fetch("https://api.minimax.io/v1/files/retrieve?file_id=" + encodeURIComponent(fileId), { headers: auth });
        const d = await r.json();
        const f = (d && d.file) || {};
        return jsonRes({ url: f.download_url || f.backup_download_url || "" });
      } catch (e) {
        return jsonRes({ error: "Vídeo: " + String((e && e.message) || e) });
      }
    }

    // ── VISIÓN: analizar una imagen que envía el usuario (MiniMax-M3 multimodal, formato OpenAI). ──
    if (url.pathname === "/vision") {
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const mmKey = String((body && body.key) || "").trim();
      const image = String((body && body.image) || "").trim();   // data URI (data:image/...;base64,) o URL https
      const question = String((body && body.question) || "¿Qué hay en esta imagen? Descríbela en español.").slice(0, 1200);
      const model = String((body && body.model) || "MiniMax-M3");
      if (!mmKey) return jsonRes({ error: "Falta la API key." });
      if (!image) return jsonRes({ error: "Falta la imagen." });
      try {
        const r = await fetch("https://api.minimax.io/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + mmKey },
          body: JSON.stringify({ model: model, messages: [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url: image } }] }] }),
        });
        const d = await r.json();
        if (d.base_resp && d.base_resp.status_code !== 0) return jsonRes({ error: d.base_resp.status_msg || ("MiniMax error " + r.status) });
        let txt = "";
        try { txt = d.choices[0].message.content; if (Array.isArray(txt)) txt = txt.map(function (p) { return (p && p.text) || ""; }).join(" "); } catch (e) {}
        return jsonRes({ text: String(txt || "") });
      } catch (e) {
        return jsonRes({ error: "Visión: " + String((e && e.message) || e) });
      }
    }

    if (url.pathname !== "/tts" && url.pathname !== "/") {
      return new Response("JARVIS Worker. Usa /tts?text=... o /search?q=...", { status: 404, headers: CORS });
    }
    let text = url.searchParams.get("text") || "";
    const voice = url.searchParams.get("voice") || "es-ES-AlvaroNeural";
    const rate = url.searchParams.get("rate") || "+0%";
    const pitch = url.searchParams.get("pitch") || "+0Hz";
    if (!text.trim()) return new Response("falta ?text=", { status: 400, headers: CORS });
    if (text.length > 1500) text = text.slice(0, 1500);

    try {
      const mp3 = await synth(text, voice, rate, pitch);
      return new Response(mp3, {
        headers: Object.assign({ "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" }, CORS),
      });
    } catch (e) {
      return new Response("TTS error: " + (e && e.message || e), { status: 502, headers: CORS });
    }
  },
};

// ── Búsqueda web (DuckDuckGo HTML; si falla, Wikipedia en español) ──
function jsonRes(obj) {
  return new Response(JSON.stringify(obj), {
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS),
  });
}
function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}
async function webSearch(q) {
  const out = [];
  // 1) DuckDuckGo HTML (sin clave). Puede fallar desde IPs de datacenter → respaldo Wikipedia.
  try {
    const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), {
      headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9", "Accept": "text/html" },
    });
    const html = await r.text();
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && out.length < 5) {
      let href = m[1];
      const u = href.match(/[?&]uddg=([^&]+)/);
      if (u) href = decodeURIComponent(u[1]);
      else if (href.indexOf("//") === 0) href = "https:" + href;
      out.push({ title: stripTags(m[2]), url: href, snippet: "" });
    }
    const reS = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let s, i = 0;
    while ((s = reS.exec(html)) && i < out.length) { out[i].snippet = stripTags(s[1]); i++; }
  } catch (e) {}
  // 2) Respaldo: Wikipedia (siempre con CORS y fiable para temas enciclopédicos).
  if (!out.length) {
    try {
      const wr = await fetch("https://es.wikipedia.org/w/api.php?action=query&list=search&srlimit=4&format=json&srsearch=" + encodeURIComponent(q),
        { headers: { "User-Agent": UA } });
      const wj = await wr.json();
      ((wj.query && wj.query.search) || []).forEach(function (it) {
        out.push({
          title: it.title,
          url: "https://es.wikipedia.org/wiki/" + encodeURIComponent(it.title.replace(/ /g, "_")),
          snippet: stripTags(it.snippet || ""),
        });
      });
    } catch (e) {}
  }
  return out;
}

// SHA-256 hex en MAYÚSCULAS
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
}
// Token Sec-MS-GEC: ticks (100ns desde 1601, redondeado a 5 min) + token de confianza.
// skewMs = corrección de reloj (ms) si el servidor reportó otra hora (anti-403 por desfase).
async function secMsGec(skewMs) {
  let ticks = Math.floor(((Date.now() + (skewMs || 0)) / 1000 + 11644473600) / 300) * 300; // seg redondeados a 5 min
  ticks = ticks * 10000000; // a 100-ns
  return sha256Hex(ticks + TRUSTED_TOKEN);
}
function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}
function randHex(bytes) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function connectId() { return randHex(16); }            // 32 hex (ConnectionId)
function muid() { return randHex(16).toUpperCase(); }    // 32 hex MAYÚS (cookie muid)

// X-Timestamp en el formato EXACTO que usa edge-tts (no ISO):
// "Wed Jun 24 2026 12:00:00 GMT+0000 (Coordinated Universal Time)". Un formato distinto
// hace que Microsoft cierre la conexión (era la causa del "ws error").
function tsHeader() {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n) => String(n).padStart(2, "0");
  return days[d.getUTCDay()] + " " + mons[d.getUTCMonth()] + " " + p(d.getUTCDate()) + " " +
    d.getUTCFullYear() + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds()) +
    " GMT+0000 (Coordinated Universal Time)";
}

// Abre el WebSocket de síntesis con las cabeceras exactas que exige Microsoft.
async function openWS(skewMs) {
  const gec = await secMsGec(skewMs);
  const wssUrl = `${WSS}?TrustedClientToken=${TRUSTED_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${connectId()}`;
  return fetch(wssUrl, {
    headers: {
      "Upgrade": "websocket",
      "Sec-WebSocket-Version": "13",
      "User-Agent": UA,
      "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "Cookie": "muid=" + muid() + ";",
    },
  });
}

async function synth(text, voice, rate, pitch) {
  // Intento 1.
  let resp = await openWS(0);
  // Si Microsoft devuelve 403, suele ser desfase de reloj: nos alineamos a su cabecera Date y reintentamos UNA vez.
  if (!resp.webSocket && resp.status === 403) {
    const dateHdr = resp.headers.get("Date");
    let skewMs = 0;
    if (dateHdr) { const t = Date.parse(dateHdr); if (!isNaN(t)) skewMs = t - Date.now(); }
    resp = await openWS(skewMs);
  }
  const ws = resp.webSocket;
  if (!ws) throw new Error("sin WebSocket (status " + resp.status + ")");
  ws.accept();
  try { ws.binaryType = "arraybuffer"; } catch (e) {}

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let done = false, gotMsg = 0;
    let chain = Promise.resolve(); // procesar mensajes EN ORDEN (el binario puede ser Blob → async)
    const fail = (m) => { if (!done) { done = true; clearTimeout(timer); try { ws.close(); } catch (e) {} reject(new Error(m)); } };
    const finish = () => {
      done = true; clearTimeout(timer); try { ws.close(); } catch (e) {}
      if (!chunks.length) return reject(new Error("sin audio"));
      let total = 0; chunks.forEach((c) => (total += c.length));
      const out = new Uint8Array(total); let off = 0;
      chunks.forEach((c) => { out.set(c, off); off += c.length; });
      resolve(out);
    };
    const timer = setTimeout(() => fail("timeout (msgs=" + gotMsg + ")"), 15000);

    ws.addEventListener("message", (ev) => {
      const d = ev.data;
      chain = chain.then(async () => {
        if (done) return;
        gotMsg++;
        if (typeof d === "string") {
          if (d.includes("Path:turn.end")) finish();
          return;
        }
        // binario: [2 bytes len cabecera big-endian][cabecera][audio]
        // Cloudflare puede entregarlo como ArrayBuffer, typed array o Blob.
        let ab;
        if (d instanceof ArrayBuffer) ab = d;
        else if (ArrayBuffer.isView(d)) ab = d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
        else if (d && typeof d.arrayBuffer === "function") ab = await d.arrayBuffer(); // Blob
        else throw new Error("tipo binario " + Object.prototype.toString.call(d));
        const dv = new DataView(ab);
        const headerLen = dv.getUint16(0);
        chunks.push(new Uint8Array(ab, 2 + headerLen));
      }).catch((err) => fail("parse: " + (err && err.message)));
    });
    ws.addEventListener("close", (ev) => { if (!done) fail("cerrado code=" + (ev && ev.code) + " reason=" + (ev && ev.reason) + " msgs=" + gotMsg); });
    ws.addEventListener("error", (ev) => fail("ws error: " + (ev && (ev.message || (ev.error && ev.error.message) || "")) + " msgs=" + gotMsg));

    // 1) config de audio (MP3) — termina en \r\n como edge-tts
    ws.send(
      `X-Timestamp:${tsHeader()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
      `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`
    );
    // 2) SSML con la voz (edge-tts añade una "Z" tras el timestamp aquí)
    const ssml =
      `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'>` +
      `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${xmlEscape(text)}</prosody></voice></speak>`;
    ws.send(
      `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${tsHeader()}Z\r\nPath:ssml\r\n\r\n${ssml}`
    );
  });
}
