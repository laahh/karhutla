(function () {
  const SIPONGI_APIS = [
    "https://opsroom-sipongi.gakkum.kehutanan.go.id",
    "https://opsroom.sipongidata.my.id"
  ];
  const PROVINSI_KALTIM = "14";
  const SATS = [
    { id: "terra", label: "TERRA/AQUA", sumber: ["NASA-MODIS", "LPN-MODIS"] },
    { id: "snpp", label: "SNPP", sumber: ["NASA-SNPP", "LPN-NPP"] },
    { id: "noaa20", label: "NOAA20", sumber: ["NASA-NOAA20", "LPN-NOAA20"] }
  ];
  const LEVELS = {
    tinggi: { label: "High", badge: "High" },
    sedang: { label: "Medium", badge: "Medium" },
    rendah: { label: "Low", badge: "Low" }
  };
  const CONFS = [
    { id: "semua", label: "Semua confidence" },
    { id: "high", label: "High" },
    { id: "medium", label: "Medium" },
    { id: "low", label: "Low" }
  ];

  const boundsOps = L.latLngBounds([1.78, 117.05], [2.32, 117.72]);
  const opsPolygon = [
    [2.30, 117.28], [2.28, 117.64], [2.16, 117.70], [1.92, 117.62], [1.84, 117.22], [1.98, 117.12], [2.18, 117.18]
  ];

  const listEl = document.getElementById("hotspot-list");
  const countEl = document.getElementById("list-count");
  const satGrid = document.getElementById("sat-grid");
  const siteEl = document.getElementById("filter-site");
  const statusEl = document.getElementById("filter-status");
  const dateEl = document.getElementById("filter-date");
  const periodEl = document.getElementById("filter-period");
  const areaEl = document.getElementById("filter-area");
  const dateWrap = document.getElementById("date-wrap");
  const emptyEl = document.getElementById("detail-empty");
  const cardEl = document.getElementById("detail-card");
  const detailPane = document.getElementById("map-detail");
  const loadingEl = document.getElementById("map-loading");
  const sourceEl = document.getElementById("data-source");
  const liveStatus = document.getElementById("live-status");
  const refreshBtn = document.getElementById("btn-refresh");

  let HOTSPOTS = [];
  let CASES = [];
  let selectedId = null;
  let listMode = "satelit";
  let showKasus = true;
  const markers = {};
  const caseMarkers = {};
  let lastFetchAt = null;
  let loading = false;

  CONFS.forEach(function (row) {
    const opt = document.createElement("option");
    opt.value = row.id;
    opt.textContent = row.label;
    statusEl.appendChild(opt);
  });

  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Esri • Data SIPONGI KEMENHUT",
    maxZoom: 18
  });
  const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "OSM & CARTO • Data SIPONGI KEMENHUT",
    maxZoom: 18
  });
  const map = L.map("map", {
    center: [2.08, 117.42],
    zoom: 10,
    layers: [sat],
    zoomControl: false,
    attributionControl: false
  });
  const opsLayer = L.polygon(opsPolygon, {
    color: "#86d15c",
    weight: 1.6,
    dashArray: "6 5",
    fillColor: "#6bb443",
    fillOpacity: 0.06
  });
  const fdrsLayer = L.layerGroup([
    L.polygon([[2.22, 117.12], [2.30, 117.28], [2.18, 117.18]], { color: "#2ea043", weight: 1, fillColor: "#2ea043", fillOpacity: 0.22 }),
    L.polygon([[2.28, 117.28], [2.30, 117.48], [2.12, 117.40], [2.10, 117.22]], { color: "#e6d325", weight: 1, fillColor: "#e6d325", fillOpacity: 0.22 }),
    L.polygon([[2.16, 117.40], [2.28, 117.64], [2.16, 117.70], [2.02, 117.52]], { color: "#e8891c", weight: 1, fillColor: "#e8891c", fillOpacity: 0.22 }),
    L.polygon([[2.02, 117.22], [1.92, 117.62], [1.84, 117.22], [1.98, 117.12]], { color: "#d73a32", weight: 1, fillColor: "#d73a32", fillOpacity: 0.22 })
  ]);

  function esc(s) {
    return String(s == null || s === "" ? "—" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  }

  function parseNotif(text) {
    const parts = String(text || "").split("_").map(function (s) { return s.trim(); }).filter(Boolean);
    return {
      raw: text || "—",
      jenis: parts[0] || "Karhutla",
      perusahaan: parts[1] || "",
      lokasi: parts[2] || "",
      siteTeks: parts[3] || "",
      tanggalTeks: parts[4] || "",
      jamKejadian: parts[5] || "",
      jamLapor: parts[6] || "",
      uraian: parts[7] || "",
      korban: parts[8] || "",
      tindakan: parts[9] || ""
    };
  }

  function kasusIcon(on) {
    return L.divIcon({
      className: "",
      html: '<span class="pin kasus' + (on ? " is-on" : "") + '"><i class="pin-ring"></i><i class="pin-core"></i></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function satOf(sumber) {
    const found = SATS.find(function (row) { return row.sumber.indexOf(sumber) !== -1; });
    return found ? found.id : "terra";
  }

  function levelOf(conf) {
    if (conf === "high") return "tinggi";
    if (conf === "medium") return "sedang";
    return "rendah";
  }

  function markerIcon(level, on) {
    return L.divIcon({
      className: "",
      html: '<span class="pin ' + level + (on ? " is-on" : "") + '"><i class="pin-ring"></i><i class="pin-core"></i></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  function hudPad() {
    const left = document.querySelector(".list-card");
    const right = document.querySelector(".hud-right");
    const legend = document.querySelector(".map-legend-bar");
    const topbar = document.querySelector(".topbar");
    return {
      paddingTopLeft: [(left ? left.offsetWidth : 0) + 36, (topbar ? topbar.offsetHeight : 72) + 16],
      paddingBottomRight: [(right ? right.offsetWidth : 0) + 36, (legend ? legend.offsetHeight : 64) + 28]
    };
  }

  function fitOps() {
    map.fitBounds(boundsOps, hudPad());
  }

  function buildQuery() {
    const period = periodEl.value;
    const custom = period === "custom";
    const params = new URLSearchParams();
    params.set("wilayah", "IN");
    params.set("filterperiode", custom ? "true" : "false");
    params.set("from", custom && dateEl.value ? dateEl.value : "");
    params.set("to", custom && dateEl.value ? dateEl.value : "");
    params.set("late", custom ? "custom" : period);
    params.set("provinsi", PROVINSI_KALTIM);
    params.set("kabkota", "");
    ["NASA-MODIS", "NASA-SNPP", "NASA-NOAA20"].forEach(function (name) {
      params.append("satelit[]", name);
    });
    ["low", "medium", "high"].forEach(function (name) {
      params.append("confidence[]", name);
    });
    return params.toString();
  }

  function mapFeature(feature, index) {
    const p = feature.properties || {};
    const g = feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates : [p.long, p.lat];
    const conf = (p.confidence_level || "low").toLowerCase();
    const lat = Number(p.lat != null ? p.lat : g[1]);
    const lng = Number(p.long != null ? p.long : g[0]);
    return {
      id: [p.sumber, lat, lng, p.date_hotspot_ori || p.hs_id, index].join("_"),
      site: p.kecamatan || "Tidak diketahui",
      name: p.desa || p.kecamatan || "Hotspot",
      lat: lat,
      lng: lng,
      sat: satOf(p.sumber || ""),
      source: p.sumber || "—",
      conf: conf,
      level: levelOf(conf),
      confidence: Number(p.confidence) || 0,
      detected: p.date_hotspot || p.date_hotspot_ori || "—",
      desa: p.desa || "—",
      kec: p.kecamatan || "—",
      kab: p.kabkota || "—",
      prov: p.nama_provinsi || "Kalimantan Timur",
      kawasan: p.kawasan || "—"
    };
  }

  async function fetchFrom(base) {
    const res = await fetch(base + "/api/opsroom/indoHotspot?" + buildQuery());
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || !Array.isArray(json.features)) throw new Error("Format data tidak dikenali");
    return json.features;
  }

  async function loadHotspots() {
    if (loading) return;
    loading = true;
    loadingEl.hidden = false;
    refreshBtn.disabled = true;
    let lastError = null;
    for (let i = 0; i < SIPONGI_APIS.length; i += 1) {
      try {
        const features = await fetchFrom(SIPONGI_APIS[i]);
        const area = areaEl.value;
        HOTSPOTS = features
          .map(mapFeature)
          .filter(function (item) {
            if (Number.isNaN(item.lat) || Number.isNaN(item.lng)) return false;
            if (area === "berau") return String(item.kab).toLowerCase() === "berau";
            return true;
          });
        lastFetchAt = new Date();
        fillKecamatan();
        selectedId = null;
        renderDetail(null);
        renderSat();
        renderList();
        renderMarkers();
        sourceEl.textContent = "Sumber data: SIPONGI KEMENHUT • " + HOTSPOTS.length + " titik " + (area === "berau" ? "Berau" : "Kaltim") + " • diperbarui " + lastFetchAt.toLocaleTimeString("id-ID");
        liveStatus.textContent = HOTSPOTS.length ? (HOTSPOTS.length + " hotspot aktif pada periode ini") : "Tidak ada hotspot pada periode ini";
        loadingEl.hidden = true;
        refreshBtn.disabled = false;
        loading = false;
        if (HOTSPOTS.length) {
          const group = L.featureGroup(Object.keys(markers).map(function (id) { return markers[id]; }));
          if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.18), hudPad());
        } else {
          fitOps();
        }
        return;
      } catch (err) {
        lastError = err;
      }
    }
    loadingEl.hidden = true;
    refreshBtn.disabled = false;
    loading = false;
    sourceEl.textContent = "Gagal memuat SiPongi. Coba muat ulang.";
    liveStatus.textContent = lastError ? String(lastError.message) : "Koneksi gagal";
  }

  function fillKecamatan() {
    const current = siteEl.value;
    const names = ["Semua kecamatan"].concat(Array.from(new Set(HOTSPOTS.map(function (item) { return item.site; }))).sort());
    siteEl.innerHTML = "";
    names.forEach(function (name) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      siteEl.appendChild(opt);
    });
    if (names.indexOf(current) !== -1) siteEl.value = current;
  }

  function filtered() {
    const site = siteEl.value || "Semua kecamatan";
    const conf = statusEl.value;
    return HOTSPOTS.filter(function (item) {
      return (site === "Semua kecamatan" || item.site === site) && (conf === "semua" || item.conf === conf);
    });
  }

  function renderSat() {
    const rows = filtered();
    satGrid.innerHTML = SATS.map(function (satItem) {
      const group = rows.filter(function (item) { return item.sat === satItem.id; });
      const low = group.filter(function (i) { return i.conf === "low"; }).length;
      const med = group.filter(function (i) { return i.conf === "medium"; }).length;
      const high = group.filter(function (i) { return i.conf === "high"; }).length;
      return (
        '<div class="sat-block"><h3>' + satItem.label + "</h3><ul>" +
          '<li><i class="diamond low"></i>' + low + "</li>" +
          '<li><i class="diamond medium"></i>' + med + "</li>" +
          '<li><i class="diamond high"></i>' + high + "</li>" +
          "<li>" + group.length + "</li>" +
        "</ul></div>"
      );
    }).join("");
  }

  function renderList() {
    if (listMode === "kasus") {
      countEl.textContent = String(CASES.length);
      listEl.innerHTML = CASES.length ? CASES.map(function (item) {
        const on = item.id === selectedId ? " is-on" : "";
        return (
          '<button class="hotspot-item' + on + '" type="button" data-id="' + item.id + '">' +
            '<span class="pin-mini kasus"><i></i></span>' +
            '<span class="copy"><b>' + esc(item.lokasi) + '</b><span class="meta">' + esc(item.tanggal) + " · " + esc(item.site) + "</span></span>" +
            '<span class="badge kasus">' + (item.eksternal ? "Eksternal" : "Internal") + "</span>" +
          "</button>"
        );
      }).join("") : '<p class="demo-note">Data kejadian belum termuat.</p>';
      return;
    }
    const rows = filtered();
    countEl.textContent = String(rows.length);
    listEl.innerHTML = rows.length ? rows.map(function (item) {
      const on = item.id === selectedId ? " is-on" : "";
      return (
        '<button class="hotspot-item' + on + '" type="button" data-id="' + item.id + '">' +
          '<span class="pin-mini ' + item.level + '"><i></i></span>' +
          '<span class="copy"><b>' + item.name + '</b><span class="meta">' + item.source + " · " + item.kec + "</span></span>" +
          '<span class="badge ' + item.level + '">' + LEVELS[item.level].badge + "</span>" +
        "</button>"
      );
    }).join("") : '<p class="demo-note">Tidak ada hotspot untuk filter ini.</p>';
  }

  function renderMarkers() {
    Object.keys(markers).forEach(function (id) {
      map.removeLayer(markers[id]);
      delete markers[id];
    });
    filtered().forEach(function (item) {
      const marker = L.marker([item.lat, item.lng], {
        icon: markerIcon(item.level, item.id === selectedId),
        title: item.name
      }).addTo(map);
      marker.on("click", function () { select(item.id, true); });
      markers[item.id] = marker;
    });
  }

  function renderCaseMarkers() {
    Object.keys(caseMarkers).forEach(function (id) {
      map.removeLayer(caseMarkers[id]);
      delete caseMarkers[id];
    });
    if (!showKasus) return;
    CASES.forEach(function (item) {
      if (Number.isNaN(item.lat) || Number.isNaN(item.lng)) return;
      const marker = L.marker([item.lat, item.lng], {
        icon: kasusIcon(item.id === selectedId),
        title: item.lokasi + " · " + item.site,
        zIndexOffset: 800
      }).addTo(map);
      marker.on("click", function () { select(item.id, true); });
      caseMarkers[item.id] = marker;
    });
  }

  function renderCaseDetail(item) {
    const n = item.notif;
    emptyEl.hidden = true;
    cardEl.hidden = false;
    detailPane.classList.add("is-open");
    cardEl.innerHTML =
      "<small>Kejadian lapangan · " + esc(item.site) + "</small>" +
      "<h2>" + esc(item.lokasi) + "</h2>" +
      '<p><span class="badge kasus">' + (item.eksternal ? "Eksternal" : "Internal") + "</span></p>" +
      '<p class="notif-box">' + esc(n.raw) + "</p>" +
      '<div class="detail-grid">' +
        "<div><span>Tanggal</span><strong>" + esc(formatDate(item.tanggal)) + "</strong></div>" +
        "<div><span>Site</span><strong>" + esc(item.site) + "</strong></div>" +
        "<div><span>Perusahaan</span><strong>" + esc(n.perusahaan || "—") + "</strong></div>" +
        "<div><span>Jam dilaporkan</span><strong>" + esc(n.jamLapor || n.jamKejadian || "—") + "</strong></div>" +
        "<div><span>Koordinat</span><strong>" + item.lat.toFixed(6) + ", " + item.lng.toFixed(6) + "</strong></div>" +
        "<div><span>Yang merespon</span><strong>" + esc(item.respon) + "</strong></div>" +
        "<div class='span-2'><span>Korban / lingkungan</span><strong>" + esc(n.korban || "—") + "</strong></div>" +
        "<div class='span-2'><span>Tindakan</span><strong>" + esc(n.tindakan || "Tim ER merespon ke lokasi.") + "</strong></div>" +
        "<div class='span-2'><span>Koordinat respon awal</span><strong>" + esc(item.responAwal) + "</strong></div>" +
      "</div>" +
      '<div class="detail-actions">' +
        '<button class="go" type="button" id="focus-spot">Fokuskan di peta</button>' +
      "</div>" +
      '<p class="demo-note">Data kasus lapangan Berau Coal OHS.</p>';
    const focus = document.getElementById("focus-spot");
    if (focus) {
      focus.addEventListener("click", function () {
        map.flyTo([item.lat, item.lng], 14, { duration: 0.8 });
      });
    }
  }
  function satLabel(id) {
    const found = SATS.find(function (s) { return s.id === id; });
    return found ? found.label : id;
  }

  function applyCaseRecords(records) {
    CASES = (records || []).map(function (rec, index) {
      const notif = parseNotif(rec.notifikasi);
      return {
        kind: "kasus",
        id: "kasus-" + (rec.excel_row || index + 1),
        tanggal: rec.tanggal,
        site: rec.site || "—",
        lokasi: notif.lokasi || notif.uraian || rec.site || "Kejadian Karhutla",
        lat: Number(rec.latitude),
        lng: Number(rec.longitude),
        respon: String(rec.yang_merespon || "—").replace(/\n/g, ", "),
        responAwal: rec.titik_koordinat_respon_awal ? String(rec.titik_koordinat_respon_awal).replace(/\n/g, " · ") : "—",
        eksternal: String(rec.keterangan || "").toLowerCase() === "eksternal",
        notif: notif
      };
    });
    renderCaseMarkers();
    if (listMode === "kasus") renderList();
  }

  function loadCases() {
    const bundled = window.KARHUTLA_CASE_DATA;
    const records = bundled && bundled.sheets && bundled.sheets[0] && bundled.sheets[0].records;
    if (records) {
      applyCaseRecords(records);
      return;
    }
    fetch("Data_Titik_Koordinat_Karhutla.json")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        applyCaseRecords(json.sheets && json.sheets[0] && json.sheets[0].records);
      })
      .catch(function (err) {
        console.error("Gagal memuat data kejadian", err);
      });
  }

  function findItem(id) {
    return CASES.find(function (row) { return row.id === id; }) ||
      HOTSPOTS.find(function (row) { return row.id === id; });
  }

  function renderDetail(item) {
    if (!item) {
      emptyEl.hidden = false;
      cardEl.hidden = true;
      detailPane.classList.remove("is-open");
      return;
    }
    if (item.kind === "kasus") {
      renderCaseDetail(item);
      return;
    }
    emptyEl.hidden = true;
    cardEl.hidden = false;
    detailPane.classList.add("is-open");
    cardEl.innerHTML =
      "<small>" + item.source + " · " + item.kab + "</small>" +
      "<h2>" + item.name + "</h2>" +
      '<p><span class="badge ' + item.level + '">' + LEVELS[item.level].label + " · " + item.confidence + "%</span></p>" +
      '<div class="detail-grid">' +
        "<div><span>Koordinat</span><strong>" + item.lat.toFixed(5) + ", " + item.lng.toFixed(5) + "</strong></div>" +
        "<div><span>Satelit</span><strong>" + satLabel(item.sat) + "</strong></div>" +
        "<div><span>Desa</span><strong>" + item.desa + "</strong></div>" +
        "<div><span>Kecamatan</span><strong>" + item.kec + "</strong></div>" +
        "<div><span>Kabupaten</span><strong>" + item.kab + "</strong></div>" +
        "<div><span>Waktu</span><strong>" + item.detected + "</strong></div>" +
      "</div>" +
      '<div class="detail-actions">' +
        '<button class="go" type="button" id="focus-spot">Fokuskan di peta</button>' +
        '<a class="ghost" href="https://sipongi.gakkum.kehutanan.go.id/peta" target="_blank" rel="noopener">Buka SiPongi</a>' +
      "</div>" +
      '<p class="demo-note">Sumber: SIPONGI KEMENHUT. Hotspot satelit bukan bukti mutlak kebakaran.</p>';
    const focus = document.getElementById("focus-spot");
    if (focus) {
      focus.addEventListener("click", function () {
        map.flyTo([item.lat, item.lng], 13, { duration: 0.8 });
      });
    }
  }

  function select(id, fly) {
    selectedId = id;
    const item = findItem(id);
    if (item && item.kind === "kasus") listMode = "kasus";
    document.querySelectorAll("[data-list]").forEach(function (el) {
      el.classList.toggle("is-on", el.getAttribute("data-list") === listMode);
    });
    satGrid.hidden = listMode === "kasus";
    document.querySelector(".filters").hidden = listMode === "kasus";
    renderSat();
    renderList();
    renderMarkers();
    renderCaseMarkers();
    renderDetail(item);
    if (item && fly) map.flyTo([item.lat, item.lng], 14, { duration: 0.75 });
  }

  function refreshView() {
    if (selectedId && String(selectedId).indexOf("kasus-") !== 0 && !filtered().some(function (item) { return item.id === selectedId; })) {
      selectedId = null;
      renderDetail(null);
    }
    renderSat();
    renderList();
    renderMarkers();
    renderCaseMarkers();
  }

  function toggleDate() {
    dateWrap.hidden = periodEl.value !== "custom";
    if (!dateEl.value) {
      const now = new Date();
      dateEl.value = now.toISOString().slice(0, 10);
    }
  }

  listEl.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    select(btn.getAttribute("data-id"), true);
  });
  siteEl.addEventListener("change", refreshView);
  statusEl.addEventListener("change", refreshView);
  periodEl.addEventListener("change", function () {
    toggleDate();
    loadHotspots();
  });
  dateEl.addEventListener("change", function () {
    if (periodEl.value === "custom") loadHotspots();
  });
  areaEl.addEventListener("change", loadHotspots);
  refreshBtn.addEventListener("click", loadHotspots);

  document.querySelectorAll("[data-list]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      listMode = btn.getAttribute("data-list");
      document.querySelectorAll("[data-list]").forEach(function (el) {
        el.classList.toggle("is-on", el.getAttribute("data-list") === listMode);
      });
      satGrid.hidden = listMode === "kasus";
      document.querySelector(".filters").hidden = listMode === "kasus";
      renderList();
    });
  });

  document.getElementById("zoom-in").addEventListener("click", function () { map.zoomIn(); });
  document.getElementById("zoom-out").addEventListener("click", function () { map.zoomOut(); });
  document.getElementById("zoom-fit").addEventListener("click", fitOps);

  document.querySelectorAll("[data-layer]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const layer = btn.getAttribute("data-layer");
      if (layer === "dark" || layer === "sat") {
        document.querySelectorAll("[data-layer='dark'], [data-layer='sat']").forEach(function (el) {
          el.classList.remove("is-on");
        });
        btn.classList.add("is-on");
        if (layer === "dark") {
          if (!map.hasLayer(dark)) dark.addTo(map);
          if (map.hasLayer(sat)) map.removeLayer(sat);
        } else {
          if (!map.hasLayer(sat)) sat.addTo(map);
          if (map.hasLayer(dark)) map.removeLayer(dark);
        }
        return;
      }
      if (layer === "ops") {
        if (map.hasLayer(opsLayer)) {
          map.removeLayer(opsLayer);
          btn.classList.remove("is-on");
        } else {
          opsLayer.addTo(map);
          btn.classList.add("is-on");
        }
        return;
      }
      if (layer === "kasus") {
        showKasus = !showKasus;
        btn.classList.toggle("is-on", showKasus);
        renderCaseMarkers();
        return;
      }
      if (layer === "fdrs") {
        if (map.hasLayer(fdrsLayer)) {
          map.removeLayer(fdrsLayer);
          btn.classList.remove("is-on");
        } else {
          fdrsLayer.addTo(map);
          btn.classList.add("is-on");
        }
      }
    });
  });

  document.querySelector("[data-layer='ops']").classList.add("is-on");
  opsLayer.addTo(map);
  setTimeout(function () {
    map.invalidateSize();
    fitOps();
    loadHotspots();
    loadCases();
  }, 180);
  setInterval(loadHotspots, 5 * 60 * 1000);
})();
