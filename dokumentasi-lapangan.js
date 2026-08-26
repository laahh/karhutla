(function () {
  const openBtn = document.getElementById("btn-dokumentasi");
  const modal = document.getElementById("doc-modal");
  const modalBackdrop = document.getElementById("doc-modal-backdrop");
  const modalClose = document.getElementById("doc-modal-close");
  const grid = document.getElementById("doc-grid");

  const lightbox = document.getElementById("doc-lightbox");
  const lightboxBackdrop = document.getElementById("doc-lightbox-backdrop");
  const lightboxClose = document.getElementById("doc-lightbox-close");
  const lightboxImg = document.getElementById("doc-lightbox-img");
  const lightboxCaption = document.getElementById("doc-lightbox-caption");
  const lightboxPrev = document.getElementById("doc-lightbox-prev");
  const lightboxNext = document.getElementById("doc-lightbox-next");

  if (!openBtn || !modal || !grid) return;

  const PHOTOS = [];
  for (let i = 1; i <= 21; i += 1) {
    const file = i === 1 ? "dokumentasi.png" : "dokumentasi" + i + ".png";
    PHOTOS.push({ src: "aktivitas/" + file, caption: "Dokumentasi lapangan " + i });
  }

  grid.innerHTML = PHOTOS.map(function (photo, index) {
    return '<button type="button" class="doc-thumb" data-index="' + index + '">' +
      '<img src="' + photo.src + '" alt="' + photo.caption + '" loading="lazy">' +
      "</button>";
  }).join("");

  let currentIndex = 0;

  function openModal() {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  function showLightbox(index) {
    currentIndex = (index + PHOTOS.length) % PHOTOS.length;
    const photo = PHOTOS[currentIndex];
    lightboxImg.src = photo.src;
    lightboxImg.alt = photo.caption;
    lightboxCaption.textContent = photo.caption + " (" + (currentIndex + 1) + "/" + PHOTOS.length + ")";
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
  }

  openBtn.addEventListener("click", openModal);
  modalBackdrop.addEventListener("click", closeModal);
  modalClose.addEventListener("click", closeModal);

  grid.addEventListener("click", function (e) {
    const btn = e.target.closest(".doc-thumb");
    if (!btn) return;
    showLightbox(Number(btn.getAttribute("data-index")));
  });

  lightboxBackdrop.addEventListener("click", closeLightbox);
  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", function () { showLightbox(currentIndex - 1); });
  lightboxNext.addEventListener("click", function () { showLightbox(currentIndex + 1); });

  document.addEventListener("keydown", function (e) {
    if (!lightbox.hidden) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showLightbox(currentIndex - 1);
      if (e.key === "ArrowRight") showLightbox(currentIndex + 1);
      return;
    }
    if (!modal.hidden && e.key === "Escape") closeModal();
  });
})();
