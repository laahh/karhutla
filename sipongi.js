(function () {
  const fromEl = document.getElementById("sp-from");
  const toEl = document.getElementById("sp-to");
  const searchEl = document.getElementById("sp-search");
  const bodyEl = document.getElementById("sp-body");
  const countEl = document.getElementById("sp-count");
  const statusEl = document.getElementById("sp-status");
  const reloadBtn = document.getElementById("sp-reload");
  const downloadBtn = document.getElementById("sp-download");
  const konsesiEl = document.getElementById("sp-konsesi");
  const KD = window.KarhutlaData;

  let rows = [];
  let loading = false;
  let loadSeq = 0;

  function todayKey() {
    return KD && KD.todayKey ? KD.todayKey() : isoDate(new Date());
  }

  function isoDate(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function addDays(key, delta) {
    const d = new Date(key + "T00:00:00");
    d.setDate(d.getDate() + delta);
    return isoDate(d);
  }

  function buildDateRange(from, to) {
    const keys = [];
    const cursor = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return keys;
    while (cursor <= end) {
      keys.push(isoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
      if (keys.length > 31) break;
    }
    return keys;
  }

  function formatDateId(key) {
    if (!key) return "—";
    if (KD && KD.formatDate) return KD.formatDate(key);
    const d = new Date(key + "T00:00:00");
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  function sipongiTime(p) {
    const iso = p.date_hotspot_ori || p.hs_id || "";
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime()) && iso) {
      const dateKey = d.toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
      const timeLabel = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Makassar"
      });
      return { dateKey: dateKey, timeLabel: timeLabel + " WITA" };
    }
    const raw = String(p.date_hotspot || "").trim();
    const m = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
    return { dateKey: "", timeLabel: m ? m[1] + " WITA" : "—" };
  }

  function konsesiOf(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    if (!KD || typeof KD.insideIupk !== "function") return "";
    return KD.insideIupk(lat, lng) ? "Dalam konsesi" : "Luar konsesi";
  }

  function mapRow(feature) {
    const p = feature.properties || {};
    const g = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : [p.long, p.lat];
    const when = sipongiTime(p);
    const lat = Number(p.lat != null ? p.lat : g[1]);
    const lng = Number(p.long != null ? p.long : g[0]);
    const conf = String(p.confidence_level || "").toLowerCase();
    return {
      tanggal: when.dateKey || (KD && KD.dayKey ? KD.dayKey(p.date_hotspot_ori || p.date_hotspot) : ""),
      jam: when.timeLabel,
      desa: p.desa || "—",
      kecamatan: p.kecamatan || "—",
      kabupaten: p.kabkota || "—",
      satelit: p.sumber || "—",
      confidence: conf || "—",
      confidencePct: p.confidence != null ? Number(p.confidence) : "",
      lat: Number.isFinite(lat) ? lat : "",
      lng: Number.isFinite(lng) ? lng : "",
      kawasan: p.kawasan || "—",
      konsesi: konsesiOf(lat, lng)
    };
  }

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-ok", "is-err");
    if (kind) statusEl.classList.add(kind);
  }

  function visibleRows() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const scope = konsesiEl ? konsesiEl.value : "semua";
    return rows.filter(function (row) {
      if (scope === "dalam" && row.konsesi !== "Dalam konsesi") return false;
      if (scope === "luar" && row.konsesi !== "Luar konsesi") return false;
      if (!q) return true;
      return [
        row.tanggal, row.jam, row.desa, row.kecamatan, row.kabupaten,
        row.satelit, row.confidence, row.kawasan, row.konsesi, row.lat, row.lng
      ].join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function confClass(level) {
    if (level === "high") return "sp-conf sp-conf-high";
    if (level === "medium") return "sp-conf sp-conf-medium";
    if (level === "low") return "sp-conf sp-conf-low";
    return "sp-conf";
  }

  function confLabel(level) {
    if (level === "high") return "High";
    if (level === "medium") return "Medium";
    if (level === "low") return "Low";
    return level || "—";
  }

  function esc(s) {
    return String(s == null || s === "" ? "—" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderTable() {
    const list = visibleRows();
    countEl.textContent = list.length + " titik";
    if (!list.length) {
      bodyEl.innerHTML = '<tr><td class="sp-empty" colspan="12">' +
        (rows.length ? "Tidak ada titik yang cocok." : "Belum ada data. Pilih tanggal lalu klik Muat data.") +
        "</td></tr>";
      return;
    }
    bodyEl.innerHTML = list.map(function (row, i) {
      return "<tr>" +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + esc(formatDateId(row.tanggal)) + "</td>" +
        "<td>" + esc(row.jam) + "</td>" +
        "<td>" + esc(row.desa) + "</td>" +
        "<td>" + esc(row.kecamatan) + "</td>" +
        "<td>" + esc(row.kabupaten) + "</td>" +
        "<td>" + esc(row.satelit) + "</td>" +
        '<td><span class="' + confClass(row.confidence) + '">' + esc(confLabel(row.confidence)) + "</span></td>" +
        "<td>" + (row.lat === "" ? "—" : Number(row.lat).toFixed(5)) + "</td>" +
        "<td>" + (row.lng === "" ? "—" : Number(row.lng).toFixed(5)) + "</td>" +
        "<td>" + esc(row.kawasan) + "</td>" +
        '<td><span class="sp-conf ' + (row.konsesi === "Dalam konsesi" ? "sp-konsesi-dalam" : row.konsesi === "Luar konsesi" ? "sp-konsesi-luar" : "") + '">' +
          esc(row.konsesi || "—") + "</span></td>" +
        "</tr>";
    }).join("");
  }

  function dedupe(list) {
    const seen = {};
    const out = [];
    list.forEach(function (row) {
      const key = [row.tanggal, row.jam, row.lat, row.lng, row.satelit, row.desa].join("|");
      if (seen[key]) return;
      seen[key] = true;
      out.push(row);
    });
    out.sort(function (a, b) {
      const ka = String(a.tanggal || "") + " " + String(a.jam || "");
      const kb = String(b.tanggal || "") + " " + String(b.jam || "");
      return kb.localeCompare(ka);
    });
    return out;
  }

  async function loadData() {
    if (!KD || typeof KD.fetchSipongi !== "function") {
      setStatus("Modul data SiPongi belum termuat.", "is-err");
      return;
    }
    const from = fromEl.value;
    const to = toEl.value;
    if (!from || !to) {
      setStatus("Isi tanggal dari dan sampai.", "is-err");
      return;
    }
    if (from > to) {
      setStatus("Tanggal awal tidak boleh lebih besar dari tanggal akhir.", "is-err");
      return;
    }
    const keys = buildDateRange(from, to);
    if (!keys.length) {
      setStatus("Rentang tanggal tidak valid.", "is-err");
      return;
    }

    const seq = ++loadSeq;
    loading = true;
    reloadBtn.disabled = true;
    downloadBtn.disabled = true;
    setStatus("Memuat " + keys.length + " hari dari SiPongi…");

    try {
      const collected = [];
      let failedDays = 0;
      for (let i = 0; i < keys.length; i += 3) {
        if (seq !== loadSeq) return;
        const slice = keys.slice(i, i + 3);
        const part = await Promise.all(slice.map(function (key) {
          return KD.fetchSipongi(key, key);
        }));
        part.forEach(function (features) {
          if (!features) {
            failedDays += 1;
            return;
          }
          features.forEach(function (feature) {
            collected.push(mapRow(feature));
          });
        });
        setStatus("Memuat " + Math.min(i + 3, keys.length) + " / " + keys.length + " hari…");
      }
      if (seq !== loadSeq) return;
      rows = dedupe(collected);
      renderTable();
      const dalam = rows.filter(function (row) { return row.konsesi === "Dalam konsesi"; }).length;
      const luar = rows.filter(function (row) { return row.konsesi === "Luar konsesi"; }).length;
      if (!rows.length) {
        setStatus(failedDays === keys.length
          ? "SiPongi belum termuat. Periksa koneksi lalu coba lagi."
          : "Tidak ada hotspot Berau pada rentang ini.", failedDays === keys.length ? "is-err" : "");
      } else {
        setStatus(
          "Berau · " + formatDateId(from) + " – " + formatDateId(to) + " · " + rows.length + " titik · " +
          dalam + " dalam konsesi · " + luar + " luar konsesi" +
          (failedDays ? " · " + failedDays + " hari gagal dimuat" : "") + ".",
          "is-ok"
        );
      }
    } catch (err) {
      if (seq !== loadSeq) return;
      setStatus(err.message || "Gagal memuat SiPongi.", "is-err");
    } finally {
      if (seq !== loadSeq) return;
      loading = false;
      reloadBtn.disabled = false;
      downloadBtn.disabled = false;
    }
  }

  function excelHeaders() {
    return [
      "No", "Tanggal", "Jam", "Desa", "Kecamatan", "Kabupaten",
      "Satelit", "Confidence", "Latitude", "Longitude", "Kawasan", "Konsesi"
    ];
  }

  function excelRow(row, no) {
    return [
      no,
      formatDateId(row.tanggal),
      row.jam,
      row.desa,
      row.kecamatan,
      row.kabupaten,
      row.satelit,
      confLabel(row.confidence),
      row.lat === "" ? "" : Number(row.lat),
      row.lng === "" ? "" : Number(row.lng),
      row.kawasan,
      row.konsesi || ""
    ];
  }

  function downloadExcel() {
    try {
      if (typeof XLSX === "undefined" || !XLSX.utils) {
        throw new Error("Pustaka Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
      }
      const list = visibleRows();
      if (!list.length) {
        setStatus("Belum ada data untuk diunduh.", "is-err");
        return;
      }
      const sheet = [excelHeaders()];
      list.forEach(function (row, i) {
        sheet.push(excelRow(row, i + 1));
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(sheet);
      ws["!cols"] = [5, 18, 14, 22, 18, 14, 16, 12, 12, 12, 28, 16].map(function (w) {
        return { wch: w };
      });
      XLSX.utils.book_append_sheet(wb, ws, "SiPongi Berau");
      const from = fromEl.value || todayKey();
      const to = toEl.value || from;
      XLSX.writeFile(wb, "SiPongi Berau " + from + " - " + to + ".xlsx");
      setStatus("Excel " + list.length + " titik berhasil diunduh.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal mengunduh Excel.", "is-err");
    }
  }

  function setRange(days) {
    const end = todayKey();
    const start = days <= 1 ? end : addDays(end, -(days - 1));
    fromEl.value = start;
    toEl.value = end;
    document.querySelectorAll(".sp-range").forEach(function (btn) {
      btn.classList.toggle("is-on", Number(btn.getAttribute("data-range")) === days);
    });
  }

  document.querySelectorAll(".sp-range").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setRange(Number(btn.getAttribute("data-range")) || 7);
      loadData();
    });
  });

  fromEl.addEventListener("change", function () {
    document.querySelectorAll(".sp-range").forEach(function (btn) { btn.classList.remove("is-on"); });
  });
  toEl.addEventListener("change", function () {
    document.querySelectorAll(".sp-range").forEach(function (btn) { btn.classList.remove("is-on"); });
  });
  searchEl.addEventListener("input", renderTable);
  if (konsesiEl) konsesiEl.addEventListener("change", renderTable);
  reloadBtn.addEventListener("click", loadData);
  downloadBtn.addEventListener("click", downloadExcel);
  document.getElementById("sp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    loadData();
  });

  setRange(7);
  loadData();
})();
