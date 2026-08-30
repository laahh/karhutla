(function () {
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const SITES = [
    "BMO 1", "BMO 2", "BMO 3", "GMO", "LMO", "SMO",
    "BLOK 8", "SUARAN", "Sembakungan", "Jalan Negara"
  ];

  const form = document.getElementById("lp-form");
  const listEl = document.getElementById("lp-list");
  const searchEl = document.getElementById("lp-search");
  const countEl = document.getElementById("lp-count");
  const statusEl = document.getElementById("lp-status");
  const titleEl = document.getElementById("lp-form-title");
  const hintEl = document.getElementById("lp-form-hint");
  const saveBtn = document.getElementById("lp-save");
  const deleteBtn = document.getElementById("lp-delete");
  const siteLainWrap = document.getElementById("site-lain-wrap");
  const fields = {
    index: document.getElementById("f-index"),
    id: document.getElementById("f-id"),
    tanggal: document.getElementById("f-tanggal"),
    bulan: document.getElementById("f-bulan"),
    week: document.getElementById("f-week"),
    waktu: document.getElementById("f-waktu"),
    status: document.getElementById("f-status"),
    site: document.getElementById("f-site"),
    siteLain: document.getElementById("f-site-lain"),
    lokasi: document.getElementById("f-lokasi"),
    koordinat: document.getElementById("f-koordinat"),
    personil: document.getElementById("f-personil"),
    keterangan: document.getElementById("f-keterangan"),
    fotos: document.getElementById("f-fotos")
  };

  const photosEl = document.getElementById("lp-photos");
  const PHOTO_MAX = 12;
  const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
  let existingPhotos = [];
  let pendingPhotos = [];
  let activeIndex = -1;

  function dataStore() {
    if (!window.KARHUTLA_PATROLI_DATA || !Array.isArray(window.KARHUTLA_PATROLI_DATA.records)) {
      window.KARHUTLA_PATROLI_DATA = {
        source_file: "Form input patroli KARHUTLA",
        total_records: 0,
        records: []
      };
    }
    return window.KARHUTLA_PATROLI_DATA;
  }

  function records() {
    return dataStore().records;
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
    if (!value) return "";
    return value + " WITA";
  }

  function emptyToNull(value) {
    const t = String(value || "").trim();
    return t === "" ? null : t;
  }

  function monthName(key) {
    const parts = String(key || "").split("-");
    if (parts.length < 2) return "";
    return MONTHS[Number(parts[1]) - 1] || "";
  }

  function weekOfMonth(key) {
    const parts = String(key || "").split("-");
    const d = Number(parts[2]);
    if (!d) return "";
    return "Minggu " + Math.ceil(d / 7);
  }

  function formatDateId(key) {
    if (!key) return "—";
    const parts = key.split("-");
    if (parts.length !== 3) return key;
    const month = MONTHS[Number(parts[1]) - 1] || parts[1];
    return Number(parts[2]) + " " + month + " " + parts[0];
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function fillDateParts() {
    const key = fields.tanggal.value;
    fields.bulan.value = monthName(key);
    fields.week.value = weekOfMonth(key);
  }

  function syncSiteLain() {
    const isLain = fields.site.value === "Lainnya";
    if (siteLainWrap) siteLainWrap.hidden = !isLain;
    if (!isLain) fields.siteLain.value = "";
  }

  function siteValue() {
    if (fields.site.value === "Lainnya") return String(fields.siteLain.value || "").trim();
    return String(fields.site.value || "").trim();
  }

  function setSiteField(value) {
    const name = String(value || "").trim();
    if (!name) {
      fields.site.value = "";
      fields.siteLain.value = "";
      syncSiteLain();
      return;
    }
    if (SITES.indexOf(name) !== -1) {
      fields.site.value = name;
      fields.siteLain.value = "";
    } else {
      fields.site.value = "Lainnya";
      fields.siteLain.value = name;
    }
    syncSiteLain();
  }

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("is-ok", "is-err");
    if (kind) statusEl.classList.add(kind);
  }

  function revokePreview(item) {
    if (item && item.preview) URL.revokeObjectURL(item.preview);
  }

  function clearPendingPhotos() {
    pendingPhotos.forEach(revokePreview);
    pendingPhotos = [];
    if (fields.fotos) fields.fotos.value = "";
  }

  function currentPhotoFiles() {
    return existingPhotos.map(function (item) {
      return item.stored || item.src;
    }).concat(pendingPhotos.map(function (item) {
      return item.uploaded || ("laporan-foto/" + item.name);
    }));
  }

  function safePhotoName(file) {
    const extMatch = String(file && file.name || "").match(/\.(jpe?g|png|webp|gif)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase().replace("jpeg", "jpg") : ".jpg";
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8);
    return "patroli-" + stamp + "-" + rand + ext;
  }

  function renderPhotos() {
    if (!photosEl) return;
    photosEl.innerHTML = "";
    const all = existingPhotos.map(function (item, i) {
      return { kind: "existing", index: i, src: item.src, label: item.name };
    }).concat(pendingPhotos.map(function (item, i) {
      return { kind: "pending", index: i, src: item.preview, label: item.name };
    }));
    if (!all.length) {
      const empty = document.createElement("p");
      empty.className = "lp-photos-empty";
      empty.textContent = "Belum ada foto.";
      photosEl.appendChild(empty);
      return;
    }
    all.forEach(function (item) {
      const card = document.createElement("figure");
      card.className = "lp-photo";
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.label;
      const cap = document.createElement("figcaption");
      cap.textContent = item.label;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "lp-photo-del";
      del.setAttribute("aria-label", "Hapus foto");
      del.textContent = "×";
      del.addEventListener("click", function () {
        if (item.kind === "existing") existingPhotos.splice(item.index, 1);
        else {
          revokePreview(pendingPhotos[item.index]);
          pendingPhotos.splice(item.index, 1);
        }
        renderPhotos();
      });
      card.appendChild(img);
      card.appendChild(cap);
      card.appendChild(del);
      photosEl.appendChild(card);
    });
  }

  function addPhotoFiles(fileList) {
    const incoming = Array.prototype.slice.call(fileList || []);
    incoming.forEach(function (file) {
      if (!file || String(file.type || "").indexOf("image/") !== 0) return;
      if (file.size > PHOTO_MAX_BYTES) {
        setStatus("Lewati " + file.name + " (lebih dari 8 MB).", "is-err");
        return;
      }
      if (existingPhotos.length + pendingPhotos.length >= PHOTO_MAX) {
        setStatus("Maksimal " + PHOTO_MAX + " foto per patroli.", "is-err");
        return;
      }
      pendingPhotos.push({
        file: file,
        name: safePhotoName(file),
        preview: URL.createObjectURL(file)
      });
    });
    renderPhotos();
  }

  function pillClass(status) {
    const key = String(status || "").toLowerCase();
    if (key === "aman" || key === "selesai") return "lp-pill lp-pill-ok";
    if (key === "asap") return "lp-pill lp-pill-warn";
    if (key.indexOf("api") !== -1 || key.indexOf("tindak") !== -1) return "lp-pill lp-pill-hot";
    return "lp-pill";
  }

  function fillForm(row, index) {
    fields.index.value = index >= 0 ? String(index) : "";
    fields.id.value = text(row && row.id);
    fields.tanggal.value = dayKey(row && row.tanggal);
    fields.bulan.value = text(row && row.bulan) || monthName(fields.tanggal.value);
    fields.week.value = text(row && row.week) || weekOfMonth(fields.tanggal.value);
    fields.waktu.value = timeValue(row && row.waktu);
    fields.status.value = text(row && row.status) || "Aman";
    setSiteField(row && row.site);
    fields.lokasi.value = text(row && row.lokasi);
    fields.koordinat.value = text(row && row.koordinat);
    fields.personil.value = text(row && row.personil);
    fields.keterangan.value = text(row && row.keterangan);
    clearPendingPhotos();
    const files = row && row.dokumentasi && Array.isArray(row.dokumentasi.files) ? row.dokumentasi.files : [];
    existingPhotos = files.filter(function (src) {
      if (window.KarhutlaPatroliStore) return KarhutlaPatroliStore.isPhotoRef(src);
      return typeof src === "string";
    }).map(function (src) {
      const shown = window.KarhutlaPatroliStore ? (KarhutlaPatroliStore.displayUrl(src) || src) : src;
      return { src: shown, stored: src, name: String(src).split("/").pop().replace(/^idb:/, "") };
    });
    renderPhotos();

    activeIndex = index;
    if (deleteBtn) deleteBtn.hidden = index < 0;
    if (index >= 0) {
      titleEl.textContent = "Ubah patroli";
      hintEl.textContent = "Mengubah data yang sudah tersimpan. Klik Simpan.";
    } else {
      titleEl.textContent = "Patroli baru";
      hintEl.textContent = "Lengkapi data patroli. Kolom bertanda * wajib diisi. Bulan dan week terisi otomatis dari tanggal.";
    }
    renderList();
  }

  function resetForm() {
    form.reset();
    fields.index.value = "";
    fields.id.value = "";
    fields.status.value = "Aman";
    fillForm(null, -1);
    setStatus("");
  }

  function readForm() {
    const tanggal = fields.tanggal.value;
    const files = currentPhotoFiles();
    return {
      id: fields.id.value || newId(),
      tanggal: tanggal || null,
      bulan: monthName(tanggal) || emptyToNull(fields.bulan.value),
      week: weekOfMonth(tanggal) || emptyToNull(fields.week.value),
      waktu: withWita(fields.waktu.value) || null,
      site: emptyToNull(siteValue()),
      lokasi: emptyToNull(fields.lokasi.value),
      koordinat: emptyToNull(fields.koordinat.value),
      status: emptyToNull(fields.status.value) || "Aman",
      personil: emptyToNull(fields.personil.value),
      keterangan: emptyToNull(fields.keterangan.value),
      dokumentasi: {
        jumlah_gambar: files.length,
        files: files
      }
    };
  }

  function matchesSearch(row, q) {
    if (!q) return true;
    const hay = [
      row.tanggal, row.bulan, row.week, row.waktu, row.site,
      row.lokasi, row.koordinat, row.status, row.personil, row.keterangan
    ].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderList() {
    const q = String(searchEl.value || "").trim().toLowerCase();
    const items = records();
    countEl.textContent = items.length + " patroli";
    listEl.innerHTML = "";

    const visible = [];
    items.forEach(function (row, index) {
      if (matchesSearch(row, q)) visible.push({ row: row, index: index });
    });
    visible.reverse();

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "lp-empty";
      empty.textContent = items.length ? "Tidak ada patroli yang cocok." : "Belum ada patroli.";
      listEl.appendChild(empty);
      return;
    }

    visible.forEach(function (item) {
      const row = item.row || {};
      const card = document.createElement("div");
      card.className = "lp-item" + (item.index === activeIndex ? " is-active" : "");
      card.setAttribute("role", "listitem");

      const main = document.createElement("button");
      main.type = "button";
      main.className = "lp-item-main";
      main.innerHTML = "<strong></strong><small></small>";
      main.querySelector("strong").textContent =
        (row.site || "Site belum diisi") + " · " + (row.lokasi || "Lokasi belum diisi");
      main.querySelector("small").textContent =
        formatDateId(dayKey(row.tanggal)) +
        (row.waktu ? " · " + row.waktu : "") +
        (row.week ? " · " + row.week : "");
      if (row.status) {
        const pill = document.createElement("span");
        pill.className = pillClass(row.status);
        pill.textContent = row.status;
        main.appendChild(pill);
      }
      main.addEventListener("click", function () {
        setStatus("");
        fillForm(row, item.index);
      });

      const actions = document.createElement("div");
      actions.className = "lp-item-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "lp-item-btn";
      editBtn.title = "Ubah patroli";
      editBtn.setAttribute("aria-label", "Ubah patroli");
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/></svg>';
      editBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        setStatus("");
        fillForm(row, item.index);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "lp-item-btn lp-item-btn-del";
      delBtn.title = "Hapus patroli";
      delBtn.setAttribute("aria-label", "Hapus patroli");
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V5h6v2"/></svg>';
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteRecord(item.index, row);
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      card.appendChild(main);
      card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  function recordSortKey(row) {
    return String((row && row.tanggal) || "") + " " + String((row && row.waktu) || "");
  }

  function applyRecordToStore(record) {
    const store = dataStore();
    const items = store.records.slice();
    if (activeIndex >= 0 && items[activeIndex]) {
      items[activeIndex] = record;
    } else {
      items.push(record);
    }
    items.sort(function (a, b) {
      return recordSortKey(a).localeCompare(recordSortKey(b));
    });
    store.records = items;
    store.total_records = items.length;
    if (!store.source_file) store.source_file = "Form input patroli KARHUTLA";
    return items.indexOf(record);
  }

  async function persistStore() {
    if (!window.KarhutlaPatroliStore) {
      throw new Error("Modul simpan patroli belum termuat.");
    }
    return KarhutlaPatroliStore.save(dataStore());
  }

  async function deleteRecord(index, row) {
    const label = [
      formatDateId(dayKey(row && row.tanggal)),
      row && row.site,
      row && row.lokasi
    ].filter(Boolean).join(" · ") || "patroli ini";
    if (!window.confirm("Hapus \"" + label + "\" dari daftar?")) {
      return;
    }

    const wasActive = activeIndex === index;
    const store = dataStore();
    const snapshot = store.records.slice();
    const snapshotTotal = store.total_records;
    try {
      if (index < 0 || index >= store.records.length) {
        setStatus("Patroli tidak ditemukan.", "is-err");
        return;
      }
      store.records.splice(index, 1);
      store.total_records = store.records.length;
      await persistStore();
      if (wasActive) resetForm();
      else {
        if (activeIndex > index) activeIndex -= 1;
        renderList();
      }
      setStatus("Patroli dihapus. Total " + store.total_records + " patroli.", "is-ok");
    } catch (err) {
      store.records = snapshot;
      store.total_records = snapshotTotal;
      renderList();
      setStatus(err.message || "Gagal menghapus patroli.", "is-err");
    }
  }

  async function saveRecord(event) {
    event.preventDefault();
    const draft = readForm();
    if (!draft.tanggal || !draft.waktu || !draft.site || !draft.lokasi) {
      setStatus("Tanggal, waktu, site, dan lokasi wajib diisi.", "is-err");
      return;
    }

    saveBtn.disabled = true;
    setStatus("Menyimpan patroli…");

    const store = dataStore();
    const snapshot = store.records.slice();
    const snapshotTotal = store.total_records;
    try {
      if (window.KarhutlaPatroliStore) {
        for (let i = 0; i < pendingPhotos.length; i += 1) {
          pendingPhotos[i].uploaded = await KarhutlaPatroliStore.uploadPhoto(
            pendingPhotos[i].file,
            pendingPhotos[i].name
          );
        }
      }
      const record = readForm();
      const index = applyRecordToStore(record);
      const result = await persistStore();
      fillForm(records()[index], index);
      const shared = result && result.persistent;
      setStatus(
        (shared ? "Tersimpan." : "Tersimpan di browser ini.") +
        " Total " + dataStore().total_records + " patroli.",
        "is-ok"
      );
    } catch (err) {
      store.records = snapshot;
      store.total_records = snapshotTotal;
      renderList();
      setStatus(err.message || "Gagal menyimpan patroli.", "is-err");
    } finally {
      saveBtn.disabled = false;
    }
  }

  function dash(value) {
    const t = text(value).trim();
    return t === "" ? "" : t;
  }

  function flattenRecord(row, no) {
    const docs = (row && row.dokumentasi) || {};
    const files = Array.isArray(docs.files) ? docs.files : [];
    return {
      no: no,
      tanggal: formatDateId(dayKey(row && row.tanggal)),
      bulan: dash(row && row.bulan),
      week: dash(row && row.week),
      waktu: dash(row && row.waktu),
      site: dash(row && row.site),
      lokasi: dash(row && row.lokasi),
      koordinat: dash(row && row.koordinat),
      status: dash(row && row.status),
      personil: dash(row && row.personil),
      keterangan: dash(row && row.keterangan),
      dokumentasi: files.length ? files.length + " foto" : "",
      foto: files.join(", ")
    };
  }

  function excelHeaders() {
    return [
      "TANGGAL", "BULAN", "WEEK", "WAKTU", "SITE", "LOKASI",
      "KORDINAT", "STATUS", "PERSONIL", "KETERANGAN", "Dokumentasi"
    ];
  }

  function excelRow(row, no) {
    const r = flattenRecord(row, no);
    return [
      r.tanggal, r.bulan, r.week, r.waktu, r.site, r.lokasi,
      r.koordinat, r.status, r.personil, r.keterangan, r.dokumentasi
    ];
  }

  function applyColWidths(ws, widths) {
    ws["!cols"] = widths.map(function (w) { return { wch: w }; });
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

  function uniqueSheetName(raw, used) {
    let name = String(raw || "Patroli")
      .replace(/[:\\/?*\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) name = "Patroli";
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

  function downloadAllExcel() {
    try {
      ensureXlsx();
      const items = records();
      if (!items.length) {
        setStatus("Belum ada patroli untuk diunduh.", "is-err");
        return;
      }
      const wb = XLSX.utils.book_new();
      const sheet = [excelHeaders()];
      items.forEach(function (row, i) {
        sheet.push(excelRow(row, i + 1));
      });
      const ws = XLSX.utils.aoa_to_sheet(sheet);
      applyColWidths(ws, [18, 12, 12, 14, 14, 28, 28, 20, 24, 40, 14]);
      XLSX.utils.book_append_sheet(wb, ws, "Patroli");
      XLSX.writeFile(wb, "Patroli KARHUTLA " + stamp() + ".xlsx");
      setStatus("Excel " + items.length + " patroli berhasil diunduh.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal mengunduh Excel.", "is-err");
    }
  }

  function downloadOneExcel() {
    try {
      ensureXlsx();
      let row = null;
      if (activeIndex >= 0 && records()[activeIndex]) {
        row = records()[activeIndex];
      } else {
        const drafted = readForm();
        if (!drafted.tanggal || !drafted.site || !drafted.lokasi) {
          setStatus("Pilih patroli di daftar, atau isi tanggal, site, dan lokasi terlebih dahulu.", "is-err");
          return;
        }
        row = drafted;
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([excelHeaders(), excelRow(row, 1)]);
      applyColWidths(ws, [18, 12, 12, 14, 14, 28, 28, 20, 24, 40, 14]);
      const used = {};
      const name = uniqueSheetName((row.site || "Patroli") + " " + formatDateId(dayKey(row.tanggal)), used);
      XLSX.utils.book_append_sheet(wb, ws, name);
      XLSX.writeFile(wb, "Patroli KARHUTLA - " + name + ".xlsx");
      setStatus("Excel patroli \"" + name + "\" berhasil diunduh.", "is-ok");
    } catch (err) {
      setStatus(err.message || "Gagal mengunduh Excel.", "is-err");
    }
  }

  fields.tanggal.addEventListener("change", fillDateParts);
  fields.site.addEventListener("change", syncSiteLain);
  if (fields.fotos) {
    fields.fotos.addEventListener("change", function () {
      addPhotoFiles(fields.fotos.files);
      fields.fotos.value = "";
    });
  }

  document.getElementById("lp-new").addEventListener("click", resetForm);
  document.getElementById("lp-reset").addEventListener("click", resetForm);
  document.getElementById("lp-download-all").addEventListener("click", downloadAllExcel);
  document.getElementById("lp-download-one").addEventListener("click", downloadOneExcel);
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (activeIndex < 0) return;
      deleteRecord(activeIndex, records()[activeIndex]);
    });
  }
  searchEl.addEventListener("input", renderList);
  form.addEventListener("submit", saveRecord);

  function boot() {
    resetForm();
    renderList();
  }

  if (window.KarhutlaPatroliStore) {
    KarhutlaPatroliStore.hydrate().then(boot).catch(boot);
  } else {
    boot();
  }
})();
