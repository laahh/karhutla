(function () {
  const card = document.getElementById("aqi-card");
  const selectEl = document.getElementById("aqi-location");
  const valueEl = document.getElementById("aqi-value");
  const categoryEl = document.getElementById("aqi-category");
  const detailEl = document.getElementById("aqi-detail");
  const updatedEl = document.getElementById("aqi-updated");
  if (!card || !selectEl) return;

  const STORAGE_KEY = "karhutla-aqi-location";
  const REFRESH_MS = 10 * 60 * 1000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

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

  function levelFromAqi(aqi) {
    if (aqi == null || Number.isNaN(Number(aqi))) {
      return { key: "unknown", label: "Tidak tersedia" };
    }
    const n = Number(aqi);
    if (n <= 50) return { key: "good", label: "Baik" };
    if (n <= 100) return { key: "moderate", label: "Sedang" };
    if (n <= 150) return { key: "sensitive", label: "Tidak sehat (sensitif)" };
    if (n <= 200) return { key: "unhealthy", label: "Tidak sehat" };
    if (n <= 300) return { key: "very", label: "Sangat tidak sehat" };
    return { key: "hazard", label: "Berbahaya" };
  }

  function formatStamp(iso, tzAbbr) {
    if (!iso) return "Waktu tidak tersedia";
    const parts = iso.split("T");
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

  function setLoading(on) {
    card.classList.toggle("is-loading", on);
  }

  function renderError(message) {
    card.dataset.level = "unknown";
    valueEl.textContent = "–";
    categoryEl.textContent = "Data belum termuat";
    detailEl.textContent = "PM2.5 —";
    updatedEl.textContent = message;
  }

  async function load(id) {
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
      const pm25 = current.pm2_5;
      const pm10 = current.pm10;

      card.dataset.level = level.key;
      valueEl.textContent = aqi == null ? "–" : String(Math.round(Number(aqi)));
      categoryEl.textContent = level.label;

      const parts = [];
      if (pm25 != null) parts.push("PM2.5 " + Number(pm25).toFixed(1) + " µg/m³");
      if (pm10 != null) parts.push("PM10 " + Number(pm10).toFixed(1));
      detailEl.textContent = parts.length ? parts.join(" · ") : "PM2.5 —";
      updatedEl.textContent = formatStamp(current.time, data.timezone_abbreviation);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      renderError("Gagal memuat data. Coba pilih lokasi lain.");
    } finally {
      setLoading(false);
    }
  }

  function persistAndLoad() {
    const id = selectEl.value;
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* ignore */ }
    load(id);
  }

  let saved = "tanjung-redeb";
  try { saved = localStorage.getItem(STORAGE_KEY) || saved; } catch (e) { /* ignore */ }

  fillSelect(saved);
  persistAndLoad();
  selectEl.addEventListener("change", persistAndLoad);

  timer = setInterval(function () {
    load(selectEl.value);
  }, REFRESH_MS);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) load(selectEl.value);
  });

  window.addEventListener("beforeunload", function () {
    if (timer) clearInterval(timer);
    if (abortCtrl) abortCtrl.abort();
  });
})();
