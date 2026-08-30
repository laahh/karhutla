function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  return {
    signal: ctrl.signal,
    done: function () { clearTimeout(timer); }
  };
}

function titleCase(value) {
  return String(value || "").replace(/\w+/g, function (word) {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function toNum(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeRows(rows) {
  return (rows || []).map(function (row) {
    if (!row || !row.id_stasiun) return null;
    if (row.is_maintenance) return null;
    if (String(row.stasiun_show) === "0") return null;
    const cat = row.cat || (row.kategori && row.kategori.nilai) || "";
    return {
      id: "klhk:" + row.id_stasiun,
      agency: "KLHK",
      name: row.nama || row.id_stasiun,
      city: row.kota || "",
      province: row.provinsi || "",
      pm25: toNum(row.a_pm25),
      pm10: toNum(row.a_pm10),
      ispu: toNum(row.val != null && row.val !== "" ? row.val : row.t_pm25),
      category: cat ? titleCase(cat) : "",
      time: row.waktu || "",
      lat: toNum(row.lat),
      lon: toNum(row.lon)
    };
  }).filter(Boolean);
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

  const wait = abortAfter(14000);
  try {
    const upstream = await fetch("https://ispu.kemenlh.go.id/apimobile/v1/getStations", {
      headers: {
        Accept: "application/json",
        "User-Agent": "KarhutlaCommandCenter/1.0"
      },
      signal: wait.signal,
      redirect: "follow"
    });
    wait.done();
    if (!upstream.ok) {
      send(res, 502, { ok: false, stations: [], error: "KLHK HTTP " + upstream.status });
      return;
    }
    const data = await upstream.json();
    const stations = normalizeRows(data && data.rows);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=180");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({
      ok: stations.length > 0,
      fetched_at: new Date().toISOString(),
      stations: stations,
      counts: { bmkg: 0, klhk: stations.length }
    }));
  } catch (err) {
    wait.done();
    send(res, 502, {
      ok: false,
      stations: [],
      error: err && err.message ? err.message : "Gagal memuat stasiun ISPU."
    });
  }
};
