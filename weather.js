/* weather.js — Clima por Open-Meteo (API pública gratis, sin key) + ciudad por IP.
   Icono según código WMO y hora (luna de noche). Expone window.Weather. */
(function () {
  "use strict";

  function descFor(code) {
    if (code === 0) return "Despejado";
    if (code <= 2) return "Poco nuboso";
    if (code === 3) return "Nublado";
    if (code === 45 || code === 48) return "Niebla";
    if (code >= 51 && code <= 57) return "Llovizna";
    if (code >= 61 && code <= 67) return "Lluvia";
    if (code >= 71 && code <= 77) return "Nieve";
    if (code >= 80 && code <= 82) return "Chubascos";
    if (code >= 95) return "Tormenta";
    return "—";
  }
  function iconFor(code, isNight) {
    if (code === 0) return isNight ? "🌙" : "☀️";
    if (code <= 2) return isNight ? "🌙" : "🌤️";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if (code >= 51 && code <= 67) return "🌧️";
    if (code >= 71 && code <= 77) return "❄️";
    if (code >= 80 && code <= 82) return "🌦️";
    if (code >= 95) return "⛈️";
    return "🌡️";
  }

  // Devuelve una promesa con {temp, desc, icon, city}. Cachea ubicación (cambia poco) y
  // el resultado 5 min (evita repetir 2 fetch seguidos → menos batería).
  var _loc = null, _wx = null, _wxTime = 0;
  function fetchWeather() {
    var now = new Date().getTime();
    if (_wx && now - _wxTime < 5 * 60 * 1000) return Promise.resolve(_wx);
    var locP = _loc ? Promise.resolve(_loc) : fetch("https://ipapi.co/json/").then(function (r) { return r.json(); });
    return locP.then(function (loc) {
      _loc = loc;
      var lat = loc.latitude, lon = loc.longitude, city = loc.city || "";
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
                "&current=temperature_2m,weather_code,is_day&timezone=auto";
      return fetch(url).then(function (r) { return r.json(); }).then(function (w) {
        var c = (w && w.current) || {};
        var night = c.is_day === 0;
        _wx = {
          temp: c.temperature_2m != null ? Math.round(c.temperature_2m) : null,
          desc: descFor(c.weather_code),
          icon: iconFor(c.weather_code, night),
          city: city,
        };
        _wxTime = now;
        return _wx;
      });
    });
  }

  window.Weather = { fetch: fetchWeather, iconFor: iconFor, descFor: descFor };
})();
