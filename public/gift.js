// Dárkové odkazy: ?gift=<KÓD> → mince + exkluzivní skiny (jednou na zařízení, každý dárek zvlášť).
// Stav "už vyzvednuto" je v běžných datech obchodu (data.gifts), takže ho smaže i reset postupu.
// Tabulka dárků: klíč = kód malými písmeny (zároveň id v data.gifts), items = skiny, fx = efekty oslavy.
const GIFTS = {
  obzerstvi3000: { coins: 3000, items: ['frame-obzerstvi'], fx: 'legendary' },
  jezevcik3000: { coins: 3000, items: ['frame-jezevcik', 'name-jezevcik'], fx: 'mythic' },
  miku3000: { coins: 3000, items: ['frame-miku', 'name-miku'], fx: 'mythic' },
};

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

// Společné vyzvednutí dárku (z odkazu i z kódu zadaného v obchodě).
// Vrací 'ok' | 'dev' | 'invalid' | 'claimed'.
function claimGift(rawCode) {
  const code = String(rawCode || '').trim().toLowerCase().replace(/\s+/g, '');
  // dev režim: dev klíč může být v adrese poprvé, takže stačí, že existuje klíč
  if (isDevMode() || devKey()) return 'dev';
  if (!code || !Object.prototype.hasOwnProperty.call(GIFTS, code)) return 'invalid';
  const gift = GIFTS[code];
  const d = shopLoad();
  d.gifts = d.gifts || [];
  if (d.gifts.includes(code)) return 'claimed';
  d.gifts.push(code);
  d.coins = (d.coins || 0) + gift.coins;
  d.owned = d.owned || [];
  for (const id of gift.items) if (!d.owned.includes(id)) d.owned.push(id);
  shopSave(d);
  showGiftReveal(gift);
  return 'ok';
}

function handleGiftLink() {
  const code = takeGiftParam();
  if (code === null) return;
  const res = claimGift(code);
  if (res === 'dev') showToast("Gift links don't work in dev mode.");
  else if (res === 'claimed') showToast('You already claimed this gift.');
}

// Karta „Enter code“ v obchodě (záložka Free): hráč opíše kód, který od tebe dostal.
function redeemCodeCardHtml() {
  return `
    <div class="redeem-card">
      <div class="redeem-title">${icon('gift')} Got a code?</div>
      <div class="redeem-row">
        <input id="redeem-input" class="redeem-input" maxlength="30" placeholder="Enter code" autocomplete="off" autocapitalize="characters" spellcheck="false">
        <button type="button" class="btn btn-primary" id="redeem-btn">Redeem</button>
      </div>
    </div>`;
}

function wireRedeemCode() {
  const input = document.getElementById('redeem-input');
  const btn = document.getElementById('redeem-btn');
  if (!input || !btn) return;
  const submit = () => {
    if (!input.value.trim()) { showError('Enter a code first.'); return; }
    const res = claimGift(input.value);
    if (res === 'invalid') showError("That code doesn't work.");
    else if (res === 'claimed') showToast('You already claimed this code.');
    else if (res === 'dev') showToast("Codes don't work in dev mode.");
    else input.value = '';
  };
  btn.onclick = submit;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
}

function showGiftReveal(gift) {
  const items = gift.items.map((id) => ALL_ITEMS.find((i) => i.id === id));
  const rarity = RARITIES[items[0].rarity];
  const mythic = items[0].rarity === 'mythic';
  closeCaseOverlay();
  playSfx('gift-reveal');
  setTimeout(() => playSfx('payout'), 450);
  items.forEach((it) => playSkinSfx(it.id, 1200));
  // jeden skin = původní vzhled; víc skinů = pod sebou náhled + název + druh každého
  const itemsHtml = items.map((item) => `
          <div class="reveal-preview">${shopItemPreview(sectionOf(item), item)}</div>
          <div class="reveal-name">${item.name}</div>
          <div class="reveal-kind">${item.section === 'frame' ? 'Frame' : 'Name color'}</div>`).join('');
  const overlay = document.createElement('div');
  overlay.id = 'case-overlay';
  overlay.className = 'case-overlay chest-overlay';
  overlay.innerHTML = `
    <button class="x-close case-x" id="reveal-close" aria-label="Close">${icon('close')}</button>
    <div class="case-stage">
      <div class="case-reveal show" id="case-reveal" style="--rc:${rarity.color}">
        <div class="reveal-card rar-${items[0].rarity} ${mythic ? 'is-mythic' : ''} ${items.length > 1 ? 'gift-multi' : ''}">
          <div class="reveal-rays"></div>
          <h2 class="case-title gift-title">You got a gift!</h2>
          <div class="gift-coins"><svg class="wheel-reveal-art" viewBox="0 0 64 56">${coinArt(32, 29, 17)}</svg><span class="num">+${gift.coins} coins</span></div>
          <div class="reveal-rarity">${rarity.label}</div>${itemsHtml}
        </div>
        <div class="reveal-actions"><button class="btn btn-primary btn-block" id="gift-equip">Equip</button></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');
  const done = () => {
    closeCaseOverlay();
    if (typeof mountedKey !== 'undefined' && mountedKey === 'shop') renderShopScreen(); // vyzvednuto v obchodě → obnov ho (mince, skiny)
    else if (typeof lastState === 'undefined' || !lastState) renderStartScreen();
  };
  overlay.querySelector('#reveal-close').onclick = done;
  overlay.querySelector('#gift-equip').onclick = () => {
    const d = shopLoad();
    for (const item of items) d.equipped[item.section] = item.id;
    shopSave(d);
    showToast(`Equipped: ${items.map((i) => i.name).join(' + ')}`);
    done();
  };
  if (!caseReducedMotion()) {
    const card = overlay.querySelector('.reveal-card');
    const r = card.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const fx = CASE_FX[gift.fx];
    caseBurst(overlay, fx.cols, fx.n, true, r.left - o.left + r.width / 2, r.top - o.top + r.height * 0.4, 3);
    caseRays(overlay, gift.fx);
    if (fx.coins) caseCoinRain(overlay, fx.coins);
  }
}

// až po načtení stránky (aplikace se vykreslí v app.js, texty přeloží i18n)
window.addEventListener('load', () => setTimeout(handleGiftLink, 0));
