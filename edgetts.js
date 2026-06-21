/* edgetts.js — La VOZ JARVIS de las películas (es-ES-AlvaroNeural) en el móvil, vía el
   endpoint de Microsoft Edge TTS (gratis, sin key). Es la MISMA voz que el JARVIS del PC.
   Si falla (red/origen), voice.js cae a la voz del sistema. Expone window.EdgeTTS. */
(function () {
  "use strict";
  var TRUSTED = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  var GEC_VERSION = "1-130.0.2849.68";
  var ENDPOINT = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
  var VOICE = "es-ES-AlvaroNeural";
  var OUTFMT = "audio-24khz-48kbitrate-mono-mp3";

  var available = ("WebSocket" in window) && !!(window.crypto && window.crypto.subtle) && (typeof BigInt !== "undefined");
  var _cur = null;

  function uuid() { var s = ""; for (var i = 0; i < 32; i++) s += (Math.floor(Math.random() * 16)).toString(16); return s; }

  // Sec-MS-GEC: SHA256( ticks_100ns(redondeado 5min) + TRUSTED ), igual que edge-tts/drm.py.
  function secMsGec() {
    var sec = BigInt(Math.floor(Date.now() / 1000)) + BigInt(11644473600);
    sec = sec - (sec % BigInt(300));
    var ticks = sec * BigInt(10000000);
    var str = ticks.toString() + TRUSTED;
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("").toUpperCase();
    });
  }

  function ssmlFor(text) {
    var safe = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'>" +
           "<voice name='" + VOICE + "'><prosody pitch='-2Hz' rate='+3%' volume='+0%'>" + safe + "</prosody></voice></speak>";
  }

  function stop() { if (_cur) { try { _cur.pause(); } catch (e) {} _cur = null; } }

  // speak(text, onstart, onend) -> Promise; rechaza si edge-tts falla antes de sonar.
  function speak(text, onstart, onend) {
    stop();
    if (!available) return Promise.reject(new Error("edge-tts no disponible"));
    return secMsGec().then(function (gec) {
      return new Promise(function (resolve, reject) {
        var url = ENDPOINT + "?TrustedClientToken=" + TRUSTED + "&Sec-MS-GEC=" + gec +
                  "&Sec-MS-GEC-Version=" + GEC_VERSION + "&ConnectionId=" + uuid();
        var ws, chunks = [], done = false;
        var killer = setTimeout(function () { if (!done) { done = true; try { ws.close(); } catch (e) {} reject(new Error("timeout")); } }, 12000);
        try { ws = new WebSocket(url); } catch (e) { clearTimeout(killer); return reject(e); }
        ws.binaryType = "arraybuffer";
        var ts = new Date().toString();
        ws.onopen = function () {
          ws.send("X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
                  '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"' + OUTFMT + '"}}}}');
          ws.send("X-RequestId:" + uuid() + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + ts + "\r\nPath:ssml\r\n\r\n" + ssmlFor(text));
        };
        ws.onmessage = function (e) {
          if (typeof e.data === "string") {
            if (e.data.indexOf("Path:turn.end") !== -1) { done = true; clearTimeout(killer); try { ws.close(); } catch (x) {} play(); }
          } else {
            try { var hlen = new DataView(e.data).getUint16(0); chunks.push(new Uint8Array(e.data, 2 + hlen)); } catch (x) {}
          }
        };
        ws.onerror = function () { if (!done) { done = true; clearTimeout(killer); reject(new Error("ws error")); } };
        ws.onclose = function () { if (!done) { clearTimeout(killer); reject(new Error("closed")); } };

        function play() {
          if (!chunks.length) return reject(new Error("sin audio"));
          var total = chunks.reduce(function (a, c) { return a + c.length; }, 0);
          var buf = new Uint8Array(total), off = 0;
          chunks.forEach(function (c) { buf.set(c, off); off += c.length; });
          var a = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" })));
          _cur = a;
          a.onplay = function () { if (onstart) onstart(); };
          a.onended = function () { if (onend) onend(); resolve(); };
          a.onerror = function () { reject(new Error("play error")); };
          a.play().catch(reject);
        }
      });
    });
  }

  // Prueba si el endpoint responde (devuelve Promise<bool>) — para validar disponibilidad.
  function test() {
    return speak("Hola", null, null).then(function () { return true; }).catch(function () { return false; });
  }

  window.EdgeTTS = { speak: speak, stop: stop, available: available, test: test };
})();
