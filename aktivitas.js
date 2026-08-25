(function () {
  const grid = document.getElementById("ak-grid");
  const label = document.getElementById("ak-page");
  const pager = document.querySelector(".ak-pager");
  const prev = document.getElementById("ak-prev");
  const next = document.getElementById("ak-next");
  if (!grid || !label) return;

  const PAGES = [
    [
      {
        img: "aktivitas/Picture1.png",
        tag: "COORDINATION",
        date: "19 AUG",
        title: "Koordinasi lapangan & dukungan logistik",
        sub: "TNI AD • Damkar • KPHP Berau"
      },
      {
        img: "aktivitas/Picture2.png",
        tag: "RESPONSE",
        date: "20 AUG",
        title: "Aktivasi posko & respons pemadaman",
        sub: "Standby dan kejadian lapangan"
      },
      {
        img: "aktivitas/Picture3.png",
        tag: "RESOURCE",
        date: "20 AUG",
        title: "Tambahan Water Truck PMI • 4.000 L",
        sub: "1 unit • kapasitas 4.000 liter"
      },
      {
        img: "aktivitas/Picture4.png",
        tag: "LOGISTICS",
        date: "24 AUG",
        title: "Penyerahan bantuan logistik • Rp120 juta",
        sub: "Melalui BPBD / Bupati Berau"
      }
    ]
  ];

  let page = 0;

  function render() {
    const cards = PAGES[page];
    grid.innerHTML = cards.map(function (card, i) {
      const sub = card.sub ? "<small>" + card.sub + "</small>" : "";
      return (
        '<article class="ak-card" style="--i:' + i + '">' +
          '<div class="ak-photo">' +
            '<img src="' + card.img + '" alt="' + card.title + '">' +
            '<span class="ak-tag">' + card.tag + "</span>" +
          "</div>" +
          "<footer>" +
            "<b>" + (i + 1) + "</b>" +
            "<time>" + card.date + "</time>" +
            "<p>" + card.title + "</p>" +
            sub +
          "</footer>" +
        "</article>"
      );
    }).join("");
    label.textContent = (page + 1) + " / " + PAGES.length;
    if (pager) pager.classList.toggle("is-single", PAGES.length < 2);
  }

  function go(dir) {
    page = (page + dir + PAGES.length) % PAGES.length;
    render();
  }

  if (prev) prev.addEventListener("click", function () { go(-1); });
  if (next) next.addEventListener("click", function () { go(1); });
  render();
})();
