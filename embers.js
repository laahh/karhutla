(function () {
  const canvas = document.querySelector(".embers");
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let particles = [];
  let raf = 0;
  let last = 0;
  let time = 0;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickType() {
    const roll = Math.random();
    if (roll < 0.62) return "spec";
    if (roll < 0.82) return "streak";
    return "bokeh";
  }

  function spawn(inFlight) {
    const type = pickType();
    const x = width * rand(0.03, 0.48);
    const y = height * rand(0.16, 0.9);
    const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
    const speed = type === "streak" ? rand(0.35, 1.05) : rand(0.08, 0.55);

    return {
      type: type,
      x: x,
      y: y,
      vx: Math.cos(angle) * speed + rand(-0.12, 0.22),
      vy: Math.sin(angle) * speed,
      size:
        type === "bokeh"
          ? rand(2.2, 4.8)
          : type === "streak"
            ? rand(0.7, 1.4)
            : rand(0.45, 1.15),
      life: inFlight ? rand(0, 5) : 0,
      maxLife: type === "bokeh" ? rand(4.5, 9) : rand(2.8, 7.2),
      seed: rand(0, 40),
      heat: rand(0.55, 1),
      drift: rand(0.6, 1.5)
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(36, Math.min(72, Math.round(width * 0.038)));
    particles = Array.from({ length: count }, function () {
      return spawn(true);
    });
  }

  function drawSpec(p, alpha, cool) {
    const r = p.size;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
    glow.addColorStop(0, "rgba(255," + (210 - cool * 70) + "," + (140 - cool * 90) + "," + alpha + ")");
    glow.addColorStop(0.35, "rgba(255," + (110 - cool * 40) + ",32," + alpha * 0.45 + ")");
    glow.addColorStop(1, "rgba(180,40,8,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,236,200," + alpha * 0.9 + ")";
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.35, r * 0.28), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBokeh(p, alpha, cool) {
    const r = p.size;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    glow.addColorStop(0, "rgba(255," + (90 - cool * 20) + ",18," + alpha * 0.22 + ")");
    glow.addColorStop(0.55, "rgba(200,50,10," + alpha * 0.08 + ")");
    glow.addColorStop(1, "rgba(120,20,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStreak(p, alpha, cool) {
    const speed = Math.hypot(p.vx, p.vy) || 0.2;
    const len = 4 + speed * 7;
    const ang = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(-len, 0, len * 0.2, 0);
    g.addColorStop(0, "rgba(255,80,20,0)");
    g.addColorStop(0.55, "rgba(255," + (120 - cool * 40) + ",28," + alpha * 0.35 + ")");
    g.addColorStop(1, "rgba(255,230,170," + alpha * 0.8 + ")");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, Math.max(0.35, p.size * 0.38), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function tick(now) {
    const dt = Math.min(0.033, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;

    const breeze =
      Math.sin(time * 0.27) * 0.12 +
      Math.sin(time * 0.08 + 2.1) * 0.08;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.life += dt;

      if (p.life >= p.maxLife || p.y < -16 || p.x < -20 || p.x > width * 0.72) {
        particles[i] = spawn(false);
        continue;
      }

      const n1 = Math.sin(time * 1.35 * p.drift + p.seed);
      const n2 = Math.cos(time * 1.9 * p.drift + p.seed * 0.7);
      const n3 = Math.sin(time * 0.6 + p.seed * 1.3);
      p.vx += breeze * 0.008 + n1 * 0.028 + n3 * 0.01;
      p.vy += -0.003 * p.heat + n2 * 0.024;
      p.vx *= 0.978;
      p.vy *= 0.988;
      p.x += p.vx * 48 * dt;
      p.y += p.vy * 48 * dt;

      const fadeIn = Math.min(1, p.life / 0.55);
      const fadeOut = Math.min(1, (p.maxLife - p.life) / 1.6);
      const flicker = 0.72 + 0.28 * Math.sin(time * (6 + (p.seed % 5)) + p.seed);
      const alpha = fadeIn * fadeOut * p.heat * flicker * (p.type === "bokeh" ? 0.7 : 0.95);
      if (alpha <= 0.03) continue;

      const cool = 1 - fadeOut;
      if (p.type === "bokeh") drawBokeh(p, alpha, cool);
      else if (p.type === "streak") drawStreak(p, alpha, cool);
      else drawSpec(p, alpha, cool);
    }

    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(tick);
  }

  function start() {
    cancelAnimationFrame(raf);
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  resize();
  start();
  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) cancelAnimationFrame(raf);
    else start();
  });
})();
