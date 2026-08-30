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

function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  return {
    signal: ctrl.signal,
    done: function () { clearTimeout(timer); }
  };
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

  const params = new URLSearchParams(rawQuery(req));
  const lat = Number(params.get("latitude"));
  const lon = Number(params.get("longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    send(res, 400, { ok: false, error: "Koordinat tidak valid." });
    return;
  }
  const current = String(params.get("current") || "us_aqi,pm2_5,pm10");
  if (!/^[a-z0-9_,]+$/i.test(current) || current.length > 80) {
    send(res, 400, { ok: false, error: "Parameter current tidak valid." });
    return;
  }

  const url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    + "?latitude=" + encodeURIComponent(String(lat))
    + "&longitude=" + encodeURIComponent(String(lon))
    + "&current=" + encodeURIComponent(current)
    + "&timezone=auto";

  const wait = abortAfter(12000);
  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "KarhutlaCommandCenter/1.0"
      },
      signal: wait.signal,
      redirect: "follow"
    });
    wait.done();
    if (!upstream.ok) {
      send(res, 502, { ok: false, error: "Open-Meteo HTTP " + upstream.status });
      return;
    }
    const json = await upstream.json();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=180");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(json));
  } catch (err) {
    wait.done();
    send(res, 502, {
      ok: false,
      error: err && err.message ? err.message : "Gagal memuat kualitas udara."
    });
  }
};
