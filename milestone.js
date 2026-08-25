(function () {
  const IMG_W = 1024;
  const IMG_H = 576;
  const ICO = {
    flame: '<svg viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.7 7-6.4 0-2.7-1.5-5.2-4.4-7.6.1 2-1 3.1-2.1 3.8.3-3.4-1.4-6.4-4.5-8.8.2 3.1-1.8 5.3-3 7.4C3.8 12.3 5 15.2 5 16c0 3.3 3.1 6 7 6Z"/></svg>',
    drone: '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M4.5 10.2 12 6l7.5 4.2v7.4L12 22l-7.5-4.4V10.2Z"/><path d="M8 9.2 16 13.6"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="16" cy="9" r="2.4"/><path d="M4 19c.4-3.2 2.8-5 5-5s4.6 1.8 5 5M14.2 14.2c1.6-.4 3.5.6 4.8 3.8"/></svg>',
    tent: '<svg viewBox="0 0 24 24"><path d="M4 20v-8l8-6 8 6v8"/><path d="M9 20v-6h6v6"/><path d="M14 6.2V4h3"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 16V9h11v7"/><path d="M14 12h4.2L21 16v3h-2"/><circle cx="7" cy="18.5" r="2"/><circle cx="16.5" cy="18.5" r="2"/><path d="M9 18.5h5.5"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3 20 6.5v6.2c0 5.1-3.4 8.8-8 10.5-4.6-1.7-8-5.4-8-10.5V6.5L12 3Z"/><path d="M12 16.5c2.4 0 4-1.5 4-3.6 0-1.7-.9-3-2.6-4.3.1 1.1-.4 1.8-.8 2.2.1-1.9-.8-3.6-2.6-5 .1 1.7-1 2.9-1.7 4.1-.7 1.3 0 3 0 3.4 0 1.8 1.8 3.2 3.7 3.2Z"/></svg>'
  };
  const DETAILS = {
    "1": {
      date: "10 Agu 2026",
      title: "Kejadian Awal Karhutla",
      icon: "flame",
      hasil: "Titik api pertama di area revegetasi GMO berhasil ditangani dan terkendali.",
      lanjut: "Monitoring area dan potensi titik api lanjutan."
    },
    "2": {
      date: "15 Agu 2026",
      title: "Peningkatan Kejadian & Early Coordination",
      icon: "drone",
      hasil: "Tercatat 4 laporan Karhutla; seluruh kejadian berhasil ditangani. PT Berau Coal mulai menyiapkan personel dan sarana prasarana pendukung.",
      lanjut: "Patroli darat, pemantauan drone, serta tindak lanjut pembagian zona penanganan."
    },
    "3": {
      date: "18 Agu 2026",
      title: "Pembentukan Koordinator Operasi",
      icon: "people",
      hasil: "Koordinator Operasi Karhutla PT Berau Coal dibentuk dan disetujui Chief ER.",
      lanjut: "Mengendalikan koordinasi dan kebutuhan operasional lapangan."
    },
    "4": {
      date: "19 Agu 2026",
      title: "Koordinasi Internal & Posko Limunjan",
      icon: "tent",
      hasil: "Mekanisme dukungan dengan TNI AD, Damkar, dan KPHP disepakati; kesiapan tim satgas, logistik, transportasi, peralatan, dan APD diperkuat.",
      lanjut: "Menyiapkan personel PT Berau Coal untuk dukungan di Posko Limunjan."
    },
    "5": {
      date: "20 Agu 2026",
      title: "Aktivasi Satgas & Dukungan Operasional",
      icon: "people",
      hasil: "Tim Satgas 2 ERG & 3 Security standby 24 jam. Logistik air mineral dan snack, APD masker dan sarung tangan, transportasi, serta peralatan siap untuk dukungan internal maupun eksternal.",
      lanjut: "Distribusi resource dan penugasan disesuaikan kebutuhan lapangan."
    },
    "6": {
      date: "21 Agu 2026",
      title: "Penambahan Resource Pemadaman",
      icon: "truck",
      hasil: "Dukungan 1 unit Water Truck 4.000 liter dari PMI Berau tersedia sebagai tambahan resource.",
      lanjut: "Water truck disiapkan untuk mobilisasi sesuai kebutuhan operasi."
    },
    "7": {
      date: "24 Agu 2026",
      title: "Dukungan Berkelanjutan & Operasi 24 Jam",
      icon: "shield",
      hasil: "Bantuan logistik Rp 120 juta diserahkan kepada BPBD. Hingga 24 Agustus, operasi pemadaman masih berjalan; Tim Satgas terus patroli dan memantau potensi titik api.",
      lanjut: "Patroli, monitoring, dan kesiapsiagaan dilanjutkan hingga kondisi Karhutla sepenuhnya terkendali."
    }
  };

  const stage = document.querySelector(".ms-stage");
  const mapEl = document.querySelector(".ms-map");
  if (!stage || !mapEl) return;

  const pins = Array.prototype.slice.call(mapEl.querySelectorAll(".ms-pin"));
  const cards = Array.prototype.slice.call(mapEl.querySelectorAll(".ms-card"));
  const svg = mapEl.querySelector(".ms-lines");
  const modal = document.getElementById("ms-modal");

  function coverRect(boxW, boxH) {
    const imgR = IMG_W / IMG_H;
    const boxR = boxW / boxH;
    if (boxR > imgR) {
      const drawH = boxW / imgR;
      return { drawW: boxW, drawH: drawH, ox: 0, oy: (boxH - drawH) / 2 };
    }
    const drawW = boxH * imgR;
    return { drawW: drawW, drawH: boxH, ox: (boxW - drawW) / 2, oy: 0 };
  }

  function lineEnds(pin, card, mr) {
    const pr = pin.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const x1 = pr.left - mr.left + pr.width / 2;
    const y1 = pr.top - mr.top + pr.height / 2;
    const place = card.getAttribute("data-place") || "above";
    if (place === "left") {
      return { x1: x1, y1: y1, x2: cr.right - mr.left, y2: cr.top - mr.top + cr.height / 2 };
    }
    if (place === "right") {
      return { x1: x1, y1: y1, x2: cr.left - mr.left, y2: cr.top - mr.top + cr.height / 2 };
    }
    if (place === "below" || place === "below-right") {
      return { x1: x1, y1: y1, x2: cr.left - mr.left + cr.width / 2, y2: cr.top - mr.top };
    }
    return { x1: x1, y1: y1, x2: cr.left - mr.left + cr.width / 2, y2: cr.bottom - mr.top };
  }

  function layout() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      if (svg) svg.innerHTML = "";
      return;
    }

    const box = stage.getBoundingClientRect();
    const map = coverRect(box.width, box.height);
    mapEl.style.left = map.ox + "px";
    mapEl.style.top = map.oy + "px";
    mapEl.style.width = map.drawW + "px";
    mapEl.style.height = map.drawH + "px";

    if (!svg) return;
    const mr = mapEl.getBoundingClientRect();
    const ns = "http://www.w3.org/2000/svg";
    svg.setAttribute("viewBox", "0 0 " + mr.width + " " + mr.height);
    svg.innerHTML = "";

    cards.forEach(function (card) {
      const pin = pins.filter(function (item) {
        return item.getAttribute("data-id") === card.getAttribute("data-id");
      })[0];
      if (!pin) return;
      const pt = lineEnds(pin, card, mr);
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", "M" + pt.x1 + "," + pt.y1 + " L" + pt.x2 + "," + pt.y2);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(134,209,92,.78)");
      path.setAttribute("stroke-width", "1.35");
      svg.appendChild(path);
    });
  }

  function highlight(id) {
    pins.forEach(function (pin) {
      const on = pin.getAttribute("data-id") === id;
      pin.classList.toggle("is-on", on);
      pin.setAttribute("aria-pressed", on ? "true" : "false");
    });
    cards.forEach(function (card) {
      card.classList.toggle("is-on", card.getAttribute("data-id") === id);
    });
  }

  function openModal(id) {
    const data = DETAILS[id];
    if (!data || !modal) return;
    highlight(id);
    document.getElementById("ms-modal-num").textContent = id;
    document.getElementById("ms-modal-date").textContent = data.date;
    document.getElementById("ms-modal-title").textContent = data.title;
    document.getElementById("ms-modal-ico").innerHTML = ICO[data.icon] || "";
    document.getElementById("ms-modal-hasil").textContent = data.hasil;
    document.getElementById("ms-modal-lanjut").textContent = data.lanjut;
    modal.hidden = false;
    const closeBtn = modal.querySelector(".ms-modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    highlight("");
  }

  pins.forEach(function (pin) {
    pin.addEventListener("click", function (e) {
      e.preventDefault();
      openModal(pin.getAttribute("data-id"));
    });
  });

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      openModal(card.getAttribute("data-id"));
    });
  });

  document.querySelectorAll(".ms-mobile li[data-id]").forEach(function (item) {
    item.addEventListener("click", function () {
      openModal(item.getAttribute("data-id"));
    });
  });

  if (modal) {
    modal.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    const closeBtn = modal.querySelector(".ms-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  layout();
  window.addEventListener("resize", layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
})();
