// Shared helpers for pulling live SiPongi hotspot data and merging it with
// the verified case/report data (kasus-data.js + laporan-data.js). Mirrors
// the exact logic hotspot-map.js uses on /hotspot.html so every page that
// includes this file agrees on the same numbers.
window.KarhutlaData = (function () {
  const SIPONGI_UPSTREAM = [
    "https://opsroom-sipongi.gakkum.kehutanan.go.id/api/opsroom/indoHotspot",
    "https://opsroom.sipongidata.my.id/api/opsroom/indoHotspot"
  ];
  const PROVINSI_KALTIM = "14";
  const MATCH_KM = 3;

  function isStaticLocal() {
    const host = location.hostname;
    return !host || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }

  function sipongiEndpoints() {
    return isStaticLocal() ? SIPONGI_UPSTREAM.slice() : ["/api/sipongi"];
  }

  function todayKey() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
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

  function formatDate(key) {
    const d = new Date(key + "T00:00:00");
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
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

  function mapLaporan(rep, index) {
    const op = (rep && rep.operasi_karhutla) || {};
    const place = splitLokasi(op.lokasi_pemadaman);
    const xy = parseCoord(op.titik_koordinat_pemadaman);
    return {
      used: false,
      tanggal: dayKey(op.tanggal),
      site: place.site,
      lokasi: place.lokasi,
      lat: xy.lat,
      lng: xy.lng,
      index: index,
      eksternal: typeof op.eksternal === "boolean" ? op.eksternal : null
    };
  }

  function mergeCases(records, reports) {
    const laps = (reports || []).map(mapLaporan);
    const out = [];
    (records || []).forEach(function (rec) {
      const lat = Number(rec.latitude);
      const lng = Number(rec.longitude);
      const key = dayKey(rec.tanggal);
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
      out.push({
        tanggal: key,
        eksternal: (best && best.used && typeof best.eksternal === "boolean")
          ? best.eksternal
          : isEksternal(rec, lat, lng)
      });
    });
    laps.forEach(function (lap) {
      if (lap.used) return;
      out.push({
        tanggal: lap.tanggal,
        eksternal: typeof lap.eksternal === "boolean"
          ? lap.eksternal
          : (hasCoord(lap) ? !insideIupk(lap.lat, lap.lng) : false)
      });
    });
    return out;
  }

  function loadMergedCases() {
    const recs = window.KARHUTLA_CASE_DATA && window.KARHUTLA_CASE_DATA.sheets && window.KARHUTLA_CASE_DATA.sheets[0]
      ? window.KARHUTLA_CASE_DATA.sheets[0].records
      : [];
    const reports = window.KARHUTLA_LAPORAN_DATA && window.KARHUTLA_LAPORAN_DATA.reports
      ? window.KARHUTLA_LAPORAN_DATA.reports
      : [];
    return mergeCases(recs, reports);
  }

  function buildQuery(from, to) {
    const custom = !!(from && to);
    const params = new URLSearchParams();
    params.set("wilayah", "IN");
    params.set("filterperiode", custom ? "true" : "false");
    params.set("from", custom ? from : "");
    params.set("to", custom ? to : "");
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

  function isBerauFeature(feature) {
    const p = (feature && feature.properties) || {};
    if (String(p.kabkota).toLowerCase() !== "berau") return false;
    const g = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : [p.long, p.lat];
    const lat = Number(p.lat != null ? p.lat : g[1]);
    const lng = Number(p.long != null ? p.long : g[0]);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  async function fetchFrom(base, from, to) {
    const join = base.indexOf("?") >= 0 ? "&" : "?";
    const res = await fetch(base + join + buildQuery(from, to), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.features)) throw new Error("Format data tidak dikenali");
    return json.features;
  }

  // Fetches SiPongi hotspots for a date range (or "last 24h" when from/to are
  // omitted) and returns only the Berau features, trying each mirror in turn.
  async function fetchSipongi(from, to) {
    const endpoints = sipongiEndpoints();
    for (let i = 0; i < endpoints.length; i += 1) {
      try {
        const features = await fetchFrom(endpoints[i], from, to);
        return features.filter(isBerauFeature);
      } catch (err) {
        /* try next endpoint */
      }
    }
    return null;
  }

  // Mirrors hotspot.html: default to the most recent day that has verified
  // case data (falling back to today when there is none), so pages agree on
  // which day's numbers are being shown.
  function pickActiveDay(cases) {
    const keys = Array.from(new Set(cases.map(function (c) { return c.tanggal; }).filter(Boolean))).sort();
    return keys.length ? keys[keys.length - 1] : todayKey();
  }

  return {
    todayKey: todayKey,
    dayKey: dayKey,
    formatDate: formatDate,
    hasCoord: hasCoord,
    mergeCases: mergeCases,
    loadMergedCases: loadMergedCases,
    fetchSipongi: fetchSipongi,
    pickActiveDay: pickActiveDay,
    insideIupk: insideIupk
  };
})();
