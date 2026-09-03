function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      resolve(req.body);
      return;
    }
    if (typeof req.body === "string") {
      try {
        resolve(JSON.parse(req.body || "{}"));
      } catch (err) {
        reject(err);
      }
      return;
    }
    let raw = "";
    req.on("data", function (chunk) { raw += chunk; });
    req.on("end", function () {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function safeName(name) {
  const base = String(name || "foto.jpg").split(/[/\\]/).pop();
  const match = base.match(/^[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i);
  if (match) return match[0].replace(/\.jpeg$/i, ".jpg");
  return Date.now().toString(36) + ".jpg";
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, { ok: true });
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "Gunakan POST." });
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    send(res, 503, {
      ok: false,
      persistent: false,
      error: "Vercel Blob belum dihubungkan."
    });
    return;
  }

  try {
    const payload = await readBody(req);
    const data = String(payload && payload.data || "");
    if (!data) {
      send(res, 400, { ok: false, error: "Foto kosong." });
      return;
    }
    const buf = Buffer.from(data, "base64");
    if (!buf.length || buf.length > 4.2 * 1024 * 1024) {
      send(res, 400, { ok: false, error: "Ukuran foto terlalu besar. Kompres dulu atau pilih file lebih kecil." });
      return;
    }
    const name = safeName(payload.name);
    const type = String(payload.type || "image/jpeg");
    const { put } = require("@vercel/blob");
    const blob = await put("laporan-foto/" + name, buf, {
      access: "public",
      addRandomSuffix: true,
      contentType: type.indexOf("image/") === 0 ? type : "image/jpeg"
    });
    send(res, 200, { ok: true, url: blob.url, pathname: blob.pathname });
  } catch (err) {
    send(res, 503, {
      ok: false,
      persistent: false,
      error: err && err.message ? err.message : "Gagal mengunggah foto."
    });
  }
};
