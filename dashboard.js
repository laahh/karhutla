(function () {
  const dash = document.getElementById("aktual");
  if (!dash) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function countUp(el) {
    const target = Number(el.getAttribute("data-count")) || 0;
    const suffix = el.getAttribute("data-suffix") || "";
    if (prefersReduced) {
      el.textContent = target + suffix;
      return;
    }
    const duration = 900;
    const start = performance.now() + 150;
    requestAnimationFrame(function tick(now) {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    });
  }

  document.querySelectorAll(".dash-stat strong[data-count]").forEach(countUp);

  let TREND_LABELS = [];
  let TREND_INTERNAL = [];
  let TREND_EXTERNAL = [];
  let TREND_ACTIVE = null;

  function showTrendLoading() {
    const holder = document.getElementById("trend-chart");
    if (!holder) return;
    holder.innerHTML = '<p class="trend-loading">Memuat data tren…</p>';
  }

  function renderTrend() {
    const holder = document.getElementById("trend-chart");
    if (!holder) return;

    const n = TREND_LABELS.length;
    if (!n) {
      showTrendLoading();
      return;
    }

    const rect = holder.getBoundingClientRect();
    const containerW = rect.width || 640;
    const containerH = rect.height || 250;
    const W = 640;
    const H = Math.max(160, Math.round(W * (containerH / containerW)));
    const ML = 30, MR = 34, MT = 10, MB = 26;
    const plotW = W - ML - MR;
    const plotH = H - MT - MB;

    let barMax = 0;
    for (let i = 0; i < n; i += 1) {
      barMax = Math.max(barMax, (Number(TREND_INTERNAL[i]) || 0) + (Number(TREND_EXTERNAL[i]) || 0));
    }
    const yMax = Math.max(7, Math.ceil(barMax));
    const activeMax = TREND_ACTIVE
      ? Math.max(100, Math.ceil(Math.max.apply(null, TREND_ACTIVE) / 100) * 100)
      : 700;
    const groupW = plotW / n;
    const barW = Math.min(groupW * 0.62, 42);
    const yPix = function (v) { return MT + plotH - (v / yMax) * plotH; };
    const yPixActive = function (v) { return MT + plotH - (v / activeMax) * plotH; };

    let gridLines = "";
    let leftTicks = "";
    let rightTicks = "";
    for (let i = 0; i <= 7; i++) {
      const v = i * yMax / 7;
      const y = yPix(v);
      gridLines += '<line class="grid-line" x1="' + ML + '" x2="' + (ML + plotW) + '" y1="' + y + '" y2="' + y + '"/>';
      leftTicks += '<text class="axis-tick" x="' + (ML - 6) + '" y="' + (y + 3) + '" text-anchor="end">' +
        (yMax <= 7 ? i.toFixed(1).replace(".", ",") : String(Math.round(v))) + "</text>";
      rightTicks += '<text class="axis-tick" x="' + (ML + plotW + 8) + '" y="' + (y + 3) + '" text-anchor="start">' +
        Math.round(i * activeMax / 7) + "</text>";
    }

    let bars = "", xLabels = "", linePoints = [], lineValues = "";
    for (let i = 0; i < n; i++) {
      const gx = ML + i * groupW;
      const bx = gx + (groupW - barW) / 2;
      const internal = Number(TREND_INTERNAL[i]) || 0;
      const external = Number(TREND_EXTERNAL[i]) || 0;
      const total = internal + external;
      const yInternalTop = yPix(internal);
      const yTotalTop = yPix(total);
      const baseY = yPix(0);
      const delay = (i * 45) + "ms";

      bars += '<g class="bar-group" style="animation-delay:' + delay + '">';
      bars += '<rect class="bar-internal" x="' + bx + '" y="' + yInternalTop + '" width="' + barW + '" height="' + (baseY - yInternalTop) + '"/>';
      if (external > 0) {
        bars += '<rect class="bar-external" x="' + bx + '" y="' + yTotalTop + '" width="' + barW + '" height="' + (yInternalTop - yTotalTop) + '"/>';
      }
      bars += "</g>";
      if (internal > 0) {
        bars += '<text class="bar-value" style="animation-delay:' + delay + '" x="' + (bx + barW / 2) + '" y="' + (baseY - 3) + '">' + internal + "</text>";
      }
      if (external > 0) {
        bars += '<text class="bar-value" style="animation-delay:' + delay + '" x="' + (bx + barW / 2) + '" y="' + (yTotalTop + (yInternalTop - yTotalTop) / 2 + 3) + '">' + external + "</text>";
      }

      const showLabel = n <= 12 || i === 0 || i === n - 1 || i % (n > 20 ? 3 : 2) === 0;
      if (showLabel) {
        xLabels += '<text class="x-label" x="' + (gx + groupW / 2) + '" y="' + (H - 6) + '">' + TREND_LABELS[i] + "</text>";
      }

      const lineVal = TREND_ACTIVE ? TREND_ACTIVE[i] : total;
      const lx = gx + groupW / 2;
      const ly = TREND_ACTIVE ? yPixActive(lineVal) : yPix(lineVal);
      linePoints.push(lx + "," + ly);
      lineValues += '<text class="line-value" style="animation-delay:' + (650 + i * 25) + 'ms" x="' + lx + '" y="' + (ly - 10) + '">' + lineVal + "</text>";
    }

    let lineDots = "";
    linePoints.forEach(function (p, i) {
      const parts = p.split(",");
      lineDots += '<circle class="line-dot" style="animation-delay:' + (650 + i * 25) + 'ms" cx="' + parts[0] + '" cy="' + parts[1] + '" r="2.6"/>';
    });

    holder.innerHTML =
      '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
        gridLines + leftTicks + rightTicks + bars +
        '<polyline class="line-path" points="' + linePoints.join(" ") + '"/>' +
        lineDots + lineValues + xLabels +
      "</svg>";
  }

  const EQUIPMENT = [
    { label: "Fire Truck", value: 24, color: "#4d8a35" },
    { label: "Portable Fire Pump", value: 5, color: "#3fae6a" },
    { label: "Fire Hose 2.5", value: 11, color: "#6bb443" },
    { label: "Fire Hose 1.5", value: 70, color: "#86d15c" },
    { label: "Nozzle", value: 42, color: "#e0a83a" },
    { label: "Pompa Gendong", value: 85, color: "#ef5a36" }
  ];

  function renderDonut() {
    const holder = document.getElementById("donut-chart");
    const legend = document.getElementById("donut-legend");
    if (!holder || !legend) return;

    const total = EQUIPMENT.reduce(function (sum, item) { return sum + item.value; }, 0);
    let angleStart = 0;
    const stops = [];
    let labelsHtml = "";

    EQUIPMENT.forEach(function (item, idx) {
      const angleSpan = (item.value / total) * 360;
      const angleEnd = angleStart + angleSpan;
      stops.push(item.color + " " + angleStart + "deg " + angleEnd + "deg");

      const mid = ((angleStart + angleEnd) / 2 - 90) * (Math.PI / 180);
      const r = 37;
      const x = 50 + r * Math.cos(mid);
      const y = 50 + r * Math.sin(mid);
      const delay = (750 + idx * 45) + "ms";
      labelsHtml += '<span class="donut-label" style="left:' + x + '%;top:' + y + '%;animation-delay:' + delay + '">' + item.value + "</span>";

      angleStart = angleEnd;
    });

    holder.style.background = "conic-gradient(" + stops.join(", ") + ")";
    holder.innerHTML = labelsHtml;

    legend.innerHTML = EQUIPMENT.map(function (item) {
      return '<li><i class="dot" style="background:' + item.color + '"></i>' + item.label + "</li>";
    }).join("");
  }

  showTrendLoading();
  renderDonut();

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderTrend, 150);
  });

  // Live SiPongi + laporan wiring fills the chart via setTrendData.
  window.setTrendData = function (labels, internalArr, externalArr, activeArr) {
    TREND_LABELS = labels;
    TREND_INTERNAL = internalArr;
    TREND_EXTERNAL = externalArr;
    TREND_ACTIVE = activeArr || null;
    renderTrend();
  };
})();
