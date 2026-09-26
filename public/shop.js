// Shop — PROTOTYP. Mince, vlastněné a nasazené věci se zatím drží jen
// v localStorage tohohle telefonu (žádný server, žádné skutečné platby).
// Kosmetika se nedá koupit přímo — padá jen z bedny (viz case.js).
// Mince se utrácí výhradně za kosmetiku, nikdy za herní výhodu.

const SHOP_START_COINS = 250;

// Vzácnosti: weight = šance v procentech, refund = kolik mincí vrátí
// duplikát (věc, kterou už máš).
const RARITIES = {
  common: { label: 'Běžná', color: '#60A5FA', weight: 55, refund: 15 },
  rare: { label: 'Vzácná', color: '#A855F7', weight: 28, refund: 35 },
  epic: { label: 'Epická', color: '#EC4899', weight: 13, refund: 75 },
  legendary: { label: 'Legendární', color: '#F0B429', weight: 4, refund: 200 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const SHOP_SECTIONS = [
  {
    id: 'frame',
    title: 'Rámečky fotek',
    items: [
      { id: 'frame-ice', name: 'Led', rarity: 'common', style: 'linear-gradient(135deg,#E0F2FE,#7DD3FC,#38BDF8)' },
      { id: 'frame-forest', name: 'Les', rarity: 'common', style: 'linear-gradient(135deg,#86EFAC,#22C55E,#15803D)' },
      { id: 'frame-neon', name: 'Neon', rarity: 'rare', style: 'linear-gradient(135deg,#F472B6,#C084FC,#22D3EE)' },
      { id: 'frame-night', name: 'Půlnoc', rarity: 'rare', style: 'linear-gradient(135deg,#1E3A8A,#6366F1,#A5B4FC)' },
      { id: 'frame-gold', name: 'Zlato', rarity: 'epic', style: 'linear-gradient(135deg,#FDE68A,#F0B429,#B45309)' },
      { id: 'frame-fire', name: 'Plameny', rarity: 'epic', style: 'linear-gradient(0deg,#DC2626,#F97316,#FDE047)' },
      { id: 'frame-rainbow', name: 'Duha', rarity: 'legendary', style: 'conic-gradient(#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA,#F87171)' },
      { id: 'frame-sunset', name: 'Západ slunce', rarity: 'common', style: 'linear-gradient(135deg,#FDBA74,#F472B6)' },
      { id: 'frame-mint', name: 'Máta', rarity: 'common', style: 'linear-gradient(135deg,#A7F3D0,#34D399)' },
      { id: 'frame-grape', name: 'Hrozen', rarity: 'common', style: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)' },
      { id: 'frame-ocean', name: 'Oceán', rarity: 'rare', style: 'linear-gradient(135deg,#22D3EE,#2563EB,#1E3A8A)' },
      { id: 'frame-candy', name: 'Cukrová vata', rarity: 'rare', style: 'linear-gradient(135deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'frame-toxic', name: 'Toxic', rarity: 'rare', style: 'linear-gradient(135deg,#BEF264,#22C55E,#14532D)' },
      { id: 'frame-lava', name: 'Láva', rarity: 'epic', style: 'linear-gradient(160deg,#FACC15,#EF4444 45%,#7F1D1D)' },
      { id: 'frame-aurora', name: 'Polární záře', rarity: 'epic', style: 'linear-gradient(135deg,#34D399,#22D3EE,#A78BFA,#F472B6)' },
      { id: 'frame-chrome', name: 'Chrom', rarity: 'epic', style: 'linear-gradient(135deg,#F8FAFC,#94A3B8 30%,#F1F5F9 55%,#64748B 80%,#E2E8F0)' },
      { id: 'frame-galaxy', name: 'Galaxie', rarity: 'legendary', style: 'conic-gradient(from 200deg,#1E1B4B,#7C3AED,#EC4899,#22D3EE,#1E1B4B)' },
      { id: 'frame-diamond', name: 'Diamant', rarity: 'legendary', style: 'conic-gradient(#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD,#E9D5FF,#E0F2FE)' },
    ],
  },
  {
    id: 'name',
    title: 'Barva jména',
    items: [
      { id: 'name-violet', name: 'Fialová', rarity: 'common', color: '#C084FC' },
      { id: 'name-mint', name: 'Mátová', rarity: 'common', color: '#5EEAD4' },
      { id: 'name-pink', name: 'Růžová', rarity: 'common', color: '#F9A8D4' },
      { id: 'name-gold', name: 'Zlatá', rarity: 'rare', color: '#FBBF24' },
      { id: 'name-ice', name: 'Ledová', rarity: 'rare', gradient: 'linear-gradient(90deg,#E0F2FE,#38BDF8)' },
      { id: 'name-fire', name: 'Ohnivá', rarity: 'epic', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626)' },
      { id: 'name-rainbow', name: 'Duhová', rarity: 'legendary', gradient: 'linear-gradient(90deg,#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA)' },
      { id: 'name-sky', name: 'Nebeská', rarity: 'common', color: '#7DD3FC' },
      { id: 'name-lime', name: 'Limetková', rarity: 'common', color: '#BEF264' },
      { id: 'name-peach', name: 'Broskvová', rarity: 'common', color: '#FDBA74' },
      { id: 'name-sunset', name: 'Západ slunce', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDBA74,#F472B6)' },
      { id: 'name-toxic', name: 'Toxická', rarity: 'rare', gradient: 'linear-gradient(90deg,#BEF264,#22C55E)' },
      { id: 'name-candy', name: 'Cukrová', rarity: 'rare', gradient: 'linear-gradient(90deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'name-aurora', name: 'Polární záře', rarity: 'epic', gradient: 'linear-gradient(90deg,#34D399,#22D3EE,#A78BFA)' },
      { id: 'name-chrome', name: 'Chromová', rarity: 'epic', gradient: 'linear-gradient(90deg,#F8FAFC,#94A3B8,#F1F5F9,#94A3B8)' },
      { id: 'name-galaxy', name: 'Galaktická', rarity: 'legendary', gradient: 'linear-gradient(90deg,#A78BFA,#EC4899,#22D3EE)' },
      { id: 'name-diamond', name: 'Diamantová', rarity: 'legendary', gradient: 'linear-gradient(90deg,#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD)' },
    ],
  },
];

// Všechny věci v jednom seznamu, každá ví, do jaké sekce patří.
const ALL_ITEMS = SHOP_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.id })));

// Ceník — jeden kurz pro všechno: zhruba 100 mincí = 1 €.
// Větší balíčky mincí mají bonus navíc, ať se vyplatí.
// Truhly stojí 80–400 mincí (≈ 0,80–4 €), dohraná hra dá 5–20 mincí.
const COIN_RATE_EUR = 0.01; // cena 1 mince v eurech (podle nejmenšího balíčku)

const COIN_PACKS = [
  { coins: 100, price: '0,99 €' },
  { coins: 550, price: '4,99 €', bonus: 10, tag: 'Oblíbené' },
  { coins: 1200, price: '9,99 €', bonus: 20 },
  { coins: 2600, price: '19,99 €', bonus: 30, tag: 'Nejvýhodnější' },
];

const NO_ADS_PRICE = '2,99 €';

function formatEur(value) {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

function shopLoad() {
  try {
    const data = JSON.parse(localStorage.getItem('vyraz_shop') || 'null');
    if (data) return data;
  } catch { /* ignore */ }
  return { coins: SHOP_START_COINS, owned: [], equipped: {} };
}

function shopSave(data) {
  try { localStorage.setItem('vyraz_shop', JSON.stringify(data)); } catch { /* ignore */ }
}

function coinBadgeHtml(coins) {
  return `<div class="coin-badge">${COIN_SVG}<span class="num">${coins}</span></div>`;
}

function shopItemPreview(section, item) {
  if (section.id === 'frame') {
    return `<div class="frame-preview" style="background:${item.style}"><div class="frame-inner">${icon('camera')}</div>${frameDecorHtml(item)}</div>`;
  }
  const name = escapeHtml(getSavedName() || 'Jméno');
  const style = item.gradient
    ? `background:${item.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`
    : `color:${item.color};`;
  return `<div class="name-preview"><span style="${style}">${name}</span></div>`;
}

function sectionOf(item) {
  return SHOP_SECTIONS.find((s) => s.id === item.section);
}

// Shop záložka má dvě pod-obrazovky: samotný obchod a inventář.
let shopView = 'shop';

function openInventory() {
  shopView = 'inventory';
  renderShopScreen();
  window.scrollTo(0, 0);
}

function backToShop() {
  shopView = 'shop';
  renderShopScreen();
  window.scrollTo(0, 0);
}

function itemCountLabel(n) {
  if (n === 1) return '1 věc';
  if (n >= 2 && n <= 4) return `${n} věci`;
  return `${n} věcí`;
}

function renderShopScreen() {
  if (shopView === 'inventory') return renderInventoryScreen();
  mountedKey = 'shop';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();

  const casesHtml = CASES.map((c) => `
    <div class="case-card" style="--case-glow:${c.glow}">
      <button class="case-info-btn" data-case="${c.id}" title="Co může padnout" aria-label="Co může padnout">?</button>
      <div class="case-art">${caseSvg(c)}</div>
      <h3>${c.name}</h3>
      <button class="case-open-btn" data-case="${c.id}">${COIN_SVG}<span class="num">${c.price}</span></button>
    </div>
  `).join('');

  const packsHtml = COIN_PACKS.map((p) => `
    <button class="coin-pack" data-pack="${p.coins}">
      ${p.tag ? `<span class="coin-pack-tag">${p.tag}</span>` : ''}
      <div class="coin-pack-icon">${COIN_SVG}</div>
      <div class="coin-pack-amount num">${p.coins}</div>
      ${p.bonus ? `<div class="coin-pack-bonus">+${p.bonus} % navíc</div>` : ''}
      <div class="coin-pack-price">${p.price}</div>
    </button>
  `).join('');

  app.innerHTML = `
    <div class="home-top">
      <div class="brand"><img class="mark" src="icon.svg" alt=""><h1>Shop</h1></div>
      ${coinBadgeHtml(data.coins)}
    </div>

    <div class="screen">
      <button class="inventory-btn" id="inventory-btn">
        <div class="inventory-btn-icon">${icon('backpack')}</div>
        <div class="inventory-btn-text"><strong>Inventář</strong><span>${itemCountLabel(data.owned.length)}</span></div>
        <div class="inventory-btn-arrow">${icon('chevron')}</div>
      </button>

      <div class="section-eyebrow">NABÍDKA</div>
      <div id="shop-pack">${partyPackCardHtml({ compact: true })}</div>

      <div class="section-eyebrow">TRUHLY</div>
      <div class="case-grid">${casesHtml}</div>

      <div class="section-eyebrow">MINCE</div>
      <div class="coin-packs">${packsHtml}</div>

      <button class="no-ads-card" id="no-ads-btn">
        <div class="no-ads-icon">${icon('noAds')}</div>
        <div class="no-ads-text"><strong>Bez reklam</strong><span>Navždy</span></div>
        <div class="no-ads-price">${NO_ADS_PRICE}</div>
      </button>
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  document.getElementById('inventory-btn').onclick = openInventory;
  wirePackBuy(document.getElementById('shop-pack'), renderShopScreen);
  // truhla se po ťuknutí zatřese; "Otevřít" ji nejdřív zatřese a pak otevře
  const shake = (card) => {
    card.classList.remove('shake');
    void card.offsetWidth; // restart animace, i když se ťukne vícekrát za sebou
    card.classList.add('shake');
  };
  document.querySelectorAll('.case-grid .case-card').forEach((card) => {
    // po zatřesení se truhla vrátí k levitování
    card.addEventListener('animationend', (e) => {
      if (e.animationName === 'chest-shake') card.classList.remove('shake');
    });
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button')) shake(card);
    });
  });
  document.querySelectorAll('.case-open-btn').forEach((btn) => {
    btn.onclick = () => {
      shake(btn.closest('.case-card'));
      setTimeout(() => openCase(btn.dataset.case), 450);
    };
  });
  document.querySelectorAll('.case-info-btn').forEach((btn) => { btn.onclick = () => showCaseContents(btn.dataset.case); });

  const notYet = () => showToast('Platby zatím nefungují — tohle je prototyp.');
  document.querySelectorAll('.coin-pack').forEach((b) => { b.onclick = notYet; });
  document.getElementById('no-ads-btn').onclick = notYet;
}

let toastTimer = null;
function showToast(text) {
  clearTimeout(toastTimer);
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ------------------------------------------------------------ INVENTÁŘ ---

function equippedItem(data, sectionId) {
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  return section.items.find((i) => i.id === data.equipped[sectionId]) || null;
}

function nameStyleFor(item) {
  if (!item) return 'color:#fff;';
  if (item.gradient) return `background:${item.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`;
  return `color:${item.color};`;
}

// Náhled toho, jak tě uvidí ostatní — nasazený rámeček + barva jména.
function looksPreviewHtml(data) {
  const frame = equippedItem(data, 'frame');
  const nameItem = equippedItem(data, 'name');
  return `
    <div class="looks-card">
      <div class="looks-frame" style="background:${frame ? frame.style : 'rgba(255,255,255,0.12)'}">
        <div class="looks-photo">${escapeHtml((getSavedName() || '?').charAt(0).toUpperCase())}</div>
        ${frameDecorHtml(frame)}
      </div>
      <div class="looks-name" style="${nameStyleFor(nameItem)}">${escapeHtml(getSavedName() || 'Jméno')}</div>
    </div>`;
}

function inventoryTileHtml(section, item, equipped) {
  const preview = item
    ? shopItemPreview(section, item)
    : section.id === 'frame'
      ? `<div class="frame-preview" style="background:rgba(255,255,255,0.12)"><div class="frame-inner">${icon('camera')}</div></div>`
      : `<div class="name-preview"><span style="color:#fff">${escapeHtml(getSavedName() || 'Jméno')}</span></div>`;
  return `
    <button class="shop-item inv-item ${equipped ? 'is-equipped' : ''} ${item ? 'has-rarity' : ''}" data-section="${section.id}" data-id="${item ? item.id : ''}" style="${item ? `--rc:${RARITIES[item.rarity].color}` : ''}">
      ${preview}
      <div class="shop-item-name">${item ? item.name : 'Výchozí'}</div>
      ${equipped
        ? `<span class="shop-state equipped">${icon('check')} Nasazeno</span>`
        : `<span class="shop-state owned">Nasadit</span>`}
    </button>`;
}

function renderInventoryScreen() {
  mountedKey = 'inventory';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();

  const sectionsHtml = SHOP_SECTIONS.map((section) => {
    const ownedItems = section.items.filter((i) => data.owned.includes(i.id));
    const tiles = [inventoryTileHtml(section, null, !data.equipped[section.id])]
      .concat(ownedItems.map((item) => inventoryTileHtml(section, item, data.equipped[section.id] === item.id)))
      .join('');
    return `
      <div class="section-eyebrow">${section.title.toUpperCase()}</div>
      <div class="shop-grid">${tiles}</div>`;
  }).join('');

  app.innerHTML = `
    <div class="home-top">
      <div class="lobby-top" style="margin-bottom:0">
        <button id="inv-back" class="back-btn" title="Zpět do shopu">${icon('back')}</button>
        <div class="brand"><h1>Inventář</h1></div>
      </div>
      ${coinBadgeHtml(data.coins)}
    </div>

    <div class="screen">
      ${looksPreviewHtml(data)}
      ${sectionsHtml}
      ${data.owned.length === 0 ? `<button class="btn btn-primary btn-block" id="inv-to-shop">${icon('bag')} Otevřít bednu v shopu</button>` : ''}
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  // ťuknutí na "Shop" v liště z inventáře vrátí zpátky do obchodu
  document.querySelector('.bottom-nav-btn[data-tab="shop"]').onclick = backToShop;
  document.getElementById('inv-back').onclick = backToShop;
  const toShop = document.getElementById('inv-to-shop');
  if (toShop) toShop.onclick = backToShop;

  document.querySelectorAll('.inv-item').forEach((btn) => {
    btn.onclick = () => {
      const d = shopLoad();
      if (btn.dataset.id) d.equipped[btn.dataset.section] = btn.dataset.id;
      else delete d.equipped[btn.dataset.section];
      shopSave(d);
      renderInventoryScreen();
    };
  });
}
