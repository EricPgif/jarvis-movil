/* appicons.js — Catálogo de LOGOS de apps populares (SVG). Cada usuario añade SUS apps en
   "Mis Apps" y, si están aquí, salen con su logo en el dock (su amigo añade las suyas).
   No se pueden escanear las apps instaladas (sandbox del navegador) → catálogo + elección manual.
   Expone window.AppIcons.get(nombre) → string SVG (o null). */
(function () {
  "use strict";
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""); }

  var I = {
    spotify:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1DB954"/><g fill="none" stroke="#06140a" stroke-width="1.5" stroke-linecap="round"><path d="M6.7 9.2c3.3-1 7.6-.8 10.6 1"/><path d="M7.3 12.1c2.7-.8 6.4-.6 9 1.1"/><path d="M7.8 14.8c2.1-.6 4.9-.4 6.9.9"/></g></svg>',
    youtube:  '<svg viewBox="0 0 24 24"><rect x="1.5" y="5" width="21" height="14" rx="4.2" fill="#FF0000"/><path d="M10 8.4l6 3.6-6 3.6z" fill="#fff"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.55 15.2L2 22l4.95-1.3A10 10 0 1 0 12 2z"/><path fill="#fff" d="M9.1 7.2c-.18-.42-.37-.43-.55-.44h-.47c-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.06s.88 2.39 1 2.56c.12.16 1.71 2.74 4.22 3.74 2.08.82 2.5.66 2.96.62.46-.04 1.48-.6 1.69-1.19.21-.59.21-1.09.15-1.19-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.55.12-.16.25-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.25-.01-.38.11-.5.11-.11.24-.28.37-.42.12-.14.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.12-.54-1.34-.74-1.83z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#29A9EB"/><path fill="#fff" d="M5.6 11.7l11-4.24c.55-.2 1.04.13.86.83l-1.87 8.82c-.13.6-.5.74-1 .46l-2.74-2.02-1.32 1.27c-.15.15-.27.27-.55.27l.2-2.8 5.1-4.6c.22-.2-.05-.31-.34-.12l-6.3 3.97-2.72-.85c-.59-.18-.6-.59.12-.87z"/></svg>',
    gmail:    '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#4285F4" d="M4 8.2v8.3a1 1 0 0 0 1 1h2.4V12z"/><path fill="#34A853" d="M20 8.2v8.3a1 1 0 0 1-1 1h-2.4V12z"/><path fill="#FBBC04" d="M4 8.2 7.4 12V17.5H5a1 1 0 0 1-1-1z" opacity="0"/><path fill="#EA4335" d="M4 8.2c0-1 1.15-1.55 1.93-.95L12 11.5l6.07-4.25c.78-.6 1.93-.05 1.93.95L12 14.2z"/><path fill="#C5221F" d="M7.4 12 12 15.2 16.6 12v5.5h-9.2z"/></svg>',
    discord:  '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#5865F2"/><path fill="#fff" d="M16.3 7.8a10 10 0 0 0-2.5-.78l-.16.32a9 9 0 0 1 2.2.9 8.6 8.6 0 0 0-7.5 0 9 9 0 0 1 2.2-.9l-.16-.32A10 10 0 0 0 7.7 7.8 12.4 12.4 0 0 0 5.6 16a10.3 10.3 0 0 0 3.1.97l.5-.85a5.8 5.8 0 0 1-1.18-.57l.27-.18a7.4 7.4 0 0 0 6.42 0l.27.18a5.8 5.8 0 0 1-1.18.57l.5.85a10.3 10.3 0 0 0 3.1-.97 12.4 12.4 0 0 0-2.1-8.2zM9.9 14.1c-.62 0-1.13-.57-1.13-1.27 0-.7.5-1.27 1.13-1.27.63 0 1.14.57 1.13 1.27 0 .7-.5 1.27-1.13 1.27zm4.2 0c-.62 0-1.13-.57-1.13-1.27 0-.7.5-1.27 1.13-1.27.63 0 1.14.57 1.13 1.27 0 .7-.5 1.27-1.13 1.27z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#E1306C"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="16.2" cy="7.8" r="1" fill="#fff"/></svg>',
    tiktok:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" d="M13.5 5.5h2c.2 1.5 1.3 2.6 2.8 2.8v2c-1.1 0-2.1-.3-3-.9v4.3a4.1 4.1 0 1 1-4.1-4.1c.24 0 .47.02.7.06v2.1a1.9 1.9 0 1 0 1.8 1.9z"/></svg>',
    x:        '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" d="M7 6h2.4l2.7 3.8L15.4 6H18l-4.4 5.2L18.6 18h-2.4l-3-4.2L9.6 18H7l4.8-5.6z"/></svg>',
    reddit:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FF4500"/><circle cx="9.4" cy="12.8" r="1.15" fill="#fff"/><circle cx="14.6" cy="12.8" r="1.15" fill="#fff"/><path d="M9 15.4c1.8 1.2 4.2 1.2 6 0" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/><circle cx="15.6" cy="8.4" r="1" fill="#fff"/></svg>',
    twitch:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#9146FF"/><path fill="#fff" d="M8 6h9v6.2L14.2 15H12l-2 2v-2H8z"/><rect x="11" y="8.6" width="1.3" height="3" fill="#9146FF"/><rect x="14" y="8.6" width="1.3" height="3" fill="#9146FF"/></svg>',
    netflix:  '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#E50914" d="M9 5h2.3l3.7 9.4V5H17v14h-2.3L11 9.6V19H9z"/></svg>',
    maps:     '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#EA4335" d="M12 5a4.2 4.2 0 0 0-4.2 4.2c0 3 4.2 7.3 4.2 7.3s4.2-4.3 4.2-7.3A4.2 4.2 0 0 0 12 5z"/><circle cx="12" cy="9.2" r="1.6" fill="#fff"/></svg>',
    chatgpt:  '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="none" stroke="#0d0d0d" stroke-width="1.15" stroke-linejoin="round" d="M12 6.2c-1.15 0-2.12.66-2.6 1.62-1.06.06-1.97.72-2.37 1.7-.46 1-.32 2.13.3 3-.3.92-.18 1.95.34 2.78.48.96 1.45 1.55 2.5 1.55h.03c.49.95 1.46 1.58 2.6 1.58 1.15 0 2.12-.66 2.6-1.62 1.06-.06 1.97-.72 2.37-1.7.46-1 .32-2.13-.3-3 .3-.92.18-1.95-.34-2.78-.48-.96-1.45-1.55-2.5-1.55h-.03C14.11 6.83 13.14 6.2 12 6.2z"/><path fill="none" stroke="#0d0d0d" stroke-width=".95" stroke-linecap="round" stroke-linejoin="round" d="M12 9.1l2.55 1.47v2.95L12 15 9.45 13.5v-2.95z"/></svg>',
    pinterest:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#E60023"/><path fill="#fff" d="M12.4 6.4c-3 0-4.7 1.9-4.7 4 0 .98.52 2.2 1.36 2.59.18.08.27.05.31-.14.03-.13.18-.74.25-1.03.02-.09.01-.17-.06-.26-.36-.43-.64-1.22-.64-1.96 0-1.9 1.43-3.74 3.87-3.74 2.11 0 3.58 1.44 3.58 3.5 0 2.32-1.17 3.93-2.7 3.93-.84 0-1.47-.7-1.27-1.55.24-1.02.71-2.12.71-2.86 0-.66-.35-1.21-1.08-1.21-.86 0-1.55.89-1.55 2.08 0 .76.26 1.27.26 1.27l-1.03 4.36c-.3 1.3-.04 2.88-.02 3.04.01.09.13.12.18.05.08-.1 1.07-1.33 1.41-2.55.1-.35.55-2.16.55-2.16.27.52 1.07.98 1.92.98 2.53 0 4.25-2.31 4.25-5.4 0-2.34-1.98-4.52-4.99-4.52z"/></svg>',
    alexa:    '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#0b1d2a"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#00CAFF" stroke-width="1.7"/><path d="M12 4.4a7.6 7.6 0 0 1 6 12.2" fill="none" stroke="#1ce5ff" stroke-width="1.7" stroke-linecap="round"/></svg>',
    chrome:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><path fill="#EA3939" d="M12 3a9 9 0 0 1 7.8 4.5H12a4.5 4.5 0 0 0-3.9 2.25L4.6 5.65A9 9 0 0 1 12 3z"/><path fill="#3ECF4C" d="M4.6 5.65 8.1 9.75A4.5 4.5 0 0 0 9.9 15.6L6.3 21A9 9 0 0 1 4.6 5.65z"/><path fill="#FFCD41" d="M19.8 7.5A9 9 0 0 1 12 21l3.9-6.75A4.5 4.5 0 0 0 15.6 8.7z"/><circle cx="12" cy="12" r="3.4" fill="#fff"/><circle cx="12" cy="12" r="2.7" fill="#4a90e2"/></svg>',
    steam:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#171a21"/><path d="M4.5 13.8 8 15.3" stroke="#c7d5e0" stroke-width="1.1"/><circle cx="15.2" cy="9" r="2.7" fill="none" stroke="#c7d5e0" stroke-width="1.4"/><circle cx="15.2" cy="9" r="1" fill="#c7d5e0"/><circle cx="8.7" cy="15.1" r="2.3" fill="#c7d5e0"/><path d="M13.3 10.7 9.5 13.9" stroke="#c7d5e0" stroke-width="1.1"/></svg>',
    mifitness:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><circle cx="12" cy="12" r="6" fill="none" stroke="#FF6900" stroke-width="2.5"/></svg>',
    drive:    '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#2196F3" d="M9 4.5 4 13h5l5-8.5z"/><path fill="#4CAF50" d="M4 13l2.5 4.5h11L15 13z"/><path fill="#FFC107" d="M14 4.5H9l6 8.5h5z"/></svg>',
    fotos:    '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#EA4335" d="M12 4.5c2.2 0 3.5 1.8 3.5 4S14.2 12 12 12V4.5z"/><path fill="#4285F4" d="M19.5 12c0 2.2-1.8 3.5-4 3.5S12 14.2 12 12h7.5z"/><path fill="#34A853" d="M12 19.5c-2.2 0-3.5-1.8-3.5-4S9.8 12 12 12v7.5z"/><path fill="#FBBC04" d="M4.5 12c0-2.2 1.8-3.5 4-3.5S12 9.8 12 12H4.5z"/></svg>',
    traductor:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#4285F4"/><text x="6.5" y="13.5" font-size="9" fill="#fff" font-family="Arial,sans-serif" font-weight="700">A</text><text x="11.5" y="19" font-size="8.5" fill="#cfe0ff" font-family="sans-serif">文</text></svg>',
    playstore:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#00C3FF" d="M5 4.3 13 12 5 19.7z"/><path fill="#EA4335" d="M5 4.3 16.5 10.8 13 12z"/><path fill="#FBBC04" d="M5 19.7 16.5 13.2 13 12z"/><path fill="#34A853" d="M16.5 10.8 19.5 12.5 16.5 13.2 13 12z"/></svg>',
    gemini:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#4285F4" d="M12 4c.55 3.7 2.6 5.75 6.3 6.3-3.7.55-5.75 2.6-6.3 6.3-.55-3.7-2.6-5.75-6.3-6.3 3.7-.55 5.75-2.6 6.3-6.3z"/></svg>',
    wallet:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><rect x="5" y="8" width="14" height="9" rx="2" fill="#4285F4"/><rect x="5" y="10.6" width="14" height="2.3" fill="#34A853"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5" fill="#fff"/><rect x="4" y="5" width="16" height="4" rx="2.5" fill="#4285F4"/><text x="12" y="17.5" font-size="7.5" fill="#4285F4" text-anchor="middle" font-weight="700" font-family="Arial">31</text></svg>',
    camara:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#222"/><path fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" d="M5 9h2.6l1.4-2h6l1.4 2H19v9H5z"/><circle cx="12" cy="13" r="3" fill="none" stroke="#fff" stroke-width="1.4"/></svg>',
    facebook: '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#1877F2"/><path fill="#fff" d="M14.5 12.5h2l.4-2.6h-2.4V8.2c0-.75.37-1.48 1.55-1.48h1.13V4.5s-1.03-.18-2-.18c-2.05 0-3.38 1.24-3.38 3.5v1.98H9.5v2.6h2.3V19h2.7z"/></svg>',
    epicgames:'<svg viewBox="0 0 24 24"><path fill="#121212" d="M5.4 2h13.2c1.2 0 1.9.7 1.9 1.9v9.5c0 .8-.1 1.1-.5 1.6-.3.4-.5.6-3.8 2.7-3 1.9-3.5 2.2-4.2 2.2s-1.2-.3-4.2-2.2C4.5 15.6 4.3 15.4 4 15c-.4-.5-.5-.8-.5-1.6V3.9C3.5 2.7 4.2 2 5.4 2Z"/><path fill="#fff" d="M9 5.5h6v1.9h-3.9v2h3.3v1.9h-3.3v2.2H15v1.9H9z"/><rect x="7.6" y="16.4" width="8.8" height="1.3" rx=".65" fill="#fff"/></svg>',
  };
  // Alias de nombres equivalentes.
  I.twitter = I.x; I.equis = I.x;
  I.mapas = I.maps; I.googlemaps = I.maps; I.mapa = I.maps;
  I.correo = I.gmail; I.musica = I.spotify;
  I.openai = I.chatgpt; I.gpt = I.chatgpt;
  I.agenda = I.calendar; I.photos = I.fotos; I.googlephotos = I.fotos;
  I.translate = I.traductor; I.googletranslate = I.traductor;
  I.googledrive = I.drive; I.googlewallet = I.wallet; I.camera = I.camara;

  // Pastilla con la inicial (respaldo si no hay logo). Color estable según el nombre.
  var PALETTE = ["#5865F2", "#1DB954", "#FF4500", "#E50914", "#0088cc", "#FF6D00", "#9146FF", "#E1306C", "#00A8E8", "#7C4DFF", "#FF3D71", "#00C2A8"];
  function colorFor(s) { s = norm(s) || "x"; var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; }
  function tile(name) {
    var L = ((norm(name).charAt(0)) || "?").toUpperCase();
    return '<span class="lt" style="background:' + colorFor(name) + '">' + L + '</span>';
  }

  window.AppIcons = {
    get: function (name) { return I[norm(name)] || null; },   // SVG de marca dibujado a mano (o null)
    has: function (name) { return !!I[norm(name)]; },
    // Mejor icono posible: SVG de marca > logo real (Clearbit) sobre pastilla > pastilla con inicial.
    html: function (name, domain) {
      var svg = I[norm(name)];
      if (svg) return svg;
      if (domain) {
        // Cascada: logo de marca (Clearbit) → favicon de la web (Google, muy fiable) → pastilla con inicial.
        var fav = "https://www.google.com/s2/favicons?sz=128&domain=" + encodeURIComponent(domain);
        return '<span class="qi-wrap">' + tile(name) +
          '<img class="lt-img" loading="lazy" src="https://logo.clearbit.com/' + domain + '" data-fb="' + fav + '" alt="" ' +
          "onerror=\"if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else{this.remove();}\"></span>";
      }
      return '<span class="qi-wrap">' + tile(name) + '</span>';
    },
  };
})();
