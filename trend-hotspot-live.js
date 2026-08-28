(function () {
  if (!window.KarhutlaData || typeof window.setTrendData !== "function") return;
  const KD = window.KarhutlaData;

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
    return buildDateRange(addDays(end, -9), end);
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

    // Query SiPongi once per day (same single-day from=to=day request
    // hotspot.html issues when you pick that date), run in parallel, so the
    // count for each day is guaranteed identical to what hotspot.html shows
    // for that same day — not a range query bucketed on our own.
    const perDay = [];
    for (let i = 0; i < dateKeys.length; i += 3) {
      const slice = dateKeys.slice(i, i + 3);
      const part = await Promise.all(slice.map(function (key) {
        return KD.fetchSipongi(key, key);
      }));
      for (let p = 0; p < part.length; p += 1) perDay.push(part[p]);
    }

    if (perDay.every(function (features) { return features == null; })) {
      // No live SiPongi data available at all — still show real case counts for the bars.
      window.setTrendData(labels, internal, eksternal, null);
      return;
    }

    const active = perDay.map(function (features) { return features ? features.length : 0; });

    window.setTrendData(labels, internal, eksternal, active);
  }

  const ready = window.KarhutlaLaporanStore
    ? KarhutlaLaporanStore.hydrate()
    : Promise.resolve();
  ready.then(refresh).catch(refresh);
})();
