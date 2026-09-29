// Shop — PROTOTYP. Mince, vlastněné a nasazené věci se zatím drží jen
// v localStorage tohohle telefonu (žádný server, žádné skutečné platby).
// Kosmetika se nedá koupit přímo — padá jen z bedny (viz case.js).
// Mince se utrácí výhradně za kosmetiku, nikdy za herní výhodu.

// Reset postupu pro všechny: když se PROGRESS_VERSION zvýší, každému hráči
// se při dalším otevření hry jednou smažou mince, skiny, odemčené balíčky,
// vstupenky a denní odměny. Jméno, profilovka a přátelé zůstanou.
const PROGRESS_VERSION = 4; // 2, 3, 4 = resety 27. 9. 2026 (dev postup vyraz_shop_dev se nemaže)
try {
  if (Number(localStorage.getItem('vyraz_progress_version') || 1) < PROGRESS_VERSION) {
    localStorage.removeItem('vyraz_shop');
    localStorage.setItem('vyraz_progress_version', String(PROGRESS_VERSION));
  }
} catch { /* bez localStorage není co mazat */ }

const SHOP_START_COINS = 0; // nový hráč začíná bez mincí — první si vydělá hrou nebo denní odměnou

// Vzácnosti: refund = kolik mincí vrátí duplikát (věc, kterou už máš).
// Šance na jednotlivé vzácnosti má každá truhla vlastní (viz CASES v case.js).
const RARITIES = {
  common: { label: 'Common', color: '#60A5FA', refund: 15 },
  rare: { label: 'Rare', color: '#A855F7', refund: 35 },
  epic: { label: 'Epic', color: '#EC4899', refund: 75 },
  legendary: { label: 'Legendary', color: '#F0B429', refund: 200 },
  // Mythic — nejvzácnější, zatím jen rámeček Fortune z kola štěstí (v truhlách není,
  // proto není v RARITY_ORDER, podle kterého se počítají šance truhel)
  mythic: { label: 'Mythic', color: '#FF3D7F', refund: 500 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

const SHOP_SECTIONS = [
  {
    id: 'frame',
    title: 'Photo frames',
    items: [
      { id: 'frame-ice', name: 'Ice', rarity: 'common', style: 'linear-gradient(135deg,#E0F2FE,#7DD3FC,#38BDF8)' },
      { id: 'frame-forest', name: 'Forest', rarity: 'common', style: 'linear-gradient(135deg,#86EFAC,#22C55E,#15803D)' },
      { id: 'frame-neon', name: 'Neon', rarity: 'rare', style: 'linear-gradient(135deg,#F472B6,#C084FC,#22D3EE)' },
      { id: 'frame-night', name: 'Midnight', rarity: 'rare', style: 'linear-gradient(135deg,#1E3A8A,#6366F1,#A5B4FC)' },
      { id: 'frame-gold', name: 'Gold', rarity: 'epic', style: 'linear-gradient(135deg,#FDE68A,#F0B429,#B45309)' },
      { id: 'frame-fire', name: 'Flames', rarity: 'epic', style: 'linear-gradient(0deg,#DC2626,#F97316,#FDE047)' },
      { id: 'frame-rainbow', name: 'Rainbow', rarity: 'legendary', style: 'conic-gradient(#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA,#F87171)' },
      { id: 'frame-sunset', name: 'Sunset', rarity: 'common', style: 'linear-gradient(135deg,#FDBA74,#F472B6)' },
      { id: 'frame-mint', name: 'Mint', rarity: 'common', style: 'linear-gradient(135deg,#A7F3D0,#34D399)' },
      { id: 'frame-grape', name: 'Grape', rarity: 'common', style: 'linear-gradient(135deg,#C4B5FD,#8B5CF6)' },
      { id: 'frame-ocean', name: 'Ocean', rarity: 'rare', style: 'linear-gradient(135deg,#22D3EE,#2563EB,#1E3A8A)' },
      { id: 'frame-candy', name: 'Cotton Candy', rarity: 'rare', style: 'linear-gradient(135deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'frame-toxic', name: 'Toxic', rarity: 'rare', style: 'linear-gradient(135deg,#BEF264,#22C55E,#14532D)' },
      { id: 'frame-lava', name: 'Lava', rarity: 'epic', style: 'linear-gradient(160deg,#FDE047,#F97316 30%,#DC2626 60%,#450A0A)' },
      { id: 'frame-aurora', name: 'Aurora', rarity: 'epic', style: 'linear-gradient(135deg,#34D399,#22D3EE,#A78BFA,#F472B6)' },
      { id: 'frame-chrome', name: 'Chrome', rarity: 'epic', style: 'linear-gradient(135deg,#F8FAFC,#94A3B8 30%,#F1F5F9 55%,#64748B 80%,#E2E8F0)' },
      { id: 'frame-galaxy', name: 'Galaxy', rarity: 'legendary', style: 'conic-gradient(from 200deg,#1E1B4B,#7C3AED,#EC4899,#22D3EE,#1E1B4B)' },
      { id: 'frame-diamond', name: 'Diamond', rarity: 'legendary', style: 'conic-gradient(#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD,#E9D5FF,#E0F2FE)' },
      { id: 'frame-sand', name: 'Sand', rarity: 'common', style: 'linear-gradient(135deg,#FDE68A,#D6B370)' },
      { id: 'frame-rose', name: 'Rose', rarity: 'common', style: 'linear-gradient(135deg,#FECDD3,#FB7185)' },
      { id: 'frame-slate', name: 'Slate', rarity: 'common', style: 'linear-gradient(135deg,#CBD5E1,#64748B)' },
      { id: 'frame-sakura', name: 'Sakura', rarity: 'rare', style: 'linear-gradient(135deg,#FFF1F2,#F9A8D4,#EC4899)' },
      { id: 'frame-mango', name: 'Mango', rarity: 'rare', style: 'linear-gradient(135deg,#FDE047,#FB923C)' },
      { id: 'frame-deepsea', name: 'Deep Sea', rarity: 'rare', style: 'linear-gradient(135deg,#22D3EE,#1E3A8A,#0F172A)' },
      { id: 'frame-frost', name: 'Frost', rarity: 'epic', style: 'linear-gradient(135deg,#FFFFFF,#BAE6FD,#60A5FA)' },
      { id: 'frame-love', name: 'Love', rarity: 'epic', style: 'linear-gradient(135deg,#FDA4AF,#F43F5E,#BE123C)' },
      { id: 'frame-electric', name: 'Lightning', rarity: 'epic', style: 'linear-gradient(135deg,#FEF08A,#FACC15 40%,#3B82F6)' },
      { id: 'frame-music', name: 'Music', rarity: 'epic', style: 'linear-gradient(135deg,#A78BFA,#EC4899,#F59E0B)' },
      { id: 'frame-king', name: 'King', rarity: 'legendary', style: 'linear-gradient(135deg,#7C3AED,#FDE68A 45%,#F59E0B 55%,#7C3AED)' },
      { id: 'frame-phoenix', name: 'Phoenix', rarity: 'legendary', style: 'linear-gradient(0deg,#7F1D1D,#F97316 40%,#FDE047 75%,#FFF7ED)' },
      { id: 'frame-sweets', name: 'Sweets', rarity: 'legendary', style: 'repeating-linear-gradient(135deg,#FF5FA2 0 7%,#FFF0F6 7% 12%,#7DD3FC 12% 19%,#FFF0F6 19% 24%)' },
      // Spooky (halloweenská sada — Spooky Chest)
      { id: 'frame-pumpkin', name: 'Pumpkin', rarity: 'common', style: 'linear-gradient(135deg,#FDBA74,#F97316,#C2410C)' },
      { id: 'frame-moss', name: 'Moss', rarity: 'common', style: 'linear-gradient(135deg,#A3E635,#4D7C0F)' },
      { id: 'frame-bone', name: 'Bone', rarity: 'common', style: 'linear-gradient(135deg,#FAFAF9,#D6D3D1,#A8A29E)' },
      { id: 'frame-bat', name: 'Bat Wing', rarity: 'rare', style: 'linear-gradient(135deg,#8B5CF6,#4C1D95,#1E1B4B)' },
      { id: 'frame-slime', name: 'Slime', rarity: 'rare', style: 'linear-gradient(160deg,#ECFCCB,#A3E635 40%,#65A30D 75%,#365314)' },
      { id: 'frame-blood', name: 'Blood Moon', rarity: 'rare', style: 'linear-gradient(135deg,#FCA5A5,#DC2626,#450A0A)' },
      { id: 'frame-ghost', name: 'Ghost', rarity: 'epic', style: 'linear-gradient(135deg,#FFFFFF,#E2E8F0 45%,#A78BFA)' },
      { id: 'frame-witch', name: 'Witch', rarity: 'epic', style: 'linear-gradient(135deg,#86EFAC,#7C3AED 55%,#2E1065)' },
      { id: 'frame-spider', name: 'Spider', rarity: 'epic', style: 'linear-gradient(135deg,#6B7280,#1F2937 50%,#9CA3AF)' },
      { id: 'frame-haunted', name: 'Haunted', rarity: 'legendary', style: 'conic-gradient(from 45deg,#F97316,#7C3AED,#1E1B4B,#7C3AED,#F97316)' },
      { id: 'frame-vampire', name: 'Vampire', rarity: 'legendary', style: 'linear-gradient(160deg,#FECACA,#DC2626 35%,#7F1D1D 65%,#18181B)' },
      // jen z kola štěstí (wheel.js)
      { id: 'frame-fortune', name: 'Fortune', rarity: 'mythic', wheelOnly: true, style: 'conic-gradient(from 20deg,#FDE047,#22C55E,#FDE047,#A855F7,#FDE047)' },
    ],
  },
  {
    id: 'name',
    title: 'Name color',
    items: [
      { id: 'name-violet', name: 'Violet', rarity: 'common', color: '#C084FC' },
      { id: 'name-mint', name: 'Mint', rarity: 'common', color: '#5EEAD4' },
      { id: 'name-pink', name: 'Pink', rarity: 'common', color: '#F9A8D4' },
      { id: 'name-gold', name: 'Golden', rarity: 'rare', color: '#FBBF24' },
      { id: 'name-ice', name: 'Icy', rarity: 'rare', gradient: 'linear-gradient(90deg,#E0F2FE,#38BDF8)' },
      { id: 'name-fire', name: 'Fiery', rarity: 'epic', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626)' },
      { id: 'name-rainbow', name: 'Rainbow', rarity: 'legendary', gradient: 'linear-gradient(90deg,#F87171,#FBBF24,#34D399,#60A5FA,#A78BFA)' },
      { id: 'name-sky', name: 'Sky', rarity: 'common', color: '#7DD3FC' },
      { id: 'name-lime', name: 'Lime', rarity: 'common', color: '#BEF264' },
      { id: 'name-peach', name: 'Peach', rarity: 'common', color: '#FDBA74' },
      { id: 'name-sunset', name: 'Sunset', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDBA74,#F472B6)' },
      { id: 'name-toxic', name: 'Toxic', rarity: 'rare', gradient: 'linear-gradient(90deg,#BEF264,#22C55E)' },
      { id: 'name-candy', name: 'Candy', rarity: 'rare', gradient: 'linear-gradient(90deg,#F9A8D4,#C4B5FD,#93C5FD)' },
      { id: 'name-aurora', name: 'Aurora', rarity: 'epic', gradient: 'linear-gradient(90deg,#34D399,#22D3EE,#A78BFA)' },
      { id: 'name-chrome', name: 'Chrome', rarity: 'epic', gradient: 'linear-gradient(90deg,#F8FAFC,#94A3B8,#F1F5F9,#94A3B8)' },
      { id: 'name-galaxy', name: 'Galactic', rarity: 'legendary', gradient: 'linear-gradient(90deg,#A78BFA,#EC4899,#22D3EE)' },
      { id: 'name-diamond', name: 'Diamond', rarity: 'legendary', gradient: 'linear-gradient(90deg,#E0F2FE,#A5F3FC,#F5D0FE,#FFFFFF,#BAE6FD)' },
      { id: 'name-coral', name: 'Coral', rarity: 'common', color: '#FB7185' },
      { id: 'name-sand', name: 'Sandy', rarity: 'common', color: '#E7C98A' },
      { id: 'name-sakura', name: 'Sakura', rarity: 'rare', gradient: 'linear-gradient(90deg,#FFF1F2,#F9A8D4)' },
      { id: 'name-deepsea', name: 'Deep Sea', rarity: 'rare', gradient: 'linear-gradient(90deg,#22D3EE,#3B82F6)' },
      { id: 'name-mango', name: 'Mango', rarity: 'rare', gradient: 'linear-gradient(90deg,#FDE047,#FB923C)' },
      { id: 'name-frost', name: 'Frosty', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFFFFF,#BAE6FD,#60A5FA)' },
      { id: 'name-love', name: 'Lovestruck', rarity: 'epic', gradient: 'linear-gradient(90deg,#FDA4AF,#F43F5E)' },
      { id: 'name-electric', name: 'Electric', rarity: 'epic', gradient: 'linear-gradient(90deg,#FEF08A,#FACC15,#3B82F6)' },
      { id: 'name-king', name: 'Royal', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDE68A,#F59E0B,#FDE68A)' },
      { id: 'name-phoenix', name: 'Phoenix', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDE047,#F97316,#DC2626)' },
      // Spooky (halloweenská sada — Spooky Chest)
      { id: 'name-pumpkin', name: 'Pumpkin', rarity: 'common', color: '#FB923C' },
      { id: 'name-bone', name: 'Bone', rarity: 'common', color: '#E7E5E4' },
      { id: 'name-slime', name: 'Slimy', rarity: 'rare', gradient: 'linear-gradient(90deg,#ECFCCB,#A3E635,#65A30D)' },
      { id: 'name-bat', name: 'Batty', rarity: 'rare', gradient: 'linear-gradient(90deg,#C4B5FD,#8B5CF6)' },
      { id: 'name-ghost', name: 'Ghostly', rarity: 'epic', gradient: 'linear-gradient(90deg,#FFFFFF,#C4B5FD,#FFFFFF,#E2E8F0)' },
      { id: 'name-witch', name: 'Witchy', rarity: 'epic', gradient: 'linear-gradient(90deg,#86EFAC,#A855F7,#86EFAC)' },
      { id: 'name-haunted', name: 'Haunted', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FDBA74,#F97316,#A855F7,#F97316)' },
      { id: 'name-vampire', name: 'Vampire', rarity: 'legendary', gradient: 'linear-gradient(90deg,#FECACA,#EF4444,#B91C1C,#EF4444)' },
      // jen z kola štěstí (wheel.js)
      { id: 'name-jackpot', name: 'Jackpot', rarity: 'epic', wheelOnly: true, gradient: 'linear-gradient(90deg,#FDE047,#4ADE80,#FDE047,#4ADE80)' },
    ],
  },
];

// Všechny věci v jednom seznamu, každá ví, do jaké sekce patří.
const ALL_ITEMS = SHOP_SECTIONS.flatMap((s) => s.items.map((i) => ({ ...i, section: s.id })));

// Ceník — jeden kurz pro všechno: 120 mincí za €0.99 (≈ 121 mincí = 1 €).
// Větší balíčky mincí mají bonus navíc (+10/20/30 %), ať se vyplatí.
// Truhly stojí 50–250 mincí (≈ €0.40–2.10), dohraná hra dá 3–13 mincí, denně +30 zdarma.
const COIN_RATE_EUR = 0.99 / 120; // cena 1 mince v eurech (podle nejmenšího balíčku)

const COIN_PACKS = [
  { coins: 120, price: '€0.99', art: 'coin' },
  { coins: 670, price: '€4.99', bonus: 10, tag: 'Popular', art: 'pile' },
  { coins: 1450, price: '€9.99', bonus: 20, art: 'box' },
  { coins: 3150, price: '€19.99', bonus: 30, tag: 'Best value', art: 'safe' },
];

const NO_ADS_PRICE = '€2.99';

function formatEur(value) {
  return `€${value.toFixed(2)}`;
}

// V dev režimu je postup uložený zvlášť a mincí je pořád kolem milionu.
function shopKey() {
  return isDevMode() ? 'vyraz_shop_dev' : 'vyraz_shop';
}

function shopLoad() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(shopKey()) || 'null'); } catch { /* ignore */ }
  data = data || { coins: SHOP_START_COINS, owned: [], equipped: {} };
  // nabídky byly zdarma omylem v prototypu, tak se odstraní od běžných hráčů (dev storage se nemění)
  if (!isDevMode() && data.unlocks) {
    const partyPackCoins = 200; // PARTY_PACK.coins z offers.js
    const questionPacksCoins = 100; // QUESTION_PACKS.coins z offers.js
    let coinsToRemove = 0;
    if (data.unlocks.includes('party-pack')) coinsToRemove += partyPackCoins;
    if (data.unlocks.includes('question-packs')) coinsToRemove += questionPacksCoins;
    data.unlocks = data.unlocks.filter(id => id !== 'party-pack' && id !== 'question-packs');
    if (coinsToRemove > 0) {
      data.coins = Math.max(0, data.coins - coinsToRemove);
      shopSave(data);
    }
  }
  if (isDevMode() && data.coins < DEV_COINS / 2) data.coins = DEV_COINS;
  return data;
}

function shopSave(data) {
  try { localStorage.setItem(shopKey(), JSON.stringify(data)); } catch { /* ignore */ }
}

function coinBadgeHtml(coins) {
  return `<div class="coin-badge">${COIN_SVG}<span class="num">${coins}</span></div>`;
}

function shopItemPreview(section, item) {
  if (section.id === 'frame') {
    return `<div class="frame-preview" style="background:${item.style}"><div class="frame-inner">${icon('camera')}</div>${frameDecorHtml(item)}</div>`;
  }
  const name = escapeHtml(getSavedName() || 'Name');
  return `<div class="name-preview"><span style="${nameStyleFor(item)}">${name}</span></div>`;
}

function sectionOf(item) {
  return SHOP_SECTIONS.find((s) => s.id === item.section);
}

// Shop záložka má dvě pod-obrazovky: samotný obchod a inventář.
let shopView = 'shop';

// Obchod je rozdělený do záložek, ať není jeden dlouhý seznam.
// Otevře se na „Free", když je co vyzvednout, jinak na truhlách.
const SHOP_TABS = [
  { id: 'free', label: 'Free', icon: 'gift' },
  { id: 'chests', label: 'Chests', icon: 'chest' },
  { id: 'packs', label: 'Packs', icon: 'star' }, // nabídky + mince + No ads
];
let shopTab = null;

function shopTabsHtml() {
  return `<div class="shop-tabs">${SHOP_TABS.map((t) => `
    <button class="shop-tab ${t.id === shopTab ? 'active' : ''}" data-shop-tab="${t.id}">
      <span class="shop-tab-icon">${icon(t.icon)}</span>
      <span>${t.label}</span>
      ${t.id === 'free' && anyDailyAvailable() ? '<i class="shop-tab-dot"></i>' : ''}
    </button>`).join('')}</div>`;
}

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
  return n === 1 ? '1 item' : `${n} items`;
}

function renderShopScreen() {
  if (shopView === 'inventory') return renderInventoryScreen();
  mountedKey = 'shop';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();
  if (!shopTab) shopTab = anyDailyAvailable() ? 'free' : 'chests';

  const casesHtml = CASES.filter((c) => isCaseAvailable(c)).map((c) => `
    <div class="case-card ${c.isNew ? 'is-new' : ''}" style="--case-glow:${c.glow}">
      ${c.isNew ? '<span class="case-new-tag">NEW</span>' : ''}
      <button class="case-info-btn" data-case="${c.id}" title="What's inside" aria-label="What's inside">?</button>
      <div class="case-art">${caseSvg(c)}</div>
      <h3>${c.name}</h3>
      ${c.endsAt ? `<div class="case-timer">${icon('timer')} ${caseTimeLeft(c)}</div>` : ''}
      <button class="case-open-btn" data-case="${c.id}">${COIN_SVG}<span class="num">${c.price}</span></button>
    </div>
  `).join('');

  const packsHtml = COIN_PACKS.map((p) => `
    <button class="coin-pack" data-pack="${p.coins}">
      ${p.tag ? `<span class="coin-pack-tag">${p.tag}</span>` : ''}
      <div class="coin-pack-icon">${COIN_PACK_ART[p.art]}</div>
      <div class="coin-pack-amount num">${p.coins}</div>
      ${p.bonus ? `<div class="coin-pack-bonus">+${p.bonus}% extra</div>` : ''}
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
        <div class="inventory-btn-icon">${icon('hanger')}</div>
        <div class="inventory-btn-text"><strong>Inventory</strong><span>${itemCountLabel(data.owned.length)}</span></div>
        <div class="inventory-btn-arrow">${icon('chevron')}</div>
      </button>

      ${shopTabsHtml()}

      <div class="shop-tab-body">
        ${shopTab === 'free' ? dailyRewardsHtml() : ''}

        ${shopTab === 'chests' ? `<div class="case-grid">${casesHtml}</div>` : ''}

        ${shopTab === 'packs' ? `
          <div id="shop-pack">${partyPackCardHtml({ compact: true })}</div>
          <div id="shop-qpacks">${questionPacksCardHtml({ compact: true })}</div>

          <div class="section-eyebrow">COINS</div>
          <div class="coin-packs">${packsHtml}</div>
          <button class="no-ads-card" id="no-ads-btn">
            <div class="no-ads-icon">${NO_ADS_SVG}</div>
            <div class="no-ads-text"><strong>No ads</strong><span>Forever</span></div>
            <div class="no-ads-price">${NO_ADS_PRICE}</div>
          </button>` : ''}
      </div>
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  document.getElementById('inventory-btn').onclick = openInventory;
  document.querySelectorAll('[data-shop-tab]').forEach((b) => {
    b.onclick = () => { shopTab = b.dataset.shopTab; renderShopScreen(); };
  });
  if (shopTab === 'free') wireDailyRewards();
  if (shopTab === 'packs') {
    wirePackBuy(document.getElementById('shop-pack'), renderShopScreen);
    wireQuestionPacksBuy(document.getElementById('shop-qpacks'), renderShopScreen);
  }
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
  // jen truhly v sekci CHESTS — Daily Chest má vlastní "?" (daily.js), ten nepřepisovat
  document.querySelectorAll('.case-info-btn[data-case]').forEach((btn) => { btn.onclick = () => showCaseContents(btn.dataset.case); });

  const notYet = () => showToast('Payments aren\'t live yet — this is a prototype.');
  document.querySelectorAll('.coin-pack').forEach((b) => { b.onclick = notYet; });
  const noAds = document.getElementById('no-ads-btn');
  if (noAds) noAds.onclick = notYet;
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
  if (item.gradient) {
    const base = `background:${item.gradient}; -webkit-background-clip:text; background-clip:text; color:transparent;`;
    // vzácné barvy jména se pomalu přelévají, epické a legendární rychleji a víc září
    if (item.rarity === 'epic' || item.rarity === 'legendary') {
      return `${base} background-size:220% 100%; animation:name-shimmer 3.5s ease-in-out infinite alternate; filter:drop-shadow(0 0 6px rgba(255,255,255,0.25));`;
    }
    return `${base} background-size:180% 100%; animation:name-shimmer 6s ease-in-out infinite alternate;`;
  }
  // obyčejné barvy jména jemně svítí svou barvou
  return `color:${item.color}; text-shadow:0 0 10px ${item.color}55;`;
}

// Náhled toho, jak tě uvidí ostatní — nasazený rámeček + barva jména.
function looksPreviewHtml(data) {
  const frame = equippedItem(data, 'frame');
  const nameItem = equippedItem(data, 'name');
  return `
    <div class="looks-card">
      <div class="looks-frame" style="background:${frame ? frame.style : 'rgba(255,255,255,0.12)'}">
        <div class="looks-photo">${getAvatar() ? `<img class="avatar-img" src="${getAvatar()}" alt="">` : escapeHtml((getSavedName() || '?').charAt(0).toUpperCase())}</div>
        ${frameDecorHtml(frame)}
      </div>
      <div class="looks-name" style="${nameStyleFor(nameItem)}">${escapeHtml(getSavedName() || 'Name')}</div>
    </div>`;
}

function inventoryTileHtml(section, item, equipped) {
  const preview = item
    ? shopItemPreview(section, item)
    : section.id === 'frame'
      ? `<div class="frame-preview" style="background:rgba(255,255,255,0.12)"><div class="frame-inner">${icon('camera')}</div></div>`
      : `<div class="name-preview"><span style="color:#fff">${escapeHtml(getSavedName() || 'Name')}</span></div>`;
  return `
    <button class="shop-item inv-item ${equipped ? 'is-equipped' : ''} ${item ? 'has-rarity' : ''}" data-section="${section.id}" data-id="${item ? item.id : ''}" style="${item ? `--rc:${RARITIES[item.rarity].color}` : ''}">
      ${preview}
      <div class="shop-item-name">${item ? item.name : 'Default'}</div>
      ${equipped
        ? `<span class="shop-state equipped">${icon('check')} Equipped</span>`
        : `<span class="shop-state owned">Equip</span>`}
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
        <button id="inv-back" class="back-btn" title="Back to shop">${icon('back')}</button>
        <div class="brand"><h1>Inventory</h1></div>
      </div>
      ${coinBadgeHtml(data.coins)}
    </div>

    <div class="screen">
      ${looksPreviewHtml(data)}
      ${sectionsHtml}
      ${data.owned.length === 0 ? `<button class="btn btn-primary btn-block" id="inv-to-shop">${icon('bag')} Open a chest in the shop</button>` : ''}
    </div>
    ${bottomNavHtml('shop')}
  `;

  wireBottomNav();
  // ťuknutí na "Shop" v liště z inventáře vrátí zpátky do obchodu
  document.querySelector('.bottom-nav-btn[data-tab="shop"]').onclick = backToShop;
  document.getElementById('inv-back').onclick = backToShop;
  const toShop = document.getElementById('inv-to-shop');
  if (toShop) toShop.onclick = () => { shopTab = 'chests'; backToShop(); };

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
