(function () {
  const board = document.querySelector(".ms-board");
  const svg = board && board.querySelector(".ms-wires");
  if (!board || !svg) return;

  const mobile = window.matchMedia("(max-width: 900px)");
  const LINKS = [
    ["ms-1", "ms-2"],
    ["ms-2", "ms-3"],
    ["ms-3", "ms-4"],
    ["ms-4", "ms-5"],
    ["ms-5", "ms-6"],
    ["ms-6", "ms-7"]
  ];

  function box(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const p = board.getBoundingClientRect();
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

  function pathH(a, b) {
    const y = a.cy;
    const x1 = a.r;
    const x2 = b.l;
    return "M" + x1 + "," + y + " L" + x2 + "," + y;
  }

  function pathWrap(a, b) {
    const xRight = Math.min(board.clientWidth - 8, a.r + 22);
    const y1 = a.cy;
    const mid = (a.b + b.t) / 2;
    return "M" + a.r + "," + y1 +
      " L" + xRight + "," + y1 +
      " L" + xRight + "," + mid +
      " L" + b.cx + "," + mid +
      " L" + b.cx + "," + b.t;
  }

  function draw() {
    const w = board.clientWidth;
    const h = board.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (mobile.matches) return;

    const defs = ns("defs");
    const marker = ns("marker");
    marker.setAttribute("id", "ms-arr");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "7");
    marker.setAttribute("markerHeight", "7");
    marker.setAttribute("orient", "auto");
    const tip = ns("path");
    tip.setAttribute("d", "M0 0 L10 5 L0 10 z");
    tip.setAttribute("fill", "#86d15c");
    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);

    LINKS.forEach(function (pair) {
      const a = box(pair[0]);
      const b = box(pair[1]);
      if (!a || !b) return;
      const d = pair[0] === "ms-4" ? pathWrap(a, b) : pathH(a, b);
      const line = ns("path");
      line.setAttribute("d", d);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#86d15c");
      line.setAttribute("stroke-width", "1.8");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      line.setAttribute("marker-end", "url(#ms-arr)");
      svg.appendChild(line);
    });
  }

  let raf = 0;
  function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(board);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
