// Round Gallery — po konci hry TOP 3 nejvíc hlasované fotky z celé hry (jen k prohlížení, bez ukládání a sdílení).
// Server posílá `state.gallery` jen ve fázi gameover:
// [{ round, kind, label, likes, photos: [{ name, looks, photoDataUrl }] }] — seřazené od nejlepší

let galleryItems = [];
let galleryIndex = 0;

function galleryNamesHtml(item) {
  return item.photos.map((p) => playerNameHtml(p.name, p.looks)).join('<span class="gal-amp"> &amp; </span>');
}

// Štítek pořadí: „#1 · 👍 3“ (zlatá/stříbrná/bronzová podle místa)
function galleryRankHtml(item, index) {
  const v = item.likes || 0;
  return `<span class="gal-round gal-rank r${index + 1}">#${index + 1}${v ? ` · 👍 ${v}` : ''}</span>`;
}

function galleryPhotosHtml(item) {
  return `<div class="gal-photos n${item.photos.length}">${item.photos.map((p) => `<div class="gal-ph">${resultPhotoHtml(p.photoDataUrl, p.looks)}</div>`).join('')}</div>`;
}

// Sekce pod výsledky; prázdný string, pokud není co ukázat.
function galleryHtml(state) {
  const items = (state.gallery || []).filter((g) => g.photos && g.photos.length);
  if (!items.length) return '';
  return `
    <div class="gal-sec">
      <h3 class="gal-title">Top 3 Photos</h3>
      <div class="gal-grid">
        ${items.map((g, i) => `
          <button class="gal-card" data-gi="${i}" style="animation-delay:${0.08 * Math.min(i, 8)}s">
            ${galleryPhotosHtml(g)}
            <div class="gal-name">${galleryNamesHtml(g)}</div>
            <div class="gal-meta">${galleryRankHtml(g, i)}${g.label ? `<span class="gal-label">${escapeHtml(g.label)}</span>` : ''}</div>
          </button>`).join('')}
      </div>
    </div>`;
}

function wireGallery(state) {
  const items = (state.gallery || []).filter((g) => g.photos && g.photos.length);
  document.querySelectorAll('.gal-card').forEach((el) => {
    el.onclick = () => openGalleryViewer(items, Number(el.dataset.gi));
  });
}

function closeGalleryViewer() {
  const el = document.getElementById('gal-view');
  if (el) el.remove();
  document.removeEventListener('keydown', galleryKey);
}

function galleryKey(e) {
  if (e.key === 'Escape') closeGalleryViewer();
  else if (e.key === 'ArrowLeft') galleryStep(-1);
  else if (e.key === 'ArrowRight') galleryStep(1);
}

function openGalleryViewer(items, index) {
  closeGalleryViewer();
  galleryItems = items;
  galleryIndex = index;
  const view = document.createElement('div');
  view.id = 'gal-view';
  view.className = 'gal-view';
  view.innerHTML = `
    <button class="x-close gal-x" id="gal-close" aria-label="Close">${icon('close')}</button>
    <div class="gal-stage" id="gal-stage"></div>
    <div class="gal-nav">
      <button class="gal-arrow flip" id="gal-prev" aria-label="Previous">${icon('chevron')}</button>
      <span class="gal-count" id="gal-count"></span>
      <button class="gal-arrow" id="gal-next" aria-label="Next">${icon('chevron')}</button>
    </div>
    <div class="gal-note">${icon('lock')} What happens in the game stays in the game — photos can't be saved.</div>`;
  document.body.appendChild(view);
  document.getElementById('gal-close').onclick = closeGalleryViewer;
  document.getElementById('gal-prev').onclick = () => galleryStep(-1);
  document.getElementById('gal-next').onclick = () => galleryStep(1);
  // fotky nejdou uložit ani přetáhnout (co se stane ve hře, zůstane ve hře)
  view.addEventListener('contextmenu', (e) => e.preventDefault());
  view.addEventListener('dragstart', (e) => e.preventDefault());
  // swipe doleva/doprava
  let x0 = null;
  view.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) galleryStep(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', galleryKey);
  galleryShow(0);
}

function galleryStep(d) {
  if (!document.getElementById('gal-view')) return;
  const n = galleryItems.length;
  galleryIndex = (galleryIndex + d + n) % n;
  playSfx('swipe');
  galleryShow(d);
}

function galleryShow(dir) {
  const item = galleryItems[galleryIndex];
  const stage = document.getElementById('gal-stage');
  if (!item || !stage) return;
  stage.innerHTML = `
    <div class="gal-slide ${dir < 0 ? 'from-left' : 'from-right'}">
      ${galleryPhotosHtml(item)}
      <div class="gal-big-name">${galleryNamesHtml(item)}</div>
      <div class="gal-meta big">${galleryRankHtml(item, galleryIndex)}${item.label ? `<span class="gal-label">${escapeHtml(item.label)}</span>` : ''}</div>
    </div>`;
  document.getElementById('gal-count').textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
  const multi = galleryItems.length > 1;
  document.getElementById('gal-prev').style.visibility = multi ? 'visible' : 'hidden';
  document.getElementById('gal-next').style.visibility = multi ? 'visible' : 'hidden';
}
