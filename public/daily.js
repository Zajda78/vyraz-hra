// Denní odměny — PROTOTYP. Každý den (podle data v telefonu) si hráč může
// vzít pár mincí zdarma a jednou otevřít Daily Chest za zhlédnutí reklamy.
// Reklama je zatím jen napodobená; v appce ji nahradí rewarded video
// (AdMob). Datum se bere z telefonu, takže to jde obejít změnou času —
// v ostré verzi to musí hlídat server.

const DAILY_COINS = 30;
const FAKE_AD_SECONDS = 5;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailyState() {
  return shopLoad().daily || {};
}

function canClaimDailyCoins() {
  return dailyState().coins !== todayKey();
}

function canOpenDailyChest() {
  return dailyState().chest !== todayKey();
}

// Denní vstupenka dává smysl, jen dokud hráč nemá Party Pack (pak má módy navždy).
function canClaimDailyTicket() {
  return !ownsPartyPack() && dailyState().ticket !== todayKey();
}

function anyDailyAvailable() {
  return canClaimDailyCoins() || canOpenDailyChest() || canClaimDailyTicket();
}

function claimDailyTicket() {
  if (!canClaimDailyTicket()) return;
  const d = shopLoad();
  d.tickets = d.tickets || {};
  d.tickets.any = (d.tickets.any || 0) + 1;
  d.daily = { ...(d.daily || {}), ticket: todayKey() };
  shopSave(d);
  showToast('Free ticket! Play one game of Doodle or Impostor');
  renderShopScreen();
}

function markDaily(key) {
  const d = shopLoad();
  d.daily = { ...(d.daily || {}), [key]: todayKey() };
  shopSave(d);
}

// „za 7 h 23 min“ — kolik zbývá do půlnoci, kdy se odměny obnoví
function timeUntilReset() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((midnight - now) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function claimDailyCoins() {
  if (!canClaimDailyCoins()) return;
  const d = shopLoad();
  d.coins += DAILY_COINS;
  d.daily = { ...(d.daily || {}), coins: todayKey() };
  shopSave(d);
  showToast(`+${DAILY_COINS} coins — see you tomorrow!`);
  renderShopScreen();
}

// Karta s denními odměnami nahoře v shopu.
function dailyRewardsHtml() {
  const coinsReady = canClaimDailyCoins();
  const chestReady = canOpenDailyChest();
  const daily = caseById('daily');
  return `
    <div class="section-eyebrow">DAILY</div>
    <div class="daily-grid">
      <div class="daily-card ${coinsReady ? 'ready' : ''}">
        <div class="daily-art daily-coins-art">${COIN_SVG}${COIN_SVG}${COIN_SVG}</div>
        <h3>Daily Coins</h3>
        ${coinsReady
          ? `<button class="daily-btn" id="daily-coins-btn">Claim ${COIN_SVG}<span class="num">+${DAILY_COINS}</span></button>`
          : `<div class="daily-wait">${icon('timer')} ${timeUntilReset()}</div>`}
      </div>
      <div class="daily-card ${chestReady ? 'ready' : ''}">
        <button class="case-info-btn" id="daily-info" title="What's inside" aria-label="What's inside">?</button>
        <div class="case-art daily-chest-art">${caseSvg(daily)}</div>
        <h3>Daily Chest</h3>
        ${chestReady
          ? `<button class="daily-btn ad" id="daily-chest-btn">${icon('play')} Watch ad</button>`
          : `<div class="daily-wait">${icon('timer')} ${timeUntilReset()}</div>`}
      </div>
    </div>
    ${ownsPartyPack() ? '' : `
      <div class="daily-ticket ${canClaimDailyTicket() ? 'ready' : ''}">
        <div class="daily-ticket-icon">${icon('ticket')}</div>
        <div class="daily-ticket-text">
          <strong>Daily Ticket</strong>
          <span>1 free game of Doodle or Impostor</span>
        </div>
        ${canClaimDailyTicket()
          ? `<button class="daily-btn" id="daily-ticket-btn">Claim</button>`
          : `<div class="daily-wait">${icon('timer')} ${timeUntilReset()}</div>`}
      </div>`}`;
}

function wireDailyRewards() {
  const coinsBtn = document.getElementById('daily-coins-btn');
  if (coinsBtn) coinsBtn.onclick = claimDailyCoins;
  const chestBtn = document.getElementById('daily-chest-btn');
  if (chestBtn) chestBtn.onclick = startDailyChest;
  const ticketBtn = document.getElementById('daily-ticket-btn');
  if (ticketBtn) ticketBtn.onclick = claimDailyTicket;
  document.getElementById('daily-info').onclick = () => showCaseContents('daily');
}

// Reklama → po jejím doběhnutí se otevře Daily Chest.
function startDailyChest() {
  if (!canOpenDailyChest()) return showToast(`Come back in ${timeUntilReset()}`);
  showFakeAd(() => {
    markDaily('chest');
    openCase('daily', { free: true });
  });
}

// Napodobená reklama (v appce nahradí rewarded video z reklamní sítě).
function showFakeAd(onReward) {
  const overlay = document.createElement('div');
  overlay.className = 'fake-ad';
  overlay.innerHTML = `
    <div class="fake-ad-top"><span class="fake-ad-label">Ad</span><span class="fake-ad-count" id="fake-ad-count">${FAKE_AD_SECONDS}</span></div>
    <div class="fake-ad-body">
      <div class="fake-ad-box">${icon('play')}<strong>Your ad here</strong></div>
    </div>
    <button class="btn btn-primary btn-block fake-ad-claim" id="fake-ad-claim" disabled>Reward in ${FAKE_AD_SECONDS}s…</button>`;
  document.body.appendChild(overlay);
  document.body.classList.add('no-scroll');

  let left = FAKE_AD_SECONDS;
  const timer = setInterval(() => {
    left -= 1;
    const btn = document.getElementById('fake-ad-claim');
    document.getElementById('fake-ad-count').textContent = Math.max(left, 0);
    if (left > 0) {
      btn.textContent = `Reward in ${left}s…`;
      return;
    }
    clearInterval(timer);
    btn.disabled = false;
    btn.textContent = 'Claim reward';
    btn.onclick = () => {
      overlay.remove();
      document.body.classList.remove('no-scroll');
      onReward();
    };
  }, 1000);
}
