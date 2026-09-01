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
  const statPctEl = document.getElementById("stat-patroli-pct");
  const statDetailEl = document.getElementById("stat-patroli-detail");
  const livePctEl = document.getElementById("live-patroli-pct");
  const liveBarEl = document.getElementById("live-patroli-bar");
  const liveDetailEl = document.getElementById("live-patroli-detail");
  const inspeksiCountEl = document.getElementById("live-inspeksi-count");
  const inspeksiLabelEl = document.getElementById("live-inspeksi-label");
  const inspeksiAmanEl = document.getElementById("live-inspeksi-aman");
  const inspeksiGapEl = document.getElementById("live-inspeksi-gap");
  const handleKruEl = document.getElementById("live-handle-kru");
  const handleJamEl = document.getElementById("live-handle-jam");
  const sumOpsEl = document.getElementById("live-sum-ops");
  const sumDurEl = document.getElementById("live-sum-dur");
  const sumKruEl = document.getElementById("live-sum-kru");
  const sumNoteEl = document.getElementById("live-sum-note");
  const sumDayBtn = document.getElementById("status-sum-day");
  const sumWeekBtn = document.getElementById("status-sum-week");
  if (!titikEl || !window.KarhutlaData) return;

  const KD = window.KarhutlaData;
  const BACK_DAYS = 60;
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  let selectedDay = "";
  let minDay = "";
  let maxDay = "";
  let loadSeq = 0;
  let sumMode = "day";

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

  function patrolRecords() {
    const data = window.KARHUTLA_PATROLI_DATA;
    return data && Array.isArray(data.records) ? data.records : [];
  }

  function patrolsOnDay(day) {
    return patrolRecords().filter(function (row) {
      return KD.dayKey(row && row.tanggal) === day;
    });
  }

  function patrolCoord(row) {
    const lat = Number(row && row.lat);
    const lng = Number(row && row.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: lat, lng: lng };
    const raw = String((row && row.koordinat) || "").trim();
    const m = raw.match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    return { lat: NaN, lng: NaN };
  }

  function featureCoord(feature) {
    const p = (feature && feature.properties) || {};
    const g = feature && feature.geometry && feature.geometry.coordinates
      ? feature.geometry.coordinates
      : [p.long, p.lat];
    return {
      lat: Number(p.lat != null ? p.lat : g[1]),
      lng: Number(p.long != null ? p.long : g[0])
    };
  }

  function haversineKm(aLat, aLng, bLat, bLng) {
    const R = 6371;
    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLng = (bLng - aLng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function featureInKonsesi(feature) {
    const xy = featureCoord(feature);
    return Number.isFinite(xy.lat) && Number.isFinite(xy.lng) && KD.insideIupk(xy.lat, xy.lng);
  }

  function hotspotCovered(feature, patrols, day) {
    const xy = featureCoord(feature);
    const key = Number.isFinite(xy.lat) && Number.isFinite(xy.lng)
      ? day + "|" + xy.lat.toFixed(5) + "|" + xy.lng.toFixed(5)
      : "";
    if (key) {
      const hit = patrols.find(function (row) { return row && row.hotspot_key === key; });
      if (hit) return true;
    }
    if (!Number.isFinite(xy.lat) || !Number.isFinite(xy.lng)) return false;
    return patrols.some(function (row) {
      const pxy = patrolCoord(row);
      if (!Number.isFinite(pxy.lat) || !Number.isFinite(pxy.lng)) return false;
      return haversineKm(xy.lat, xy.lng, pxy.lat, pxy.lng) < 0.15;
    });
  }

  function statusSummary(patrols) {
    const counts = {};
    patrols.forEach(function (row) {
      const key = String((row && row.status) || "Aman").trim() || "Aman";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).map(function (key) {
      return counts[key] + " " + key;
    }).join(" · ");
  }

  function paintPatroli(features, day) {
    const patrols = patrolsOnDay(day);
    const konsesi = features ? features.filter(featureInKonsesi) : null;
    const hotspotN = konsesi ? konsesi.length : 0;
    let covered = 0;
    if (konsesi) {
      konsesi.forEach(function (feature) {
        if (hotspotCovered(feature, patrols, day)) covered += 1;
      });
    }
    const pct = hotspotN > 0 ? Math.round((covered / hotspotN) * 100) : (patrols.length ? 0 : 0);
    const pctText = hotspotN || patrols.length ? pct + "%" : "–";
    const statusBit = patrols.length ? statusSummary(patrols) : "belum ada patroli";
    const detail = hotspotN
      ? covered + "/" + hotspotN + " titik konsesi dipatroli · " + statusBit
      : patrols.length + " patroli · " + statusBit;

    if (statPctEl) statPctEl.textContent = pctText;
    if (statDetailEl) statDetailEl.textContent = detail;
    if (livePctEl) livePctEl.textContent = pctText;
    if (liveBarEl) liveBarEl.style.width = Math.min(100, pct) + "%";
    if (liveDetailEl) liveDetailEl.textContent = detail;
  }

  function laporanReports() {
    const data = window.KARHUTLA_LAPORAN_DATA;
    return data && Array.isArray(data.reports) ? data.reports : [];
  }

  function reportOp(rep) {
    return (rep && rep.operasi_karhutla) || {};
  }

  function reportDay(rep) {
    return KD.dayKey(reportOp(rep).tanggal);
  }

  function weekOfMonth(day) {
    const parts = String(day || "").split("-");
    const d = Number(parts[2]);
    if (!d) return 0;
    return Math.ceil(d / 7);
  }

  function sameWeek(a, b) {
    const pa = String(a || "").split("-");
    const pb = String(b || "").split("-");
    return pa[0] === pb[0] && pa[1] === pb[1] && weekOfMonth(a) === weekOfMonth(b);
  }

  function weekLabel(day) {
    const parts = String(day || "").split("-");
    const month = MONTHS[Number(parts[1]) - 1] || parts[1];
    return "Minggu " + weekOfMonth(day) + " " + month + " " + parts[0];
  }

  function parseMinutes(raw) {
    const m = String(raw || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return NaN;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function formatClock(raw) {
    const m = String(raw || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    return String(m[1]).padStart(2, "0") + ":" + m[2];
  }

  function durationMins(startRaw, endRaw) {
    const a = parseMinutes(startRaw);
    const b = parseMinutes(endRaw);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    let d = b - a;
    if (d < 0) d += 24 * 60;
    return d;
  }

  function formatDuration(mins) {
    const n = Math.max(0, Math.round(mins || 0));
    if (!n) return "0 jam";
    const h = Math.floor(n / 60);
    const m = n % 60;
    if (!h) return m + " mnt";
    if (!m) return h + " jam";
    return h + " jam " + m + " mnt";
  }

  function cleanText(value) {
    const t = String(value || "").replace(/\s+/g, " ").trim();
    if (!t || t === "-" || t.toLowerCase() === "null") return "";
    return t;
  }

  function crewFromReport(rep) {
    const tim = reportOp(rep).jumlah_tim || {};
    return [tim.berau_coal, tim.volunteer].map(cleanText).filter(function (line) {
      if (!line) return false;
      return !/tidak ada|terlambat tiba/i.test(line);
    });
  }

  function peopleCount(text) {
    const raw = cleanText(text);
    if (!raw) return 0;
    let total = 0;
    const labeled = /(\d+)\s*(?:orang|personil|org|kru)\b/gi;
    let m;
    while ((m = labeled.exec(raw))) total += Number(m[1]);
    if (total) return total;
    const nums = raw.match(/\d+/g);
    if (!nums) return 1;
    return nums.reduce(function (sum, n) { return sum + Number(n); }, 0);
  }

  function uniqueJoin(items) {
    const seen = {};
    const out = [];
    items.forEach(function (item) {
      const key = item.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out;
  }

  function reportsForDay(day) {
    return laporanReports().filter(function (rep) { return reportDay(rep) === day; });
  }

  function reportsForWeek(day) {
    return laporanReports().filter(function (rep) { return sameWeek(reportDay(rep), day); });
  }

  function summarizeReports(reports) {
    let mins = 0;
    let kruN = 0;
    const crews = [];
    const clocks = [];
    reports.forEach(function (rep) {
      const op = reportOp(rep);
      mins += durationMins(op.mulai_operasi, op.selesai_operasi);
      const crew = crewFromReport(rep);
      crew.forEach(function (line) {
        crews.push(line);
        kruN += peopleCount(line);
      });
      const start = formatClock(op.mulai_operasi);
      const end = formatClock(op.selesai_operasi);
      if (start && end) clocks.push(start + "–" + end);
      else if (start) clocks.push(start);
    });
    return {
      ops: reports.length,
      mins: mins,
      kruN: kruN,
      crews: uniqueJoin(crews),
      clocks: uniqueJoin(clocks)
    };
  }

  function paintInspeksi(day) {
    const patrols = patrolsOnDay(day);
    const total = patrols.length;
    let aman = 0;
    patrols.forEach(function (row) {
      const st = String((row && row.status) || "Aman").trim().toLowerCase();
      if (st === "aman" || st === "selesai") aman += 1;
    });
    const gap = Math.max(0, total - aman);
    if (inspeksiCountEl) inspeksiCountEl.textContent = String(total);
    if (inspeksiAmanEl) inspeksiAmanEl.textContent = String(aman);
    if (inspeksiGapEl) inspeksiGapEl.textContent = String(gap);
    if (inspeksiLabelEl) {
      inspeksiLabelEl.textContent = total
        ? "Lokasi dipatroli pada tanggal ini"
        : "Belum ada patroli pada tanggal ini";
    }
  }

  function paintHandle(day) {
    const reports = reportsForDay(day);
    const sum = summarizeReports(reports);
    let kruText = sum.crews.join(" · ");
    let jamText = sum.clocks.length
      ? sum.clocks.join(" · ") + " WITA"
      : "";

    if (!reports.length) {
      const patrols = patrolsOnDay(day);
      const names = uniqueJoin(patrols.map(function (row) {
        return cleanText(row && row.personil);
      }).filter(Boolean));
      const times = uniqueJoin(patrols.map(function (row) {
        return formatClock(row && row.waktu);
      }).filter(Boolean));
      if (names.length) kruText = names.join(" · ");
      if (times.length) jamText = times.join(" · ") + " WITA";
    } else if (!jamText) {
      const times = uniqueJoin(patrolsOnDay(day).map(function (row) {
        return formatClock(row && row.waktu);
      }).filter(Boolean));
      if (times.length) jamText = times.join(" · ") + " WITA";
    }

    if (handleKruEl) {
      handleKruEl.textContent = kruText || "Belum ada data kru";
      handleKruEl.title = kruText || "";
    }
    if (handleJamEl) {
      handleJamEl.textContent = jamText || "Belum ada jam penanganan";
      handleJamEl.title = jamText || "";
    }
  }

  function paintSummary(day) {
    const weekly = sumMode === "week";
    const reports = weekly ? reportsForWeek(day) : reportsForDay(day);
    const sum = summarizeReports(reports);
    const range = weekly ? weekLabel(day) : KD.formatDate(day);
    if (sumOpsEl) sumOpsEl.textContent = sum.ops ? sum.ops + " ops" : "0 ops";
    if (sumDurEl) sumDurEl.textContent = formatDuration(sum.mins);
    if (sumKruEl) sumKruEl.textContent = sum.kruN ? sum.kruN + " orang" : "0 orang";
    if (sumNoteEl) {
      sumNoteEl.textContent = sum.ops
        ? range + " · " + (sum.crews[0] || "kru tercatat") + (sum.crews.length > 1 ? " +" + (sum.crews.length - 1) : "")
        : "Belum ada laporan penanganan " + (weekly ? "minggu ini" : "pada tanggal ini") + ".";
    }
    if (sumDayBtn) sumDayBtn.classList.toggle("is-on", !weekly);
    if (sumWeekBtn) sumWeekBtn.classList.toggle("is-on", weekly);
  }

  function paintSide(day) {
    paintInspeksi(day);
    paintHandle(day);
    paintSummary(day);
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
    paintSide(day);
    setLoading(true);

    const features = await KD.fetchSipongi(day, day);
    if (seq !== loadSeq) return;
    setLoading(false);

    if (features == null) {
      titikEl.textContent = "–";
      noteEl.textContent = "SiPongi belum termuat. Data internal/eksternal tetap dari penanganan terverifikasi.";
      paintPatroli(null, day);
      return;
    }

    const sipongiCount = features.length;
    titikEl.textContent = String(sipongiCount);
    noteEl.textContent = sipongiCount === 0
      ? "Kondisi saat ini sudah zero titik aktif. Tetap fokus pada patroli pencegahan dan validasi lapangan."
      : sipongiCount + " titik hotspot SiPongi terpantau pada tanggal ini. Prioritaskan validasi dan respons lapangan.";
    paintPatroli(features, day);
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
  if (sumDayBtn) {
    sumDayBtn.addEventListener("click", function () {
      sumMode = "day";
      paintSummary(selectedDay);
    });
  }
  if (sumWeekBtn) {
    sumWeekBtn.addEventListener("click", function () {
      sumMode = "week";
      paintSummary(selectedDay);
    });
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

  const jobs = [];
  if (window.KarhutlaLaporanStore) jobs.push(KarhutlaLaporanStore.hydrate());
  if (window.KarhutlaPatroliStore) jobs.push(KarhutlaPatroliStore.hydrate());
  if (!jobs.length) {
    boot();
  } else {
    Promise.all(jobs).then(boot).catch(boot);
  }
})();
