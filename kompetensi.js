(function () {
  var TZ = "Asia/Makassar";
  var $ = function (sel) { return document.querySelector(sel); };
  var form = $("#lp-form");
  var listEl = $("#lp-list");
  var searchEl = $("#lp-search");
  var countEl = $("#lp-count");
  var statusEl = $("#lp-status");
  var siteSelect = $("#f-site");
  var siteLainWrap = $("#site-lain-wrap");
  var siteLainInput = $("#f-site-lain");
  var saveBtn = $("#lp-save");
  var editingIndex = -1;
  var searchQ = "";

  function dataStore() {
    if (!window.KARHUTLA_KOMPETENSI_DATA || !Array.isArray(window.KARHUTLA_KOMPETENSI_DATA.records)) {
      window.KARHUTLA_KOMPETENSI_DATA = {
        source_file: "Form input kompetensi personil KARHUTLA",
        total_records: 0,
        records: []
      };
    }
    return window.KARHUTLA_KOMPETENSI_DATA;
  }

  function records() {
    return dataStore().records;
  }

  function newId() {
    return "k-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nowISODate() {
    return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  }

  function formatTanggal(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function weekFromDate(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length !== 3) return "";
    var d = parseInt(p[2], 10);
    if (!d) return "";
    return "Minggu " + Math.ceil(d / 7);
  }

  function parseNum(v) {
    var n = parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }

  function applyRanking(rows) {
    var indexed = rows.map(function (r, i) {
      return { i: i, s: parseNum(r.score_all_competency) };
    });
    indexed.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    var rank = 1;
    indexed.forEach(function (item, pos) {
      if (pos > 0 && item.s < indexed[pos - 1].s) rank = pos + 1;
      rows[item.i].rangking = item.s ? rank : "";
    });
    return rows;
  }

  function showSiteLain(show) {
    siteLainWrap.hidden = !show;
    siteLainInput.required = show;
    if (!show) siteLainInput.value = "";
  }

  function selectedSite() {
    var v = siteSelect.value;
    if (v === "Lainnya") return (siteLainInput.value || "").trim();
    return v;
  }

  function fillSite(site) {
    var known = [
      "BMO 1", "BMO 2", "BMO 3", "GMO", "LMO", "SMO",
      "BLOK 8", "SUARAN", "Sembakungan", "Jalan Negara"
    ];
    if (!site) {
      siteSelect.value = "";
      showSiteLain(false);
      return;
    }
    if (known.indexOf(site) !== -1) {
      siteSelect.value = site;
      showSiteLain(false);
    } else {
      siteSelect.value = "Lainnya";
      showSiteLain(true);
      siteLainInput.value = site;
    }
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.classList.remove("is-ok", "is-err");
    if (msg) statusEl.classList.add(isError ? "is-err" : "is-ok");
  }

  function collect() {
    return {
      id: $("#f-id").value.trim() || newId(),
      no: $("#f-no").value.trim(),
      personil: $("#f-personil").value.trim(),
      npk_sid: $("#f-npk").value.trim(),
      jabatan: $("#f-jabatan").value.trim(),
      site: selectedSite(),
      perusahaan: $("#f-perusahaan").value.trim(),
      week: $("#f-week").value.trim() || weekFromDate($("#f-tanggal").value),
      tanggal_verifikasi: $("#f-tanggal").value,
      absensi: $("#f-absensi").value,
      score: $("#f-score").value.trim(),
      wrc_hiperkes: $("#f-wrc-hiperkes").value.trim(),
      wrc_erg: $("#f-wrc-erg").value.trim(),
      wrc_darurat: $("#f-wrc-darurat").value.trim(),
      score_wrc: $("#f-score-wrc").value.trim(),
      bfrc: $("#f-bfrc").value.trim(),
      score_bfrc: $("#f-score-bfrc").value.trim(),
      samapta: $("#f-samapta").value.trim(),
      keterangan: $("#f-keterangan").value.trim(),
      score_samapta: $("#f-score-samapta").value.trim(),
      tim_ikk: $("#f-tim-ikk").value.trim(),
      pelatihan_ikk: $("#f-pelatihan-ikk").value.trim(),
      kompetensi: $("#f-kompetensi").value.trim(),
      pic_safety_device: $("#f-pic-safety").value.trim(),
      pelatihan_safety_device: $("#f-pelatihan-safety").value.trim(),
      post_test_harian: $("#f-post-test").value.trim(),
      nilai: $("#f-nilai").value.trim(),
      score_all_competency: $("#f-score-all").value.trim(),
      rangking: $("#f-rangking").value.trim()
    };
  }

  function fillForm(row, index) {
    editingIndex = index;
    $("#f-index").value = index;
    $("#f-id").value = row.id || "";
    $("#f-no").value = row.no || "";
    $("#f-personil").value = row.personil || "";
    $("#f-npk").value = row.npk_sid || "";
    $("#f-jabatan").value = row.jabatan || "";
    fillSite(row.site || "");
    $("#f-perusahaan").value = row.perusahaan || "";
    $("#f-week").value = row.week || weekFromDate(row.tanggal_verifikasi);
    $("#f-tanggal").value = row.tanggal_verifikasi || "";
    $("#f-absensi").value = row.absensi || "";
    $("#f-score").value = row.score || "";
    $("#f-wrc-hiperkes").value = row.wrc_hiperkes || "";
    $("#f-wrc-erg").value = row.wrc_erg || "";
    $("#f-wrc-darurat").value = row.wrc_darurat || "";
    $("#f-score-wrc").value = row.score_wrc || "";
    $("#f-bfrc").value = row.bfrc || "";
    $("#f-score-bfrc").value = row.score_bfrc || "";
    $("#f-samapta").value = row.samapta || "";
    $("#f-keterangan").value = row.keterangan || "";
    $("#f-score-samapta").value = row.score_samapta || "";
    $("#f-tim-ikk").value = row.tim_ikk || "";
    $("#f-pelatihan-ikk").value = row.pelatihan_ikk || "";
    $("#f-kompetensi").value = row.kompetensi || "";
    $("#f-pic-safety").value = row.pic_safety_device || "";
    $("#f-pelatihan-safety").value = row.pelatihan_safety_device || "";
    $("#f-post-test").value = row.post_test_harian || "";
    $("#f-nilai").value = row.nilai || "";
    $("#f-score-all").value = row.score_all_competency || "";
    $("#f-rangking").value = row.rangking || "";
    $("#lp-form-title").textContent = "Edit kompetensi #" + (index + 1);
    $("#lp-form-hint").textContent = "Ubah data lalu simpan. Ranking dihitung ulang dari Score All Competency.";
    $("#lp-delete").hidden = false;
    setStatus("");
    renderList();
  }

  function resetForm() {
    editingIndex = -1;
    form.reset();
    $("#f-index").value = "";
    $("#f-id").value = "";
    $("#f-tanggal").value = nowISODate();
    $("#f-week").value = weekFromDate(nowISODate());
    fillSite("");
    $("#lp-form-title").textContent = "Data baru";
    $("#lp-form-hint").textContent = "Lengkapi data kompetensi. Kolom bertanda * wajib diisi. Week terisi otomatis dari tanggal verifikasi. Ranking dihitung dari Score All Competency.";
    $("#lp-delete").hidden = true;
    setStatus("");
    renderList();
  }

  function matchesSearch(row) {
    if (!searchQ) return true;
    var hay = [
      row.personil, row.npk_sid, row.jabatan, row.site, row.perusahaan,
      row.week, row.absensi, row.tim_ikk, row.kompetensi
    ].join(" ").toLowerCase();
    return hay.indexOf(searchQ) !== -1;
  }

  function renderList() {
    var data = records();
    var filtered = [];
    data.forEach(function (row, i) {
      if (matchesSearch(row)) filtered.push({ row: row, index: i });
    });
    countEl.textContent = data.length + " personil";
    if (!filtered.length) {
      listEl.innerHTML = "<p class=\"lp-empty\">" + (searchQ ? "Tidak ada hasil pencarian." : "Belum ada data kompetensi. Isi formulir di kanan.") + "</p>";
      return;
    }
    listEl.innerHTML = filtered.map(function (item) {
      var r = item.row;
      var active = item.index === editingIndex ? " is-active" : "";
      var rank = r.rangking ? " · Rank " + r.rangking : "";
      return "<button type=\"button\" class=\"lp-item" + active + "\" data-index=\"" + item.index + "\" role=\"listitem\">" +
        "<span class=\"lp-item-title\">" + (r.personil || "Tanpa nama") + "</span>" +
        "<span class=\"lp-item-meta\">" + (r.npk_sid || "—") + " · " + (r.site || "—") + rank + "</span>" +
        "<span class=\"lp-item-meta\">" + formatTanggal(r.tanggal_verifikasi) + " · " + (r.week || "—") +
        " · Score " + (r.score_all_competency || "—") + "</span>" +
        "</button>";
    }).join("");
  }

  function persistStore() {
    if (!window.KarhutlaKompetensiStore) {
      return Promise.reject(new Error("Modul simpan kompetensi belum termuat."));
    }
    return window.KarhutlaKompetensiStore.save(dataStore());
  }

  function applyRecordToStore(record) {
    var store = dataStore();
    var items = store.records.slice();
    if (editingIndex >= 0 && items[editingIndex]) {
      items[editingIndex] = record;
    } else {
      items.push(record);
    }
    applyRanking(items);
    store.records = items;
    store.total_records = items.length;
    if (!store.source_file) store.source_file = "Form input kompetensi personil KARHUTLA";
    var idx = -1;
    items.forEach(function (row, i) {
      if (row.id === record.id) idx = i;
    });
    return idx;
  }

  function downloadExcel(rows, filename) {
    if (typeof XLSX === "undefined") {
      setStatus("Pustaka Excel belum termuat. Muat ulang halaman.", true);
      return;
    }
    var headers = [
      "No", "PERSONIL", "NPK / SID", "JABATAN PERSONIL", "SITE", "PERUSAHAAN",
      "WEEK", "TANGGAL VERIFIKASI", "ABSENSI", "SCORE",
      "WRC HIPERKES", "WRC ERG", "WRC PENANGGULANGAN KEADAAN DARURAT", "SCORE WRC",
      "BFRC", "SCORE BFRC", "SAMAPTA", "KETERANGAN", "SCORE SAMAPTA",
      "TIM IKK", "PELATIHAN IKK", "KOMPETENSI", "PIC SAFETY DEVICE", "PELATIHAN SAFETY DEVICE",
      "POST TEST HARIAN", "NILAI", "SCORE ALL COMPETENCY", "RANGKING"
    ];
    var body = rows.map(function (r) {
      return [
        r.no || "", r.personil || "", r.npk_sid || "", r.jabatan || "", r.site || "", r.perusahaan || "",
        r.week || "", r.tanggal_verifikasi || "", r.absensi || "", r.score || "",
        r.wrc_hiperkes || "", r.wrc_erg || "", r.wrc_darurat || "", r.score_wrc || "",
        r.bfrc || "", r.score_bfrc || "", r.samapta || "", r.keterangan || "", r.score_samapta || "",
        r.tim_ikk || "", r.pelatihan_ikk || "", r.kompetensi || "", r.pic_safety_device || "", r.pelatihan_safety_device || "",
        r.post_test_harian || "", r.nilai || "", r.score_all_competency || "", r.rangking || ""
      ];
    });
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(body));
    ws["!cols"] = headers.map(function (h) { return { wch: Math.max(12, h.length + 2) }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kompetensi");
    XLSX.writeFile(wb, filename);
  }

  siteSelect.addEventListener("change", function () {
    showSiteLain(siteSelect.value === "Lainnya");
  });

  $("#f-tanggal").addEventListener("change", function () {
    $("#f-week").value = weekFromDate(this.value);
  });

  listEl.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-index]");
    if (!btn) return;
    var idx = parseInt(btn.getAttribute("data-index"), 10);
    var row = records()[idx];
    if (row) fillForm(row, idx);
  });

  searchEl.addEventListener("input", function () {
    searchQ = this.value.trim().toLowerCase();
    renderList();
  });

  $("#lp-new").addEventListener("click", resetForm);
  $("#lp-reset").addEventListener("click", resetForm);

  $("#lp-delete").addEventListener("click", function () {
    if (editingIndex < 0) return;
    var current = records()[editingIndex];
    var label = current && current.personil ? current.personil : "data kompetensi ini";
    if (!window.confirm("Hapus \"" + label + "\" dari daftar?")) return;

    var store = dataStore();
    var snapshot = store.records.slice();
    var snapshotTotal = store.total_records;
    store.records.splice(editingIndex, 1);
    applyRanking(store.records);
    store.total_records = store.records.length;
    persistStore().then(function () {
      resetForm();
      setStatus("Data kompetensi dihapus. Total " + store.total_records + " personil.");
    }).catch(function (err) {
      store.records = snapshot;
      store.total_records = snapshotTotal;
      renderList();
      setStatus(err.message || "Gagal menghapus data kompetensi.", true);
    });
  });

  $("#lp-download-all").addEventListener("click", function () {
    var rows = records();
    if (!rows.length) {
      setStatus("Belum ada data untuk diunduh.", true);
      return;
    }
    downloadExcel(rows, "kompetensi-karhutla.xlsx");
    setStatus("Excel seluruh data kompetensi diunduh.");
  });

  $("#lp-download-one").addEventListener("click", function () {
    var row = collect();
    if (!row.personil && !row.npk_sid) {
      setStatus("Isi personil atau NPK dulu sebelum mengunduh.", true);
      return;
    }
    var nama = (row.personil || row.npk_sid || "kompetensi").replace(/[^\w\-]+/g, "-");
    downloadExcel([row], "kompetensi-" + nama + ".xlsx");
    setStatus("Excel data ini diunduh.");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var row = collect();
    if (!row.personil) { setStatus("Isi nama personil.", true); $("#f-personil").focus(); return; }
    if (!row.npk_sid) { setStatus("Isi NPK / SID.", true); $("#f-npk").focus(); return; }
    if (!row.site) { setStatus("Pilih atau isi site.", true); siteSelect.focus(); return; }
    if (!row.tanggal_verifikasi) { setStatus("Isi tanggal verifikasi.", true); $("#f-tanggal").focus(); return; }

    var store = dataStore();
    var snapshot = store.records.slice();
    var snapshotTotal = store.total_records;
    if (!row.no) row.no = String(store.records.length + (editingIndex >= 0 ? 0 : 1));

    saveBtn.disabled = true;
    setStatus("Menyimpan kompetensi…");
    var index = applyRecordToStore(row);
    persistStore().then(function (result) {
      var saved = records();
      var found = index;
      saved.forEach(function (item, i) {
        if (item.id === row.id) found = i;
      });
      fillForm(saved[found] || row, found);
      var shared = result && result.persistent;
      setStatus(
        (shared ? "Tersimpan." : "Tersimpan di browser ini.") +
        " Total " + dataStore().total_records + " personil."
      );
    }).catch(function (err) {
      store.records = snapshot;
      store.total_records = snapshotTotal;
      renderList();
      setStatus(err.message || "Gagal menyimpan data kompetensi.", true);
    }).then(function () {
      saveBtn.disabled = false;
    });
  });

  function boot() {
    resetForm();
    renderList();
  }

  if (window.KarhutlaKompetensiStore) {
    window.KarhutlaKompetensiStore.hydrate().then(boot).catch(boot);
  } else {
    boot();
    setStatus("Penyimpanan lokal belum siap. Data sementara di memori.", true);
  }
})();
