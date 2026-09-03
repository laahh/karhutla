const UPSTREAMS = [
  "https://opsroom-sipongi.gakkum.kehutanan.go.id/api/opsroom/indoHotspot",
  "https://mirror-opsroom.sipongidata.my.id/api/opsroom/indoHotspot",
  "https://opsroom.sipongidata.my.id/api/opsroom/indoHotspot"
];

const FIRMS_CSV = [
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_7d.csv",
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_7d.csv",
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_7d.csv"
];

const DEFAULT_SATS = ["NASA-MODIS", "NASA-SNPP", "NASA-NOAA20"];
const DEFAULT_CONF = ["low", "medium", "high"];
const BERAU = { latMin: 1.0, latMax: 2.75, lngMin: 116.0, lngMax: 119.1 };

const FETCH_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://sipongi.gakkum.kehutanan.go.id/peta",
  Origin: "https://sipongi.gakkum.kehutanan.go.id"
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function rawQuery(req) {
  const url = String(req.url || "");
  const i = url.indexOf("?");
  return i >= 0 ? url.slice(i + 1) : "";
}

function allowedQuery(raw) {
  const src = new URLSearchParams(raw);
  const out = new URLSearchParams();
  ["wilayah", "filterperiode", "from", "to", "late", "provinsi", "kabkota"].forEach(function (key) {
    if (!src.has(key)) return;
    const value = String(src.get(key) || "");
    if (key === "from" || key === "to") {
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    }
    out.set(key, value);
  });
  if (!out.get("wilayah")) out.set("wilayah", "IN");
  src.getAll("satelit[]").concat(src.getAll("satelit")).forEach(function (value) {
    if (/^[A-Za-z0-9._-]{3,40}$/.test(value)) out.append("satelit[]", value);
  });
  src.getAll("confidence[]").concat(src.getAll("confidence")).forEach(function (value) {
    if (/^(low|medium|high)$/.test(value)) out.append("confidence[]", value);
  });
  if (!out.getAll("satelit[]").length) {
    DEFAULT_SATS.forEach(function (value) { out.append("satelit[]", value); });
  }
  if (!out.getAll("confidence[]").length) {
    DEFAULT_CONF.forEach(function (value) { out.append("confidence[]", value); });
  }
  return out;
}

function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  return {
    signal: ctrl.signal,
    done: function () { clearTimeout(timer); }
  };
}

async function fetchJson(url, ms) {
  const wait = abortAfter(ms);
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: wait.signal,
      redirect: "follow"
    });
    wait.done();
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.features)) throw new Error("Format data tidak dikenali");
    return json;
  } catch (err) {
    wait.done();
    throw err;
  }
}

async function fetchText(url, ms) {
  const wait = abortAfter(ms);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/csv,text/plain,*/*",
        "User-Agent": FETCH_HEADERS["User-Agent"]
      },
      signal: wait.signal,
      redirect: "follow"
    });
    wait.done();
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } catch (err) {
    wait.done();
    throw err;
  }
}

async function fetchSipongi(qs) {
  const query = qs.toString();
  const tasks = UPSTREAMS.map(function (base) {
    return fetchJson(base + "?" + query, 8000);
  });
  try {
    return await Promise.any(tasks);
  } catch (err) {
    throw new Error("SiPongi tidak merespons.");
  }
}

function satName(raw) {
  const s = String(raw || "").toUpperCase();
  if (s === "T" || s === "A" || s === "TERRA" || s === "AQUA") return "NASA-MODIS";
  if (s === "N20" || s === "1" || s === "NOAA-20" || s === "NOAA20") return "NASA-NOAA20";
  if (s === "N21" || s === "NOAA-21" || s === "NOAA21") return "NASA-NOAA21";
  return "NASA-SNPP";
}

function confLevel(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "high" || s === "h") return "high";
  if (s === "low" || s === "l") return "low";
  return "medium";
}

function firmsToGeoJSON(text, from, to) {
  const lines = String(text || "").split(/\r?\n/);
  if (lines.length < 2) return { type: "FeatureCollection", features: [] };
  const header = lines[0].split(",").map(function (h) { return h.trim(); });
  const idx = {};
  header.forEach(function (h, i) { idx[h] = i; });
  const features = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",");
    if (cols.length < 8) continue;
    const lat = Number(cols[idx.latitude]);
    const lng = Number(cols[idx.longitude]);
    const date = String(cols[idx.acq_date] || "");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (from && date && date < from) continue;
    if (to && date && date > to) continue;
    if (lat < BERAU.latMin || lat > BERAU.latMax || lng < BERAU.lngMin || lng > BERAU.lngMax) continue;
    const time = String(cols[idx.acq_time] || "").padStart(4, "0");
    const hh = time.slice(0, 2);
    const mm = time.slice(2, 4);
    const iso = date + "T" + hh + ":" + mm + ":00Z";
    const sumber = satName(cols[idx.satellite]);
    const level = confLevel(cols[idx.confidence]);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        lat: lat,
        long: lng,
        kabkota: "Berau",
        desa: "",
        kecamatan: "",
        kawasan: "",
        sumber: sumber,
        confidence: cols[idx.confidence],
        confidence_level: level,
        date_hotspot_ori: iso,
        date_hotspot: date + " " + hh + ":" + mm
      }
    });
  }
  return { type: "FeatureCollection", features: features };
}

async function fetchFirms(from, to) {
  const parts = await Promise.all(FIRMS_CSV.map(function (url) {
    return fetchText(url, 9000).catch(function () { return ""; });
  }));
  const merged = { type: "FeatureCollection", features: [] };
  parts.forEach(function (text) {
    if (!text) return;
    const json = firmsToGeoJSON(text, from, to);
    merged.features = merged.features.concat(json.features);
  });
  return merged;
}

function sendGeo(res, json) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(json));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, { ok: true });
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { ok: false, error: "Metode tidak didukung." });
    return;
  }
  const qs = allowedQuery(rawQuery(req));
  const from = qs.get("from") || "";
  const to = qs.get("to") || "";
  const firmsTask = fetchFirms(from, to);
  try {
    const json = await fetchSipongi(qs);
    sendGeo(res, json);
  } catch (err) {
    try {
      const json = await firmsTask;
      sendGeo(res, json);
    } catch (fallbackErr) {
      send(res, 200, { type: "FeatureCollection", features: [] });
    }
  }
};
