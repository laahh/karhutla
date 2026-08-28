(function () {
  if (!window.KarhutlaData || typeof window.setTrendData !== "function") return;
  const KD = window.KarhutlaData;

  const FROM = "2026-08-10";
  const TO = "2026-08-25";

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
    const dateKeys = buildDateRange(FROM, TO);
    const labels = dateKeys.map(labelFor);

    const cases = KD.loadMergedCases();
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
    const perDay = await Promise.all(dateKeys.map(function (key) {
      return KD.fetchSipongi(key, key);
    }));

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
