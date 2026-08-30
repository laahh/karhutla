(function () {
  const titikEl = document.getElementById("live-titik-aktif");
  const perTanggalEl = document.getElementById("live-per-tanggal");
  const internalEl = document.getElementById("live-internal");
  const eksternalEl = document.getElementById("live-eksternal");
  const noteEl = document.getElementById("live-status-note");
  const navEl = document.getElementById("status-date-nav");
  const prevBtn = document.getElementById("status-date-prev");
  const nextBtn = document.getElementById("status-date-next");
  const dateInput = document.getElementById("status-date-input");
  const mainEl = document.querySelector(".dash-status .status-main");
  if (!titikEl || !window.KarhutlaData) return;

  const KD = window.KarhutlaData;
  const BACK_DAYS = 60;
  let selectedDay = "";
  let minDay = "";
  let maxDay = "";
  let loadSeq = 0;

  function addDays(key, delta) {
    const parts = String(key || "").split("-").map(Number);
    if (parts.length < 3 || !parts[0]) return key;
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + delta));
    return d.toISOString().slice(0, 10);
  }

  function clampDay(key) {
    if (!key) return maxDay;
    if (minDay && key < minDay) return minDay;
    if (maxDay && key > maxDay) return maxDay;
    return key;
  }

  function setLoading(on) {
    if (navEl) navEl.classList.toggle("is-loading", on);
    if (mainEl) mainEl.classList.toggle("is-loading", on);
  }

  function syncControls() {
    if (prevBtn) prevBtn.disabled = !selectedDay || selectedDay <= minDay;
    if (nextBtn) nextBtn.disabled = !selectedDay || selectedDay >= maxDay;
    if (dateInput) {
      dateInput.min = minDay;
      dateInput.max = maxDay;
      dateInput.value = selectedDay;
    }
  }

  async function refresh() {
    const day = selectedDay;
    const seq = ++loadSeq;
    const cases = KD.loadMergedCases();
    const todays = cases.filter(function (c) { return c.tanggal === day; });
    const internal = todays.filter(function (c) { return !c.eksternal; }).length;
    const eksternal = todays.filter(function (c) { return c.eksternal; }).length;

    internalEl.textContent = String(internal);
    eksternalEl.textContent = String(eksternal);
    perTanggalEl.textContent = "Per " + KD.formatDate(day);
    syncControls();
    setLoading(true);

    const features = await KD.fetchSipongi(day, day);
    if (seq !== loadSeq) return;
    setLoading(false);

    if (features == null) {
      titikEl.textContent = "–";
      noteEl.textContent = "SiPongi belum termuat. Data internal/eksternal tetap dari penanganan terverifikasi.";
      return;
    }

    const sipongiCount = features.length;
    titikEl.textContent = String(sipongiCount);
    noteEl.textContent = sipongiCount === 0
      ? "Kondisi saat ini sudah zero titik aktif. Tetap fokus pada patroli pencegahan dan validasi lapangan."
      : sipongiCount + " titik hotspot SiPongi terpantau pada tanggal ini. Prioritaskan validasi dan respons lapangan.";
  }

  function goTo(key) {
    const next = clampDay(key);
    if (!next || next === selectedDay) {
      syncControls();
      return;
    }
    selectedDay = next;
    refresh();
  }

  function boot() {
    const cases = KD.loadMergedCases();
    maxDay = KD.todayKey();
    minDay = addDays(maxDay, -(BACK_DAYS - 1));
    selectedDay = clampDay(KD.pickActiveDay(cases));
    refresh();
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () { goTo(addDays(selectedDay, -1)); });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () { goTo(addDays(selectedDay, 1)); });
  }
  if (dateInput) {
    dateInput.addEventListener("change", function () { goTo(dateInput.value); });
  }

  const swipeRoot = document.querySelector(".dash-status");
  if (swipeRoot) {
    let startX = 0;
    swipeRoot.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest("button, input, a")) return;
      startX = e.clientX;
    });
    swipeRoot.addEventListener("pointerup", function (e) {
      if (e.target && e.target.closest && e.target.closest("button, input, a")) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) < 40) return;
      goTo(addDays(selectedDay, dx < 0 ? 1 : -1));
    });
  }

  const ready = window.KarhutlaLaporanStore
    ? KarhutlaLaporanStore.hydrate()
    : Promise.resolve();
  ready.then(boot).catch(boot);
})();
