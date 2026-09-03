const BLOB_KEY = "karhutla/patroli-data.json";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function emptyStore() {
  return {
    source_file: "Form input patroli KARHUTLA",
    total_records: 0,
    records: []
  };
}

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function normalize(data) {
  if (!data || !Array.isArray(data.records)) data = emptyStore();
  data.source_file = data.source_file || "Form input patroli KARHUTLA";
  data.total_records = data.records.length;
  return data;
}

async function readStore() {
  if (!hasBlob()) return { persistent: false, data: emptyStore() };
  try {
    const { list, put } = require("@vercel/blob");
    const listed = await list({ prefix: "karhutla/patroli-data", limit: 20 });
    const hit = (listed.blobs || []).find(function (blob) {
      return blob.pathname === BLOB_KEY || blob.pathname.indexOf("karhutla/patroli-data") === 0;
    });
    if (hit && hit.url) {
      const res = await fetch(hit.url, { cache: "no-store" });
      if (res.ok) {
        const data = normalize(await res.json());
        return { persistent: true, data: data };
      }
    }
    const seed = emptyStore();
    await put(BLOB_KEY, JSON.stringify(seed), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });
    return { persistent: true, data: seed };
  } catch (err) {
    return { persistent: false, data: emptyStore() };
  }
}

async function writeStore(data) {
  const { put } = require("@vercel/blob");
  const saved = normalize(data);
  await put(BLOB_KEY, JSON.stringify(saved), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  return saved;
}

function sortRecords(records) {
  return records.slice().sort(function (a, b) {
    const ka = String((a && a.tanggal) || "") + " " + String((a && a.waktu) || "");
    const kb = String((b && b.tanggal) || "") + " " + String((b && b.waktu) || "");
    return ka.localeCompare(kb);
  });
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

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    send(res, 204, { ok: true });
    return;
  }

  try {
    if (req.method === "GET") {
      const store = await readStore();
      send(res, 200, {
        ok: true,
        persistent: store.persistent,
        data: store.data
      });
      return;
    }

    if (req.method !== "POST") {
      send(res, 405, { ok: false, error: "Metode tidak didukung." });
      return;
    }

    if (!hasBlob()) {
      send(res, 503, {
        ok: false,
        persistent: false,
        error: "Vercel Blob belum dihubungkan. Data disimpan di browser."
      });
      return;
    }

    const payload = await readBody(req);
    const action = payload && payload.action ? String(payload.action) : "replace";

    if (action === "replace") {
      const incoming = payload.data;
      if (!incoming || !Array.isArray(incoming.records)) {
        send(res, 400, { ok: false, error: "Data patroli tidak valid." });
        return;
      }
      incoming.records = sortRecords(incoming.records);
      const saved = await writeStore(incoming);
      send(res, 200, {
        ok: true,
        persistent: true,
        total_records: saved.total_records,
        data: saved
      });
      return;
    }

    send(res, 400, { ok: false, error: "Aksi tidak dikenali." });
  } catch (err) {
    send(res, 503, {
      ok: false,
      persistent: false,
      error: err && err.message ? err.message : "Gagal memproses patroli."
    });
  }
};
