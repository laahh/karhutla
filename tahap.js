(function () {
  const root = document.querySelector(".tp-flow");
  const svg = root && root.querySelector(".flow-wires");
  if (!root || !svg) return;

  const mobile = window.matchMedia("(max-width: 900px)");

  function box(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const p = root.getBoundingClientRect();
    return {
      l: r.left - p.left,
      t: r.top - p.top,
      r: r.right - p.left,
      b: r.bottom - p.top,
      cx: r.left - p.left + r.width / 2,
      cy: r.top - p.top + r.height / 2
    };
  }

  function ns(name) {
    return document.createElementNS("http://www.w3.org/2000/svg", name);
  }

  function addPath(d, color, marker) {
    const line = ns("path");
    line.setAttribute("d", d);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "1.85");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    if (marker) line.setAttribute("marker-end", marker);
    svg.appendChild(line);
  }

  function vert(a, b) {
    const y1 = Math.min(a.b, b.t - 10);
    return "M" + a.cx + "," + y1 + " L" + b.cx + "," + (b.t - 1);
  }

  function elbowRight(x1, y1, x2, y2) {
    const mx = (x1 + x2) / 2;
    if (Math.abs(y1 - y2) < 2) return "M" + x1 + "," + y1 + " L" + x2 + "," + y2;
    return "M" + x1 + "," + y1 + " L" + mx + "," + y1 + " L" + mx + "," + y2 + " L" + x2 + "," + y2;
  }

  function hideTags() {
    ["lbl-small", "lbl-big"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.left = "-999px";
    });
  }

  function placeTag(id, x, y) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.left = x + "px";
    el.style.top = y + "px";
  }

  function draw() {
    const w = root.clientWidth;
    const h = root.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (mobile.matches) {
      hideTags();
      return;
    }

    const colors = ["#4aa3ff", "#3ecf9a", "#ef5a36", "#ffb25a", "#ff6b4d", "#86d15c", "#9aa2a4"];
    const defs = ns("defs");
    const marker = {};
    colors.forEach(function (c, i) {
      const m = ns("marker");
      m.setAttribute("id", "arr-" + i);
      m.setAttribute("viewBox", "0 0 10 10");
      m.setAttribute("refX", "9");
      m.setAttribute("refY", "5");
      m.setAttribute("markerWidth", "6.5");
      m.setAttribute("markerHeight", "6.5");
      m.setAttribute("orient", "auto");
      const p = ns("path");
      p.setAttribute("d", "M0 0 L10 5 L0 10 z");
      p.setAttribute("fill", c);
      m.appendChild(p);
      defs.appendChild(m);
      marker[c] = "url(#arr-" + i + ")";
    });
    svg.appendChild(defs);

    const start = box("n-start");
    const detect = box("n-detect");
    const hotspot = box("n-hotspot");
    const karyawan = box("n-karyawan");
    const drone = box("n-drone");
    const patrol = box("n-patrol");
    const laporanP = box("n-laporan-patroli");
    const diamond = box("n-diamond");
    const none = box("n-none");
    const padamkan = box("n-padamkan");
    const ic = box("n-ic");
    const volunteer = box("n-volunteer");
    const mobilisasi = box("n-mobilisasi");
    const padamS = box("n-padam-s");
    const laporanS = box("n-laporan-s");
    const padamB = box("n-padam-b");
    const laporanB = box("n-laporan-b");

    if (!start || !detect || !hotspot || !karyawan || !drone || !patrol || !diamond) {
      hideTags();
      return;
    }

    const blue = "#4aa3ff";
    const teal = "#3ecf9a";
    const orange = "#ef5a36";
    const smallC = "#ffb25a";
    const bigC = "#ff6b4d";
    const green = "#86d15c";
    const gray = "#9aa2a4";

    addPath(vert(start, detect), blue, marker[blue]);

    const leaves = [hotspot, karyawan, drone];
    const forkY = Math.min(hotspot.t, karyawan.t, drone.t) - 10;
    addPath("M" + detect.cx + "," + detect.b + " L" + detect.cx + "," + forkY, blue);
    leaves.forEach(function (leaf) {
      addPath(
        "M" + detect.cx + "," + forkY + " L" + leaf.cx + "," + forkY + " L" + leaf.cx + "," + (leaf.t - 1),
        blue,
        marker[blue]
      );
    });

    const busY = Math.max(hotspot.b, karyawan.b, drone.b) + 6;
    leaves.forEach(function (leaf) {
      addPath("M" + leaf.cx + "," + leaf.b + " L" + leaf.cx + "," + busY, blue);
    });
    addPath("M" + hotspot.cx + "," + busY + " L" + drone.r + "," + busY, blue);
    addPath(
      elbowRight(drone.r, busY, patrol.l - 1, patrol.cy),
      blue,
      marker[blue]
    );

    if (laporanP) addPath(vert(patrol, laporanP), teal, marker[teal]);

    addPath(
      elbowRight(patrol.r, patrol.cy, diamond.l + 6, diamond.cy),
      orange,
      marker[orange]
    );

    if (none) addPath(vert(diamond, none), gray, marker[gray]);

    if (padamkan) {
      const smallX = (diamond.cx + diamond.r) / 2;
      const smallY = (diamond.t + diamond.cy) / 2;
      addPath(
        elbowRight(smallX, smallY, padamkan.l - 1, padamkan.cy),
        smallC,
        marker[smallC]
      );
      placeTag("lbl-small", (smallX + padamkan.l) / 2, Math.min(smallY, padamkan.cy) - 4);
    }

    const bracket = box("n-bracket");
    const bigTarget = volunteer || ic;
    if (bigTarget) {
      const x2 = bracket ? bracket.l + 2 : bigTarget.l - 1;
      const y2 = bracket ? Math.min(Math.max(diamond.cy, bracket.t + 24), bracket.b - 24) : bigTarget.cy;
      addPath(elbowRight(diamond.r - 4, diamond.cy, x2, y2), bigC, marker[bigC]);
      placeTag("lbl-big", (diamond.r + x2) / 2, diamond.cy - 2);
    }

    if (ic && volunteer) addPath(vert(ic, volunteer), bigC, marker[bigC]);
    if (volunteer && mobilisasi) addPath(vert(volunteer, mobilisasi), bigC, marker[bigC]);

    if (padamkan && padamS) {
      addPath(elbowRight(padamkan.r, padamkan.cy, padamS.l - 1, padamS.cy), green, marker[green]);
    }
    if (padamS && laporanS) addPath(vert(padamS, laporanS), green, marker[green]);
    if (mobilisasi && padamB) {
      addPath(elbowRight(mobilisasi.r, mobilisasi.cy, padamB.l - 1, padamB.cy), green, marker[green]);
    }
    if (padamB && laporanB) addPath(vert(padamB, laporanB), green, marker[green]);
  }

  let raf = 0;
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", schedule);
  if (window.ResizeObserver) {
    new ResizeObserver(schedule).observe(root);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
