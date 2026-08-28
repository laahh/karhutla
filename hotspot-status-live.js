(function () {
  const titikEl = document.getElementById("live-titik-aktif");
  const perTanggalEl = document.getElementById("live-per-tanggal");
  const internalEl = document.getElementById("live-internal");
  const eksternalEl = document.getElementById("live-eksternal");
  const noteEl = document.getElementById("live-status-note");
  if (!titikEl || !window.KarhutlaData) return;

  const KD = window.KarhutlaData;

  async function refresh() {
    const cases = KD.loadMergedCases();
    const day = KD.pickActiveDay(cases);
    const todays = cases.filter(function (c) { return c.tanggal === day; });
    const internal = todays.filter(function (c) { return !c.eksternal; }).length;
    const eksternal = todays.filter(function (c) { return c.eksternal; }).length;

    internalEl.textContent = String(internal);
    eksternalEl.textContent = String(eksternal);
    const dateLabel = "Per " + KD.formatDate(day);

    const features = await KD.fetchSipongi(day, day);
    if (features == null) {
      titikEl.textContent = "–";
      perTanggalEl.textContent = dateLabel;
      noteEl.textContent = "SiPongi belum termuat. Data internal/eksternal tetap dari penanganan terverifikasi.";
      return;
    }

    const sipongiCount = features.length;
    titikEl.textContent = String(sipongiCount);
    perTanggalEl.textContent = dateLabel;
    noteEl.textContent = sipongiCount === 0
      ? "Kondisi saat ini sudah zero titik aktif. Tetap fokus pada patroli pencegahan dan validasi lapangan."
      : sipongiCount + " titik hotspot SiPongi terpantau pada tanggal ini. Prioritaskan validasi dan respons lapangan.";
  }

  const ready = window.KarhutlaLaporanStore
    ? KarhutlaLaporanStore.hydrate()
    : Promise.resolve();
  ready.then(refresh).catch(refresh);
})();
