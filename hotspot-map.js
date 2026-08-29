(function () {
  const SIPONGI_APIS = [
    "https://opsroom-sipongi.gakkum.kehutanan.go.id",
    "https://opsroom.sipongidata.my.id"
  ];
  const PROVINSI_KALTIM = "14";
  const SATS = [
    { id: "terra", label: "TERRA/AQUA", sumber: ["NASA-MODIS", "LPN-MODIS"] },
    { id: "snpp", label: "SNPP", sumber: ["NASA-SNPP", "LPN-NPP"] },
    { id: "noaa20", label: "NOAA20", sumber: ["NASA-NOAA20", "LPN-NOAA20"] }
  ];
  const LEVELS = {
    tinggi: { label: "High", badge: "High" },
    sedang: { label: "Medium", badge: "Medium" },
    rendah: { label: "Low", badge: "Low" }
  };
  const FIELD_PHOTOS = (function () {
    const list = ["aktivitas/dokumentasi.png"];
    for (let i = 2; i <= 21; i += 1) list.push("aktivitas/dokumentasi" + i + ".png");
    return list;
  })();

  function randomFieldPhotos() {
    const count = Math.random() < 0.5 ? 1 : 2;
    const pool = FIELD_PHOTOS.slice();
    const picked = [];
    for (let i = 0; i < count; i += 1) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }
  const MATCH_KM = 3;
  const NEAR_KM = 5;
  const boundsOps = L.latLngBounds([1.87, 117.13], [2.40, 117.63]);

  const listEl = document.getElementById("hotspot-list");
  const countEl = document.getElementById("list-count");
  const dateStrip = document.getElementById("date-strip");
  const hourFilter = document.getElementById("hour-filter");
  const hourStrip = document.getElementById("hour-strip");
  const listLabel = document.getElementById("list-label");
  const emptyEl = document.getElementById("detail-empty");
  const cardEl = document.getElementById("detail-card");
  const detailPane = document.getElementById("map-detail");
  const loadingEl = document.getElementById("map-loading");
  const sourceEl = document.getElementById("data-source");
  const liveStatus = document.getElementById("live-status");
  const refreshBtn = document.getElementById("btn-refresh");
  const sumSipongi = document.getElementById("sum-sipongi");
  const sumInternal = document.getElementById("sum-internal");
  const sumEksternal = document.getElementById("sum-eksternal");
  const showAllRoutesEl = document.getElementById("show-all-routes");

  let HOTSPOTS = [];
  let CASES = [];
  let DATE_KEYS = [];
  let selectedId = null;
  let selectedDay = "today";
  let selectedHour = "all";
  let scope = "semua";
  let showKasus = true;
  let showSipongi = true;
  const markers = {};
  const caseMarkers = {};
  let routeLayer = L.layerGroup();
  let lastFetchAt = null;
  let loading = false;

  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Esri • Data SIPONGI KEMENHUT",
    maxZoom: 18
  });
  const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "OSM & CARTO • Data SIPONGI KEMENHUT",
    maxZoom: 18
  });
  const map = L.map("map", {
    center: [2.08, 117.42],
    zoom: 10,
    layers: [sat],
    zoomControl: false,
    attributionControl: false
  });
  map.createPane("iupk");
  map.getPane("iupk").style.zIndex = 450;
  map.getPane("iupk").style.pointerEvents = "auto";
  const iupkRenderer = L.canvas({ pane: "iupk", padding: 0.8 });
  const opsLayer = L.geoJSON(window.IUPK_BOUNDARY || { type: "FeatureCollection", features: [] }, {
    pane: "iupk",
    renderer: iupkRenderer,
    style: {
      color: "#d4ff7a",
      weight: 4,
      fillColor: "#6bb443",
      fillOpacity: 0.22
    },
    onEachFeature: function (feature, layer) {
      const p = feature.properties || {};
      const luas = p.Luas != null ? Number(p.Luas).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " ha" : "";
      const title = [p.Site, p.Layer].filter(Boolean).join(" · ");
      layer.bindTooltip((title || "Konsesi IUPK") + (luas ? " · " + luas : ""), { sticky: true, className: "iupk-tip" });
    }
  });
  routeLayer.addTo(map);

  function esc(s) {
    return String(s == null || s === "" ? "—" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function todayKey() {
    const n = new Date();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return n.getFullYear() + "-" + m + "-" + d;
  }

  function dayKey(iso) {
    if (!iso) return "";
    const raw = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const d = new Date(raw.length <= 10 ? raw + "T00:00:00" : raw);
    if (Number.isNaN(d.getTime())) return "";
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dd;
  }

  function formatDate(iso) {
    const key = dayKey(iso);
    if (!key) return "—";
    const d = new Date(key + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function sipongiTime(p) {
    const iso = p.date_hotspot_ori || p.hs_id || "";
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()) && iso) {
      const dateLabel = d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Makassar"
      });
      const timeLabel = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Makassar"
      });
      const hourPart = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Makassar"
      }).formatToParts(d).find(function (part) { return part.type === "hour"; });
      return {
        iso: d.toISOString(),
        dateLabel: dateLabel,
        timeLabel: timeLabel + " WITA",
        shortTime: timeLabel + " WITA",
        full: dateLabel + " · " + timeLabel + " WITA",
        hour: hourPart ? Number(hourPart.value) : -1
      };
    }
    const raw = String(p.date_hotspot || "").trim();
    const m = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
    return {
      iso: "",
      dateLabel: raw || "—",
      timeLabel: m ? m[1] + " WITA" : "—",
      shortTime: m ? m[1] + " WITA" : "—",
      full: raw || "—",
      hour: m ? Number(m[1].split(":")[0]) : -1
    };
  }

  function chipLabel(key) {
    if (key === "today") return "Hari ini";
    const d = new Date(key + "T00:00:00");
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  }

  function hourKeyOf(item) {
    return item.detectedHour < 0 || item.detectedHour == null ? "none" : String(item.detectedHour);
  }

  function hourChipLabel(key) {
    if (key === "all") return "Semua";
    if (key === "none") return "Tanpa jam";
    return String(Number(key)).padStart(2, "0") + ":00";
  }

  function visibleHotspots() {
    if (!showSipongi) return [];
    if (selectedHour === "all") return HOTSPOTS;
    return HOTSPOTS.filter(function (item) {
      return hourKeyOf(item) === selectedHour;
    });
  }

  function clampHourFilter() {
    if (selectedHour === "all") return;
    const still = HOTSPOTS.some(function (item) {
      return hourKeyOf(item) === selectedHour;
    });
    if (!still) selectedHour = "all";
  }

  function activeDayKey() {
    return selectedDay === "today" ? todayKey() : selectedDay;
  }

  function toNum(s) {
    return parseFloat(String(s).replace(",", "."));
  }

  function dmsToDec(d, m, s, hemi) {
    let v = Math.abs(toNum(d)) + toNum(m || 0) / 60 + toNum(s || 0) / 3600;
    const h = String(hemi || "").toUpperCase();
    if (h === "S" || h === "W") v = -v;
    if (toNum(d) < 0) v = -Math.abs(v);
    return v;
  }

  function parseCoord(text) {
    if (text == null) return { lat: NaN, lng: NaN };
    let t = String(text)
      .replace(/⁰/g, "°")
      .replace(/[′’]/g, "'")
      .replace(/[″“”]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    if (!t || t === "-") return { lat: NaN, lng: NaN };

    let m = t.match(/lat[:\s]*([-\d.]+)\s*°?\s*[NS]?.*?long[:\s]*([-\d.]+)\s*°?\s*[EW]?/i);
    if (m) return { lat: toNum(m[1]), lng: toNum(m[2]) };

    m = t.match(/N\s+(\d+)°\s*(\d+(?:\.\d+)?)\s+E\s+(\d+)°\s*(\d+(?:\.\d+)?)/i);
    if (m) return { lat: dmsToDec(m[1], m[2], 0, "N"), lng: dmsToDec(m[3], m[4], 0, "E") };

    m = t.match(/(\d+)[°']\s*(\d+)['']\s*(\d+(?:\.\d+)?)["']?\s*([NS])\s+(\d+)[°']\s*(\d+)['']\s*(\d+(?:\.\d+)?)["']?\s*([EW])/i);
    if (m) return { lat: dmsToDec(m[1], m[2], m[3], m[4]), lng: dmsToDec(m[5], m[6], m[7], m[8]) };

    m = t.match(/([-\d.]+)\s*[°"']?\s*([NS])\s*,?\s*([-\d.]+)\s*[°"']?\s*([EW])/i);
    if (m) return { lat: dmsToDec(m[1], 0, 0, m[2]), lng: dmsToDec(m[3], 0, 0, m[4]) };

    m = t.match(/([1-3]\.\d+)\s*["']?\s*N\s+([1][01]\d\.\d+)\s*["']?\s*E/i);
    if (m) return { lat: toNum(m[1]), lng: toNum(m[2]) };

    m = t.match(/([1-3]\.\d+)\s*[,;]?\s+(117\.\d+)/);
    if (m) return { lat: toNum(m[1]), lng: toNum(m[2]) };

    return { lat: NaN, lng: NaN };
  }

  function firstCoord(text) {
    if (text == null) return { lat: NaN, lng: NaN };
    const chunks = String(text).split(/[\n;/]+/);
    for (let i = 0; i < chunks.length; i += 1) {
      const xy = parseCoord(chunks[i]);
      if (Number.isFinite(xy.lat) && Number.isFinite(xy.lng)) return xy;
    }
    return parseCoord(text);
  }

  function splitLokasi(raw) {
    const text = String(raw || "").trim();
    if (!text) return { lokasi: "Operasi Karhutla", site: "—" };
    const parts = text.split("_").map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length >= 2) {
      return { lokasi: parts.slice(0, -1).join(" "), site: parts[parts.length - 1] };
    }
    return { lokasi: text, site: "—" };
  }

  function hasCoord(item) {
    return item && Number.isFinite(item.lat) && Number.isFinite(item.lng);
  }

  function dash(v) {
    if (v == null) return "—";
    const s = String(v).replace(/\s+/g, " ").trim();
    return s || "—";
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLng = (bLng - aLng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function pointInRing(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function insideIupk(lat, lng) {
    const fc = window.IUPK_BOUNDARY;
    if (!fc || !Array.isArray(fc.features)) return false;
    return fc.features.some(function (feat) {
      const g = feat.geometry;
      if (!g) return false;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      return polys.some(function (poly) { return poly[0] && pointInRing(lat, lng, poly[0]); });
    });
  }

  function isEksternal(rec, lat, lng) {
    const ket = String(rec.keterangan || "").toLowerCase();
    const site = String(rec.site || "").toLowerCase();
    const note = String(rec.notifikasi || "").toLowerCase();
    if (ket.indexOf("eksternal") !== -1) return true;
    if (site.indexOf("jalan negara") !== -1) return true;
    if (/kampung|jalan poros|jalan baru/.test(site + " " + note) && !/bmo|lmo|gmo|smo|blok|punan/.test(site)) return true;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return !insideIupk(lat, lng);
    return false;
  }

  function satOf(sumber) {
    const found = SATS.find(function (row) { return row.sumber.indexOf(sumber) !== -1; });
    return found ? found.id : "terra";
  }

  function levelOf(conf) {
    if (conf === "high") return "tinggi";
    if (conf === "medium") return "sedang";
    return "rendah";
  }

  function satLabel(id) {
    const found = SATS.find(function (s) { return s.id === id; });
    return found ? found.label : id;
  }

  function kasusIcon(item, on) {
    const kind = item.eksternal ? "kasus" : "internal";
    return L.divIcon({
      className: "",
      html: '<span class="pin ' + kind + (on ? " is-on" : "") + '"><i class="pin-ring"></i><i class="pin-core"></i></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function markerIcon(level, on) {
    return L.divIcon({
      className: "",
      html: '<span class="pin ' + level + (on ? " is-on" : "") + '"><i class="pin-ring"></i><i class="pin-core"></i></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  function baseIcon() {
    return L.divIcon({
      className: "",
      html: '<span class="pin base"><i class="pin-ring"></i><i class="pin-core"></i></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  function hudPad() {
    const left = document.querySelector(".list-card");
    const right = document.querySelector(".hud-right");
    const legend = document.querySelector(".map-legend-bar");
    const topbar = document.querySelector(".topbar");
    return {
      paddingTopLeft: [(left ? left.offsetWidth : 0) + 36, (topbar ? topbar.offsetHeight : 72) + 16],
      paddingBottomRight: [(right ? right.offsetWidth : 0) + 36, (legend ? legend.offsetHeight : 64) + 28]
    };
  }

  function fitDay() {
    const layers = opsLayer.getLayers().slice();
    Object.keys(markers).forEach(function (id) { layers.push(markers[id]); });
    Object.keys(caseMarkers).forEach(function (id) { layers.push(caseMarkers[id]); });
    if (!layers.length) {
      map.fitBounds(boundsOps, hudPad());
      return;
    }
    map.fitBounds(L.featureGroup(layers).getBounds().pad(0.1), hudPad());
  }

  function buildQuery() {
    const custom = selectedDay !== "today";
    const key = activeDayKey();
    const params = new URLSearchParams();
    params.set("wilayah", "IN");
    params.set("filterperiode", custom ? "true" : "false");
    params.set("from", custom ? key : "");
    params.set("to", custom ? key : "");
    params.set("late", custom ? "custom" : "24");
    params.set("provinsi", PROVINSI_KALTIM);
    params.set("kabkota", "");
    ["NASA-MODIS", "NASA-SNPP", "NASA-NOAA20"].forEach(function (name) {
      params.append("satelit[]", name);
    });
    ["low", "medium", "high"].forEach(function (name) {
      params.append("confidence[]", name);
    });
    return params.toString();
  }

  function mapFeature(feature, index) {
    const p = feature.properties || {};
    const g = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : [p.long, p.lat];
    const conf = (p.confidence_level || "low").toLowerCase();
    const lat = Number(p.lat != null ? p.lat : g[1]);
    const lng = Number(p.long != null ? p.long : g[0]);
    const when = sipongiTime(p);
    return {
      kind: "sipongi",
      id: [p.sumber, lat, lng, p.date_hotspot_ori || p.hs_id, index].join("_"),
      site: p.kecamatan || "Tidak diketahui",
      name: p.desa || p.kecamatan || "Hotspot",
      lat: lat,
      lng: lng,
      sat: satOf(p.sumber || ""),
      source: p.sumber || "—",
      conf: conf,
      level: levelOf(conf),
      confidence: Number(p.confidence) || 0,
      detected: when.full,
      detectedDate: when.dateLabel,
      detectedTime: when.timeLabel,
      detectedShort: when.shortTime,
      detectedIso: when.iso,
      detectedHour: when.hour,
      desa: p.desa || "—",
      kec: p.kecamatan || "—",
      kab: p.kabkota || "—",
      prov: p.nama_provinsi || "Kalimantan Timur",
      kawasan: p.kawasan || "—"
    };
  }

  async function fetchFrom(base) {
    const res = await fetch(base + "/api/opsroom/indoHotspot?" + buildQuery());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.features)) throw new Error("Format data tidak dikenali");
    return json.features;
  }

  function mapLaporan(rep, index) {
    const op = (rep && rep.operasi_karhutla) || {};
    const tim = op.jumlah_tim || {};
    const evalRep = (rep && rep.evaluasi) || {};
    const plus = evalRep.kelebihan || {};
    const minus = evalRep.kekurangan || {};
    const docs = (rep && rep.dokumentasi) || {};
    const place = splitLokasi(op.lokasi_pemadaman);
    const xy = parseCoord(op.titik_koordinat_pemadaman);
    return {
      used: false,
      sheet: dash(rep.sheet_name),
      tanggal: dayKey(op.tanggal),
      site: place.site,
      lokasi: place.lokasi,
      lat: xy.lat,
      lng: xy.lng,
      coordRaw: op.titik_koordinat_pemadaman,
      mulai: dash(op.mulai_operasi),
      selesai: dash(op.selesai_operasi),
      titikApi: dash(op.jumlah_titik_api_yang_dipadamkan),
      timBc: dash(tim.berau_coal),
      volunteer: dash(tim.volunteer),
      unit: dash(tim.unit_support),
      alat: dash(tim.peralatan_yang_digunakan),
      konsumsi: dash(tim.konsumsi),
      plusTim: dash(plus.jumlah_tim),
      plusUnit: dash(plus.unit_support),
      plusAlat: dash(plus.peralatan),
      plusKonsumsi: dash(plus.konsumsi),
      minusTim: dash(minus.jumlah_tim),
      minusUnit: dash(minus.unit_support),
      minusAlat: dash(minus.peralatan_yang_digunakan),
      minusKonsumsi: dash(minus.konsumsi),
      rencana: dash(rep.rencana_kegiatan_besok),
      docsCount: docs.jumlah_gambar_tertanam,
      docsNote: dash(docs.catatan),
      photos: Array.isArray(docs.files) ? docs.files.filter(function (src) {
        if (window.KarhutlaLaporanStore) return KarhutlaLaporanStore.isPhotoRef(src);
        return typeof src === "string" && src.indexOf("laporan-foto/") === 0;
      }).map(function (src) {
        return window.KarhutlaLaporanStore ? (KarhutlaLaporanStore.displayUrl(src) || src) : src;
      }) : [],
      index: index,
      eksternal: typeof op.eksternal === "boolean" ? op.eksternal : null
    };
  }

  function attachLaporan(base, lap) {
    if (!lap) return base;
    ["sheet", "lokasi", "mulai", "selesai", "titikApi", "timBc", "volunteer", "unit", "alat", "konsumsi",
      "plusTim", "plusUnit", "plusAlat", "plusKonsumsi", "minusTim", "minusUnit", "minusAlat", "minusKonsumsi",
      "rencana", "docsCount", "docsNote", "coordRaw"].forEach(function (key) {
      if (lap[key] != null && lap[key] !== "—") base[key] = lap[key];
    });
    if (!hasCoord(base) && hasCoord(lap)) {
      base.lat = lap.lat;
      base.lng = lap.lng;
    }
    if (lap.site && lap.site !== "—") base.site = lap.site;
    if (typeof lap.eksternal === "boolean") base.eksternal = lap.eksternal;
    if (lap.photos && lap.photos.length) {
      base.media = base.media || {};
      base.media.photos = lap.photos.slice();
    }
    return base;
  }

  function mergeCases(records, reports) {
    const laps = (reports || []).map(mapLaporan);
    const out = [];
    (records || []).forEach(function (rec, index) {
      const lat = Number(rec.latitude);
      const lng = Number(rec.longitude);
      const key = dayKey(rec.tanggal);
      const origin = firstCoord(rec.titik_koordinat_respon_awal);
      let best = null;
      let bestD = Infinity;
      laps.forEach(function (lap) {
        if (lap.used || lap.tanggal !== key) return;
        let d = 99;
        if (hasCoord(lap) && Number.isFinite(lat) && Number.isFinite(lng)) d = haversineKm(lat, lng, lap.lat, lap.lng);
        else if (String(lap.site).toLowerCase() === String(rec.site || "").toLowerCase()) d = 2.5;
        if (d < bestD) {
          bestD = d;
          best = lap;
        }
      });
      if (best && bestD <= MATCH_KM) best.used = true;
      else best = null;
      const item = {
        kind: "kasus",
        id: "kasus-" + (index + 1),
        tanggal: key,
        site: rec.site || "—",
        lokasi: splitLokasi((rec.notifikasi || "").split("_")[2] || rec.site).lokasi,
        lat: lat,
        lng: lng,
        originLat: origin.lat,
        originLng: origin.lng,
        originRaw: rec.titik_koordinat_respon_awal,
        responder: dash(rec.yang_merespon),
        notifikasi: rec.notifikasi || "",
        keterangan: rec.keterangan,
        eksternal: isEksternal(rec, lat, lng),
        media: {
          photos: randomFieldPhotos(),
          video: null
        }
      };
      if (!(item.lokasi && item.lokasi !== "—")) item.lokasi = rec.site || "Penanganan KARHUTLA";
      out.push(attachLaporan(item, best));
    });
    laps.forEach(function (lap) {
      if (lap.used) return;
      const origin = { lat: NaN, lng: NaN };
      out.push(attachLaporan({
        kind: "kasus",
        id: "kasus-lap-" + (lap.index + 1),
        tanggal: lap.tanggal,
        site: lap.site,
        lokasi: lap.lokasi,
        lat: lap.lat,
        lng: lap.lng,
        originLat: origin.lat,
        originLng: origin.lng,
        originRaw: "",
        responder: lap.timBc,
        notifikasi: "",
        keterangan: null,
        eksternal: typeof lap.eksternal === "boolean"
          ? lap.eksternal
          : (hasCoord(lap) ? !insideIupk(lap.lat, lap.lng) : false),
        media: {
          photos: (lap.photos && lap.photos.length) ? lap.photos.slice() : randomFieldPhotos(),
          video: null
        }
      }, lap));
    });
    out.sort(function (a, b) {
      if (a.tanggal === b.tanggal) return (a.mulai || "").localeCompare(b.mulai || "");
      return a.tanggal < b.tanggal ? 1 : -1;
    });
    return out;
  }

  function loadCases() {
    const recs = window.KARHUTLA_CASE_DATA && window.KARHUTLA_CASE_DATA.sheets && window.KARHUTLA_CASE_DATA.sheets[0]
      ? window.KARHUTLA_CASE_DATA.sheets[0].records
      : [];
    const reports = window.KARHUTLA_LAPORAN_DATA && window.KARHUTLA_LAPORAN_DATA.reports
      ? window.KARHUTLA_LAPORAN_DATA.reports
      : [];
    CASES = mergeCases(recs, reports);
    DATE_KEYS = Array.from(new Set(CASES.map(function (c) { return c.tanggal; }).filter(Boolean))).sort();
    if (DATE_KEYS.length) selectedDay = DATE_KEYS[DATE_KEYS.length - 1];
    renderDateStrip();
  }

  function dayCases() {
    const key = activeDayKey();
    return CASES.filter(function (item) {
      if (item.tanggal !== key) return false;
      if (scope === "internal") return !item.eksternal;
      if (scope === "eksternal") return item.eksternal;
      return true;
    });
  }

  function nearestCase(item) {
    if (!hasCoord(item)) return null;
    const key = activeDayKey();
    let best = null;
    let bestD = NEAR_KM;
    CASES.forEach(function (row) {
      if (row.tanggal !== key || !hasCoord(row)) return;
      const d = haversineKm(item.lat, item.lng, row.lat, row.lng);
      if (d < bestD) {
        bestD = d;
        best = row;
      }
    });
    return best;
  }

  async function loadHotspots() {
    if (loading) return;
    loading = true;
    loadingEl.hidden = false;
    refreshBtn.disabled = true;
    let lastError = null;
    for (let i = 0; i < SIPONGI_APIS.length; i += 1) {
      try {
        const features = await fetchFrom(SIPONGI_APIS[i]);
        HOTSPOTS = features
          .map(mapFeature)
          .filter(function (item) {
            if (Number.isNaN(item.lat) || Number.isNaN(item.lng)) return false;
            return String(item.kab).toLowerCase() === "berau";
          })
          .sort(function (a, b) {
            return String(b.detectedIso || "").localeCompare(String(a.detectedIso || ""));
          });
        lastFetchAt = new Date();
        loadingEl.hidden = true;
        refreshBtn.disabled = false;
        loading = false;
        selectedId = null;
        paint();
        fitDay();
        return;
      } catch (err) {
        lastError = err;
      }
    }
    HOTSPOTS = [];
    loadingEl.hidden = true;
    refreshBtn.disabled = false;
    loading = false;
    sourceEl.textContent = "SiPongi belum termuat. Penanganan terverifikasi tetap ditampilkan.";
    liveStatus.textContent = lastError ? String(lastError.message) : "Koneksi SiPongi gagal";
    paint();
    fitDay();
  }

  function renderDateStrip() {
    const keys = ["today"].concat(DATE_KEYS.slice().reverse());
    dateStrip.innerHTML = keys.map(function (key) {
      const on = key === selectedDay ? " is-on" : "";
      const count = key === "today"
        ? ""
        : " · " + CASES.filter(function (c) { return c.tanggal === key; }).length;
      return '<button type="button" class="date-chip' + on + '" data-day="' + key + '">' +
        esc(chipLabel(key)) + (count ? "<i>" + count.replace(" · ", "") + "</i>" : "") +
        "</button>";
    }).join("");
  }

  function renderHourStrip() {
    if (!hourStrip) return;
    if (!HOTSPOTS.length || !showSipongi) {
      if (hourFilter) hourFilter.hidden = true;
      hourStrip.innerHTML = "";
      return;
    }
    if (hourFilter) hourFilter.hidden = false;
    const counts = {};
    HOTSPOTS.forEach(function (item) {
      const key = hourKeyOf(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    const keys = Object.keys(counts).sort(function (a, b) {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return Number(a) - Number(b);
    });
    const chips = [{ key: "all", n: HOTSPOTS.length }].concat(keys.map(function (key) {
      return { key: key, n: counts[key] };
    }));
    hourStrip.innerHTML = chips.map(function (chip) {
      const on = chip.key === selectedHour ? " is-on" : "";
      return '<button type="button" class="date-chip' + on + '" data-hour="' + chip.key + '">' +
        esc(hourChipLabel(chip.key)) + "<i>" + chip.n + "</i></button>";
    }).join("");
  }

  function renderSummary() {
    const cases = CASES.filter(function (c) { return c.tanggal === activeDayKey(); });
    const internal = cases.filter(function (c) { return !c.eksternal; }).length;
    const eksternal = cases.filter(function (c) { return c.eksternal; }).length;
    const spots = visibleHotspots();
    const sipongiShown = showSipongi ? spots.length : 0;
    const sipongiAll = HOTSPOTS.length;
    sumSipongi.textContent = selectedHour === "all" || !showSipongi
      ? String(sipongiAll)
      : String(sipongiShown);
    sumInternal.textContent = String(internal);
    sumEksternal.textContent = String(eksternal);
    const label = selectedDay === "today" ? "Hari ini (24 jam)" : formatDate(selectedDay);
    const hourBit = selectedHour === "all" ? "" : " · jam " + hourChipLabel(selectedHour) + " WITA";
    const sipongiBit = selectedHour === "all" || !showSipongi
      ? "SiPongi " + sipongiAll
      : "SiPongi " + sipongiShown + " dari " + sipongiAll;
    sourceEl.textContent = "Berau · " + label + hourBit + " · " + sipongiBit + " · Internal " + internal + " · Eksternal " + eksternal +
      (lastFetchAt ? " · " + lastFetchAt.toLocaleTimeString("id-ID") : "");
    liveStatus.textContent = cases.length
      ? (internal + " respon internal, " + eksternal + " eksternal")
      : (sipongiShown
        ? sipongiShown + " hotspot SiPongi" + (selectedHour === "all" ? "" : " jam " + hourChipLabel(selectedHour)) + ", belum ada penanganan terverifikasi"
        : "Tidak ada titik pada " + (selectedHour === "all" ? "tanggal ini" : "jam ini"));
  }

  function renderList() {
    const cases = dayCases();
    const spots = visibleHotspots();
    const total = spots.length + cases.length;
    countEl.textContent = String(total);
    if (listLabel) {
      listLabel.textContent = selectedHour === "all" ? "titik di tanggal ini" : "titik di jam " + hourChipLabel(selectedHour);
    }
    let html = "";
    if (spots.length) {
      html += '<p class="list-group">Hotspot satelit</p>';
      html += spots.map(function (item) {
        const on = item.id === selectedId ? " is-on" : "";
        return (
          '<button class="hotspot-item' + on + '" type="button" data-id="' + esc(item.id) + '">' +
            '<span class="pin-mini ' + item.level + '"><i></i></span>' +
            '<span class="copy"><b>' + esc(item.name) + '</b><span class="meta">' + esc(item.detectedShort || item.detected) + " · " + esc(item.source) + "</span></span>" +
            '<span class="badge ' + item.level + '">' + LEVELS[item.level].badge + "</span>" +
          "</button>"
        );
      }).join("");
    }
    if (cases.length) {
      html += '<p class="list-group">Penanganan terverifikasi</p>';
      html += cases.map(function (item) {
        const on = item.id === selectedId ? " is-on" : "";
        const kind = item.eksternal ? "kasus" : "internal";
        return (
          '<button class="hotspot-item' + on + '" type="button" data-id="' + item.id + '">' +
            '<span class="pin-mini ' + kind + '"><i></i></span>' +
            '<span class="copy"><b>' + esc(item.lokasi) + '</b><span class="meta">' + esc(item.site) + " · " + esc(item.mulai || item.responder) + "</span></span>" +
            '<span class="badge ' + kind + '">' + (item.eksternal ? "Eksternal" : "Internal") + "</span>" +
          "</button>"
        );
      }).join("");
    }
    listEl.innerHTML = html || '<p class="demo-note">Tidak ada hotspot atau penanganan pada ' + (selectedHour === "all" ? "tanggal ini" : "jam ini") + ".</p>";
  }

  function renderMarkers() {
    Object.keys(markers).forEach(function (id) {
      map.removeLayer(markers[id]);
      delete markers[id];
    });
    if (!showSipongi) return;
    visibleHotspots().forEach(function (item) {
      const marker = L.marker([item.lat, item.lng], {
        icon: markerIcon(item.level, item.id === selectedId),
        title: item.name + " · " + (item.detectedShort || item.detected),
        zIndexOffset: 400
      }).addTo(map);
      marker.bindTooltip(
        esc(item.name) + "<br>" + esc(item.detectedShort || item.detected),
        { sticky: true, className: "sipongi-tip", direction: "top" }
      );
      marker.on("click", function () { select(item.id, true); });
      markers[item.id] = marker;
    });
  }

  function renderCaseMarkers() {
    Object.keys(caseMarkers).forEach(function (id) {
      map.removeLayer(caseMarkers[id]);
      delete caseMarkers[id];
    });
    if (!showKasus) return;
    dayCases().forEach(function (item) {
      if (!hasCoord(item)) return;
      const marker = L.marker([item.lat, item.lng], {
        icon: kasusIcon(item, item.id === selectedId),
        title: item.lokasi + " · " + item.site,
        zIndexOffset: 800
      }).addTo(map);
      marker.on("click", function () { select(item.id, true); });
      caseMarkers[item.id] = marker;
    });
  }

  function addRoute(item, emphasize) {
    if (!hasCoord(item) || !Number.isFinite(item.originLat) || !Number.isFinite(item.originLng)) return;
    const color = item.eksternal ? "#ef5a36" : "#86d15c";
    L.polyline([[item.originLat, item.originLng], [item.lat, item.lng]], {
      color: color,
      weight: emphasize ? 3.2 : 2,
      opacity: emphasize ? 0.95 : 0.55,
      dashArray: "7 6"
    }).addTo(routeLayer);
    L.marker([item.originLat, item.originLng], {
      icon: baseIcon(),
      title: "Base respon · " + dash(item.responder),
      zIndexOffset: 700
    }).addTo(routeLayer);
  }

  function renderRoutes() {
    routeLayer.clearLayers();
    const all = showAllRoutesEl && showAllRoutesEl.checked;
    const selected = findItem(selectedId);
    if (all) {
      dayCases().forEach(function (item) { addRoute(item, selected && item.id === selected.id); });
      return;
    }
    if (selected && selected.kind === "kasus") addRoute(selected, true);
  }

  function findItem(id) {
    if (!id) return null;
    return CASES.find(function (row) { return row.id === id; }) ||
      HOTSPOTS.find(function (row) { return row.id === id; });
  }

  function renderMedia(item) {
    const photos = (item.media && item.media.photos) || [];
    const gallery = photos.map(function (src) {
      return '<img src="' + esc(src) + '" alt="Dokumentasi operasi ' + esc(item.lokasi) + '">';
    }).join("");
    const poster = photos[0] || FIELD_PHOTOS[0];
    return (
      '<p class="detail-section">Dokumentasi lapangan</p>' +
      '<div class="media-gallery">' + gallery + "</div>" +
      '<div class="video-slot">' +
        '<img src="' + esc(poster) + '" alt="">' +
        "" +
      "</div>"
    );
  }

  function renderCaseDetail(item) {
    emptyEl.hidden = true;
    cardEl.hidden = false;
    detailPane.classList.add("is-open");
    const coordText = hasCoord(item) ? item.lat.toFixed(6) + ", " + item.lng.toFixed(6) : dash(item.coordRaw);
    const originText = Number.isFinite(item.originLat)
      ? item.originLat.toFixed(6) + ", " + item.originLng.toFixed(6)
      : dash(item.originRaw);
    cardEl.innerHTML =
      "<small>Penanganan terverifikasi · " + esc(formatDate(item.tanggal)) + "</small>" +
      "<h2>" + esc(item.lokasi) + "</h2>" +
      '<p><span class="badge ' + (item.eksternal ? "kasus" : "internal") + '">' + (item.eksternal ? "Eksternal" : "Internal") + "</span></p>" +
      (item.notifikasi ? '<p class="lead-mini">' + esc(item.notifikasi.replace(/_/g, " · ")) + "</p>" : "") +
      '<p class="detail-section">Personil &amp; unit</p>' +
      '<div class="detail-grid">' +
        "<div class='span-2'><span>Tim Berau Coal</span><strong>" + esc(item.timBc) + "</strong></div>" +
        "<div class='span-2'><span>Volunteer</span><strong>" + esc(item.volunteer) + "</strong></div>" +
        "<div class='span-2'><span>Yang merespon</span><strong>" + esc(item.responder) + "</strong></div>" +
        "<div class='span-2'><span>Unit support</span><strong>" + esc(item.unit) + "</strong></div>" +
        "<div class='span-2'><span>Peralatan</span><strong>" + esc(item.alat) + "</strong></div>" +
        "<div class='span-2'><span>Konsumsi</span><strong>" + esc(item.konsumsi) + "</strong></div>" +
      "</div>" +
      '<p class="detail-section">Operasi</p>' +
      '<div class="detail-grid">' +
        "<div><span>Mulai</span><strong>" + esc(item.mulai) + "</strong></div>" +
        "<div><span>Selesai</span><strong>" + esc(item.selesai) + "</strong></div>" +
        "<div class='span-2'><span>Site</span><strong>" + esc(item.site) + "</strong></div>" +
        "<div class='span-2'><span>Titik api dipadamkan</span><strong>" + esc(item.titikApi) + "</strong></div>" +
        "<div class='span-2'><span>Base respon</span><strong>" + esc(originText) + "</strong></div>" +
        "<div class='span-2'><span>Titik api</span><strong>" + esc(coordText) + "</strong></div>" +
      "</div>" +
      '<p class="detail-section">Evaluasi</p>' +
      '<div class="detail-grid">' +
        "<div class='span-2'><span>Kelebihan tim</span><strong>" + esc(item.plusTim) + "</strong></div>" +
        "<div class='span-2'><span>Kelebihan unit</span><strong>" + esc(item.plusUnit) + "</strong></div>" +
        "<div class='span-2'><span>Kekurangan tim</span><strong>" + esc(item.minusTim) + "</strong></div>" +
        "<div class='span-2'><span>Kekurangan unit</span><strong>" + esc(item.minusUnit) + "</strong></div>" +
        "<div class='span-2'><span>Kekurangan alat</span><strong>" + esc(item.minusAlat) + "</strong></div>" +
      "</div>" +
      renderMedia(item) +
      (hasCoord(item)
        ? '<div class="detail-actions"><button class="go" type="button" id="focus-spot">Fokuskan jalur respon</button></div>'
        : "") +
      '<p class="demo-note">Sumber: laporan operasi + data titik koordinat KARHUTLA. Foto contoh dari arsip aktivitas.</p>';
    const focus = document.getElementById("focus-spot");
    if (focus) {
      focus.addEventListener("click", function () {
        const pts = [[item.lat, item.lng]];
        if (Number.isFinite(item.originLat)) pts.unshift([item.originLat, item.originLng]);
        map.fitBounds(L.latLngBounds(pts).pad(0.35), hudPad());
      });
    }
  }

  function renderSipongiDetail(item) {
    emptyEl.hidden = true;
    cardEl.hidden = false;
    detailPane.classList.add("is-open");
    const near = nearestCase(item);
    cardEl.innerHTML =
      "<small>" + esc(item.source) + " · Berau</small>" +
      "<h2>" + esc(item.name) + "</h2>" +
      '<p><span class="badge ' + item.level + '">' + LEVELS[item.level].label + " · " + item.confidence + '%</span> <span class="badge selesai">Belum terverifikasi lapangan</span></p>' +
      '<div class="detail-grid">' +
        "<div><span>Koordinat</span><strong>" + item.lat.toFixed(5) + ", " + item.lng.toFixed(5) + "</strong></div>" +
        "<div><span>Satelit</span><strong>" + esc(satLabel(item.sat)) + "</strong></div>" +
        "<div><span>Desa</span><strong>" + esc(item.desa) + "</strong></div>" +
        "<div><span>Kecamatan</span><strong>" + esc(item.kec) + "</strong></div>" +
        "<div class='span-2'><span>Tanggal muncul</span><strong>" + esc(item.detectedDate || item.detected) + "</strong></div>" +
        "<div class='span-2'><span>Jam muncul</span><strong>" + esc(item.detectedTime || "—") + "</strong></div>" +
      "</div>" +
      (near
        ? '<div class="detail-actions"><button class="go" type="button" id="open-near">Lihat penanganan terdekat · ' + esc(near.lokasi) + "</button></div>"
        : "") +
      '<div class="detail-actions">' +
        '<button class="ghost" type="button" id="focus-spot">Fokuskan di peta</button>' +
        '<a class="ghost" href="https://sipongi.gakkum.kehutanan.go.id/peta" target="_blank" rel="noopener">Buka SiPongi</a>' +
      "</div>" +
      '<p class="demo-note">Sumber: SIPONGI KEMENHUT. Hotspot satelit bukan bukti mutlak kebakaran.</p>';
    const focus = document.getElementById("focus-spot");
    if (focus) {
      focus.addEventListener("click", function () {
        map.flyTo([item.lat, item.lng], 13, { duration: 0.8 });
      });
    }
    const openNear = document.getElementById("open-near");
    if (openNear && near) {
      openNear.addEventListener("click", function () { select(near.id, true); });
    }
  }

  function renderDetail(item) {
    if (!item) {
      emptyEl.hidden = false;
      cardEl.hidden = true;
      detailPane.classList.remove("is-open");
      return;
    }
    if (item.kind === "kasus") {
      renderCaseDetail(item);
      return;
    }
    renderSipongiDetail(item);
  }

  function paint() {
    clampHourFilter();
    const visibleIds = {};
    visibleHotspots().forEach(function (item) { visibleIds[item.id] = true; });
    if (selectedId && HOTSPOTS.some(function (row) { return row.id === selectedId; }) && !visibleIds[selectedId]) {
      selectedId = null;
    }
    renderDateStrip();
    renderHourStrip();
    renderSummary();
    renderList();
    renderMarkers();
    renderCaseMarkers();
    renderRoutes();
    renderDetail(findItem(selectedId));
    if (map.hasLayer(opsLayer)) opsLayer.bringToFront();
  }

  function select(id, fly) {
    selectedId = id;
    const item = findItem(id);
    paint();
    if (item && fly && hasCoord(item)) {
      if (item.kind === "kasus" && Number.isFinite(item.originLat)) {
        map.fitBounds(L.latLngBounds([[item.originLat, item.originLng], [item.lat, item.lng]]).pad(0.4), hudPad());
      } else {
        map.flyTo([item.lat, item.lng], 14, { duration: 0.75 });
      }
    }
  }

  function setDay(key) {
    selectedDay = key;
    selectedHour = "all";
    selectedId = null;
    renderDateStrip();
    loadHotspots();
  }

  dateStrip.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-day]");
    if (!btn) return;
    setDay(btn.getAttribute("data-day"));
  });

  if (hourStrip) {
    hourStrip.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-hour]");
      if (!btn) return;
      selectedHour = btn.getAttribute("data-hour") || "all";
      selectedId = null;
      paint();
      fitDay();
    });
  }

  document.querySelectorAll("[data-scope]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      scope = btn.getAttribute("data-scope");
      document.querySelectorAll("[data-scope]").forEach(function (el) {
        el.classList.toggle("is-on", el.getAttribute("data-scope") === scope);
      });
      selectedId = null;
      paint();
    });
  });

  listEl.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    select(btn.getAttribute("data-id"), true);
  });

  refreshBtn.addEventListener("click", loadHotspots);
  if (showAllRoutesEl) showAllRoutesEl.addEventListener("change", renderRoutes);

  document.getElementById("zoom-in").addEventListener("click", function () { map.zoomIn(); });
  document.getElementById("zoom-out").addEventListener("click", function () { map.zoomOut(); });
  document.getElementById("zoom-fit").addEventListener("click", fitDay);

  document.querySelectorAll("[data-layer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const layer = btn.getAttribute("data-layer");
      if (layer === "dark" || layer === "sat") {
        document.querySelectorAll("[data-layer='dark'], [data-layer='sat']").forEach(function (el) {
          el.classList.remove("is-on");
        });
        btn.classList.add("is-on");
        if (layer === "dark") {
          if (!map.hasLayer(dark)) dark.addTo(map);
          if (map.hasLayer(sat)) map.removeLayer(sat);
        } else {
          if (!map.hasLayer(sat)) sat.addTo(map);
          if (map.hasLayer(dark)) map.removeLayer(dark);
        }
        return;
      }
      if (layer === "ops") {
        if (map.hasLayer(opsLayer)) {
          map.removeLayer(opsLayer);
          btn.classList.remove("is-on");
        } else {
          opsLayer.addTo(map);
          btn.classList.add("is-on");
        }
        return;
      }
      if (layer === "sipongi") {
        showSipongi = !showSipongi;
        btn.classList.toggle("is-on", showSipongi);
        paint();
        return;
      }
      if (layer === "kasus") {
        showKasus = !showKasus;
        btn.classList.toggle("is-on", showKasus);
        paint();
      }
    });
  });

  opsLayer.addTo(map);
  function startMap() {
    loadCases();
    setTimeout(function () {
      map.invalidateSize();
      loadHotspots();
    }, 180);
  }
  if (window.KarhutlaLaporanStore) {
    KarhutlaLaporanStore.hydrate().then(startMap).catch(startMap);
  } else {
    startMap();
  }
  setInterval(function () {
    if (selectedDay === "today") loadHotspots();
  }, 5 * 60 * 1000);
})();
