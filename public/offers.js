// Oferty — PROTOTYP. Placené módy se odemykají Party balíčkem.
// Kupuje jen hostitel: kdo má mód odemčený, může ho založit a všichni
// v jeho lobby ho hrají zdarma. Nákup se zatím jen nasimuluje (žádná
// skutečná platba), odemčení se drží v localStorage jako mince.

const PAID_MODES = ['draw', 'impostor'];

// Hodnota balíčku = módy zvlášť + mince podle kurzu. Sleva se z toho
// dopočítá sama, ať cena, přeškrtnutá hodnota a procenta vždycky sedí.
const MODE_PRICE_EUR = 1.99; // cena jednoho módu, kdyby se prodával zvlášť

const PARTY_PACK = {
  id: 'party-pack',
  name: 'Party balíček',
  priceEur: 3.99,
  coins: 200,
  modes: ['draw', 'impostor'],
};
PARTY_PACK.worthEur = PARTY_PACK.modes.length * MODE_PRICE_EUR + PARTY_PACK.coins * COIN_RATE_EUR;
PARTY_PACK.discount = Math.round((1 - PARTY_PACK.priceEur / PARTY_PACK.worthEur) * 100);

// Vstupenka na jednu hru zamčeného módu za mince. Koupí se dopředu,
// spotřebuje se až ve chvíli, kdy hostitel hru opravdu spustí.
const SINGLE_GAME_PRICE = 50;

function getTickets(mode) {
  return (shopLoad().tickets || {})[mode] || 0;
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

function useTicket(mode) {
  const d = shopLoad();
  if (!d.tickets || !d.tickets[mode]) return;
  d.tickets[mode] -= 1;
  shopSave(d);
}

// Může hostitel tenhle mód spustit? (odemčený navždy, nebo má vstupenku)
function canHostMode(mode) {
  return isModeUnlocked(mode) || getTickets(mode) > 0;
}

function isModeUnlocked(mode) {
  if (!PAID_MODES.includes(mode)) return true;
  return (shopLoad().unlocks || []).includes(PARTY_PACK.id);
}

function ownsPartyPack() {
  return (shopLoad().unlocks || []).includes(PARTY_PACK.id);
}

function modeRibbonHtml(mode) {
  if (!PAID_MODES.includes(mode)) return `<div class="ribbon">ZDARMA</div>`;
  if (isModeUnlocked(mode)) return `<div class="ribbon ribbon-party">PARTY</div>`;
  const tickets = getTickets(mode);
  if (tickets > 0) return `<div class="ribbon ribbon-ticket">${icon('ticket')} ${tickets}× HRA</div>`;
  return `<div class="ribbon ribbon-locked">${icon('lock')} PARTY BALÍČEK</div>`;
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
        <div class="pack-mode">${`<div class="pack-plus">+</div>`}<span>Další nové módy</span></div>
      </div>
      <div class="pack-coins">${COIN_SVG}<span class="num">+${PARTY_PACK.coins}</span> mincí navíc</div>
      <ul class="pack-perks">
        <li>${icon('check')} Módy navždy odemčené</li>
        <li>${icon('check')} Všichni v tvé lobby je hrají zdarma</li>
      </ul>
      ${owned
        ? `<div class="pack-owned">${icon('checkCircle')} Vlastníš</div>`
        : `<button class="pack-buy" data-buy-pack>
             <span class="pack-price">Koupit za ${formatEur(PARTY_PACK.priceEur)}</span>
             <span class="pack-worth">${formatEur(PARTY_PACK.worthEur)}</span>
           </button>`}
    </div>`;
}

function wirePackBuy(root, onDone) {
  root.querySelectorAll('[data-buy-pack]').forEach((btn) => {
    btn.onclick = () => {
      buyPartyPack();
      showToast(`Odemčeno! +${PARTY_PACK.coins} mincí (prototyp — nic se neplatilo)`);
      onDone();
    };
  });
}

function singleGameCardHtml(mode) {
  const coins = shopLoad().coins;
  return `
    <div class="single-game-card mode-color-${mode}">
      ${modeTile(mode)}
      <div class="single-game-text">
        <strong>Zahrát jednou</strong>
        <span>1 hra ${modeDisplayName(mode)}</span>
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
    <div class="x-close-row"><button class="x-close" id="offer-close" aria-label="Zavřít">${icon('close')}</button></div>
    ${fromMode ? `<div class="offer-locked">${icon('lock')} ${modeDisplayName(fromMode)} je v Party balíčku</div>` : ''}
    ${fromMode ? `${singleGameCardHtml(fromMode)}<div class="offer-or">nebo navždy</div>` : ''}
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
      if (!buySingleGame(fromMode)) return showToast('Nemáš dost mincí.');
      showToast(`Vstupenka koupena: 1 hra ${modeDisplayName(fromMode)}`);
      closeModal();
      if (onSingleGame) onSingleGame();
      else renderStartScreen();
    };
  }
}
