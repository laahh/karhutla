const fs = require("fs");
const path = require("path");

const BLOB_KEY = "karhutla/laporan-data.json";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function parseSeed() {
  const fallback = {
    source_file: "Form input laporan KARHUTLA",
    total_reports: 0,
    reports: []
  };
  try {
    const candidates = [
      path.join(process.cwd(), "laporan-data.js"),
      path.join(__dirname, "..", "laporan-data.js")
    ];
    let raw = "";
    for (let i = 0; i < candidates.length; i += 1) {
      try {
        raw = fs.readFileSync(candidates[i], "utf8");
        break;
      } catch (err) {
        raw = "";
      }
    }
    if (!raw) return fallback;
    raw = raw.replace(/^\uFEFF/, "");
    raw = raw.replace(/^window\.KARHUTLA_LAPORAN_DATA\s*=\s*/, "");
    raw = raw.trim();
    if (raw.slice(-1) === ";") raw = raw.slice(0, -1);
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.reports)) return fallback;
    data.total_reports = data.reports.length;
    return data;
  } catch (err) {
    return fallback;
  }
}

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function readStore() {
  if (!hasBlob()) return { persistent: false, data: parseSeed() };
  const { list, put } = require("@vercel/blob");
  const listed = await list({ prefix: "karhutla/laporan-data", limit: 20 });
  const hit = (listed.blobs || []).find(function (blob) {
    return blob.pathname === BLOB_KEY || blob.pathname.indexOf("karhutla/laporan-data") === 0;
  });
  if (hit && hit.url) {
    const res = await fetch(hit.url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.reports)) {
        data.total_reports = data.reports.length;
        return { persistent: true, data: data };
      }
    }
  }
  const seed = parseSeed();
  await put(BLOB_KEY, JSON.stringify(seed), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  return { persistent: true, data: seed };
}

async function writeStore(data) {
  const { put } = require("@vercel/blob");
  data.total_reports = Array.isArray(data.reports) ? data.reports.length : 0;
  await put(BLOB_KEY, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  return data;
}

function sortReports(reports) {
  return reports.slice().sort(function (a, b) {
    const ao = (a && a.operasi_karhutla) || {};
    const bo = (b && b.operasi_karhutla) || {};
    const ka = String(ao.tanggal || "") + " " + String(ao.mulai_operasi || "");
    const kb = String(bo.tanggal || "") + " " + String(bo.mulai_operasi || "");
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
    const action = payload && payload.action ? String(payload.action) : "save";

    if (action === "replace") {
      const incoming = payload.data;
      if (!incoming || !Array.isArray(incoming.reports)) {
        send(res, 400, { ok: false, error: "Data laporan tidak valid." });
        return;
      }
      incoming.reports = sortReports(incoming.reports);
      const saved = await writeStore(incoming);
      send(res, 200, {
        ok: true,
        persistent: true,
        index: payload.index != null ? parseInt(payload.index, 10) : -1,
        total_reports: saved.total_reports,
        data: saved
      });
      return;
    }

    const store = await readStore();
    const reports = (store.data.reports || []).slice();
    let index = payload && payload.index !== "" && payload.index != null
      ? parseInt(payload.index, 10) : -1;
    if (isNaN(index)) index = -1;
    let savedIndex = -1;

    if (action === "delete") {
      if (index < 0 || !reports[index]) {
        send(res, 400, { ok: false, error: "Laporan tidak ditemukan." });
        return;
      }
      reports.splice(index, 1);
    } else {
      const report = payload && payload.report;
      if (!report || !report.operasi_karhutla) {
        send(res, 400, { ok: false, error: "Data laporan tidak valid." });
        return;
      }
      if (index >= 0 && reports[index]) reports[index] = report;
      else reports.push(report);
      const sorted = sortReports(reports);
      savedIndex = sorted.indexOf(report);
      if (savedIndex < 0) {
        savedIndex = sorted.findIndex(function (row) {
          return JSON.stringify(row) === JSON.stringify(report);
        });
      }
      store.data.reports = sorted;
      const saved = await writeStore(store.data);
      send(res, 200, {
        ok: true,
        persistent: true,
        index: Math.max(0, savedIndex),
        total_reports: saved.total_reports,
        data: saved
      });
      return;
    }

    store.data.reports = reports;
    const saved = await writeStore(store.data);
    send(res, 200, {
      ok: true,
      persistent: true,
      index: -1,
      total_reports: saved.total_reports,
      data: saved
    });
  } catch (err) {
    send(res, 500, {
      ok: false,
      error: err && err.message ? err.message : "Gagal memproses laporan."
    });
  }
};
