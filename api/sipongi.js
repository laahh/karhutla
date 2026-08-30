const UPSTREAMS = [
  "https://opsroom-sipongi.gakkum.kehutanan.go.id/api/opsroom/indoHotspot",
  "https://opsroom.sipongidata.my.id/api/opsroom/indoHotspot"
];

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
  src.getAll("satelit[]").concat(src.getAll("satelit")).forEach(function (value) {
    if (/^[A-Za-z0-9._-]{3,40}$/.test(value)) out.append("satelit[]", value);
  });
  src.getAll("confidence[]").concat(src.getAll("confidence")).forEach(function (value) {
    if (/^(low|medium|high)$/.test(value)) out.append("confidence[]", value);
  });
  return out.toString();
}

function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  return {
    signal: ctrl.signal,
    done: function () { clearTimeout(timer); }
  };
}

async function fetchUpstream(qs) {
  let lastErr = null;
  for (let i = 0; i < UPSTREAMS.length; i += 1) {
    const wait = abortAfter(12000);
    try {
      const res = await fetch(UPSTREAMS[i] + "?" + qs, {
        headers: {
          Accept: "application/json",
          "User-Agent": "KarhutlaCommandCenter/1.0"
        },
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
      lastErr = err;
    }
  }
  throw lastErr || new Error("SiPongi tidak merespons.");
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
  try {
    const json = await fetchUpstream(allowedQuery(rawQuery(req)));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(json));
  } catch (err) {
    send(res, 502, {
      ok: false,
      error: err && err.message ? err.message : "Gagal memuat SiPongi."
    });
  }
};
