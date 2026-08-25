(function () {
  const stats = document.querySelectorAll(".ks-stats strong[data-count]");
  if (!stats.length) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = 900;

  stats.forEach(function (el, i) {
    const target = Number(el.getAttribute("data-count")) || 0;

    if (prefersReduced) {
      el.textContent = target;
      return;
    }

    const start = performance.now() + 300 + i * 120;
    requestAnimationFrame(function tick(now) {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(tick);
    });
  });
})();
