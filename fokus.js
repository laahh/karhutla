(function () {
  const grid = document.getElementById("fa-grid");
  const filters = document.querySelectorAll(".fa-filters button");
  if (!grid) return;

  const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>';

  const AREAS = [
    { n: 1, site: "LMO", cat: "Jalan Hauling", loc: "Jalan Hauling KM 3.", tags: ["hauling"] },
    { n: 2, site: "SMO", cat: "WMP + Jalan Hauling", loc: "WMP 26; Jalan Hauling KM 9.", tags: ["hauling", "wmp"] },
    { n: 3, site: "BMO 1 Blok PMO", cat: "Disposal Area", loc: "Sekitar Disposal Mage.", tags: ["riwayat"] },
    { n: 4, site: "BMO 1 Blok 56", cat: "Jalan Hauling", loc: "Jalan Hauling KM 6,6 – KM 10,8.", tags: ["hauling"] },
    { n: 5, site: "BMO 1 Suaran", cat: "Jalan Hauling", loc: "Koridor Jalan Hauling KM 11 – KM 18.", tags: ["hauling"] },
    { n: 6, site: "BMO 2", cat: "WMP + Jalan Hauling", loc: "Genangan 10; WMP 89, BRCS; Pos Long Lemuk; Pit X; Jalan Nyagapa.", tags: ["hauling", "wmp"] },
    { n: 7, site: "BMO 3", cat: "Baseline Area", loc: "Jalan Hauling; Area IPPKH; dan WMP.", tags: ["hauling", "ippkh", "wmp"] },
    { n: 8, site: "GMO", cat: "Project + WMP + Revegetasi", loc: "Road Diversion; WMP 2; area revegetasi.", tags: ["wmp", "ippkh"] }
  ];

  let filter = "all";

  function render() {
    const items = AREAS.filter(function (item) {
      return filter === "all" || item.tags.indexOf(filter) !== -1;
    });

    if (!items.length) {
      grid.classList.remove("is-full");
      grid.innerHTML = '<p class="fa-empty">Tidak ada area pada filter ini. Pilih baseline lain.</p>';
      return;
    }

    grid.classList.toggle("is-full", items.length === 8);

    grid.innerHTML = items.map(function (item, i) {
      return (
        '<article class="fa-card" style="animation-delay:' + (i * 50) + 'ms">' +
          "<b>" + item.n + "</b>" +
          "<h3>" + item.site + "</h3>" +
          PIN +
          "<small>" + item.cat.toUpperCase() + "</small>" +
          "<p>" + item.loc + "</p>" +
        "</article>"
      );
    }).join("");
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filters.forEach(function (el) { el.classList.remove("is-active"); });
      btn.classList.add("is-active");
      filter = btn.getAttribute("data-filter") || "all";
      render();
    });
  });

  render();
})();
