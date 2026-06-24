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

  // Ubicación REAL: primero el GPS del dispositivo (preciso, donde estés); si lo deniegas o
  // no hay, por IP (aproximado, suele dar la ciudad del proveedor → antes salía "Madrid").
  function getCoords() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        function () { resolve(null); },
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 }
      );
    });
  }
  function cityFromCoords(lat, lon) {
    return fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + lat + "&longitude=" + lon + "&localityLanguage=es")
      .then(function (r) { return r.json(); })
      .then(function (j) { return j.city || j.locality || j.principalSubdivision || ""; })
      .catch(function () { return ""; });
  }
  function ipLoc() {
    return fetch("https://ipapi.co/json/").then(function (r) { return r.json(); })
      .then(function (j) { return { lat: j.latitude, lon: j.longitude, city: j.city || "" }; });
  }

  // Devuelve {temp, desc, icon, city}. Cachea 5 min (menos batería). force=true ignora caché.
  var _loc = null, _wx = null, _wxTime = 0;
  function fetchWeather(force) {
    var now = new Date().getTime();
    if (!force && _wx && now - _wxTime < 5 * 60 * 1000) return Promise.resolve(_wx);
    var locP;
    if (_loc) {
      locP = Promise.resolve(_loc);
    } else {
      locP = getCoords().then(function (g) {
        if (g) return cityFromCoords(g.lat, g.lon).then(function (c) { return { lat: g.lat, lon: g.lon, city: c }; });
        return ipLoc();   // GPS denegado o sin soporte → por IP
      }).catch(function () { return ipLoc(); });
    }
    return locP.then(function (loc) {
      _loc = loc;
      var url = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.lon +
                "&current=temperature_2m,weather_code,is_day&timezone=auto";
      return fetch(url).then(function (r) { return r.json(); }).then(function (w) {
        var c = (w && w.current) || {};
        _wx = {
          temp: c.temperature_2m != null ? Math.round(c.temperature_2m) : null,
          desc: descFor(c.weather_code),
          icon: iconFor(c.weather_code, c.is_day === 0),
          city: loc.city || "",
        };
        _wxTime = now;
        return _wx;
      });
    });
  }

  window.Weather = { fetch: fetchWeather, iconFor: iconFor, descFor: descFor };
})();
