// Dárkový odkaz: ?gift=OBZERSTVI3000 → +3000 mincí a exkluzivní rámeček Obžerství (jednou na zařízení).
// Stav "už vyzvednuto" je v běžných datech obchodu (data.gifts), takže ho smaže i reset postupu.
const GIFT_CODE = 'obzerstvi3000';
const GIFT_COINS = 3000;
const GIFT_ITEM = 'frame-obzerstvi';

// Vrátí kód z adresy (malými písmeny) a parametr hned odstraní, ať ho reload nespustí znovu.
function takeGiftParam() {
  try {
    const params = new URLSearchParams(location.search);
    if (!params.has('gift')) return null;
    const code = String(params.get('gift') || '').trim().toLowerCase();
    params.delete('gift');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    return code;
  } catch { return null; }
}

function handleGiftLink() {
  const code = takeGiftParam();
  if (code === null) return;
  // dev režim: dev klíč může být v adrese poprvé, takže stačí, že existuje klíč
  if (isDevMode() || devKey()) { showToast("Gift links don't work in dev mode."); return; }
  if (code !== GIFT_CODE) return;
  const d = shopLoad();
  d.gifts = d.gifts || [];
  if (d.gifts.includes(GIFT_CODE)) { showToast('You already claimed this gift.'); return; }
  d.gifts.push(GIFT_CODE);
  d.coins = (d.coins || 0) + GIFT_COINS;
  d.owned = d.owned || [];
  if (!d.owned.includes(GIFT_ITEM)) d.owned.push(GIFT_ITEM);
  shopSave(d);
  showGiftReveal();
}

function showGiftReveal() {
  const item = ALL_ITEMS.find((i) => i.id === GIFT_ITEM);
  const rarity = RARITIES[item.rarity];
  closeCaseOverlay();
  playSfx('reveal-legendary');
  setTimeout(() => playSfx('coins'), 450);
  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay chest-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close">${icon('close')}</button>
    <div class="case-stage">
      <div class="case-reveal show" id="case-reveal" style="--rc:${rarity.color}">
        <div class="reveal-card rar-legendary">
          <div class="reveal-rays"></div>
          <h2 class="case-title gift-title">You got a gift!</h2>
          <div class="gift-coins"><svg class="wheel-reveal-art" viewBox="0 0 64 56">${coinArt(32, 29, 17)}</svg><span class="num">+${GIFT_COINS} coins</span></div>
          <div class="reveal-rarity">${rarity.label}</div>
          <div class="reveal-preview">${shopItemPreview(sectionOf(item), item)}</div>
          <div class="reveal-name">${item.name}</div>
          <div class="reveal-kind">Frame</div>
        </div>
        <div class="reveal-actions"><button class="btn btn-primary btn-block" id="gift-equip">Equip</button></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');
  const done = () => { closeCaseOverlay(); if (typeof lastState === 'undefined' || !lastState) renderStartScreen(); };
  overlay.querySelector('#reveal-close').onclick = done;
  overlay.querySelector('#gift-equip').onclick = () => {
    const d = shopLoad();
    d.equipped[item.section] = item.id;
    shopSave(d);
    showToast(`Equipped: ${item.name}`);
    done();
  };
  if (!caseReducedMotion()) {
    const card = overlay.querySelector('.reveal-card');
    const r = card.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const fx = CASE_FX.legendary;
    caseBurst(overlay, fx.cols, fx.n, true, r.left - o.left + r.width / 2, r.top - o.top + r.height * 0.4, 3);
    caseRays(overlay, 'legendary');
    if (fx.coins) caseCoinRain(overlay, fx.coins);
  }
}

// až po načtení stránky (aplikace se vykreslí v app.js, texty přeloží i18n)
window.addEventListener('load', () => setTimeout(handleGiftLink, 0));
