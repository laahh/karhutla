(function () {
  if (!window.KarhutlaData || typeof window.setTrendData !== "function") return;
  const KD = window.KarhutlaData;
  const STORAGE_KEY = "karhutla-trend-span";
  const RANGE_DAYS = { "7": 7, "10": 10, "30": 30 };
  let spanDays = 10;
  let refreshSeq = 0;

  function readSavedSpan() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (RANGE_DAYS[raw]) return RANGE_DAYS[raw];
    } catch (err) {
      /* ignore */
    }
    return 10;
  }

  function saveSpan(days) {
    try { localStorage.setItem(STORAGE_KEY, String(days)); } catch (err) { /* ignore */ }
  }

  function syncRangeButtons() {
    document.querySelectorAll(".trend-range-btn").forEach(function (btn) {
      const days = RANGE_DAYS[btn.getAttribute("data-range")];
      btn.classList.toggle("is-on", days === spanDays);
    });
  }

  function setRangeBusy(busy) {
    document.querySelectorAll(".trend-range-btn").forEach(function (btn) {
      btn.disabled = !!busy;
    });
  }

  function laporanDateKeys() {
    const keys = {};
    const reports = window.KARHUTLA_LAPORAN_DATA && window.KARHUTLA_LAPORAN_DATA.reports;
    (reports || []).forEach(function (rep) {
      const op = (rep && rep.operasi_karhutla) || {};
      const key = KD.dayKey(op.tanggal);
      if (key) keys[key] = true;
    });
    return Object.keys(keys).sort();
  }

  function addDays(key, delta) {
    const d = new Date(key + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function maxKey(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a >= b ? a : b;
  }

  function axisDateKeys(cases) {
    const keys = {};
    (cases || []).forEach(function (c) {
      if (c && c.tanggal) keys[c.tanggal] = true;
    });
    laporanDateKeys().forEach(function (key) { keys[key] = true; });
    const sorted = Object.keys(keys).sort();
    const today = KD.todayKey();
    const latest = sorted.length ? sorted[sorted.length - 1] : today;
    const end = maxKey(latest, today);
    return buildDateRange(addDays(end, -(spanDays - 1)), end);
  }

  function buildDateRange(from, to) {
    const keys = [];
    const cursor = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      keys.push(y + "-" + m + "-" + d);
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }

  function labelFor(key) {
    const d = new Date(key + "T00:00:00");
    return d.getDate() + "-" + d.toLocaleDateString("en-US", { month: "short" });
  }

  async function refresh() {
    const seq = ++refreshSeq;
    setRangeBusy(true);
    try {
      const cases = KD.loadMergedCases();
      const dateKeys = axisDateKeys(cases);
      if (!dateKeys.length) return;
      const labels = dateKeys.map(labelFor);
      const chartEl = document.getElementById("trend-chart");
      if (chartEl) {
        chartEl.setAttribute(
          "aria-label",
          "Grafik tren hotspot dan karhutla " + labels[0] + " sampai " + labels[labels.length - 1]
        );
      }
      const internal = dateKeys.map(function (key) {
        return cases.filter(function (c) { return c.tanggal === key && !c.eksternal; }).length;
      });
      const eksternal = dateKeys.map(function (key) {
        return cases.filter(function (c) { return c.tanggal === key && c.eksternal; }).length;
      });

      const perDay = [];
      for (let i = 0; i < dateKeys.length; i += 3) {
        if (seq !== refreshSeq) return;
        const slice = dateKeys.slice(i, i + 3);
        const part = await Promise.all(slice.map(function (key) {
          return KD.fetchSipongi(key, key);
        }));
        for (let p = 0; p < part.length; p += 1) perDay.push(part[p]);
      }

      if (seq !== refreshSeq) return;

      if (perDay.every(function (features) { return features == null; })) {
        window.setTrendData(labels, internal, eksternal, null);
        return;
      }

      const active = perDay.map(function (features) { return features ? features.length : 0; });
      window.setTrendData(labels, internal, eksternal, active);
    } finally {
      if (seq === refreshSeq) setRangeBusy(false);
    }
  }

  spanDays = readSavedSpan();
  syncRangeButtons();
  document.querySelectorAll(".trend-range-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const days = RANGE_DAYS[btn.getAttribute("data-range")];
      if (!days || days === spanDays) return;
      spanDays = days;
      saveSpan(days);
      syncRangeButtons();
      refresh();
    });
  });

  const ready = window.KarhutlaLaporanStore
    ? KarhutlaLaporanStore.hydrate()
    : Promise.resolve();
  ready.then(refresh).catch(refresh);
})();
