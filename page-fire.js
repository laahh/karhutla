(function () {
  const canvas = document.getElementById("page-fire");
  if (!canvas || !canvas.getContext) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let playing = false;

  const GREEN = "107,180,67";
  const LIME = "134,209,92";

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function clamp01(t) {
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  function outQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function outCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function inOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function outBack(t) {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }

  function goTo(href) {
    if (!href) return;
    if (href.charAt(0) === "#") {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      else window.location.hash = href;
      document.querySelectorAll(".desktop-nav a, .mobile-menu a").forEach(function (link) {
        link.classList.toggle("active", link.getAttribute("href") === href);
      });
      return;
    }
    window.location.href = href;
  }

  function paintVeil(alpha) {
    ctx.fillStyle = "rgba(5,8,7," + alpha + ")";
    ctx.fillRect(0, 0, width, height);
  }

  function paintGrid(alpha, ox, oy) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.strokeStyle = "rgba(" + GREEN + "," + alpha * 0.18 + ")";
    ctx.lineWidth = 1;
    const gap = 48;
    const oxShift = ox % gap;
    const oyShift = oy % gap;
    ctx.beginPath();
    for (let x = oxShift; x < width; x += gap) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = oyShift; y < height; y += gap) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintScanline(y, alpha) {
    if (alpha <= 0) return;
    const g = ctx.createLinearGradient(0, y - 18, 0, y + 18);
    g.addColorStop(0, "rgba(" + LIME + ",0)");
    g.addColorStop(0.5, "rgba(" + LIME + "," + alpha * 0.22 + ")");
    g.addColorStop(1, "rgba(" + LIME + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 18, width, 36);
  }

  function paintRings(cx, cy, progress, maxR) {
    for (let i = 0; i < 4; i += 1) {
      const local = clamp01(progress * 1.15 - i * 0.12);
      if (local <= 0) continue;
      const r = 18 + outCubic(local) * maxR;
      const a = (1 - local) * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(" + LIME + "," + a + ")";
      ctx.lineWidth = i === 0 ? 2.2 : 1.1;
      ctx.stroke();
    }
  }

  function paintSweep(cx, cy, radius, angle, alpha) {
    if (radius <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createConicGradient(0, 0, 0);
    g.addColorStop(0, "rgba(" + LIME + ",0)");
    g.addColorStop(0.78, "rgba(" + LIME + ",0)");
    g.addColorStop(0.92, "rgba(" + LIME + "," + alpha * 0.18 + ")");
    g.addColorStop(1, "rgba(" + LIME + "," + alpha * 0.42 + ")");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function paintReticle(cx, cy, scale, alpha) {
    if (alpha <= 0) return;
    const s = 22 * scale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = "rgba(" + LIME + "," + alpha + ")";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 1.55, 0);
    ctx.lineTo(-s * 0.55, 0);
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 1.55, 0);
    ctx.moveTo(0, -s * 1.55);
    ctx.lineTo(0, -s * 0.55);
    ctx.moveTo(0, s * 0.55);
    ctx.lineTo(0, s * 1.55);
    ctx.stroke();
    const b = s * 1.15;
    ctx.lineWidth = 2;
    [
      [-b, -b, 1, 1],
      [b, -b, -1, 1],
      [-b, b, 1, -1],
      [b, b, -1, -1]
    ].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1] + 10 * c[3]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(c[0] + 10 * c[2], c[1]);
      ctx.stroke();
    });
    ctx.fillStyle = "rgba(" + LIME + "," + alpha + ")";
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function play(ox, oy, href) {
    if (playing) return;
    playing = true;
    resize();
    canvas.classList.add("is-on");
    document.documentElement.classList.add("is-fire-lock");

    const maxR = Math.hypot(Math.max(ox, width - ox), Math.max(oy, height - oy)) * 1.15;
    const start = performance.now();
    const lock = 220;
    const scan = 820;
    const hold = 90;
    const reveal = 620;
    let covered = false;

    function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      const lockT = clamp01(elapsed / lock);
      const scanT = clamp01((elapsed - lock * 0.35) / scan);
      const veil = 0.88 * inOutCubic(Math.min(1, scanT * 1.25));

      paintVeil(veil);
      paintGrid(scanT, ox, oy);
      paintScanline(outCubic(scanT) * height, scanT * 0.9);
      paintSweep(ox, oy, 40 + outQuint(scanT) * maxR, elapsed * 0.0042, scanT);
      paintRings(ox, oy, scanT, maxR);
      paintReticle(ox, oy, 0.65 + outBack(lockT) * 0.55, 0.25 + lockT * 0.75);

      if (elapsed >= lock * 0.35 + scan * 0.72 && !covered) {
        covered = true;
        goTo(href);
      }

      const revealAt = lock * 0.35 + scan + hold;
      if (elapsed < revealAt) {
        requestAnimationFrame(frame);
        return;
      }

      const revealT = inOutCubic(clamp01((elapsed - revealAt) / reveal));
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(ox, oy, revealT * maxR * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.restore();

      paintReticle(ox, oy, 1.05, 1 - revealT);

      if (revealT < 1) {
        requestAnimationFrame(frame);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      canvas.classList.remove("is-on");
      document.documentElement.classList.remove("is-fire-lock");
      playing = false;
    }

    requestAnimationFrame(frame);
  }

  function isInternal(a) {
    const href = a.getAttribute("href");
    if (!href || href === "#" || a.target === "_blank" || a.hasAttribute("download")) return false;
    if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return false;
    return true;
  }

  document.addEventListener("click", function (e) {
    const a = e.target.closest("a[href]");
    if (!a || !isInternal(a)) return;
    const href = a.getAttribute("href");
    const current = window.location.hash || "#beranda";
    if (href === current && href === "#beranda" && window.scrollY < 80) return;
    e.preventDefault();
    if (reduced) {
      goTo(href);
      return;
    }
    play(e.clientX, e.clientY, href);
  });

  window.addEventListener("resize", function () {
    if (playing) resize();
  });
})();
