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

  const TREND_LABELS = ["10-Aug", "11-Aug", "13-Aug", "14-Aug", "15-Aug", "18-Aug", "17-Aug", "18-Aug", "19-Aug", "21-Aug", "22-Aug", "23-Aug", "24-Aug"];
  const TREND_INTERNAL = [1, 1, 2, 1, 6, 2, 1, 2, 1, 4, 1, 4, 1];
  const TREND_EXTERNAL = [0, 0, 3, 3, 1, 0, 0, 2, 2, 3, 4, 0, 1];

  function renderTrend() {
    const holder = document.getElementById("trend-chart");
    if (!holder) return;

    const rect = holder.getBoundingClientRect();
    const containerW = rect.width || 640;
    const containerH = rect.height || 250;
    // W stays fixed so each bar/label keeps the same internal spacing regardless
    // of container width; H is derived to match the container's aspect ratio so
    // the chart fills the panel's height instead of leaving it letterboxed.
    const W = 640;
    const H = Math.max(160, Math.round(W * (containerH / containerW)));
    const ML = 30, MR = 34, MT = 10, MB = 26;
    const plotW = W - ML - MR;
    const plotH = H - MT - MB;
    const n = TREND_LABELS.length;
    const yMax = 7;
    const groupW = plotW / n;
    const barW = groupW * 0.5;

    const yPix = function (v) { return MT + plotH - (v / yMax) * plotH; };

    let gridLines = "";
    let leftTicks = "";
    let rightTicks = "";
    for (let i = 0; i <= 7; i++) {
      const y = yPix(i);
      gridLines += '<line class="grid-line" x1="' + ML + '" x2="' + (ML + plotW) + '" y1="' + y + '" y2="' + y + '"/>';
      leftTicks += '<text class="axis-tick" x="' + (ML - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + i.toFixed(1).replace(".", ",") + '</text>';
      rightTicks += '<text class="axis-tick" x="' + (ML + plotW + 8) + '" y="' + (y + 3) + '" text-anchor="start">' + (i * 100) + '</text>';
    }

    let bars = "", xLabels = "", linePoints = [], lineValues = "";
    for (let i = 0; i < n; i++) {
      const gx = ML + i * groupW;
      const bx = gx + (groupW - barW) / 2;
      const internal = TREND_INTERNAL[i];
      const external = TREND_EXTERNAL[i];
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
        bars += '<text class="bar-value" style="animation-delay:' + delay + '" x="' + (bx + barW / 2) + '" y="' + (baseY - 3) + '">' + internal + '</text>';
      }
      if (external > 0) {
        bars += '<text class="bar-value" style="animation-delay:' + delay + '" x="' + (bx + barW / 2) + '" y="' + (yTotalTop + (yInternalTop - yTotalTop) / 2 + 3) + '">' + external + '</text>';
      }

      xLabels += '<text class="x-label" x="' + (gx + groupW / 2) + '" y="' + (H - 6) + '">' + TREND_LABELS[i] + '</text>';

      const lx = gx + groupW / 2;
      const ly = yPix(total);
      linePoints.push(lx + "," + ly);
      lineValues += '<text class="line-value" style="animation-delay:' + (650 + i * 25) + 'ms" x="' + lx + '" y="' + (ly - 10) + '">' + total + '</text>';
    }

    let lineDots = "";
    linePoints.forEach(function (p, i) {
      const parts = p.split(",");
      lineDots += '<circle class="line-dot" style="animation-delay:' + (650 + i * 25) + 'ms" cx="' + parts[0] + '" cy="' + parts[1] + '" r="2.6"/>';
    });

    const linePath = '<polyline class="line-path" points="' + linePoints.join(" ") + '"/>';

    holder.innerHTML =
      '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
        gridLines + leftTicks + rightTicks + bars + linePath + lineDots + lineValues + xLabels +
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

  renderTrend();
  renderDonut();

  let resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderTrend, 150);
  });
})();
