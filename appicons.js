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
    gmail:    '<svg viewBox="0 0 24 24"><path fill="#fff" d="M4 5.5h16c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H4c-.83 0-1.5-.67-1.5-1.5V7c0-.83.67-1.5 1.5-1.5z"/><path fill="#EA4335" d="M2.5 7.2 12 14l9.5-6.8V9L12 15.7 2.5 9z"/></svg>',
    discord:  '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#5865F2"/><ellipse cx="9.2" cy="13" rx="1.25" ry="1.6" fill="#fff"/><ellipse cx="14.8" cy="13" rx="1.25" ry="1.6" fill="#fff"/><path d="M7.4 8.6c3-1.2 6.2-1.2 9.2 0" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>',
    instagram:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#E1306C"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="16.2" cy="7.8" r="1" fill="#fff"/></svg>',
    tiktok:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" d="M13.5 5.5h2c.2 1.5 1.3 2.6 2.8 2.8v2c-1.1 0-2.1-.3-3-.9v4.3a4.1 4.1 0 1 1-4.1-4.1c.24 0 .47.02.7.06v2.1a1.9 1.9 0 1 0 1.8 1.9z"/></svg>',
    x:        '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#fff" d="M7 6h2.4l2.7 3.8L15.4 6H18l-4.4 5.2L18.6 18h-2.4l-3-4.2L9.6 18H7l4.8-5.6z"/></svg>',
    reddit:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#FF4500"/><circle cx="9.4" cy="12.8" r="1.15" fill="#fff"/><circle cx="14.6" cy="12.8" r="1.15" fill="#fff"/><path d="M9 15.4c1.8 1.2 4.2 1.2 6 0" stroke="#fff" stroke-width="1.1" fill="none" stroke-linecap="round"/><circle cx="15.6" cy="8.4" r="1" fill="#fff"/></svg>',
    twitch:   '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#9146FF"/><path fill="#fff" d="M8 6h9v6.2L14.2 15H12l-2 2v-2H8z"/><rect x="11" y="8.6" width="1.3" height="3" fill="#9146FF"/><rect x="14" y="8.6" width="1.3" height="3" fill="#9146FF"/></svg>',
    netflix:  '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><path fill="#E50914" d="M9 5h2.3l3.7 9.4V5H17v14h-2.3L11 9.6V19H9z"/></svg>',
    maps:     '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#fff"/><path fill="#EA4335" d="M12 5a4.2 4.2 0 0 0-4.2 4.2c0 3 4.2 7.3 4.2 7.3s4.2-4.3 4.2-7.3A4.2 4.2 0 0 0 12 5z"/><circle cx="12" cy="9.2" r="1.6" fill="#fff"/></svg>',
  };
  // Alias de nombres equivalentes.
  I.twitter = I.x; I.equis = I.x;
  I.mapas = I.maps; I.googlemaps = I.maps; I.mapa = I.maps;
  I.correo = I.gmail; I.musica = I.spotify;

  window.AppIcons = {
    get: function (name) { return I[norm(name)] || null; },
    has: function (name) { return !!I[norm(name)]; },
  };
})();
