// Oferty — PROTOTYP. Placené módy se odemykají Party balíčkem.
// Kupuje jen hostitel: kdo má mód odemčený, může ho založit a všichni
// v jeho lobby ho hrají zdarma. Nákup se zatím jen nasimuluje (žádná
// skutečná platba), odemčení se drží v localStorage jako mince.

const PAID_MODES = ['draw', 'impostor', 'hunt', 'copycat'];

// Hodnota balíčku = módy zvlášť + mince podle kurzu. Sleva se z toho
// dopočítá sama, ať cena, přeškrtnutá hodnota a procenta vždycky sedí.
const MODE_PRICE_EUR = 1.99; // cena jednoho módu, kdyby se prodával zvlášť

const PARTY_PACK = {
  id: 'party-pack',
  name: 'Party Pack',
  priceEur: 3.99,
  coins: 200,
  modes: ['draw', 'impostor', 'hunt', 'copycat'],
};
PARTY_PACK.worthEur = PARTY_PACK.modes.length * MODE_PRICE_EUR + PARTY_PACK.coins * COIN_RATE_EUR;
PARTY_PACK.discount = Math.round((1 - PARTY_PACK.priceEur / PARTY_PACK.worthEur) * 100);

// Vstupenka na jednu hru zamčeného módu za mince. Koupí se dopředu,
// spotřebuje se až ve chvíli, kdy hostitel hru opravdu spustí.
const SINGLE_GAME_PRICE = 75; // jedna hra za mince; navíc 1 vstupenka denně zdarma (daily.js)

function getTickets(mode) {
  const t = shopLoad().tickets || {};
  return (t[mode] || 0) + (t.any || 0);
}

function buySingleGame(mode) {
  const d = shopLoad();
  if (d.coins < SINGLE_GAME_PRICE) return false;
  d.coins -= SINGLE_GAME_PRICE;
  d.tickets = d.tickets || {};
  d.tickets[mode] = (d.tickets[mode] || 0) + 1;
  shopSave(d);
  return true;
}

// Nejdřív se použije vstupenka koupená přímo na tenhle mód, pak univerzální.
function useTicket(mode) {
  const d = shopLoad();
  if (!d.tickets) return;
  if (d.tickets[mode] > 0) d.tickets[mode] -= 1;
  else if (d.tickets.any > 0) d.tickets.any -= 1;
  else return;
  shopSave(d);
}

// Může hostitel tenhle mód spustit? (odemčený navždy, nebo má vstupenku)
function canHostMode(mode) {
  return isModeUnlocked(mode) || getTickets(mode) > 0;
}

function isModeUnlocked(mode) {
  if (!PAID_MODES.includes(mode) || isDevMode()) return true;
  return (shopLoad().unlocks || []).includes(PARTY_PACK.id);
}

function ownsPartyPack() {
  return isDevMode() || (shopLoad().unlocks || []).includes(PARTY_PACK.id);
}

// compact = malá dlaždice v menu — štítek musí být kratší, ať nepřekryje ikonu
function modeRibbonHtml(mode, { compact = false } = {}) {
  if (!PAID_MODES.includes(mode)) return `<div class="ribbon">FREE</div>`;
  if (isModeUnlocked(mode)) return `<div class="ribbon ribbon-party">PARTY</div>`;
  const tickets = getTickets(mode);
  if (tickets > 0) return `<div class="ribbon ribbon-ticket">${icon('ticket')} ${tickets}×${compact ? '' : ' GAME'}</div>`;
  return `<div class="ribbon ribbon-locked">${icon('lock')} ${compact ? 'PARTY' : 'PARTY PACK'}</div>`;
}

function buyPartyPack() {
  const d = shopLoad();
  d.unlocks = d.unlocks || [];
  if (d.unlocks.includes(PARTY_PACK.id)) return;
  d.unlocks.push(PARTY_PACK.id);
  d.coins += PARTY_PACK.coins;
  shopSave(d);
}

// Velká karta balíčku (v okně s ofertou i v shopu).
function partyPackCardHtml({ compact = false } = {}) {
  const owned = ownsPartyPack();
  const modesHtml = PARTY_PACK.modes.map((m) => `
    <div class="pack-mode">${modeTile(m)}<span>${modeDisplayName(m)}</span></div>
  `).join('');
  return `
    <div class="pack-card ${compact ? 'compact' : ''}">
      <div class="pack-shine"></div>
      ${owned ? '' : `<div class="pack-discount">−${PARTY_PACK.discount} %</div>`}
      <div class="pack-title">${PARTY_PACK.name}</div>
      <div class="pack-modes">
        ${modesHtml}
        <div class="pack-mode">${`<div class="pack-plus">+</div>`}<span>More new modes</span></div>
      </div>
      <div class="pack-coins">${COIN_SVG}<span class="num">+${PARTY_PACK.coins}</span> bonus coins</div>
      <ul class="pack-perks">
        <li>${icon('check')} Modes unlocked forever</li>
        <li>${icon('check')} Everyone in your lobby plays free</li>
      </ul>
      ${owned
        ? `<div class="pack-owned">${icon('checkCircle')} Owned</div>`
        : `<button class="pack-buy" data-buy-pack>
             <span class="pack-price">Buy for ${formatEur(PARTY_PACK.priceEur)}</span>
             <span class="pack-worth">${formatEur(PARTY_PACK.worthEur)}</span>
           </button>`}
    </div>`;
}

function wirePackBuy(root, onDone) {
  root.querySelectorAll('[data-buy-pack]').forEach((btn) => {
    btn.onclick = () => {
      // dokud nejsou skutečné platby, zdarma to jde jen v dev režimu
      if (!isDevMode()) {
        showToast('Payments aren\'t live yet — this is a prototype.');
        return;
      }
      buyPartyPack();
      showToast(`Unlocked! +${PARTY_PACK.coins} coins (prototype — nothing was charged)`);
      onDone();
    };
  });
}

// ------------------------------------------------------ Question Packs ---
// Sady otázek pro Reaction, Doodle a Impostor. Classic je zdarma, Spicy,
// Family a School se odemykají jedním nákupem. Stejně jako u módů kupuje jen
// hostitel — všichni v jeho lobby pak hrají se zvolenou sadou.

const PACK_PRICE_EUR = 1.99; // cena jedné sady, kdyby se prodávala zvlášť

const QUESTION_PACK_INFO = {
  classic: { label: 'Classic', desc: 'The original prompts' },
  spicy: { label: 'Spicy', desc: 'Flirty, awkward & embarrassing' },
  family: { label: 'Family', desc: 'Fun for all ages' },
  school: { label: 'School', desc: 'Teachers, tests &amp; classmates' },
};

const QUESTION_PACKS = {
  id: 'question-packs',
  name: 'Question Packs',
  priceEur: 2.99,
  coins: 100,
  packs: ['spicy', 'family', 'school'],
};
QUESTION_PACKS.worthEur = QUESTION_PACKS.packs.length * PACK_PRICE_EUR + QUESTION_PACKS.coins * COIN_RATE_EUR;
QUESTION_PACKS.discount = Math.round((1 - QUESTION_PACKS.priceEur / QUESTION_PACKS.worthEur) * 100);

function ownsQuestionPacks() {
  return isDevMode() || (shopLoad().unlocks || []).includes(QUESTION_PACKS.id);
}

function isPackUnlocked(pack) {
  return pack === 'classic' || ownsQuestionPacks() || isDevMode();
}

function questionPacksCardHtml({ compact = false } = {}) {
  const owned = ownsQuestionPacks();
  const packsHtml = QUESTION_PACKS.packs.map((p) => `
    <div class="pack-mode">
      <div class="qp-tile qp-tile-${p}">${packGlyph(p)}</div>
      <span>${QUESTION_PACK_INFO[p].label}</span>
      <small>${QUESTION_PACK_INFO[p].desc}</small>
    </div>`).join('');
  return `
    <div class="pack-card qp-card ${compact ? 'compact' : ''}">
      ${owned ? '' : `<div class="pack-discount">−${QUESTION_PACKS.discount} %</div>`}
      <div class="pack-title">${QUESTION_PACKS.name}</div>
      <div class="pack-modes">${packsHtml}</div>
      <div class="pack-coins">${COIN_SVG}<span class="num">+${QUESTION_PACKS.coins}</span> bonus coins</div>
      <ul class="pack-perks">
        <li>${icon('check')} New questions for Reaction, Doodle &amp; Impostor</li>
        <li>${icon('check')} Everyone in your lobby plays free</li>
      </ul>
      ${owned
        ? `<div class="pack-owned">${icon('checkCircle')} Owned</div>`
        : `<button class="pack-buy" data-buy-qpacks>
             <span class="pack-price">Buy for ${formatEur(QUESTION_PACKS.priceEur)}</span>
             <span class="pack-worth">${formatEur(QUESTION_PACKS.worthEur)}</span>
           </button>`}
    </div>`;
}

function wireQuestionPacksBuy(root, onDone) {
  root.querySelectorAll('[data-buy-qpacks]').forEach((btn) => {
    btn.onclick = () => {
      // dokud nejsou skutečné platby, zdarma to jde jen v dev režimu
      if (!isDevMode()) {
        showToast('Payments aren\'t live yet — this is a prototype.');
        return;
      }
      const d = shopLoad();
      d.unlocks = d.unlocks || [];
      if (!d.unlocks.includes(QUESTION_PACKS.id)) {
        d.unlocks.push(QUESTION_PACKS.id);
        d.coins += QUESTION_PACKS.coins;
        shopSave(d);
      }
      showToast(`Unlocked! +${QUESTION_PACKS.coins} coins (prototype — nothing was charged)`);
      onDone();
    };
  });
}

// Okno s nabídkou — otevře se po ťuknutí na zamčenou sadu v lobby.
function showQuestionPacksOffer(fromPack, onDone) {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="qp-offer-close" aria-label="Close">${icon('close')}</button></div>
    ${fromPack ? `<div class="offer-locked">${icon('lock')} ${QUESTION_PACK_INFO[fromPack].label} is in the Question Packs</div>` : ''}
    ${questionPacksCardHtml()}
  `);
  modal.querySelector('#qp-offer-close').onclick = closeModal;
  wireQuestionPacksBuy(modal, () => {
    closeModal();
    if (onDone) onDone();
  });
}

function singleGameCardHtml(mode) {
  const coins = shopLoad().coins;
  return `
    <div class="single-game-card mode-color-${mode}">
      ${modeTile(mode)}
      <div class="single-game-text">
        <strong>Play once</strong>
        <span>1 game of ${modeDisplayName(mode)}</span>
      </div>
      <button class="single-game-buy" id="single-game-buy" ${coins < SINGLE_GAME_PRICE ? 'disabled' : ''}>
        ${COIN_SVG}<span class="num">${SINGLE_GAME_PRICE}</span>
      </button>
    </div>`;
}

// Okno s ofertou — otevře se po ťuknutí na zamčený mód.
// onSingleGame: co udělat po koupi jedné hry (z úvodu = založit lobby,
// z lobby = jen zavřít a pustit hostitele spustit hru).
function showPartyPackOffer(fromMode, onSingleGame) {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="offer-close" aria-label="Close">${icon('close')}</button></div>
    ${fromMode ? `<div class="offer-locked">${icon('lock')} ${modeDisplayName(fromMode)} is in the Party Pack</div>` : ''}
    ${fromMode ? `${singleGameCardHtml(fromMode)}<div class="offer-or">or forever</div>` : ''}
    ${partyPackCardHtml()}
  `);
  modal.querySelector('#offer-close').onclick = closeModal;
  wirePackBuy(modal, () => {
    closeModal();
    if (onSingleGame) onSingleGame();
    else renderStartScreen();
  });
  const single = modal.querySelector('#single-game-buy');
  if (single) {
    single.onclick = () => {
      if (!buySingleGame(fromMode)) return showToast('Not enough coins.');
      showToast(`Ticket bought: 1 game of ${modeDisplayName(fromMode)}`);
      closeModal();
      if (onSingleGame) onSingleGame();
      else renderStartScreen();
    };
  }
}
