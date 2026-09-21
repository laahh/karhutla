(function () {
  const KEYS = window.KARHUTLA_MODE_KEYS || { waqiToken: "", firmsMapKey: "", owmApiKey: "" };

  const AQI_LEVELS = [
    { max: 50, color: "#7fd858", label: "Baik" },
    { max: 100, color: "#f4d33c", label: "Sedang" },
    { max: 150, color: "#f4954a", label: "Tidak sehat bagi kelompok sensitif" },
    { max: 200, color: "#e25b4a", label: "Tidak sehat" },
    { max: 300, color: "#9b5fc0", label: "Sangat tidak sehat" },
    { max: Infinity, color: "#7a2b3a", label: "Berbahaya" }
  ];

  function aqiLevel(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return AQI_LEVELS[0];
    return AQI_LEVELS.find(function (lvl) { return n <= lvl.max; }) || AQI_LEVELS[AQI_LEVELS.length - 1];
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, wait) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  const modeButtons = document.querySelectorAll("[data-mode]");
  const iqairMapEl = document.getElementById("iqair-map");
  const noteEl = document.getElementById("iqair-note");
  if (!modeButtons.length || !iqairMapEl) return;

  let map = null;
  let aqiLayer = null;
  let heatLayer = null;
  let fireLayer = null;
  let windLayer = null;
  let windGridTimer = null;
  let boundaryLayer = null;
  let karhutlaLayer = null;
  let karhutlaTimer = null;
  let showAqi = true;
  let showFire = true;
  let showWind = true;
  let showKarhutla = true;

  const KARHUTLA_DOT_COLORS = {
    tinggi: "#ef5a36",
    sedang: "#f0a202",
    rendah: "#6bb443",
    internal: "#86d15c",
    eksternal: "#ef5a36",
    patroli: "#4aa3ff",
    dop: "#a855f7"
  };

  const HEAT_GRADIENT = {
    0.0: "#7fd858",
    0.2: "#f4d33c",
    0.4: "#f4954a",
    0.6: "#e25b4a",
    0.8: "#9b5fc0",
    1.0: "#7a2b3a"
  };

  const WIND_GRID = { lo1: 90, la1: 8, lo2: 140, la2: -12, dx: 5, dy: 5 };
  const WIND_REFRESH_MS = 15 * 60 * 1000;

  const noteParts = { aqi: "", fire: "", wind: "" };

  function renderNote() {
    if (!noteEl) return;
    const message = [noteParts.aqi, noteParts.fire, noteParts.wind].filter(Boolean).join("<br>");
    noteEl.innerHTML = message;
    noteEl.classList.toggle("is-visible", !!message);
  }

  function setNote(key, message) {
    noteParts[key] = message || "";
    renderNote();
  }

  function currentBoundsParam() {
    const b = map.getBounds();
    return {
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast()
    };
  }

  const FETCH_TIMEOUT_MS = 15000;

  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { cache: "no-store", signal: controller.signal });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error("waktu tunggu habis (15 detik) — server tidak merespons");
      }
      throw new Error(
        "koneksi diblokir atau gagal (periksa firewall/proxy jaringan Anda ke domain ini, " +
        "atau coba buka URL API-nya langsung di tab baru)"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchJson(url) {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function fetchText(url) {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  }

  async function refreshAqi() {
    if (!showAqi) return;
    if (!KEYS.waqiToken) {
      setNote("aqi", 'Layer <b>Stasiun kualitas udara</b> belum aktif. Isi <code>waqiToken</code> pada berkas <code>mode-keys.js</code> (token gratis di aqicn.org/data-platform/token).');
      return;
    }
    const b = currentBoundsParam();
    const url = "https://api.waqi.info/map/bounds/?latlng=" +
      b.south + "," + b.west + "," + b.north + "," + b.east +
      "&token=" + encodeURIComponent(KEYS.waqiToken);
    try {
      const json = await fetchJson(url);
      aqiLayer.clearLayers();
      if (json.status !== "ok" || !Array.isArray(json.data)) throw new Error(json.data || "Respons WAQI tidak valid");
      const heatPoints = [];
      json.data.forEach(function (row) {
        const aqi = Number(row.aqi);
        if (!Number.isFinite(aqi)) return;
        const level = aqiLevel(aqi);
        const marker = L.marker([row.lat, row.lon], {
          icon: L.divIcon({
            className: "",
            html: '<span class="iqair-aqi-marker" style="background:' + level.color + '">' + aqi + "</span>",
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        });
        marker.bindPopup(
          '<div class="iqair-popup"><strong>' + esc(row.station && row.station.name) + "</strong><br>AQI " +
          aqi + " · " + esc(level.label) + "</div>",
          { className: "iqair-popup" }
        );
        aqiLayer.addLayer(marker);
        heatPoints.push([row.lat, row.lon, Math.min(aqi / 300, 1)]);
      });
      if (heatLayer) heatLayer.setLatLngs(heatPoints);
      setNote("aqi", "");
    } catch (err) {
      setNote("aqi", "Gagal memuat data stasiun kualitas udara: " + esc(err.message) + ".");
    }
  }

  function parseCsv(text) {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(function (h) { return h.trim().toLowerCase(); });
    const latIdx = headers.indexOf("latitude");
    const lonIdx = headers.indexOf("longitude");
    const frpIdx = headers.indexOf("frp");
    const dateIdx = headers.indexOf("acq_date");
    const confIdx = headers.indexOf("confidence");
    if (latIdx < 0 || lonIdx < 0) return [];
    return lines.slice(1).map(function (line) {
      const cols = line.split(",");
      return {
        lat: Number(cols[latIdx]),
        lon: Number(cols[lonIdx]),
        frp: frpIdx >= 0 ? cols[frpIdx] : "",
        date: dateIdx >= 0 ? cols[dateIdx] : "",
        confidence: confIdx >= 0 ? cols[confIdx] : ""
      };
    }).filter(function (row) { return Number.isFinite(row.lat) && Number.isFinite(row.lon); });
  }

  async function refreshFires() {
    if (!showFire) return;
    if (!KEYS.firmsMapKey) {
      setNote("fire", 'Layer <b>Kebakaran</b> belum aktif. Isi <code>firmsMapKey</code> pada berkas <code>mode-keys.js</code> (daftar gratis di firms.modaps.eosdis.nasa.gov/api/area).');
      return;
    }
    const b = currentBoundsParam();
    const area = b.west + "," + b.south + "," + b.east + "," + b.north;
    const url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/" +
      encodeURIComponent(KEYS.firmsMapKey) + "/VIIRS_SNPP_NRT/" + area + "/1";
    try {
      const text = await fetchText(url);
      const rows = parseCsv(text);
      fireLayer.clearLayers();
      rows.forEach(function (row) {
        const marker = L.marker([row.lat, row.lon], {
          icon: L.divIcon({
            className: "",
            html: '<span class="iqair-fire-marker">\u{1F525}</span>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        });
        marker.bindPopup(
          '<div class="iqair-popup">Titik panas<br>' + esc(row.date) +
          (row.frp ? " · FRP " + esc(row.frp) : "") +
          (row.confidence ? " · Keyakinan " + esc(row.confidence) : "") + "</div>",
          { className: "iqair-popup" }
        );
        fireLayer.addLayer(marker);
      });
      setNote("fire", "");
    } catch (err) {
      setNote("fire", "Gagal memuat data kebakaran: " + esc(err.message) + ".");
    }
  }

  function windGridPoints() {
    const nx = Math.round((WIND_GRID.lo2 - WIND_GRID.lo1) / WIND_GRID.dx) + 1;
    const ny = Math.round((WIND_GRID.la1 - WIND_GRID.la2) / WIND_GRID.dy) + 1;
    const points = [];
    for (let j = 0; j < ny; j += 1) {
      const lat = WIND_GRID.la1 - j * WIND_GRID.dy;
      for (let i = 0; i < nx; i += 1) {
        points.push({ lat: lat, lon: WIND_GRID.lo1 + i * WIND_GRID.dx });
      }
    }
    return { nx: nx, ny: ny, points: points };
  }

  async function fetchWindPoint(p) {
    const url = "https://api.openweathermap.org/data/2.5/weather?lat=" + p.lat + "&lon=" + p.lon +
      "&appid=" + encodeURIComponent(KEYS.owmApiKey);
    try {
      const json = await fetchJson(url);
      const speed = json.wind && Number.isFinite(json.wind.speed) ? json.wind.speed : 0;
      const deg = json.wind && Number.isFinite(json.wind.deg) ? json.wind.deg : 0;
      const rad = (deg * Math.PI) / 180;
      return { u: -speed * Math.sin(rad), v: -speed * Math.cos(rad) };
    } catch (err) {
      return { u: 0, v: 0 };
    }
  }

  async function fetchWindGridData() {
    const grid = windGridPoints();
    const results = await Promise.all(grid.points.map(fetchWindPoint));
    const header = {
      parameterUnit: "m.s-1",
      refTime: new Date().toISOString(),
      forecastTime: 0,
      surface1Type: 103,
      surface1Value: 10,
      numberPoints: grid.nx * grid.ny,
      nx: grid.nx,
      ny: grid.ny,
      lo1: WIND_GRID.lo1,
      la1: WIND_GRID.la1,
      lo2: WIND_GRID.lo2,
      la2: WIND_GRID.la2,
      dx: WIND_GRID.dx,
      dy: WIND_GRID.dy
    };
    return [
      { header: Object.assign({ parameterCategory: 2, parameterNumber: 2 }, header), data: results.map(function (r) { return r.u; }) },
      { header: Object.assign({ parameterCategory: 2, parameterNumber: 3 }, header), data: results.map(function (r) { return r.v; }) }
    ];
  }

  async function loadWindLayer() {
    if (!map || !showWind) return;
    setNote("wind", "Memuat data angin…");
    try {
      const data = await fetchWindGridData();
      if (!showWind) return;
      if (windLayer) { map.removeLayer(windLayer); windLayer = null; }
      windLayer = L.velocityLayer({
        displayValues: false,
        data: data,
        minVelocity: 0,
        maxVelocity: 12,
        velocityScale: 0.01,
        opacity: 0.85,
        colorScale: ["rgba(255,255,255,0.9)"]
      });
      windLayer.addTo(map);
      setNote("wind", "");
    } catch (err) {
      setNote("wind", "Gagal memuat data angin: " + esc(err.message) + ".");
    }
  }

  function applyWindLayer() {
    if (!map) return;
    if (windGridTimer) {
      clearInterval(windGridTimer);
      windGridTimer = null;
    }
    if (windLayer) {
      map.removeLayer(windLayer);
      windLayer = null;
    }
    if (!showWind) {
      setNote("wind", "");
      return;
    }
    if (!KEYS.owmApiKey) {
      setNote("wind", 'Layer <b>Angin</b> belum aktif. Isi <code>owmApiKey</code> pada berkas <code>mode-keys.js</code> (API key gratis di openweathermap.org).');
      return;
    }
    loadWindLayer();
    windGridTimer = setInterval(loadWindLayer, WIND_REFRESH_MS);
  }

  const refreshAqiDebounced = debounce(refreshAqi, 600);
  const refreshFiresDebounced = debounce(refreshFires, 600);

  function karhutlaDotIcon(color) {
    return L.divIcon({
      className: "",
      html: '<span class="iqair-kh-dot" style="background:' + color + '"></span>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  function addKarhutlaMarker(lat, lng, color, title, html) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const marker = L.marker([lat, lng], { icon: karhutlaDotIcon(color), title: title });
    marker.bindPopup('<div class="iqair-popup">' + html + "</div>", { className: "iqair-popup" });
    karhutlaLayer.addLayer(marker);
  }

  function renderKarhutlaOverlay() {
    if (!karhutlaLayer) return;
    karhutlaLayer.clearLayers();
    if (!showKarhutla) return;
    const data = window.KarhutlaMapData;
    if (!data) return;
    (data.hotspots || []).forEach(function (item) {
      addKarhutlaMarker(
        item.lat, item.lng, KARHUTLA_DOT_COLORS[item.level] || KARHUTLA_DOT_COLORS.sedang,
        item.name,
        "<strong>" + esc(item.name) + "</strong><br>Hotspot SiPongi — " + esc(item.detectedShort || item.detected)
      );
    });
    (data.cases || []).forEach(function (item) {
      const color = item.eksternal ? KARHUTLA_DOT_COLORS.eksternal : KARHUTLA_DOT_COLORS.internal;
      addKarhutlaMarker(
        item.lat, item.lng, color, item.lokasi,
        "<strong>" + esc(item.lokasi) + "</strong><br>Penanganan terverifikasi — " + (item.eksternal ? "Eksternal" : "Internal")
      );
    });
    (data.patrols || []).forEach(function (item) {
      addKarhutlaMarker(
        item.lat, item.lng, KARHUTLA_DOT_COLORS.patroli, item.lokasi,
        "<strong>" + esc(item.lokasi) + "</strong><br>Patroli pencegahan — " + esc(item.status)
      );
    });
    (data.dops || []).forEach(function (item) {
      addKarhutlaMarker(
        item.lat, item.lng, KARHUTLA_DOT_COLORS.dop, item.lokasi,
        "<strong>" + esc(item.lokasi) + "</strong><br>Hasil DOP Karhutla — " + esc(item.status)
      );
    });
  }

  function ensureMap() {
    if (map) return;
    map = L.map("iqair-map", {
      center: [-2.5, 118],
      zoom: 5,
      minZoom: 3,
      zoomControl: true,
      attributionControl: true
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "OpenStreetMap",
      subdomains: "abc",
      maxZoom: 19
    }).addTo(map);
    heatLayer = L.heatLayer([], {
      radius: 45,
      blur: 35,
      maxZoom: 9,
      max: 1,
      minOpacity: 0.35,
      gradient: HEAT_GRADIENT
    }).addTo(map);
    aqiLayer = L.layerGroup().addTo(map);
    fireLayer = L.layerGroup().addTo(map);
    const boundaryData = window.IUPK_BOUNDARY || { type: "FeatureCollection", features: [] };
    boundaryLayer = L.layerGroup([
      L.geoJSON(boundaryData, {
        style: { color: "#ffffff", weight: 7, opacity: 0.9, fill: false }
      }),
      L.geoJSON(boundaryData, {
        style: { color: "#00e5ff", weight: 4, opacity: 1, fillColor: "#00e5ff", fillOpacity: 0.12, dashArray: "6 4" },
        onEachFeature: function (feature, layer) {
          const p = feature.properties || {};
          const title = [p.Site, p.Layer].filter(Boolean).join(" · ");
          layer.bindTooltip(title || "Konsesi IUPK Berau Coal", { sticky: true, className: "iqair-popup" });
        }
      })
    ]).addTo(map);
    karhutlaLayer = L.layerGroup().addTo(map);
    map.on("moveend", function () {
      refreshAqiDebounced();
      refreshFiresDebounced();
    });
    refreshAqi();
    refreshFires();
    applyWindLayer();
    renderKarhutlaOverlay();
    karhutlaTimer = setInterval(renderKarhutlaOverlay, 30000);
  }

  document.querySelectorAll("[data-iqair-layer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const layer = btn.getAttribute("data-iqair-layer");
      if (layer === "aqi") {
        showAqi = !showAqi;
        btn.classList.toggle("is-on", showAqi);
        if (aqiLayer) {
          if (showAqi) { refreshAqi(); } else { aqiLayer.clearLayers(); if (heatLayer) heatLayer.setLatLngs([]); setNote("aqi", ""); }
        }
      } else if (layer === "fire") {
        showFire = !showFire;
        btn.classList.toggle("is-on", showFire);
        if (fireLayer) {
          if (showFire) { refreshFires(); } else { fireLayer.clearLayers(); setNote("fire", ""); }
        }
      } else if (layer === "wind") {
        showWind = !showWind;
        btn.classList.toggle("is-on", showWind);
        applyWindLayer();
      } else if (layer === "karhutla") {
        showKarhutla = !showKarhutla;
        btn.classList.toggle("is-on", showKarhutla);
        if (boundaryLayer && map) {
          if (showKarhutla) boundaryLayer.addTo(map);
          else map.removeLayer(boundaryLayer);
        }
        renderKarhutlaOverlay();
      }
    });
  });

  modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const mode = btn.getAttribute("data-mode");
      modeButtons.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
      document.body.classList.toggle("mode-iqair", mode === "iqair");
      if (mode === "iqair") {
        ensureMap();
        setTimeout(function () { if (map) map.invalidateSize(); }, 60);
      }
    });
  });
})();
