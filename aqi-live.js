(function () {
  const card = document.getElementById("aqi-card");
  const selectEl = document.getElementById("aqi-location");
  const stationSelect = document.getElementById("aqi-station");
  const sourceEl = document.getElementById("aqi-source");
  const tabs = card ? card.querySelectorAll(".aqi-tabs [data-slide]") : [];
  if (!card || !selectEl || !stationSelect) return;

  const STORAGE_LOC = "karhutla-aqi-location";
  const STORAGE_STATION = "karhutla-aqi-station";
  const STORAGE_SLIDE = "karhutla-aqi-slide";
  const REFRESH_MS = 10 * 60 * 1000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const KALTIM = ["Kalimantan Timur", "Kalimantan Utara", "Kalimantan Tengah", "Kalimantan Barat", "Kalimantan Selatan"];

  const GROUPS = [
    {
      label: "Kabupaten Berau",
      items: [
        { id: "tanjung-redeb", name: "Tanjung Redeb", lat: 2.155, lon: 117.489 },
        { id: "lati", name: "Lati (area operasi)", lat: 2.217, lon: 117.583 },
        { id: "sambarata", name: "Sambarata (area operasi)", lat: 2.05, lon: 117.433 },
        { id: "binungan", name: "Binungan (area operasi)", lat: 1.867, lon: 117.55 },
        { id: "gunung-tabur", name: "Gunung Tabur", lat: 2.216, lon: 117.508 },
        { id: "sambaliung", name: "Sambaliung", lat: 2.083, lon: 117.5 },
        { id: "teluk-bayur", name: "Teluk Bayur", lat: 2.133, lon: 117.367 },
        { id: "segah", name: "Segah", lat: 2.0, lon: 117.2 },
        { id: "kelay", name: "Kelay", lat: 1.8, lon: 117.2 },
        { id: "talisayan", name: "Talisayan", lat: 1.616, lon: 118.2 },
        { id: "batu-putih", name: "Batu Putih", lat: 1.367, lon: 118.35 },
        { id: "biduk-biduk", name: "Biduk-Biduk", lat: 1.133, lon: 118.883 },
        { id: "derawan", name: "Pulau Derawan", lat: 2.284, lon: 118.246 }
      ]
    },
    {
      label: "Kalimantan Timur",
      items: [
        { id: "samarinda", name: "Samarinda", lat: -0.502, lon: 117.154 },
        { id: "balikpapan", name: "Balikpapan", lat: -1.238, lon: 116.853 },
        { id: "bontang", name: "Bontang", lat: 0.12, lon: 117.48 },
        { id: "tenggarong", name: "Tenggarong", lat: -0.412, lon: 116.985 },
        { id: "sangatta", name: "Sangatta", lat: 0.505, lon: 117.574 }
      ]
    },
    {
      label: "Kalimantan",
      items: [
        { id: "palangka-raya", name: "Palangka Raya", lat: -2.21, lon: 113.921 },
        { id: "pontianak", name: "Pontianak", lat: -0.026, lon: 109.343 },
        { id: "banjarmasin", name: "Banjarmasin", lat: -3.319, lon: 114.591 },
        { id: "sampit", name: "Sampit", lat: -2.532, lon: 112.95 }
      ]
    },
    {
      label: "Kota lain",
      items: [
        { id: "jakarta", name: "Jakarta", lat: -6.208, lon: 106.846 },
        { id: "surabaya", name: "Surabaya", lat: -7.258, lon: 112.752 },
        { id: "medan", name: "Medan", lat: 3.595, lon: 98.672 },
        { id: "makassar", name: "Makassar", lat: -5.147, lon: 119.433 }
      ]
    }
  ];

  const ALL = GROUPS.reduce(function (acc, group) {
    return acc.concat(group.items);
  }, []);

  let abortCtrl = null;
  let timer = null;
  let stations = [];
  let slide = 0;
  let lastMeteoLevel = "unknown";
  let lastStationLevel = "unknown";

  function levelFromAqi(aqi) {
    if (aqi == null || Number.isNaN(Number(aqi))) return { key: "unknown", label: "Tidak tersedia" };
    const n = Number(aqi);
    if (n <= 50) return { key: "good", label: "Baik" };
    if (n <= 100) return { key: "moderate", label: "Sedang" };
    if (n <= 150) return { key: "sensitive", label: "Tidak sehat (sensitif)" };
    if (n <= 200) return { key: "unhealthy", label: "Tidak sehat" };
    if (n <= 300) return { key: "very", label: "Sangat tidak sehat" };
    return { key: "hazard", label: "Berbahaya" };
  }

  function levelFromCategory(label, ispu) {
    const t = String(label || "").toLowerCase();
    if (t.indexOf("bahaya") !== -1 && t.indexOf("sangat") === -1) {
      return { key: "hazard", label: label };
    }
    if (t.indexOf("sangat") !== -1) return { key: "very", label: label };
    if (t.indexOf("tidak sehat") !== -1) return { key: "unhealthy", label: label };
    if (t.indexOf("sedang") !== -1) return { key: "moderate", label: label };
    if (t.indexOf("baik") !== -1) return { key: "good", label: label };
    return levelFromIspu(ispu, label);
  }

  function levelFromIspu(ispu, fallbackLabel) {
    if (ispu == null || Number.isNaN(Number(ispu))) {
      return { key: "unknown", label: fallbackLabel || "Tidak tersedia" };
    }
    const n = Number(ispu);
    let key = "hazard";
    let label = "Berbahaya";
    if (n <= 50) { key = "good"; label = "Baik"; }
    else if (n <= 100) { key = "moderate"; label = "Sedang"; }
    else if (n <= 200) { key = "unhealthy"; label = "Tidak sehat"; }
    else if (n <= 300) { key = "very"; label = "Sangat tidak sehat"; }
    return { key: key, label: fallbackLabel || label };
  }

  function formatStamp(iso, tzAbbr) {
    if (!iso) return "Waktu tidak tersedia";
    const parts = String(iso).split("T");
    const date = parts[0] || "";
    const time = (parts[1] || "").slice(0, 5);
    const bits = date.split("-");
    if (bits.length < 3) return iso;
    const month = MONTHS[Number(bits[1]) - 1] || bits[1];
    const day = String(Number(bits[2]));
    let zone = "WITA";
    if (tzAbbr === "GMT+7" || tzAbbr === "WIB") zone = "WIB";
    else if (tzAbbr === "GMT+9" || tzAbbr === "WIT") zone = "WIT";
    else if (tzAbbr && tzAbbr !== "GMT+8" && tzAbbr !== "WITA") zone = tzAbbr;
    return "Diperbarui " + day + " " + month + " " + time + " " + zone;
  }

  function formatStationTime(raw) {
    if (!raw) return "";
    const text = String(raw).trim();
    const m = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (m) {
      return "Diperbarui " + Number(m[3]) + " " + MONTHS[Number(m[2]) - 1] + " " + m[4] + ":" + m[5] + " WIB";
    }
    if (/^\d{2}:\d{2}$/.test(text)) return "Diperbarui " + text + " WIB";
    return "Diperbarui " + text;
  }

  function fillSelect(selectedId) {
    selectEl.innerHTML = "";
    GROUPS.forEach(function (group) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.items.forEach(function (item) {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.name;
        optgroup.appendChild(opt);
      });
      selectEl.appendChild(optgroup);
    });
    const valid = ALL.some(function (item) { return item.id === selectedId; });
    selectEl.value = valid ? selectedId : "tanjung-redeb";
  }

  function findLocation(id) {
    return ALL.find(function (item) { return item.id === id; }) || ALL[0];
  }

  function provinceRank(name) {
    const i = KALTIM.indexOf(name);
    return i === -1 ? 100 : i;
  }

  function stationGroupLabel(st) {
    if (st.province && KALTIM.indexOf(st.province) !== -1) return st.agency + " · " + st.province;
    if (st.province) return st.agency + " · " + st.province;
    return st.agency + " · Stasiun";
  }

  function fillStationSelect(selectedId) {
    stationSelect.innerHTML = "";
    if (!stations.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Stasiun belum termuat";
      stationSelect.appendChild(opt);
      return;
    }
    const sorted = stations.slice().sort(function (a, b) {
      const ra = provinceRank(a.province || "");
      const rb = provinceRank(b.province || "");
      if (ra !== rb) return ra - rb;
      if (a.agency !== b.agency) return a.agency === "BMKG" ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), "id");
    });
    const groups = {};
    const order = [];
    sorted.forEach(function (st) {
      const label = stationGroupLabel(st);
      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label].push(st);
    });
    order.forEach(function (label) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = label;
      groups[label].forEach(function (st) {
        const opt = document.createElement("option");
        opt.value = st.id;
        const city = st.city && st.city !== st.name ? " · " + st.city : "";
        opt.textContent = st.name + city;
        optgroup.appendChild(opt);
      });
      stationSelect.appendChild(optgroup);
    });
    const valid = stations.some(function (st) { return st.id === selectedId; });
    const fallback = stations.find(function (st) { return st.id === "klhk:SAMARINDA"; })
      || stations.find(function (st) { return /samarinda/i.test(st.name + st.city); })
      || stations[0];
    stationSelect.value = valid ? selectedId : (fallback ? fallback.id : "");
  }

  function findStation(id) {
    return stations.find(function (st) { return st.id === id; }) || stations[0] || null;
  }

  function applyCardLevel() {
    const level = slide === 1 ? lastStationLevel : lastMeteoLevel;
    card.dataset.level = level;
    card.dataset.scale = slide === 1 ? "ispu" : "us";
    if (sourceEl) {
      sourceEl.textContent = slide === 1 ? "Stasiun BMKG / KLHK" : "Open-Meteo · model";
    }
  }

  function setSlide(next) {
    slide = next ? 1 : 0;
    card.dataset.slide = String(slide);
    tabs.forEach(function (btn) {
      const on = Number(btn.getAttribute("data-slide")) === slide;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    applyCardLevel();
    try { localStorage.setItem(STORAGE_SLIDE, String(slide)); } catch (e) { /* ignore */ }
  }

  function setLoading(on) {
    card.classList.toggle("is-loading", on);
  }

  function renderMeteoError(message) {
    lastMeteoLevel = "unknown";
    document.getElementById("aqi-value").textContent = "–";
    document.getElementById("aqi-category").textContent = "Data belum termuat";
    document.getElementById("aqi-detail").textContent = "PM2.5 —";
    document.getElementById("aqi-updated").textContent = message;
    applyCardLevel();
  }

  function renderStationError(message) {
    lastStationLevel = "unknown";
    document.getElementById("aqi-st-value").textContent = "–";
    document.getElementById("aqi-st-category").textContent = "Stasiun belum termuat";
    document.getElementById("aqi-st-detail").textContent = "PM2.5 —";
    document.getElementById("aqi-st-updated").textContent = message;
    applyCardLevel();
  }

  function normalizeKlhkRows(rows) {
    return (rows || []).map(function (row) {
      if (!row || !row.id_stasiun) return null;
      const cat = row.cat || (row.kategori && row.kategori.nilai) || "";
      return {
        id: "klhk:" + row.id_stasiun,
        agency: "KLHK",
        name: row.nama || row.id_stasiun,
        city: row.kota || "",
        province: row.provinsi || "",
        pm25: row.a_pm25 == null || row.a_pm25 === "" ? null : Number(row.a_pm25),
        pm10: row.a_pm10 == null || row.a_pm10 === "" ? null : Number(row.a_pm10),
        ispu: row.val == null || row.val === "" ? (row.t_pm25 == null ? null : Number(row.t_pm25)) : Number(row.val),
        category: cat ? String(cat).replace(/\w+/g, function (w) {
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }) : "",
        time: row.waktu || ""
      };
    }).filter(Boolean);
  }

  async function fetchStations() {
    try {
      const res = await fetch("aqi-station.php", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.stations && data.stations.length) {
          return data.stations;
        }
      }
    } catch (e) { /* fall through to KLHK direct */ }

    const res = await fetch("https://ispu.kemenlh.go.id/apimobile/v1/getStations");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return normalizeKlhkRows(data.rows);
  }

  function renderStation(st) {
    if (!st) {
      renderStationError("Tidak ada stasiun terdekat. Berau belum punya alat ukur.");
      return;
    }
    const level = levelFromCategory(st.category, st.ispu);
    lastStationLevel = level.key;
    const ispu = st.ispu == null || Number.isNaN(Number(st.ispu)) ? "–" : String(Math.round(Number(st.ispu)));
    document.getElementById("aqi-st-value").textContent = ispu;
    document.getElementById("aqi-st-category").textContent = level.label;
    const parts = [];
    if (st.pm25 != null && !Number.isNaN(Number(st.pm25))) {
      parts.push("PM2.5 " + Number(st.pm25).toFixed(1) + " µg/m³");
    }
    if (st.pm10 != null && !Number.isNaN(Number(st.pm10))) {
      parts.push("PM10 " + Number(st.pm10).toFixed(1));
    }
    document.getElementById("aqi-st-detail").textContent = parts.length ? parts.join(" · ") : "PM2.5 —";
    const where = st.agency + " · " + (st.city || st.name);
    document.getElementById("aqi-st-updated").textContent = (formatStationTime(st.time) || "Data stasiun")
      + " · " + where
      + " (bukan Berau)";
    applyCardLevel();
  }

  async function loadMeteo(id) {
    const loc = findLocation(id);
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    setLoading(true);

    const url = "https://air-quality-api.open-meteo.com/v1/air-quality"
      + "?latitude=" + encodeURIComponent(loc.lat)
      + "&longitude=" + encodeURIComponent(loc.lon)
      + "&current=us_aqi,pm2_5,pm10"
      + "&timezone=auto";

    try {
      const res = await fetch(url, { signal: abortCtrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const current = data.current || {};
      const aqi = current.us_aqi;
      const level = levelFromAqi(aqi);
      lastMeteoLevel = level.key;
      document.getElementById("aqi-value").textContent = aqi == null ? "–" : String(Math.round(Number(aqi)));
      document.getElementById("aqi-category").textContent = level.label;
      const parts = [];
      if (current.pm2_5 != null) parts.push("PM2.5 " + Number(current.pm2_5).toFixed(1) + " µg/m³");
      if (current.pm10 != null) parts.push("PM10 " + Number(current.pm10).toFixed(1));
      document.getElementById("aqi-detail").textContent = parts.length ? parts.join(" · ") : "PM2.5 —";
      document.getElementById("aqi-updated").textContent = formatStamp(current.time, data.timezone_abbreviation);
      applyCardLevel();
    } catch (err) {
      if (err && err.name === "AbortError") return;
      renderMeteoError("Gagal memuat data model. Coba pilih lokasi lain.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStations(keepId) {
    try {
      stations = await fetchStations();
      fillStationSelect(keepId);
      renderStation(findStation(stationSelect.value));
    } catch (err) {
      renderStationError("Gagal memuat stasiun BMKG / KLHK.");
    }
  }

  function persistMeteo() {
    const id = selectEl.value;
    try { localStorage.setItem(STORAGE_LOC, id); } catch (e) { /* ignore */ }
    loadMeteo(id);
  }

  function persistStation() {
    const id = stationSelect.value;
    try { localStorage.setItem(STORAGE_STATION, id); } catch (e) { /* ignore */ }
    renderStation(findStation(id));
  }

  let savedLoc = "tanjung-redeb";
  let savedStation = "klhk:SAMARINDA";
  try {
    savedLoc = localStorage.getItem(STORAGE_LOC) || savedLoc;
    savedStation = localStorage.getItem(STORAGE_STATION) || savedStation;
    slide = localStorage.getItem(STORAGE_SLIDE) === "1" ? 1 : 0;
    if (location.hash === "#stasiun") slide = 1;
  } catch (e) { /* ignore */ }

  fillSelect(savedLoc);
  persistMeteo();
  loadStations(savedStation);
  setSlide(slide);

  selectEl.addEventListener("change", persistMeteo);
  stationSelect.addEventListener("change", persistStation);

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSlide(Number(btn.getAttribute("data-slide")));
    });
  });
  const prev = document.getElementById("aqi-prev");
  const next = document.getElementById("aqi-next");
  if (prev) prev.addEventListener("click", function () { setSlide(slide ? 0 : 1); });
  if (next) next.addEventListener("click", function () { setSlide(slide ? 0 : 1); });

  const viewport = document.getElementById("aqi-viewport");
  if (viewport) {
    let startX = 0;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest("select")) return;
      startX = e.clientX;
    });
    viewport.addEventListener("pointerup", function (e) {
      if (e.target && e.target.closest && e.target.closest("select")) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) < 40) return;
      setSlide(dx < 0 ? 1 : 0);
    });
  }

  timer = setInterval(function () {
    loadMeteo(selectEl.value);
    loadStations(stationSelect.value);
  }, REFRESH_MS);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    loadMeteo(selectEl.value);
    loadStations(stationSelect.value);
  });

  window.addEventListener("beforeunload", function () {
    if (timer) clearInterval(timer);
    if (abortCtrl) abortCtrl.abort();
  });
})();
