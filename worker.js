/* ─────────────────────────────────────────────────────────────────────────
   JARVIS TTS Worker — voz del PC (es-ES-AlvaroNeural) para el móvil.
   Genera la voz de Microsoft Edge TTS DESDE EL SERVIDOR (el navegador no puede,
   Microsoft bloquea ese canal). El móvil llama:  GET /tts?text=Hola&voice=es-ES-AlvaroNeural
   y recibe un MP3. Gratis en Cloudflare Workers. Despliegue: ver README.md.
   ───────────────────────────────────────────────────────────────────────── */

const TRUSTED_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
// Cloudflare Workers exige http(s):// en fetch para el upgrade a WebSocket (no acepta wss://).
const WSS = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const GEC_VERSION = "1-130.0.2849.68";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (url.pathname !== "/tts" && url.pathname !== "/") {
      return new Response("JARVIS TTS Worker. Usa /tts?text=...", { status: 404, headers: CORS });
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

// SHA-256 hex en MAYÚSCULAS
async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join("");
}
// Token Sec-MS-GEC: ticks (100ns desde 1601, redondeado a 5 min) + token de confianza
async function secMsGec() {
  let ticks = Math.floor((Date.now() / 1000 + 11644473600) / 300) * 300; // segundos redondeados a 5 min
  ticks = ticks * 10000000; // a 100-ns
  return sha256Hex(ticks + TRUSTED_TOKEN);
}
function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}
function connectId() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  ).replace(/-/g, "");
}

async function synth(text, voice, rate, pitch) {
  const gec = await secMsGec();
  const wssUrl = `${WSS}?TrustedClientToken=${TRUSTED_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}`;
  const resp = await fetch(wssUrl, { headers: {
    Upgrade: "websocket",
    // Microsoft rechaza el handshake si no llegan estas cabeceras (son las que envía edge-tts).
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
  }});
  const ws = resp.webSocket;
  if (!ws) throw new Error("sin WebSocket (status " + resp.status + ")");
  ws.accept();

  return await new Promise((resolve, reject) => {
    const chunks = [];
    let done = false;
    const fail = (m) => { if (!done) { done = true; try { ws.close(); } catch (e) {} reject(new Error(m)); } };
    const timer = setTimeout(() => fail("timeout"), 15000);

    ws.addEventListener("message", (ev) => {
      const d = ev.data;
      if (typeof d === "string") {
        if (d.includes("Path:turn.end")) {
          done = true; clearTimeout(timer); try { ws.close(); } catch (e) {}
          if (!chunks.length) return reject(new Error("sin audio"));
          // concatenar
          let total = 0; chunks.forEach((c) => (total += c.length));
          const out = new Uint8Array(total); let off = 0;
          chunks.forEach((c) => { out.set(c, off); off += c.length; });
          resolve(out);
        }
      } else {
        // binario: [2 bytes len cabecera big-endian][cabecera][audio]
        const buf = d instanceof ArrayBuffer ? d : d.buffer;
        const dv = new DataView(buf);
        const headerLen = dv.getUint16(0);
        chunks.push(new Uint8Array(buf, 2 + headerLen));
      }
    });
    ws.addEventListener("close", () => { if (!done) fail("cerrado sin turn.end"); });
    ws.addEventListener("error", () => fail("ws error"));

    const ts = new Date().toISOString();
    // 1) config de audio (MP3)
    ws.send(
      `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
      `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
    );
    // 2) SSML con la voz
    const ssml =
      `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'>` +
      `<voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${xmlEscape(text)}</prosody></voice></speak>`;
    ws.send(
      `X-RequestId:${connectId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`
    );
  });
}
