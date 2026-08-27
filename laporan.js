(function () {
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const form = document.getElementById("lp-form");
  const listEl = document.getElementById("lp-list");
  const searchEl = document.getElementById("lp-search");
  const countEl = document.getElementById("lp-count");
  const statusEl = document.getElementById("lp-status");
  const titleEl = document.getElementById("lp-form-title");
  const hintEl = document.getElementById("lp-form-hint");
  const saveBtn = document.getElementById("lp-save");
  const fields = {
    index: document.getElementById("f-index"),
    sheet: document.getElementById("f-sheet"),
    tanggal: document.getElementById("f-tanggal"),
    titikApi: document.getElementById("f-titik-api"),
    mulai: document.getElementById("f-mulai"),
    selesai: document.getElementById("f-selesai"),
    lokasi: document.getElementById("f-lokasi"),
    koordinat: document.getElementById("f-koordinat"),
    timBc: document.getElementById("f-tim-bc"),
    timVol: document.getElementById("f-tim-vol"),
    timUnit: document.getElementById("f-tim-unit"),
    timAlat: document.getElementById("f-tim-alat"),
    timKonsumsi: document.getElementById("f-tim-konsumsi"),
    plusTim: document.getElementById("f-plus-tim"),
    plusUnit: document.getElementById("f-plus-unit"),
    plusAlat: document.getElementById("f-plus-alat"),
    plusKonsumsi: document.getElementById("f-plus-konsumsi"),
    minusTim: document.getElementById("f-minus-tim"),
    minusUnit: document.getElementById("f-minus-unit"),
    minusAlat: document.getElementById("f-minus-alat"),
    minusKonsumsi: document.getElementById("f-minus-konsumsi"),
    rencana: document.getElementById("f-rencana"),
    gambar: document.getElementById("f-gambar"),
    catatan: document.getElementById("f-catatan")
  };

  let activeIndex = -1;

  function dataStore() {
    if (!window.KARHUTLA_LAPORAN_DATA || !Array.isArray(window.KARHUTLA_LAPORAN_DATA.reports)) {
      window.KARHUTLA_LAPORAN_DATA = {
        source_file: "Form input laporan KARHUTLA",
        total_reports: 0,
        reports: []
      };
    }
    return window.KARHUTLA_LAPORAN_DATA;
  }

  function reports() {
    return dataStore().reports;
  }

  function text(value) {
    return value == null ? "" : String(value);
  }

  function dayKey(iso) {
    if (!iso) return "";
    const raw = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return "";
  }

  function timeValue(raw) {
    const m = String(raw || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    return String(m[1]).padStart(2, "0") + ":" + m[2];
  }

  function withWita(value) {
    if (!value) return null;
    return value + " WITA";
  }

  function emptyToNull(value) {
    const t = String(value || "").trim();
    return t === "" ? null : t;
  }

  function formatDateId(key) {
    if (!key) return "—";
    const parts = key.split("-");
    if (parts.length !== 3) return key;
    const month = MONTHS[Number(parts[1]) - 1] || parts[1];
    return Number(parts[2]) + " " + month + " " + parts[0];
  }

  function nextSheetLetter(dateKey, excludeIndex) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let count = 0;
    reports().forEach(function (rep, i) {
      if (i === excludeIndex) return;
      const op = (rep && rep.operasi_karhutla) || {};
      if (dayKey(op.tanggal) === dateKey) count += 1;
    });
    if (count === 0) return "";
    return letters.charAt(Math.min(count, letters.length - 1));
  }

  function suggestSheetName(dateKey, excludeIndex) {
    if (!dateKey) return "";
    const parts = dateKey.split("-");
    const day = String(Number(parts[2]));
    const month = MONTHS[Number(parts[1]) - 1] || "";
    const year = parts[0];
    const letter = nextSheetLetter(dateKey, excludeIndex);
    return day + letter + " " + month + " " + year;
  }

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-ok", "is-err");
    if (kind) statusEl.classList.add(kind);
  }

  function fillForm(rep, index) {
    const op = (rep && rep.operasi_karhutla) || {};
    const tim = op.jumlah_tim || {};
    const evalRep = (rep && rep.evaluasi) || {};
    const plus = evalRep.kelebihan || {};
    const minus = evalRep.kekurangan || {};
    const docs = (rep && rep.dokumentasi) || {};

    fields.index.value = index >= 0 ? String(index) : "";
    fields.sheet.value = text(rep && rep.sheet_name);
    fields.tanggal.value = dayKey(op.tanggal);
    fields.titikApi.value = text(op.jumlah_titik_api_yang_dipadamkan);
    fields.mulai.value = timeValue(op.mulai_operasi);
    fields.selesai.value = timeValue(op.selesai_operasi);
    fields.lokasi.value = text(op.lokasi_pemadaman);
    fields.koordinat.value = text(op.titik_koordinat_pemadaman);
    fields.timBc.value = text(tim.berau_coal);
    fields.timVol.value = text(tim.volunteer);
    fields.timUnit.value = text(tim.unit_support);
    fields.timAlat.value = text(tim.peralatan_yang_digunakan);
    fields.timKonsumsi.value = text(tim.konsumsi);
    fields.plusTim.value = text(plus.jumlah_tim);
    fields.plusUnit.value = text(plus.unit_support);
    fields.plusAlat.value = text(plus.peralatan);
    fields.plusKonsumsi.value = text(plus.konsumsi);
    fields.minusTim.value = text(minus.jumlah_tim);
    fields.minusUnit.value = text(minus.unit_support);
    fields.minusAlat.value = text(minus.peralatan_yang_digunakan);
    fields.minusKonsumsi.value = text(minus.konsumsi);
    fields.rencana.value = text(rep && rep.rencana_kegiatan_besok);
    fields.gambar.value = docs.jumlah_gambar_tertanam != null ? docs.jumlah_gambar_tertanam : 0;
    fields.catatan.value = text(docs.catatan) || "Gambar tertanam tidak dienkode ke dalam JSON.";

    activeIndex = index;
    if (index >= 0) {
      titleEl.textContent = "Ubah laporan";
      hintEl.textContent = "Mengubah data yang sudah tersimpan di laporan-data.js.";
    } else {
      titleEl.textContent = "Laporan baru";
      hintEl.textContent = "Lengkapi data operasi. Kolom bertanda * wajib diisi.";
    }
    renderList();
  }

  function resetForm() {
    form.reset();
    fields.index.value = "";
    fields.gambar.value = "0";
    fields.catatan.value = "Gambar tertanam tidak dienkode ke dalam JSON.";
    fillForm(null, -1);
    setStatus("");
  }

  function readForm() {
    const tanggal = fields.tanggal.value;
    const sheetManual = emptyToNull(fields.sheet.value);
    return {
      sheet_name: sheetManual || suggestSheetName(tanggal, activeIndex),
      operasi_karhutla: {
        tanggal: tanggal ? tanggal + "T00:00:00" : null,
        mulai_operasi: withWita(fields.mulai.value),
        selesai_operasi: withWita(fields.selesai.value),
        lokasi_pemadaman: emptyToNull(fields.lokasi.value),
        titik_koordinat_pemadaman: emptyToNull(fields.koordinat.value),
        jumlah_tim: {
          berau_coal: emptyToNull(fields.timBc.value),
          volunteer: emptyToNull(fields.timVol.value),
          unit_support: emptyToNull(fields.timUnit.value),
          peralatan_yang_digunakan: emptyToNull(fields.timAlat.value),
          konsumsi: emptyToNull(fields.timKonsumsi.value)
        },
        jumlah_titik_api_yang_dipadamkan: emptyToNull(fields.titikApi.value)
      },
      evaluasi: {
        kelebihan: {
          jumlah_tim: emptyToNull(fields.plusTim.value),
          unit_support: emptyToNull(fields.plusUnit.value),
          peralatan: emptyToNull(fields.plusAlat.value),
          konsumsi: emptyToNull(fields.plusKonsumsi.value)
        },
        kekurangan: {
          jumlah_tim: emptyToNull(fields.minusTim.value),
          unit_support: emptyToNull(fields.minusUnit.value),
          peralatan_yang_digunakan: emptyToNull(fields.minusAlat.value),
          konsumsi: emptyToNull(fields.minusKonsumsi.value)
        }
      },
      rencana_kegiatan_besok: emptyToNull(fields.rencana.value),
      dokumentasi: {
        jumlah_gambar_tertanam: Number(fields.gambar.value || 0),
        catatan: emptyToNull(fields.catatan.value) || "Gambar tertanam tidak dienkode ke dalam JSON."
      }
    };
  }

  function matchesSearch(rep, q) {
    if (!q) return true;
    const op = (rep && rep.operasi_karhutla) || {};
    const hay = [
      rep.sheet_name,
      op.tanggal,
      op.lokasi_pemadaman,
      op.titik_koordinat_pemadaman,
      op.jumlah_titik_api_yang_dipadamkan
    ].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const items = reports();
    countEl.textContent = items.length + " laporan";
    listEl.innerHTML = "";

    const visible = [];
    items.forEach(function (rep, index) {
      if (matchesSearch(rep, q)) visible.push({ rep: rep, index: index });
    });
    visible.reverse();

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "lp-empty";
      empty.textContent = items.length ? "Tidak ada laporan yang cocok." : "Belum ada laporan.";
      listEl.appendChild(empty);
      return;
    }

    visible.forEach(function (row) {
      const op = (row.rep && row.rep.operasi_karhutla) || {};
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lp-item" + (row.index === activeIndex ? " is-active" : "");
      btn.setAttribute("role", "listitem");
      btn.innerHTML = "<strong></strong><small></small>";
      btn.querySelector("strong").textContent = row.rep.sheet_name || formatDateId(dayKey(op.tanggal));
      btn.querySelector("small").textContent = (op.lokasi_pemadaman || "Lokasi belum diisi") +
        (op.mulai_operasi ? " · " + op.mulai_operasi : "");
      btn.addEventListener("click", function () {
        setStatus("");
        fillForm(row.rep, row.index);
      });
      listEl.appendChild(btn);
    });
  }

  async function saveReport(event) {
    event.preventDefault();
    const report = readForm();
    if (!report.operasi_karhutla.tanggal || !report.operasi_karhutla.lokasi_pemadaman) {
      setStatus("Tanggal dan lokasi pemadaman wajib diisi.", "is-err");
      return;
    }

    saveBtn.disabled = true;
    setStatus("Menyimpan ke laporan-data.js…");

    try {
      const res = await fetch("save-laporan.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: activeIndex >= 0 ? activeIndex : null,
          report: report
        })
      });
      const json = await res.json().catch(function () { return null; });
      if (!res.ok || !json || !json.ok) {
        const msg = json && json.error
          ? json.error
          : "Gagal menyimpan. Buka halaman ini lewat Laragon (PHP), bukan sebagai file.";
        throw new Error(msg);
      }
      window.KARHUTLA_LAPORAN_DATA = json.data;
      fillForm(json.data.reports[json.index], json.index);
      setStatus("Tersimpan. Total " + json.total_reports + " laporan di laporan-data.js.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal menyimpan laporan.", "is-err");
    } finally {
      saveBtn.disabled = false;
    }
  }

  function dash(value) {
    const t = text(value).trim();
    return t === "" ? "" : t;
  }

  function flattenReport(rep, no) {
    const op = (rep && rep.operasi_karhutla) || {};
    const tim = op.jumlah_tim || {};
    const evalRep = (rep && rep.evaluasi) || {};
    const plus = evalRep.kelebihan || {};
    const minus = evalRep.kekurangan || {};
    const docs = (rep && rep.dokumentasi) || {};
    return {
      no: no,
      sheet: dash(rep && rep.sheet_name),
      tanggal: formatDateId(dayKey(op.tanggal)),
      mulai: dash(op.mulai_operasi),
      selesai: dash(op.selesai_operasi),
      lokasi: dash(op.lokasi_pemadaman),
      koordinat: dash(op.titik_koordinat_pemadaman),
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
      rencana: dash(rep && rep.rencana_kegiatan_besok),
      gambar: docs.jumlah_gambar_tertanam != null ? docs.jumlah_gambar_tertanam : "",
      catatan: dash(docs.catatan)
    };
  }

  function reportSheetRows(rep, no) {
    const r = flattenReport(rep, no);
    return [
      ["LAPORAN OPERASI KARHUTLA"],
      ["PT Berau Coal — Command Center"],
      [],
      ["OPERASI KARHUTLA"],
      ["Nama sheet", r.sheet],
      ["Tanggal", r.tanggal],
      ["Mulai operasi", r.mulai],
      ["Selesai operasi", r.selesai],
      ["Lokasi pemadaman", r.lokasi],
      ["Titik koordinat", r.koordinat],
      ["Jumlah titik api dipadamkan", r.titikApi],
      [],
      ["JUMLAH TIM"],
      ["Berau Coal", r.timBc],
      ["Volunteer", r.volunteer],
      ["Unit support", r.unit],
      ["Peralatan yang digunakan", r.alat],
      ["Konsumsi", r.konsumsi],
      [],
      ["EVALUASI — KELEBIHAN"],
      ["Jumlah tim", r.plusTim],
      ["Unit support", r.plusUnit],
      ["Peralatan", r.plusAlat],
      ["Konsumsi", r.plusKonsumsi],
      [],
      ["EVALUASI — KEKURANGAN"],
      ["Jumlah tim", r.minusTim],
      ["Unit support", r.minusUnit],
      ["Peralatan", r.minusAlat],
      ["Konsumsi", r.minusKonsumsi],
      [],
      ["RENCANA & DOKUMENTASI"],
      ["Rencana kegiatan besok", r.rencana],
      ["Jumlah gambar tertanam", r.gambar],
      ["Catatan dokumentasi", r.catatan]
    ];
  }

  function rekapHeaders() {
    return [
      "No", "Nama sheet", "Tanggal", "Mulai operasi", "Selesai operasi",
      "Lokasi pemadaman", "Titik koordinat", "Titik api dipadamkan",
      "Tim Berau Coal", "Volunteer", "Unit support", "Peralatan", "Konsumsi",
      "Kelebihan — tim", "Kelebihan — unit", "Kelebihan — peralatan", "Kelebihan — konsumsi",
      "Kekurangan — tim", "Kekurangan — unit", "Kekurangan — peralatan", "Kekurangan — konsumsi",
      "Rencana kegiatan besok", "Jumlah gambar"
    ];
  }

  function rekapRow(rep, no) {
    const r = flattenReport(rep, no);
    return [
      r.no, r.sheet, r.tanggal, r.mulai, r.selesai, r.lokasi, r.koordinat, r.titikApi,
      r.timBc, r.volunteer, r.unit, r.alat, r.konsumsi,
      r.plusTim, r.plusUnit, r.plusAlat, r.plusKonsumsi,
      r.minusTim, r.minusUnit, r.minusAlat, r.minusKonsumsi,
      r.rencana, r.gambar
    ];
  }

  function uniqueSheetName(raw, used) {
    let name = String(raw || "Laporan")
      .replace(/[:\\/?*\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) name = "Laporan";
    if (name.length > 31) name = name.slice(0, 31).trim();
    let candidate = name;
    let n = 2;
    while (used[candidate]) {
      const suffix = " (" + n + ")";
      candidate = (name.slice(0, Math.max(1, 31 - suffix.length)) + suffix).trim();
      n += 1;
    }
    used[candidate] = true;
    return candidate;
  }

  function applyColWidths(ws, widths) {
    ws["!cols"] = widths.map(function (w) { return { wch: w }; });
  }

  function buildReportSheet(rep, no) {
    const ws = XLSX.utils.aoa_to_sheet(reportSheetRows(rep, no));
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }
    ];
    applyColWidths(ws, [32, 70]);
    return ws;
  }

  function ensureXlsx() {
    if (typeof XLSX === "undefined" || !XLSX.utils) {
      throw new Error("Pustaka Excel belum termuat. Periksa koneksi internet lalu muat ulang halaman.");
    }
  }

  function stamp() {
    const n = new Date();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return n.getFullYear() + "-" + m + "-" + d;
  }

  function downloadAllExcel() {
    try {
      ensureXlsx();
      const items = reports();
      if (!items.length) {
        setStatus("Belum ada laporan untuk diunduh.", "is-err");
        return;
      }

      const wb = XLSX.utils.book_new();
      const rekap = [rekapHeaders()];
      items.forEach(function (rep, i) {
        rekap.push(rekapRow(rep, i + 1));
      });
      const rekapSheet = XLSX.utils.aoa_to_sheet(rekap);
      applyColWidths(rekapSheet, [5, 22, 18, 16, 16, 28, 28, 28, 28, 24, 28, 28, 24, 22, 22, 22, 22, 24, 24, 24, 24, 28, 14]);
      XLSX.utils.book_append_sheet(wb, rekapSheet, "Rekap");

      const used = { Rekap: true };
      items.forEach(function (rep, i) {
        const name = uniqueSheetName(rep.sheet_name || ("Laporan " + (i + 1)), used);
        XLSX.utils.book_append_sheet(wb, buildReportSheet(rep, i + 1), name);
      });

      XLSX.writeFile(wb, "Laporan KARHUTLA " + stamp() + ".xlsx");
      setStatus("Excel " + items.length + " laporan berhasil diunduh.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal mengunduh Excel.", "is-err");
    }
  }

  function downloadOneExcel() {
    try {
      ensureXlsx();
      let rep = null;
      let no = 1;
      if (activeIndex >= 0 && reports()[activeIndex]) {
        rep = reports()[activeIndex];
        no = activeIndex + 1;
      } else {
        const drafted = readForm();
        if (!drafted.operasi_karhutla.tanggal || !drafted.operasi_karhutla.lokasi_pemadaman) {
          setStatus("Pilih laporan di daftar, atau isi tanggal dan lokasi terlebih dahulu.", "is-err");
          return;
        }
        rep = drafted;
      }

      const wb = XLSX.utils.book_new();
      const used = {};
      const name = uniqueSheetName(rep.sheet_name || "Laporan", used);
      XLSX.utils.book_append_sheet(wb, buildReportSheet(rep, no), name);
      XLSX.writeFile(wb, "Laporan KARHUTLA - " + name + ".xlsx");
      setStatus("Excel laporan \"" + name + "\" berhasil diunduh.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal mengunduh Excel.", "is-err");
    }
  }

  fields.tanggal.addEventListener("change", function () {
    if (activeIndex >= 0) return;
    fields.sheet.value = suggestSheetName(fields.tanggal.value, activeIndex);
  });

  document.getElementById("lp-new").addEventListener("click", resetForm);
  document.getElementById("lp-reset").addEventListener("click", resetForm);
  document.getElementById("lp-download-all").addEventListener("click", downloadAllExcel);
  document.getElementById("lp-download-one").addEventListener("click", downloadOneExcel);
  searchEl.addEventListener("input", renderList);
  form.addEventListener("submit", saveReport);

  resetForm();
})();
