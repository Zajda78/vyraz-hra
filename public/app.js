const app = document.getElementById('app');

let ws = null;
let lastState = null;
let mountedKey = null;
let cameraStream = null;
let cameraFacing = 'user'; // 'user' = selfie, 'environment' = zadní foťák
let submittedLocally = false;
let lastSentPhoto = null; // { round, url } — vlastní odeslaná fotka, ukáže se při čekání na ostatní
let votedLocallyFor = null;
let drawDoneLocally = false;
// Když vyprší čas a hráč ještě nedopsal / nedokreslil, pošle se, co má zatím (aby nezůstalo prázdné).
let autoPartial = null; // { key: mountedKey obrazovky, fire: () => odeslání rozdělané práce, firedFor: deadlineAt }
let errorTimer = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Kód lobby, ze které hráč právě odešel — její případné opožděné zprávy
// se ignorují (jinak by ho to vrátilo zpátky do hry).
let leftLobbyCode = null;

function send(obj) {
  if (['create_lobby', 'join_lobby', 'join_friend', 'rejoin'].includes(obj.type)) leftLobbyCode = null;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ---------------------------------------------------- SESSION (rejoin) ---
// Uloží kód lobby + naše hráčské id, ať se po výpadku spojení dá vrátit
// zpátky na stejné místo ve hře, ne jen na úvodní obrazovku.

function getSession() {
  try { return JSON.parse(localStorage.getItem('vyraz_session') || 'null'); } catch { return null; }
}
function saveSession(code, playerId) {
  try { localStorage.setItem('vyraz_session', JSON.stringify({ code, playerId })); } catch { /* ignore */ }
}
function clearSession() {
  try { localStorage.removeItem('vyraz_session'); } catch { /* ignore */ }
}

// -------------------------------------------------------- CONNECTION ---

function wireSocketEvents(socket) {
  socket.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') {
      if (msg.code && msg.code === leftLobbyCode) return;
      if (cancelPendingCreate && msg.phase === 'lobby' && msg.isHost) {
        cancelPendingCreate = false;
        leftLobbyCode = msg.code;
        send({ type: 'leave_lobby' });
        return;
      }
      cancelPendingCreate = false;
      if (msg.phase !== 'submitting' && msg.phase !== 'copy_copying') submittedLocally = false;
      if (msg.phase !== 'drawing') drawDoneLocally = false;
      if (msg.phase !== 'voting' && msg.phase !== 'twins_voting') votedLocallyFor = null;
      if (msg.code && msg.youId) saveSession(msg.code, msg.youId);
      renderApp(msg);
    } else if (msg.type === 'error') {
      showError(msg.message);
      if (mountedKey === 'lobby' && !lastState) renderStartScreen(); // lobby se nezaložilo
    } else if (msg.type === 'info') {
      showToast(msg.message);
    } else if (msg.type === 'join_pending') {
      renderJoinPendingScreen(msg);
    } else if (msg.type === 'join_denied') {
      if (mountedKey === 'join-pending') { showToast(msg.message); renderStartScreen(); }
    } else if (msg.type === 'kicked') {
      leftLobbyCode = msg.code;
      closeModal();
      clearSession();
      lastState = null;
      renderStartScreen();
      showToast('The host removed you from the lobby.');
    } else if (handleDevMessage(msg)) {
      // vývojářský režim (dev.js)
    } else {
      handleFriendMessage(msg);
    }
  });
  socket.addEventListener('close', () => {
    if (ws === socket) ws = null;
    if (connectingSocket === socket) connectingSocket = null;
    scheduleReconnect();
  });
}

// Spojení, které se právě otevírá — ať se při rychlém ťuknutí hned po
// spuštění appky neotevře druhé souběžné spojení.
let connectingSocket = null;

function connect(onOpen) {
  if (ws && ws.readyState === WebSocket.OPEN) return onOpen && onOpen();
  if (connectingSocket) {
    if (onOpen) connectingSocket.addEventListener('open', () => onOpen());
    return;
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}`);
  connectingSocket = socket;
  wireSocketEvents(socket);
  socket.addEventListener('open', () => {
    connectingSocket = null;
    ws = socket;
    reconnectAttempts = 0;
    hideReconnectOverlay();
    hideSplash();
    sendHello();
    onOpen && onOpen();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return; // pokus už běží, neplánovat druhý souběžně
  if (getSession()) showReconnectOverlay();
  const delay = Math.min(1000 + reconnectAttempts * 1500, 8000);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    doReconnect();
  }, delay);
}

function doReconnect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}`);
  wireSocketEvents(socket);
  socket.addEventListener('open', () => {
    ws = socket;
    reconnectAttempts = 0;
    hideReconnectOverlay();
    sendHello();
    const session = getSession();
    if (session) send({ type: 'rejoin', code: session.code, playerId: session.playerId, looks: myLooks() });
  });
  // Když se ani tenhle pokus nepovede, přijde vzápětí jeho vlastní "close"
  // event (viz wireSocketEvents) a naplánuje další pokus sám.
}

function showReconnectOverlay() {
  let el = document.getElementById('reconnect-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'reconnect-overlay';
    el.className = 'reconnect-overlay';
    el.innerHTML = `
      <div class="reconnect-box">
        <div class="spinner"></div>
        <p>Connecting to the server…</p>
      </div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}

function hideReconnectOverlay() {
  const el = document.getElementById('reconnect-overlay');
  if (el) el.style.display = 'none';
}

function showError(text) {
  playSfx('error');
  clearTimeout(errorTimer);
  let el = document.getElementById('error-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-banner';
    el.className = 'error-banner';
    document.body.appendChild(el);
  }
  el.innerHTML = `${icon('alert')}<span></span>`;
  el.lastElementChild.textContent = text;
  el.style.display = 'flex';
  // špatný kód: políčka se zčervenají a zatřesou
  const cb = document.getElementById('code-boxes');
  if (cb && joinCode.length === CODE_LEN) { cb.classList.remove('is-error'); void cb.offsetWidth; cb.classList.add('is-error'); }
  errorTimer = setTimeout(() => { el.style.display = 'none'; }, 3200);
}

// ---------------------------------------------------------------- START ---

const CODE_LEN = 4;
let joinCode = '';

function getSavedName() {
  return localStorage.getItem('vyraz_name') || '';
}

// Velké obrysové ikony do pozadí dlaždic na úvodní obrazovce — mají sedět
// jako jemný stín ZA textem, ne přes něj (viz mode-card-content z-index).
const MODE_ICON_CAMERA = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 20 L47 9 H73 L80 20 H106 C111.5 20 116 24.5 116 30 V86 C116 91.5 111.5 96 106 96 H14 C8.5 96 4 91.5 4 86 V30 C4 24.5 8.5 20 14 20 H40 Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="60" cy="58" r="25" stroke="currentColor" stroke-width="6"/>
    <circle cx="60" cy="58" r="10" fill="currentColor"/>
    <circle cx="98" cy="35" r="3.5" fill="currentColor"/>
  </svg>`;

const MODE_ICON_PALETTE = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M65 4 C92 4 114 24 114 50 C114 76 92 96 65 96 C40 96 20 85 20 72 C20 60 34 54 34 50 C34 46 20 40 20 28 C20 15 40 4 65 4 Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="68" cy="24" r="9" stroke="currentColor" stroke-width="5"/>
    <circle cx="96" cy="44" r="8" stroke="currentColor" stroke-width="5"/>
    <circle cx="90" cy="68" r="8" stroke="currentColor" stroke-width="5"/>
    <circle cx="64" cy="80" r="8" stroke="currentColor" stroke-width="5"/>
    <circle cx="43" cy="65" r="8" stroke="currentColor" stroke-width="5"/>
  </svg>`;

const MODE_ICON_TWINS = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="36" cy="50" r="28" stroke="currentColor" stroke-width="6"/>
    <circle cx="84" cy="50" r="28" stroke="currentColor" stroke-width="6"/>
    <circle cx="27" cy="44" r="4.5" fill="currentColor"/>
    <circle cx="45" cy="44" r="4.5" fill="currentColor"/>
    <circle cx="75" cy="44" r="4.5" fill="currentColor"/>
    <circle cx="93" cy="44" r="4.5" fill="currentColor"/>
    <path d="M26 60 Q36 70 46 60" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M74 60 Q84 70 94 60" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  </svg>`;

const MODE_ICON_COPY = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="74" cy="38" r="30" stroke="currentColor" stroke-width="6"/>
    <circle cx="46" cy="60" r="30" stroke="currentColor" stroke-width="6" fill="#0d1f24"/>
    <circle cx="36" cy="54" r="4.5" fill="currentColor"/>
    <circle cx="56" cy="54" r="4.5" fill="currentColor"/>
    <path d="M34 70 Q46 82 58 70" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  </svg>`;

const MODE_ICON_LOUPE = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="52" cy="44" r="32" stroke="currentColor" stroke-width="6"/>
    <path d="M36 36 A18 18 0 0 1 52 26" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M76 68 L104 94" stroke="currentColor" stroke-width="10" stroke-linecap="round"/>
  </svg>`;

// Menu módů na úvodní obrazovce — rozdělené na hry zdarma a Party Pack.
// Uvnitř skupiny jsou nejdřív hry s obličejem (kompaktní dlaždice po dvou),
// módy „fotíš cokoli“ (wide) jdou přes celou šířku.
const MODE_MENU = [
  {
    title: 'FREE GAMES',
    modes: [
      { id: 'classic', name: 'Reaction', tagline: 'React to the prompt. Best face wins.', players: 3, bg: () => MODE_ICON_CAMERA },
      { id: 'caption', name: 'Main Character', tagline: 'One photo, everyone captions it.', players: 3, bg: () => MODE_ICON_SPEECH },
    ],
  },
  {
    title: 'PARTY PACK',
    partyPack: true, // placené módy — zlaté štítky u zamčených
    modes: [
      { id: 'draw', name: 'Doodle', tagline: 'Snap a selfie, doodle on it, vote.', players: 3, bg: () => MODE_ICON_PALETTE },
      { id: 'impostor', name: 'Impostor', tagline: 'One player got a different prompt.', players: 3, bg: () => MODE_ICON_SPY },
      { id: 'hunt', name: 'Snap Hunt', tagline: 'Find the thing, snap it, vote.', players: 3, bg: () => MODE_ICON_LOUPE },
      { id: 'copycat', name: 'Copycat', tagline: 'Copy the face. Best copy wins.', players: 3, bg: () => MODE_ICON_COPY },
      { id: 'twins', name: 'Twins', tagline: 'Two of you, one face. Sync up!', players: 6, wide: true, bg: () => MODE_ICON_TWINS },
    ],
  },
];

const SF_PLAY_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>';

function modeCardHtml(m, group) {
  const unlocked = isModeUnlocked(m.id);
  const locked = group.partyPack && !unlocked;
  const tickets = locked ? getTickets(m.id) : 0;
  const badge = !locked ? ''
    : tickets > 0
      ? `<span class="mode-badge mode-badge-ticket" aria-label="${tickets} game ticket${tickets > 1 ? 's' : ''}">${icon('ticket')}<b>${tickets}×</b></span>`
      : `<span class="mode-badge" aria-label="Party Pack">${icon('lock')}</span>`;
  const foot = `<span class="mode-card-foot"><span class="mode-players">${m.players}+ players</span>${locked && !tickets ? '' : `<span class="mode-play" aria-hidden="true">${SF_PLAY_ARROW}</span>`}</span>`;
  return `
    <div class="mode-card mode-card-${m.id} ${m.wide ? 'wide' : 'compact'} ${locked ? 'is-locked' : ''}" data-mode="${m.id}" role="button" tabindex="0">
      ${badge}
      <div class="mode-card-content">
        ${modeTile(m.id)}
        <div class="mode-card-text">
          <h3>${m.name}${m.isNew ? '<span class="mode-new-tag">NEW</span>' : ''}</h3>
          <p>${escapeHtml(m.tagline)}</p>
        </div>
        ${foot}
      </div>
    </div>`;
}

function modeMenuHtml() {
  return MODE_MENU.map((group) => {
    const owned = group.partyPack && ownsPartyPack();
    const head = group.partyPack && !owned
      ? `<button class="sf-mini-gold" id="pack-unlock" type="button">Unlock all ${PARTY_PACK.modes.length} · €${PARTY_PACK.priceEur.toFixed(2)}</button>`
      : `<span class="mode-group-hint">${group.partyPack ? 'Unlocked forever' : 'Tap to create a lobby'}</span>`;
    return `
    <div class="mode-group-head">
      <h2 class="section-eyebrow">${group.title}</h2>
      ${head}
    </div>
    <div class="mode-grid">
      ${group.modes.map((m) => modeCardHtml(m, group)).join('')}
    </div>`;
  }).join('');
}

const MODE_ICON_SPEECH = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 8 C90 8 114 26 114 48 C114 70 90 88 60 88 C52 88 44 87 37 84 L14 94 L22 74 C12 66 6 57 6 48 C6 26 30 8 60 8 Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="38" cy="48" r="5.5" fill="currentColor"/>
    <circle cx="60" cy="48" r="5.5" fill="currentColor"/>
    <circle cx="82" cy="48" r="5.5" fill="currentColor"/>
  </svg>`;

function modeDisplayName(mode) {
  if (mode === 'draw') return 'Doodle';
  if (mode === 'caption') return 'Main Character';
  if (mode === 'impostor') return 'Impostor';
  if (mode === 'hunt') return 'Snap Hunt';
  if (mode === 'copycat') return 'Copycat';
  if (mode === 'twins') return 'Twins';
  return 'Reaction';
}

function brandHtml(state) {
  const modeName = modeDisplayName(state?.mode);
  const inGame = state && state.phase && state.phase !== 'lobby';
  return `<div class="brand game-brand"><img class="mark" src="icon.png" alt=""><h1>${modeName}</h1>
    ${inGame ? `<button class="exit-game-btn" data-exit-game aria-label="Leave game">${icon('logout')}</button>` : ''}</div>`;
}

// Potvrzení odchodu ze hry. Hostitel může navíc ukončit hru všem.
function showExitGameModal() {
  const isHost = lastState?.isHost;
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="exit-close" aria-label="Close">${icon('close')}</button></div>
    <div class="exit-game">
      <div class="exit-game-icon">${icon('logout')}</div>
      <h2>Leave the game?</h2>
      <button class="btn btn-danger btn-block" id="exit-leave">Leave game</button>
      ${isHost ? `<button class="btn btn-ghost btn-block" id="exit-end">End game for everyone</button>` : ''}
      <button class="btn btn-ghost btn-block" id="exit-stay">Keep playing</button>
    </div>
  `, { dialog: true });
  modal.querySelector('#exit-close').onclick = closeModal;
  modal.querySelector('#exit-stay').onclick = closeModal;
  modal.querySelector('#exit-leave').onclick = leaveLobby;
  const end = modal.querySelector('#exit-end');
  if (end) end.onclick = () => { closeModal(); send({ type: 'end_game' }); };
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-exit-game]')) showExitGameModal();
});

// Úvodní obrazovka má dole lištu se dvěma záložkami: Hry a Shop.
let homeTab = 'games';

function renderStartScreen() {
  playMusic('main'); // mimo lobby hraje hlavní hudba
  sendHello(); // jméno/vzhled se mohly změnit — ať to přátelé vidí aktuální
  if (homeTab === 'shop') return renderShopScreen();
  if (homeTab === 'friends') return renderFriendsScreen();
  if (profileOpen) return renderProfileScreen();
  renderGamesScreen();
}

const NAV_TABS = ['games', 'shop', 'friends'];
// Kde bylo zvýraznění lišty naposledy — z téhle pozice pak plynule přejede
// na novou záložku (lišta se při každém překreslení vytváří znovu).
let navIndicatorIndex = 0;

function bottomNavHtml(active) {
  return `
    <nav class="bottom-nav">
      <span class="nav-indicator" style="transform:translateX(${navIndicatorIndex * 100}%)"></span>
      <button class="bottom-nav-btn ${active === 'games' ? 'active' : ''}" data-tab="games">${icon('gamepad')}<span>Games</span></button>
      <button class="bottom-nav-btn ${active === 'shop' ? 'active' : ''}" data-tab="shop">${icon('bag')}<span>Shop</span>${anyDailyAvailable() ? '<span class="nav-dot"></span>' : ''}</button>
      <button class="bottom-nav-btn ${active === 'friends' ? 'active' : ''}" data-tab="friends">${icon('users')}<span>Friends</span>${friendRequestsBadge()}</button>
    </nav>`;
}

// Jemný příjezd obsahu obrazovky — dir = 1 zprava, -1 zleva.
function animateScreenIn(dir) {
  app.style.setProperty('--enter-dir', dir);
  app.classList.remove('screen-enter');
  void app.offsetWidth; // restart animace
  app.classList.add('screen-enter');
  // po doběhnutí třídu odebrat, ať se animace nepřehraje při každém překreslení
  clearTimeout(animateScreenIn.timer);
  animateScreenIn.timer = setTimeout(() => app.classList.remove('screen-enter'), 450);
}

function wireBottomNav() {
  const nav = document.querySelector('.bottom-nav');
  const active = nav.querySelector('.bottom-nav-btn.active');
  const target = NAV_TABS.indexOf(active?.dataset.tab);
  if (target >= 0 && target !== navIndicatorIndex) {
    // zvýraznění vykreslené na staré pozici přejede na novou
    const indicator = nav.querySelector('.nav-indicator');
    requestAnimationFrame(() => { indicator.style.transform = `translateX(${target * 100}%)`; });
    navIndicatorIndex = target;
  }

  nav.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.onclick = () => {
      if (homeTab === btn.dataset.tab) return;
      const from = NAV_TABS.indexOf(homeTab);
      homeTab = btn.dataset.tab;
      shopView = 'shop'; // do shopu se vždycky vstupuje na obchod, ne do inventáře
      profileOpen = false;
      renderStartScreen();
      window.scrollTo(0, 0);
      animateScreenIn(NAV_TABS.indexOf(homeTab) > from ? 1 : -1);
    };
  });
}

function renderGamesScreen() {
  mountedKey = 'start';
  stopCamera();
  document.body.classList.add('home-bg');
  joinCode = '';

  app.innerHTML = `
    <div class="home-top">
      <div class="brand">${sfLogoSvg(40)}<h1>Snapfam</h1>${devBadgeHtml()}</div>
      <div class="home-actions">
        <button id="rules-btn" class="text-btn">${icon('book')}<span>Rules</span></button>
        <button id="settings-btn" class="icon-btn" title="Settings" aria-label="Settings">${icon('gear')}</button>
      </div>
    </div>

    ${profileCardHtml()}

    <div class="screen">
      <section class="join-card" aria-labelledby="join-title">
        <div class="join-card-head">
          <h1 id="join-title">Join a game</h1>
          <span class="join-card-sub">Type the 4-letter code from the host.</span>
        </div>
        <div class="code-boxes" id="code-boxes">
          ${Array.from({ length: CODE_LEN }).map((_, i) => `<div class="code-box" data-i="${i}"></div>`).join('')}
          <input class="code-hidden-input" id="code-hidden" maxlength="${CODE_LEN}" autocomplete="off" autocapitalize="characters" inputmode="text" aria-label="Game code">
        </div>
        <div class="join-card-actions">
          <button class="btn btn-ghost" id="code-paste" type="button">Paste</button>
          <button class="btn btn-primary" id="code-join" type="button" disabled>Join</button>
        </div>
      </section>

      ${modeMenuHtml()}

    </div>
    ${bottomNavHtml('games')}
  `;
  document.body.classList.add('has-bottom-nav');
  wireBottomNav();

  const hidden = document.getElementById('code-hidden');
  const boxesWrap = document.getElementById('code-boxes');

  const joinBtn = document.getElementById('code-join');

  function renderCodeBoxes() {
    boxesWrap.querySelectorAll('.code-box').forEach((box, i) => {
      box.textContent = joinCode[i] || '';
      box.classList.toggle('filled', !!joinCode[i]);
      box.classList.toggle('active', i === joinCode.length);
    });
    joinBtn.disabled = joinCode.length !== CODE_LEN;
  }
  renderCodeBoxes();

  function setCode(raw) {
    joinCode = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    hidden.value = joinCode;
    boxesWrap.classList.remove('is-error');
    renderCodeBoxes();
    if (joinCode.length === CODE_LEN) hidden.blur(); // klávesnice pryč, ať je vidět tlačítko Join
  }

  boxesWrap.addEventListener('click', () => hidden.focus());
  hidden.addEventListener('input', () => setCode(hidden.value));
  hidden.addEventListener('keydown', (e) => { if (e.key === 'Enter' && joinCode.length === CODE_LEN) attemptJoin(joinCode); });
  joinBtn.onclick = () => { if (joinCode.length === CODE_LEN) attemptJoin(joinCode); };
  document.getElementById('code-paste').onclick = async () => {
    try {
      setCode(await navigator.clipboard.readText());
    } catch { hidden.focus(); } // schránka zakázaná → ať kód vloží dlouhým podržením
  };

  const unlock = document.getElementById('pack-unlock');
  if (unlock) unlock.onclick = () => showPartyPackOffer(null);

  document.querySelectorAll('.mode-card').forEach((card) => {
    card.onclick = () => {
      const mode = card.getAttribute('data-mode');
      const create = () => withName((name) => {
        renderLobbyScreen(pendingLobbyState(mode, name)); // hned, ať se nečeká na server
        connect(() => send({ type: 'create_lobby', name, mode, looks: myLooks(), lang: getLang() }));
      });
      // placený mód může založit jen ten, kdo ho má odemčený nebo má vstupenku
      if (!canHostMode(mode)) return showPartyPackOffer(mode, create);
      create();
    };
  });

  document.querySelectorAll('.mode-card').forEach((card) => {
    card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } };
  });
  document.getElementById('rules-btn').onclick = () => showRulesModal();
  document.getElementById('settings-btn').onclick = () => showSettingsModal();
  wireProfileCard();
}

function attemptJoin(code) {
  withName((name) => {
    connect(() => send({ type: 'join_lobby', name, code, looks: myLooks() }));
  });
}

// -------------------------------------------------------------- MODALS ---

// opts.dialog = vycentrované potvrzovací okno (16a), opts.tall = sheet přes celou výšku (pravidla).
// Ostatní okna jsou spodní sheet: vyjede zdola, jde zavřít tažením dolů, Esc nebo ťuknutím na pozadí.
function openModal(html, opts = {}) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = `modal-backdrop${opts.dialog ? ' is-dialog' : ''}`;
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-sheet${opts.dialog ? ' is-dialog' : ''}${opts.tall ? ' is-tall' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  if (!opts.dialog) wireSheetSwipe(backdrop.firstElementChild);
  return backdrop;
}

// Tažení sheetu dolů (jen když je nahoře odscrollovaný) → zavře se.
function wireSheetSwipe(sheet) {
  let y0 = null;
  let dy = 0;
  sheet.addEventListener('touchstart', (e) => {
    y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  sheet.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    if (dy > 90) return closeModal();
    sheet.style.transition = 'transform .2s ease-out';
    sheet.style.transform = '';
  });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function closeModal() {
  const el = document.getElementById('modal-backdrop');
  if (el) el.remove();
}

function withName(onReady) {
  const existing = getSavedName();
  if (existing) return onReady(existing);
  showNameModal(onReady);
}

function showNameModal(onReady) {
  const modal = openModal(`
    <h2>What's your name?</h2>
    <div class="field">
      <input id="modal-name-input" maxlength="20" placeholder="e.g. Alex">
    </div>
    <button id="modal-name-go" class="btn btn-primary btn-block">Continue</button>
  `);
  const input = modal.querySelector('#modal-name-input');
  input.focus();
  const go = () => {
    const name = input.value.trim();
    if (!name) return showError('Please enter a name.');
    localStorage.setItem('vyraz_name', name);
    closeModal();
    onReady(name);
  };
  modal.querySelector('#modal-name-go').onclick = go;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

// Nastavení — jazyk (dlaždice), dva posuvníky a stav kamery. Jméno se mění v profilu přes tužku.
function showSettingsModal() {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="modal-settings-close" aria-label="Close">${icon('close')}</button></div>
    <h2>Settings</h2>
    <div class="setting-block-title">Language</div>
    ${languagePickerHtml()}
    ${volumeSlidersHtml()}
    <div class="setting-block-title">Camera access</div>
    <div class="sf-tiles sf-tiles-2" role="radiogroup" aria-label="Camera access">
      <button class="sf-tile" id="modal-camera-test" type="button" role="radio" aria-checked="false">Allowed</button>
      <button class="sf-tile on" id="modal-camera-off" type="button" role="radio" aria-checked="true">Off</button>
    </div>
    <p class="camera-status" id="modal-camera-status">Needed to snap photos in a game.</p>
  `);
  wireVolumeSliders(modal);
  modal.querySelectorAll('[data-lang]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.lang === getLang()) return;
      setLang(b.dataset.lang);
      closeModal();
      // překreslit aktuální obrazovku v novém jazyce a nastavení nechat otevřené
      if (lastState) { mountedKey = ''; renderApp(lastState); } else renderStartScreen();
      showSettingsModal();
    };
  });
  // ukázka hudby hraje jen během posouvání — po zavření nastavení ztichne
  const closeSettings = closeModal;
  modal.querySelector('#modal-settings-close').onclick = closeSettings;

  const allowBtn = modal.querySelector('#modal-camera-test');
  const offBtn = modal.querySelector('#modal-camera-off');
  const statusEl = modal.querySelector('#modal-camera-status');
  const setCam = (on) => {
    allowBtn.classList.toggle('on', on); allowBtn.setAttribute('aria-checked', String(on));
    offBtn.classList.toggle('on', !on); offBtn.setAttribute('aria-checked', String(!on));
  };
  // povolení kamery se dá zjistit bez ptaní (kde to prohlížeč umí)
  try {
    navigator.permissions.query({ name: 'camera' }).then((r) => { if (r.state === 'granted') setCam(true); }).catch(() => {});
  } catch { /* ignore */ }

  allowBtn.onclick = async () => {
    statusEl.innerHTML = 'Asking your browser for access…';
    statusEl.className = 'camera-status';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      setCam(true);
      statusEl.innerHTML = `${icon('checkCircle')} Camera is allowed and working.`;
      statusEl.className = 'camera-status ok';
    } catch (err) {
      setCam(false);
      statusEl.innerHTML = `${icon('xCircle')} Couldn't access the camera. Check the camera permission for this site in your phone settings.`;
      statusEl.className = 'camera-status bad';
    }
  };
  offBtn.onclick = () => {
    statusEl.innerHTML = 'To switch the camera off, change the permission for this site in your phone settings.';
    statusEl.className = 'camera-status';
  };
}

const RULES_BY_MODE = {
  classic: [
    'The host creates a lobby and shares the code with friends — you need at least 3 players.',
    'Each round a prompt drops about a random player in the lobby. The host picks the question pack — Classic, Spicy, Family or School.',
    'Everyone has 30 seconds to snap their reaction.',
    'Miss it and you get a sad face instead of a photo — "Too slow!!".',
    'All photos are revealed at once and you vote for the best one — no voting for yourself.',
    'Points by ranking — 1st place gets 100 pts, the rest a little less. Same votes = same points.',
    'After the last round, whoever has the most points wins.',
  ],
  draw: [
    'The host creates a lobby and shares the code with friends — you need at least 3 players.',
    'Each round a prompt drops about a random player in the lobby. The host picks the question pack — Classic, Spicy, Family or School.',
    'Everyone has 30 seconds to snap their reaction.',
    'Then you get a moment to doodle on your photo with your finger (the host sets how long).',
    'All photos are revealed at once and you vote for the best one — no voting for yourself.',
    'Points by ranking — 1st place gets 100 pts, the rest a little less. Same votes = same points.',
    'After the last round, whoever has the most points wins.',
  ],
  caption: [
    'The host creates a lobby and shares the code with friends — you need at least 3 players.',
    'Each round a different player is the main character — everyone gets a turn.',
    'The main character snaps a photo, with no time limit.',
    'Everyone else writes a funny caption for it (the host sets the time).',
    'The main character reads the captions anonymously and picks the best one.',
    'The author of the winning caption gets 100 pts.',
    'After the last round, whoever has the most points wins.',
  ],
  impostor: [
    'The host creates a lobby, shares the code — you need at least 3 players — and picks the question pack: Classic, Spicy, Family or School.',
    'Each round everyone gets the same photo prompt, except one random player — the impostor — who gets a completely different random one.',
    'While taking the photo, nobody knows who the impostor is — not even the impostor!',
    'Everyone has 30 seconds to snap a photo.',
    'When the photos appear, the impostor finds out and sees both prompts. Then you have 30 seconds to vote for who you think the impostor is.',
    'The impostor gets points based on how many players guess them: nobody guesses → 250 pts, everybody guesses → 0 pts.',
    'If the impostor gets the most votes, everyone else wins: +100 pts and +3 coins each.',
    'If they escape (a tie counts too), the impostor also gets +10 coins.',
  ],
  copycat: [
    'The host creates a lobby and shares the code with friends — you need at least 3 players.',
    'Each round a different player is the original — everyone gets a turn.',
    'The original snaps a selfie with a crazy face or pose, with no time limit.',
    'Everyone else sees it for a few seconds to memorise it (the host sets how long).',
    'Then the photo disappears and you have 20 seconds to copy it from memory with your own selfie.',
    'The original picks the best copy anonymously — its author gets 100 pts.',
    'After the last round, whoever has the most points wins.',
  ],
  twins: [
    'The host creates a lobby and shares the code with friends — you need at least 6 players — and picks the question pack: Classic, Spicy, Family or School.',
    'Each round the players are randomly split into pairs (an odd number makes one trio). Every team gets a letter and a colour.',
    'Everyone sees the same prompt and who their twin is. Without talking, snap a selfie that matches your twin as closely as you can — you have 30 seconds.',
    'All photos are revealed team by team, side by side. Vote for the team that is most in sync — never your own.',
    'Teams are ranked by votes and every member gets the same points — 1st place gets 100 pts, the rest a little less. Same votes = same points.',
    'After the last round, whoever has the most points wins.',
  ],
  hunt: [
    'The host creates a lobby and shares the code with friends — you need at least 3 players.',
    'Each round a task drops — like "something blue" or "the weirdest thing in your bag". The host picks what to hunt: Anywhere, Home, School, Outdoors, Party or Food.',
    'Everyone hunts it down and snaps a photo before time runs out (the host sets how long). The back camera is on — tap the flip button for a selfie.',
    'Miss it and you get a sad face instead of a photo — "Too slow!!".',
    'All photos are revealed at once and you vote for the best one — no voting for yourself.',
    'Points by ranking — 1st place gets 100 pts, the rest a little less. Same votes = same points.',
    'After the last round, whoever has the most points wins.',
  ],
};

// Ikonka ke každému kroku pravidel (jména z icons.js). Pořadí odpovídá RULES_BY_MODE.
const RULE_ICONS = {
  classic: ['users', 'chat', 'timer', 'sad', 'check', 'star', 'chest'],
  draw: ['users', 'chat', 'timer', 'brush', 'check', 'star', 'chest'],
  caption: ['users', 'users', 'camera', 'pencil', 'check', 'star', 'chest'],
  impostor: ['users', 'spy', 'camera', 'timer', 'search', 'star', 'check', 'gift'],
  copycat: ['users', 'users', 'camera', 'timer', 'copy', 'check', 'chest'],
  twins: ['users', 'users', 'camera', 'check', 'star', 'chest'],
  hunt: ['users', 'search', 'camera', 'sad', 'check', 'star', 'chest'],
};

function showRulesModal(initialMode = 'classic') {
  const modes = ['classic', 'draw', 'caption', 'impostor', 'hunt', 'copycat', 'twins'];
  openModal(`
    <div class="x-close-row"><button class="x-close" id="modal-rules-close" aria-label="Close">${icon('close')}</button></div>
    <h2>How to play</h2>
    <div class="rules-tabs" role="tablist" aria-label="Game mode">
      ${modes.map((m) => `
        <button class="rules-tab rules-tab-${m}" data-mode="${m}" role="tab">
          ${modeTile(m)}
          <span>${modeDisplayName(m)}</span>
        </button>`).join('')}
    </div>
    <ol class="rules-list" id="rules-list"></ol>
  `, { tall: true });

  function show(mode) {
    document.querySelectorAll('.rules-tab').forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    const list = document.getElementById('rules-list');
    list.className = `rules-list mc-${mode}`;
    list.innerHTML = RULES_BY_MODE[mode]
      .map((t, i) => `<li class="item"><span class="rule-ico">${icon((RULE_ICONS[mode] || [])[i] || 'star')}<span class="num">${i + 1}</span></span><span class="rule-text">${escapeHtml(t)}</span></li>`)
      .join('');
  }
  document.querySelectorAll('.rules-tab').forEach((t) => { t.onclick = () => show(t.dataset.mode); });
  show(initialMode);
  document.getElementById('modal-rules-close').onclick = closeModal;
}

// ---------------------------------------------------------------- LOBBY ---

// Nastavení v lobby se vybírá dlaždicemi s pevnými hodnotami (ne +/−).
const ROUND_OPTIONS = [3, 5, 10, 15, 20];
const DRAW_SECONDS_OPTIONS = [10, 15, 20, 30, 45];
const CAPTION_SECONDS_OPTIONS = [20, 30, 40, 60, 90];
const HUNT_SECONDS_OPTIONS = [30, 45, 60, 90, 120];

// Žánry Snap Huntu — co se bude hledat. Všechny zdarma v rámci módu.
const HUNT_PACK_INFO = {
  anywhere: { label: 'Anywhere' },
  home: { label: 'Home' },
  school: { label: 'School' },
  outdoors: { label: 'Outdoors' },
  party: { label: 'Party' },
  food: { label: 'Food' },
};

function huntPackPickerHtml(current) {
  return `<div class="pack-picker" id="picker-hunt-pack">
    ${Object.entries(HUNT_PACK_INFO).map(([id, p]) => `
      <button class="pack-chip pack-chip-${id} ${id === current ? 'active' : ''}" data-hunt-pack="${id}">
        <span class="pack-chip-glyph">${packGlyph(id)}</span><span class="pack-chip-label">${p.label}</span>
      </button>`).join('')}
  </div>`;
}

// Sada otázek (Classic / Spicy / Family / School) — stejný styl dlaždic, jen s textem.
// Spicy, Family a School jsou v nabídce Question Packs (zámek, dokud je hostitel nemá).
function packPickerHtml(current) {
  return `<div class="pack-picker" id="picker-pack">
    ${Object.entries(QUESTION_PACK_INFO).map(([id, p]) => `
      <button class="pack-chip pack-chip-${id} ${id === current ? 'active' : ''} ${isPackUnlocked(id) ? '' : 'locked'}" data-pack="${id}">
        <span class="pack-chip-glyph">${packGlyph(id)}</span><span class="pack-chip-label">${p.label}</span>
        ${isPackUnlocked(id) ? '' : `<span class="pack-chip-lock">${icon('lock')}</span>`}
      </button>`).join('')}
  </div>`;
}

function promptPackBadge(state) {
  if (state.mode === 'hunt') {
    const h = HUNT_PACK_INFO[state.huntPack];
    return h && state.huntPack !== 'anywhere' ? `<span class="spicy-badge pack-badge-${state.huntPack}">${packGlyph(state.huntPack)} ${h.label}</span>` : '';
  }
  if (state.mode === 'caption' || state.mode === 'copycat' || !state.promptPack || state.promptPack === 'classic') return '';
  const p = QUESTION_PACK_INFO[state.promptPack];
  return p ? `<span class="spicy-badge pack-badge-${state.promptPack}">${packGlyph(state.promptPack)} ${p.label}</span>` : '';
}

function optionPicker(id, values, current, suffix = '') {
  return `<div class="option-picker" id="picker-${id}">
    ${values.map((v) => `<button class="option-chip ${v === current ? 'active' : ''}" data-value="${v}">${v}${suffix}</button>`).join('')}
  </div>`;
}

function wireOptionPicker(id, onPick) {
  const wrap = document.getElementById(`picker-${id}`);
  if (!wrap) return;
  wrap.querySelectorAll('.option-chip').forEach((btn) => {
    btn.onclick = () => {
      wrap.querySelectorAll('.option-chip').forEach((b) => b.classList.toggle('active', b === btn)); // hned, bez čekání na server
      onPick(Number(btn.getAttribute('data-value')));
    };
  });
}

// Lobby, jak bude vypadat, než odpoví server (výchozí nastavení jako na serveru).
// Ovládání je do té doby zamčené, kód se objeví, jakmile přijde odpověď.
function pendingLobbyState(mode, name) {
  return {
    pending: true, code: '', mode, phase: 'lobby', isHost: true, joinRequests: [],
    players: [{ id: 'me', name, looks: myLooks(), isHost: true, isYou: true, connected: true }],
    totalRounds: 5, drawEnabled: mode === 'draw', drawSeconds: 20, captionSeconds: 40, copySeconds: 20, peekSeconds: 3,
    huntSeconds: 60, huntPack: 'anywhere', promptPack: 'classic',
  };
}

function renderLobbyScreen(state) {
  mountedKey = 'lobby';
  stopCamera();
  document.body.classList.remove('home-bg', 'has-bottom-nav');
  const players = state.players;
  const need = Math.max(0, minPlayersFor(state.mode) - players.length);
  const hostName = players.find((p) => p.isHost)?.name || '';
  app.innerHTML = `
    <header class="sf-lobby-head mc-${state.mode}">
      <button id="back-btn" class="back-btn" aria-label="Leave lobby" title="Back to home">${icon('back')}</button>
      ${modeTile(state.mode)}
      <span class="sf-lobby-mode">${modeDisplayName(state.mode)}</span>
    </header>
    <div class="screen sf-g sf-lobby ${state.pending ? 'lobby-pending' : ''}">
      <section class="sf-code-card">
        <span class="sf-label">Lobby code</span>
        <div class="sf-code ${state.pending ? 'is-pending' : ''}">${state.pending ? '<span></span><span></span><span></span><span></span>' : escapeHtml(state.code)}</div>
        ${!state.isHost && promptPackBadge(state) ? `<div>${promptPackBadge(state)}</div>` : ''}
        <div class="sf-code-actions">
          <button class="btn btn-ghost" id="copy-code-btn" ${state.pending ? 'disabled' : ''}>${icon('copy')}<span>Copy</span></button>
          <button class="btn btn-ghost invite-btn" id="invite-btn">${icon('users')}<span>Invite friends</span></button>
        </div>
      </section>

      ${joinRequestsHtml(state)}

      <section class="sf-card sf-players">
        <div class="sf-sec-head">
          <h2 class="sf-h3">Players</h2>
          <span class="sf-sec-meta">${players.length} ${players.length === 1 ? 'player' : 'players'}</span>
        </div>
        <div class="player-list">
          ${players.map((p) => `
            <div class="player-row ${p.connected ? '' : 'is-off'}">
              <span class="name"><span class="sf-avatar-wrap">${avatarHtml(p.name, p.looks, 48)}<span class="dot ${p.connected ? '' : 'off'}"></span></span><span class="sf-name-col">${playerNameHtml(p.name, p.looks)}${p.isYou ? '<span class="sf-you">(you)</span>' : ''}</span></span>
              <span class="player-row-actions">
                ${p.isHost ? '<span class="badge">Host</span>' : ''}
                ${!p.isYou && p.friendCode && !isFriend(p.friendCode) && !getSentRequests().some((r) => r.code === p.friendCode)
                  ? `<button class="add-friend-mini" data-add-friend="${p.friendCode}" data-name="${escapeHtml(p.name)}" aria-label="Add friend">${icon('plus')}</button>`
                  : ''}
                ${renameBotButtonHtml(state, p)}
                ${state.isHost && !p.isYou
                  ? `<button class="kick-btn" data-kick="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="Remove from lobby">${icon('close')}</button>`
                  : ''}
              </span>
            </div>
          `).join('')}
          ${players.length < 2 ? '<div class="sf-empty-row">Share the code. Friends show up here as soon as they join.</div>' : ''}
        </div>
      </section>

      ${state.isHost ? `
        ${state.mode !== 'caption' && state.mode !== 'hunt' && state.mode !== 'copycat' ? `
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('chat')} Question pack</h2>
            ${packPickerHtml(state.promptPack)}
          </section>
        ` : ''}

        <section class="sf-card setting-card">
          <h2 class="setting-title">${icon('rounds')} Rounds</h2>
          ${optionPicker('rounds', ROUND_OPTIONS, state.totalRounds)}
        </section>

        ${state.drawEnabled ? `
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('brush')} Doodle time</h2>
            ${optionPicker('draw-seconds', DRAW_SECONDS_OPTIONS, state.drawSeconds, 's')}
          </section>
        ` : ''}

        ${state.mode === 'hunt' ? `
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('search')} What to hunt</h2>
            ${huntPackPickerHtml(state.huntPack)}
          </section>
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('timer')} Hunt time</h2>
            ${optionPicker('hunt-seconds', HUNT_SECONDS_OPTIONS, state.huntSeconds, 's')}
          </section>
        ` : ''}

        ${state.mode === 'caption' ? `
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('timer')} Caption time</h2>
            ${optionPicker('caption-seconds', CAPTION_SECONDS_OPTIONS, state.captionSeconds, 's')}
          </section>
        ` : ''}

        ${state.mode === 'copycat' ? `
          <section class="sf-card setting-card">
            <h2 class="setting-title">${icon('timer')} Photo shown for</h2>
            ${optionPicker('peek-seconds', PEEK_SECONDS_OPTIONS, state.peekSeconds, 's')}
          </section>
        ` : ''}

        ${addBotButtonHtml(state)}
      ` : ''}

      <div class="sf-start-bar">
        ${state.isHost ? `
          <button id="start-btn" class="btn btn-primary btn-block sf-start" ${need > 0 ? 'disabled' : ''}>
            ${need > 0
              ? `Need ${need} more ${need === 1 ? 'player' : 'players'}`
              : isModeUnlocked(state.mode) ? `Start game ${icon('play')}` : `Start game ${icon('ticket')} 1`}
          </button>
        ` : `
          <p class="sf-wait-host"><span class="sf-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Waiting for the host (${escapeHtml(hostName)}) to start…</span></p>
        `}
      </div>
    </div>
  `;

  if (state.isHost) {
    wireOptionPicker('rounds', (v) => send({ type: 'set_rounds', rounds: v }));
    wireOptionPicker('draw-seconds', (v) => send({ type: 'set_draw_settings', seconds: v }));
    wireOptionPicker('caption-seconds', (v) => send({ type: 'set_caption_settings', seconds: v }));
    wireOptionPicker('peek-seconds', (v) => send({ type: 'set_copy_settings', seconds: v }));
    wireOptionPicker('hunt-seconds', (v) => send({ type: 'set_hunt_settings', seconds: v }));
    wireAddBot();
    document.querySelectorAll('#picker-hunt-pack .pack-chip').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('#picker-hunt-pack .pack-chip').forEach((c) => c.classList.toggle('active', c === b));
        send({ type: 'set_hunt_settings', pack: b.dataset.huntPack });
      };
    });
    document.querySelectorAll('#picker-pack .pack-chip').forEach((b) => {
      b.onclick = () => {
        const pack = b.dataset.pack;
        if (!isPackUnlocked(pack)) {
          // po koupi rovnou vybrat sadu, na kterou hostitel ťukl
          return showQuestionPacksOffer(pack, () => send({ type: 'set_prompt_pack', pack }));
        }
        document.querySelectorAll('#picker-pack .pack-chip').forEach((c) => c.classList.toggle('active', c === b));
        send({ type: 'set_prompt_pack', pack });
      };
    });
    document.getElementById('start-btn').onclick = () => {
      // zamčený mód bez vstupenky (třeba po "Hrát znovu") — nabídni koupi
      if (!canHostMode(state.mode)) return showPartyPackOffer(state.mode, () => renderLobbyScreen(lastState));
      send({ type: 'start_game' });
    };
  }
  document.getElementById('back-btn').onclick = leaveLobby;
  document.getElementById('invite-btn').onclick = showInviteFriendsModal;
  const copyBtn = document.getElementById('copy-code-btn');
  if (copyBtn) copyBtn.onclick = () => sfCopyCode(state.code);
  wireLobbyHostControls();
  document.querySelectorAll('[data-add-friend]').forEach((b) => {
    b.onclick = () => {
      sendFriendRequest(b.dataset.addFriend, b.dataset.name);
      b.remove();
    };
  });
}

// Hráč odešel z lobby dřív, než ji server stihl založit → až přijde, hned ji opustit.
let cancelPendingCreate = false;

function leaveLobby() {
  if (!lastState && mountedKey === 'lobby') cancelPendingCreate = true;
  leftLobbyCode = lastState?.code || null;
  closeModal();
  clearSession();
  hideReconnectOverlay();
  send({ type: 'leave_lobby' });
  lastState = null;
  submittedLocally = false;
  votedLocallyFor = null;
  drawDoneLocally = false;
  renderStartScreen();
}

// ------------------------------------------------ SCHVALOVÁNÍ A VYHAZOVÁNÍ ---
// Kdo se připojuje kódem nebo přes přítele, čeká, až ho hostitel pustí.
// Pozvaní přátelé a boti jdou rovnou dovnitř (hlídá server).

function renderJoinPendingScreen(msg) {
  mountedKey = 'join-pending';
  stopCamera();
  document.body.classList.remove('home-bg', 'has-bottom-nav');
  const host = msg.hostName ? `<b class="sf-host-name">${escapeHtml(msg.hostName)}</b>` : '';
  app.innerHTML = `
    <div class="screen center join-pending sf-g">
      <div class="sf-code-boxes" aria-label="Game code ${escapeHtml(msg.code)}">${[...String(msg.code || '')].map((ch) => `<span>${escapeHtml(ch)}</span>`).join('')}</div>
      <div class="sf-knock" aria-hidden="true">
        <div class="sf-door"><span></span></div>
        <svg class="sf-knocker" width="120" height="150" viewBox="0 0 96 120"><circle cx="48" cy="60" r="44" fill="#8B5CF6" stroke="#2C1670" stroke-width="5"/><path d="M14 46C18 18 78 18 82 46C70 34 26 34 14 46Z" fill="#1B1530" stroke="#2C1670" stroke-width="5"/><circle cx="34" cy="60" r="5" fill="#1B1530"/><circle cx="62" cy="60" r="5" fill="#1B1530"/><path d="M38 78q10 6 20 0" stroke="#1B1530" stroke-width="5" fill="none" stroke-linecap="round"/></svg>
      </div>
      <div class="sf-knock-text">
        <h2>Knock knock!</h2>
        <p class="join-pending-host">${msg.hostName ? `<span>Waiting for</span> ${host} <span>to let you in.</span>` : '<span>The host has to let you in</span>'}</p>
        <span class="sf-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
      <button class="btn btn-ghost btn-block" id="cancel-join-2">Cancel</button>
    </div>`;
  document.getElementById('cancel-join-2').onclick = () => { send({ type: 'cancel_join' }); renderStartScreen(); };
}

function joinRequestsHtml(state) {
  const reqs = state.joinRequests || [];
  if (!state.isHost || !reqs.length) return '';
  return `
    <section class="sf-join-req join-requests" aria-label="Join requests">
      ${reqs.map((r) => `
        <div class="sf-join-row">
          ${avatarHtml(r.name, r.looks, 44)}
          <span class="sf-join-text">${playerNameHtml(r.name, r.looks)} <span>wants to join</span></span>
          <button class="req-btn req-yes" data-approve="${r.id}" aria-label="Let in">${icon('check')}</button>
          <button class="req-btn req-no" data-deny="${r.id}" aria-label="Decline">${icon('close')}</button>
        </div>`).join('')}
    </section>`;
}

function wireLobbyHostControls() {
  document.querySelectorAll('[data-approve]').forEach((b) => { b.onclick = () => send({ type: 'approve_join', id: b.dataset.approve }); });
  document.querySelectorAll('[data-deny]').forEach((b) => { b.onclick = () => send({ type: 'deny_join', id: b.dataset.deny }); });
  document.querySelectorAll('[data-kick]').forEach((b) => {
    b.onclick = () => {
      const target = (lastState?.players || []).find((p) => p.id === b.dataset.kick);
      const nm = escapeHtml(b.dataset.name);
      const modal = openModal(`
        <div class="x-close-row"><button class="x-close" id="kick-cancel" aria-label="Close">${icon('close')}</button></div>
        <div class="dialog-avatar">${avatarHtml(b.dataset.name, target?.looks, 76)}</div>
        <h2>Kick ${nm}?</h2>
        <p class="dialog-text">${nm} leaves the lobby now. They can ask to join again with the code.</p>
        <button class="btn btn-danger btn-block" id="kick-yes">Kick ${nm}</button>
      `, { dialog: true });
      modal.querySelector('#kick-cancel').onclick = closeModal;
      modal.querySelector('#kick-yes').onclick = () => {
        send({ type: 'kick_player', playerId: b.dataset.kick });
        closeModal();
      };
    };
  });
}

// ----------------------------------------------------------- SUBMITTING ---

async function buildCameraView(state) {
  mountedKey = `submitting-camera-${state.round}`;
  app.innerHTML = `
    <div class="screen sf-g sf-cam">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: `<span class="prompt-text">${escapeHtml(state.prompt)}</span>` })}
      ${roleBadgeHtml(state)}
      ${twinsBannerHtml(state)}
      ${sfCameraHtml(state, state.mode === 'hunt')}
    </div>
  `;

  cameraFacing = state.mode === 'hunt' ? 'environment' : 'user';
  await startCameraStream();

  document.getElementById('shutter-btn').onclick = () => capturePhoto();
  const flip = document.getElementById('flip-btn');
  if (flip) {
    flip.onclick = async () => {
      cameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
      stopCamera();
      await startCameraStream();
    };
  }
}

// Spoušť je zamčená, dokud kamera nenaběhne (první snímky bývají černé).
function lockShutterUntilPlaying(video) {
  const shutter = document.getElementById('shutter-btn');
  if (shutter) shutter.disabled = true;
  video.addEventListener('playing', () => {
    setTimeout(() => { const b = document.getElementById('shutter-btn'); if (b) b.disabled = false; }, 700);
  }, { once: true });
}

// Spustí kameru podle cameraFacing do #cam-video.
async function startCameraStream() {
  const video = document.getElementById('cam-video');
  if (!video) return;
  // spoušť je zamčená, dokud kamera nenaběhne (první snímky bývají černé) — ochrana před
  // náhodným klepnutím hned po zobrazení obrazovky, které by odeslalo černou fotku
  lockShutterUntilPlaying(video);
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false,
    });
    video.srcObject = cameraStream;
    video.classList.toggle('rear', cameraFacing === 'environment');
    video.play().catch(() => {});
    // telefon kameru sám vypne (jiná appka, zamčená obrazovka…) → obnov ji, ať nezůstane černá
    const track = cameraStream.getVideoTracks()[0];
    if (track) track.addEventListener('ended', () => recoverCamera());
  } catch (err) {
    showCameraError(err);
  }
}

// Kamera není povolená / nejde spustit: hláška + tlačítko „Turn on camera“, které o povolení
// požádá znovu přímo ve hře (a když je zablokovaná natrvalo, vysvětlí, kde ji povolit).
async function showCameraError(err) {
  const wrap = document.querySelector('.camera-wrap');
  if (!wrap) return;
  let blocked = !!err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'camera' });
      if (st.state === 'denied') blocked = true;
    }
  } catch { /* prohlížeč stav kamery nezná */ }
  if (!document.querySelector('.camera-wrap')) return;
  wrap.innerHTML = `
    <div class="missed camera-error" style="justify-content:center;">
      <span class="emoji">${icon('cameraOff')}</span>
      <span>Couldn't access the camera.</span>
      <button type="button" class="btn btn-primary" id="camera-retry">Turn on camera</button>
      ${blocked ? '<span class="camera-help">If nothing happens, tap the lock icon next to the web address and allow the camera.</span>' : ''}
    </div>`;
  document.getElementById('camera-retry').onclick = async () => {
    // vrať video + záblesk a zkus kameru spustit znovu (prohlížeč se zeptá na povolení)
    wrap.innerHTML = sfStageInner(lastState);
    await startCameraStream();
  };
}

// Znovu spustí kameru, když se vypnula nebo zčernala (jen když je na obrazovce foťák).
let cameraRecovering = false;
async function recoverCamera() {
  if (cameraRecovering || !document.getElementById('cam-video')) return;
  cameraRecovering = true;
  try {
    stopCamera();
    await startCameraStream();
  } finally {
    cameraRecovering = false;
  }
}

// Po návratu do appky (přepnutí aplikací, odemčení telefonu) zkontroluj, jestli kamera pořád běží.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  setTimeout(() => {
    const video = document.getElementById('cam-video');
    if (!video) return;
    const track = cameraStream && cameraStream.getVideoTracks()[0];
    if (!track || track.readyState !== 'live' || track.muted || video.paused || video.readyState < 2) recoverCamera();
  }, 400);
});

// Skoro celý černý (nebo jednobarevný) snímek = kamera ještě neposlala skutečný obraz.
function isBlankFrame(ctx, size) {
  try {
    const d = ctx.getImageData(0, 0, size, size).data;
    let sum = 0, sumSq = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sum += l; sumSq += l * l; n++;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return mean < 8 && variance < 20;
  } catch { return false; }
}

function capturePhoto() {
  const video = document.getElementById('cam-video');
  if (!video || !video.videoWidth || video.readyState < 2) return;
  const shutterEl = document.getElementById('shutter-btn');
  if (shutterEl && shutterEl.disabled) return;
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const side = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  // selfie se zrcadlí (jako v zrcadle), zadní foťák ne — jinak by byl text obráceně
  if (!video.classList.contains('rear')) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  // černý snímek (kamera ještě nenaběhla) se neodešle — fotka se nechá vyfotit znovu
  if (isBlankFrame(ctx, size)) {
    showToast('Camera is still starting — try again');
    recoverCamera(); // kamera mohla zčernat — restartuj ji
    return;
  }
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

  const flash = document.getElementById('flash-el');
  if (flash) { flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 350); }

  send({ type: 'submit_photo', photoDataUrl: dataUrl });
  lastSentPhoto = { round: lastState ? lastState.round : null, url: dataUrl };
  playSfx('shutter');
  stopCamera();

  if (lastState && (lastState.phase === 'subject_photo' || lastState.phase === 'copy_original')) {
    // fáze se po odeslání změní skoro okamžitě, žádný mezikrok navíc netřeba
    return;
  }
  submittedLocally = true;
  if (lastState.phase === 'copy_copying') return buildCopyWaitingView(lastState);
  buildWaitingView(lastState);
}

function buildWaitingView(state) {
  mountedKey = `submitting-waiting-${state.round}`;
  const sent = lastSentPhoto && lastSentPhoto.round === state.round;
  app.innerHTML = `
    <div class="screen sf-g sf-waiting">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: `<span class="prompt-text">${escapeHtml(state.prompt)}</span>`, ring: 'small', small: true })}
      ${twinsBannerHtml(state, false)}
      <div class="sf-sent">
        ${sent ? `<div class="sf-sent-photo"><img src="${lastSentPhoto.url}" alt=""></div>` : `<div class="sf-sent-photo is-empty">${icon('camera')}</div>`}
        <span class="sf-sent-check" role="img" aria-label="Photo saved">${icon('check')}</span>
      </div>
      <div class="sf-nice"><b>Nice shot!</b><span>Nobody sees it until the vote.</span></div>
      ${sfWaitCardHtml()}
      <p class="sf-sr" id="wait-count-text">Waiting for the others…</p>
    </div>
  `;
  patchWaitingCount(state);
}

function patchWaitingCount(state) {
  const el = document.getElementById('wait-count-text');
  if (el) el.textContent = `${state.submittedCount} / ${state.activeCount} players done…`;
  sfSetCount(state.submittedCount || 0, state.activeCount || 0);
}

// ------------------------------------------------------------ POPISOVÁNKA ---

async function buildSubjectPhotoView(state) {
  mountedKey = `subject-photo-${state.round}`;
  app.innerHTML = `
    <div class="screen sf-g sf-cam">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: `<span>You're the main character! Snap yourself — everyone else will caption what's going on.</span>`, ring: false, small: true })}
      ${sfCameraHtml(state, false)}
    </div>
  `;

  cameraFacing = 'user';
  await startCameraStream();

  document.getElementById('shutter-btn').onclick = () => capturePhoto();
}

function buildSubjectWaitView(state) {
  mountedKey = `subject-wait-${state.round}`;
  stopCamera();
  app.innerHTML = sfStatusHtml(state, {
    pill: sfRoundPill(state),
    art: `<div class="sf-art">${icon('camera')}</div>`,
    h: `<span>Waiting for</span> ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} <span>to snap a photo…</span>`,
  });
}

function buildCaptioningView(state) {
  stopCamera();

  if (state.isSubject) {
    mountedKey = `captioning-subject-${state.round}`;
    app.innerHTML = `
      <div class="screen sf-g sf-cap">
        ${sfHeadHtml(state, { pill: sfRoundPill(state), title: '<span>Everyone is captioning your photo…</span>', small: true })}
        <div class="sf-cap-photo">
          ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}
          <span class="sf-chip-over sf-cap-count" id="caption-count-text"></span>
        </div>
      </div>
    `;
    patchCaptionCount(state);
    return;
  }

  if (state.youCaptioned) {
    mountedKey = `captioning-done-${state.round}`;
    app.innerHTML = `
      <div class="screen sf-g sf-cap">
        ${sfHeadHtml(state, { pill: sfRoundPill(state), title: '<span>Caption sent!</span>', small: true })}
        <div class="sf-cap-photo">
          ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}
          <span class="sf-chip-over sf-cap-count" id="caption-count-text"></span>
        </div>
      </div>
    `;
    patchCaptionCount(state);
    return;
  }

  mountedKey = `captioning-write-${state.round}`;
  app.innerHTML = `
    <div class="screen sf-g sf-cap">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: `<span>Caption the photo of</span> ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))}` })}
      <div class="sf-cap-photo">
        ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}
        <span class="sf-chip-over sf-cap-count" id="caption-count-text"></span>
      </div>
      <div class="sf-cap-form">
        <label for="caption-input">Your caption</label>
        <div class="sf-cap-row">
          <textarea id="caption-input" class="caption-textarea" maxlength="140" rows="2" placeholder="e.g. Just watched the bus leave without him…"></textarea>
          <button id="caption-submit" class="btn btn-primary sf-send" aria-label="Send caption">${icon('send')}</button>
        </div>
        <span class="sf-cap-len num" id="caption-len">0/140</span>
      </div>
    </div>
  `;
  const capInput = document.getElementById('caption-input');
  capInput.addEventListener('input', () => { document.getElementById('caption-len').textContent = `${capInput.value.length}/140`; });
  document.getElementById('caption-submit').onclick = () => {
    const text = document.getElementById('caption-input').value.trim();
    if (!text) return showError('Write a caption first.');
    send({ type: 'submit_caption', text });
    playSfx('type');
  };
  // vyprší čas → odešli rozepsaný popisek (prázdný se neposílá)
  autoPartial = {
    key: mountedKey,
    fire: () => {
      const text = (document.getElementById('caption-input') || {}).value;
      if (text && text.trim()) send({ type: 'submit_caption', text: text.trim() });
    },
  };
}

function patchCaptionCount(state) {
  const el = document.getElementById('caption-count-text');
  if (el) el.textContent = `${state.captionedCount} / ${state.captionEligibleCount} captions in…`;
}

function buildJudgingView(state) {
  mountedKey = `judging-${state.round}`;
  stopCamera();

  const cardsHtml = state.captionCards.map((c) => `
    <div class="caption-card ${state.isSubject ? '' : 'readonly'}" data-id="${c.id}" ${state.isSubject ? 'role="radio" aria-checked="false" tabindex="0"' : ''}>
      <p>${escapeHtml(c.text)}</p>
      <span class="sf-radio" aria-hidden="true">${icon('check')}</span>
    </div>
  `).join('');

  const subj = playerNameHtml(state.subjectName, looksOf(state, state.subjectId));
  app.innerHTML = `
    <div class="screen sf-g sf-judge">
      <div class="sf-judge-top">
        <div class="sf-judge-photo">${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}</div>
        <div class="sf-judge-text">
          <span class="sf-pill">${state.isSubject ? "You're the star" : sfRoundPill(state, 'pick')}</span>
          <h1>${state.isSubject ? 'Pick the best caption' : `${subj} <span>is picking the best caption…</span>`}</h1>
          ${state.isSubject ? '<p>Names stay hidden until you pick.</p>' : ''}
        </div>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <div class="caption-list" role="radiogroup" aria-label="Captions">${cardsHtml || '<p class="wait-note">Nobody wrote a caption in time.</p>'}</div>
      ${state.isSubject && cardsHtml ? `<div class="sf-start-bar"><button class="btn btn-primary btn-block sf-start" id="judge-status" disabled>Tap a caption to pick it</button></div>` : ''}
    </div>
  `;

  if (state.isSubject) {
    document.querySelectorAll('.caption-card[data-id]').forEach((el) => {
      el.onclick = () => {
        document.querySelectorAll('.caption-card').forEach((c) => { c.classList.add('disabled'); c.setAttribute('aria-checked', 'false'); });
        el.classList.remove('disabled');
        el.classList.add('picked');
        el.setAttribute('aria-checked', 'true');
        const st = document.getElementById('judge-status');
        if (st) st.textContent = 'Caption picked!';
        send({ type: 'pick_caption', authorId: el.getAttribute('data-id') });
        playSfx('pick');
      };
    });
  }
}

// --------------------------------------------------------------- DRAWING ---

const DRAW_COLORS = ['#ffffff', '#111111', '#F0483A', '#F0B429', '#3FAE6B', '#1C5D99'];
const DRAW_COLOR_NAMES = ['White', 'Black', 'Red', 'Yellow', 'Green', 'Blue'];
const DRAW_SIZES = [4, 8, 14];

function buildDrawingView(state) {
  mountedKey = `draw-canvas-${state.round}`;
  stopCamera();

  if (state.youMissed) {
    drawDoneLocally = true;
    buildDrawWaitingView(state);
    return;
  }

  app.innerHTML = `
    <div class="screen sf-g sf-draw">
      ${sfHeadHtml(state, { pill: sfRoundPill(state, 'doodle time'), title: `<span class="prompt-text">${escapeHtml(state.prompt)}</span>`, small: true })}
      ${state.photoOwnerName ? `<div class="draw-on-banner"><span>Draw on the photo of</span> ${escapeHtml(state.photoOwnerName)}</div>` : ''}
      <div class="camera-wrap draw-stage sf-stage">
        <img id="draw-photo" src="${state.yourPhotoDataUrl}">
        <canvas id="draw-canvas"></canvas>
      </div>
      <div class="sf-tools" role="toolbar" aria-label="Drawing tools">
        <div class="swatches" id="swatches">
          ${DRAW_COLORS.map((c, i) => `<button class="swatch ${i === 0 ? 'active' : ''}" data-color="${c}" style="background:${c}" aria-label="${DRAW_COLOR_NAMES[i]}" aria-pressed="${i === 0}"></button>`).join('')}
        </div>
        <div class="sf-tools-row">
          ${DRAW_SIZES.map((n, i) => `<button class="sf-size ${i === 1 ? 'on' : ''}" data-size="${n}" aria-label="Brush size ${i + 1}" aria-pressed="${i === 1}"><i style="width:${n + 4}px;height:${n + 4}px"></i></button>`).join('')}
          <button id="draw-undo" class="sf-tool-btn" aria-label="Undo">${icon('undo')}</button>
          <button id="draw-clear" class="sf-tool-btn is-text">Clear</button>
        </div>
      </div>
      <button id="draw-done" class="btn btn-primary btn-block sf-start">Done</button>
    </div>
  `;

  const stage = document.querySelector('.draw-stage');
  const img = document.getElementById('draw-photo');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  let color = DRAW_COLORS[0];
  let size = DRAW_SIZES[1];
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let strokes = [];   // pro Zpět: každý tah = { color, size, pts:[[x,y]…] }
  let cur = null;

  function sizeCanvas() {
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redraw();
  }
  function seg(c, w, x0, y0, x1, y1) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const st of strokes) {
      if (st.pts.length === 1) seg(st.color, st.size, st.pts[0][0], st.pts[0][1], st.pts[0][0], st.pts[0][1]);
      for (let i = 1; i < st.pts.length; i++) seg(st.color, st.size, st.pts[i - 1][0], st.pts[i - 1][1], st.pts[i][0], st.pts[i][1]);
    }
  }
  sizeCanvas();
  requestAnimationFrame(sizeCanvas);

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = posFromEvent(e);
    lastX = p.x;
    lastY = p.y;
    cur = { color, size, pts: [[p.x, p.y]] };
    strokes.push(cur);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = posFromEvent(e);
    seg(color, size, lastX, lastY, p.x, p.y);
    cur.pts.push([p.x, p.y]);
    lastX = p.x;
    lastY = p.y;
  }
  function end() {
    if (drawing && cur && cur.pts.length === 1) seg(cur.color, cur.size, cur.pts[0][0], cur.pts[0][1], cur.pts[0][0], cur.pts[0][1]); // tečka
    drawing = false;
  }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);

  document.querySelectorAll('.swatch').forEach((sw) => {
    sw.onclick = () => {
      color = sw.getAttribute('data-color');
      document.querySelectorAll('.swatch').forEach((s2) => { s2.classList.toggle('active', s2 === sw); s2.setAttribute('aria-pressed', String(s2 === sw)); });
    };
  });
  document.querySelectorAll('.sf-size').forEach((b) => {
    b.onclick = () => {
      size = Number(b.dataset.size);
      document.querySelectorAll('.sf-size').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    };
  });

  document.getElementById('draw-undo').onclick = () => { strokes.pop(); redraw(); };
  document.getElementById('draw-clear').onclick = () => { strokes = []; ctx.clearRect(0, 0, canvas.width, canvas.height); };
  document.getElementById('draw-done').onclick = () => finishDrawing(img, canvas);
  // vyprší čas → odešli, co je zatím nakresleno (fotka s dosavadními čárami)
  autoPartial = { key: mountedKey, fire: () => finishDrawing(img, canvas) };
}

function finishDrawing(img, canvas) {
  const out = document.createElement('canvas');
  out.width = canvas.width || 480;
  out.height = canvas.height || 480;
  const octx = out.getContext('2d');
  octx.drawImage(img, 0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  const dataUrl = out.toDataURL('image/jpeg', 0.75);

  send({ type: 'submit_photo', photoDataUrl: dataUrl });
  send({ type: 'finish_drawing' });
  drawDoneLocally = true;
  buildDrawWaitingView(lastState);
}

function buildDrawWaitingView(state) {
  mountedKey = `draw-waiting-${state.round}`;
  app.innerHTML = sfStatusHtml(state, {
    cls: 'sf-draw-wait',
    pill: sfRoundPill(state, 'doodle time'),
    title: `<span class="prompt-text">${escapeHtml(state.prompt)}</span>`,
    ring: 'small',
    art: `<div class="sf-art">${icon('brush')}</div>`,
    h: state.youMissed ? 'Nothing to doodle this time' : 'Doodle done!',
    sub: '<span class="sf-sr" id="draw-count-text">Waiting for the others…</span>',
    card: sfWaitCardHtml(),
  });
  patchDrawCount(state);
}

function patchDrawCount(state) {
  const el = document.getElementById('draw-count-text');
  if (el) el.textContent = `${state.doneCount} / ${state.activeCount} players done…`;
  sfSetCount(state.doneCount || 0, state.activeCount || 0);
}

// --------------------------------------------------------------- VOTING ---

function buildVotingView(state) {
  mountedKey = `voting-${state.round}`;
  const ownMissed = state.cards.some((c) => c.isOwn && !c.photoDataUrl);
  const cardsHtml = state.cards.map((c) => {
    if (c.isOwn) {
      return `
        <div class="vote-card own">
          ${c.photoDataUrl ? `<img src="${c.photoDataUrl}">` : sfMissedHtml()}
          <div class="tag">Yours – can't vote</div>
        </div>`;
    }
    if (c.missed) {
      return `
        <div class="vote-card disabled">
          ${sfMissedHtml()}
        </div>`;
    }
    return `
      <div class="vote-card" data-id="${c.id}" role="button" tabindex="0" aria-pressed="false">
        <img src="${c.photoDataUrl}">
        ${likeBtnHtml(c.id)}
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="screen sf-g sf-vote">
      <div class="sf-vote-top">
        <span class="sf-pill">${sfRoundPill(state, 'vote')}</span>
        <span class="sf-voted"><i></i><b class="sf-count-num num">0/${state.activeCount}</b><span>voted</span></span>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <div class="sf-vote-headrow">
        <div>
          <h1 class="sf-vote-title prompt-text">${escapeHtml(state.prompt)}</h1>
          <p class="sf-vote-sub">Photos are anonymous. Pick the funniest.</p>
        </div>
        ${sfRingHtml(true)}
      </div>
      ${ownMissed ? `<div class="sf-slow">${sfSadFaceHtml(56)}<div><b>Too slow!!</b><span>Your photo this round is a sad face. You can still vote.</span></div></div>` : ''}
      <div class="grid sf-pickable" id="vote-grid">${cardsHtml}</div>
      <p class="sf-sr" id="vote-count-text"></p>
      <div class="sf-start-bar"><button class="btn btn-primary btn-block sf-start" id="vote-status" disabled>Tap a photo to vote</button></div>
    </div>
  `;

  document.querySelectorAll('.vote-card[data-id]').forEach((el) => {
    el.onclick = () => {
      const targetId = el.getAttribute('data-id');
      if (votedLocallyFor === targetId) return; // už vybraný – nic
      votedLocallyFor = targetId;
      send({ type: 'cast_vote', targetId });
      playSfx('vote');
      markVoteSelection('.vote-card[data-id]', targetId);
    };
  });

  wireLikes(state);
  patchVoteCount(state);
}

// Zvýrazní vybranou kartu (hlas jde měnit, dokud hlasování trvá); ostatní zůstávají klepnutelné.
function markVoteSelection(selector, targetId) {
  document.querySelectorAll(selector).forEach((c) => {
    const on = c.getAttribute('data-id') === targetId;
    c.classList.toggle('selected', on);
    c.classList.remove('disabled');
    c.setAttribute('aria-pressed', String(on));
    const chk = c.querySelector('.check');
    if (on && !chk && c.classList.contains('vote-card')) c.insertAdjacentHTML('beforeend', `<div class="check">${icon('check')}</div>`);
    if (!on && chk) chk.remove();
  });
  document.querySelectorAll('.sf-pickable').forEach((g) => g.classList.toggle('has-pick', !!targetId));
  const st = document.getElementById('vote-status');
  if (st) { st.textContent = targetId ? 'Vote sent.' : 'Tap a photo to vote'; st.classList.toggle('is-sent', !!targetId); }
}

// --- Liky pod fotkami (jen pro galerii; počty se hráčům neukazují, vidí jen své srdíčko) ---
const HEART_SVG = '<svg viewBox="0 0 24 24" class="heart-ico" aria-hidden="true"><path d="M7 10v11H3V10h4zm0 0 4.2-7.2c.4-.7 1.3-.9 2-.5.6.4.9 1 .8 1.7L13.4 9H20a2 2 0 0 1 2 2.4l-1.6 8A2 2 0 0 1 18.4 21H7"/></svg>'; // palec nahoru (název konstanty zůstal kvůli stylům)

function likeBtnHtml(targetId) {
  return `<button type="button" class="like-btn" data-like="${targetId}" aria-label="Like" aria-pressed="false">${HEART_SVG}</button>`;
}

// Nastaví vzhled srdíček podle seznamu liknutých cílů (bez překreslení obrazovky).
function applyLikes(ids, popId) {
  const set = new Set(ids || []);
  document.querySelectorAll('.like-btn[data-like]').forEach((b) => {
    const on = set.has(b.getAttribute('data-like'));
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on && popId === b.getAttribute('data-like')) {
      b.classList.remove('pop');
      void b.offsetWidth; // restart animace
      b.classList.add('pop');
    }
  });
}

// Napojí srdíčka; klepnutí přepne like a nikdy nevybere kartu (stopPropagation).
function wireLikes(state) {
  document.querySelectorAll('.like-btn[data-like]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const targetId = b.getAttribute('data-like');
      const on = !b.classList.contains('on');
      send({ type: 'like_photo', targetId, on });
      if (on) playSfx('like'); // jemný „pluck“ při zapnutí palce
      const cur = new Set([...document.querySelectorAll('.like-btn.on')].map((x) => x.getAttribute('data-like')));
      if (on) { cur.clear(); cur.add(targetId); } else cur.delete(targetId); // jen jeden like — nový přesune starý
      applyLikes([...cur], on ? targetId : null);
    };
  });
  applyLikes(state.myLikes);
}

function patchVoteCount(state) {
  if (state.yourVote) {
    votedLocallyFor = state.yourVote;
    markVoteSelection(state.phase === 'twins_voting' ? '.twin-card[data-id]' : '.vote-card[data-id]', state.yourVote);
  }
  applyLikes(state.myLikes);
  const el = document.getElementById('vote-count-text');
  if (el) el.textContent = state.youVoted
    ? `Vote sent (you can change it). ${state.votedCount} / ${state.activeCount} voted…`
    : `${state.votedCount} / ${state.activeCount} voted…`;
  sfSetCount(state.votedCount || 0, state.activeCount || 0);
}

// -------------------------------------------------------------- RESULTS ---

function scoreboardRowsHtml(players) {
  return players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''} ${i === 0 ? 'first' : ''}">
      <span class="sb-player"><span class="rank">${i + 1}</span>${playerNameHtml(p.name, p.looks)}${p.isYou ? '<span class="sf-you">(you)</span>' : ''}</span>
      <span class="num sb-score">${p.score}</span>
    </div>
  `).join('');
}

// hlavní vítěz kola (zoom + koruna + konfety) a ostatní fotky v řádku
function sfWinnerHeroHtml(state, winners, ptsText) {
  const many = winners.length > 1;
  return `<div class="sf-hero ${many ? 'many' : ''}">
    ${winners.map((c) => `
      <div class="sf-hero-card">
        <div class="sf-hero-photo">${c.missed ? sfMissedHtml() : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}</div>
        <span class="sf-crown" aria-hidden="true">${sfCrownSvg()}</span>
        <div class="sf-hero-name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
        ${c.photoOwnerName ? `<div class="sf-hero-sub">On ${escapeHtml(c.photoOwnerName)}'s photo</div>` : ''}
        <div class="sf-hero-sub"><span>${c.votes} ${c.votes === 1 ? 'vote' : 'votes'}</span> · <b>+${c.points} pts</b></div>
      </div>`).join('')}
  </div>`;
}
function sfCrownSvg() {
  return '<svg width="74" height="54" viewBox="0 0 74 54"><path d="M6 18 18 46h38l12-28-17 11L37 6 23 29z" fill="#FFD23F" stroke="#A37A00" stroke-width="4" stroke-linejoin="round"/><circle cx="37" cy="34" r="5" fill="#EF4B5F"/></svg>';
}

function renderResultsScreen(state) {
  mountedKey = `results-${state.round}`;
  stopCamera();
  const r = state.result;

  if (r.kind === 'caption') return renderCaptionResultsScreen(state, r);
  if (r.kind === 'copycat') return renderCopyResultsScreen(state, r);
  if (r.kind === 'twins') return renderTwinResultsScreen(state, r);
  if (r.kind === 'impostor') return renderImpostorResults(state, r);

  const winners = r.cards.filter((c) => c.isWinner && !c.missed);
  const rest = r.cards.filter((c) => !winners.includes(c));
  const restHtml = rest.map((c) => `
    <div class="result-card">
      ${c.missed
        ? sfMissedHtml()
        : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
      <div class="meta">
        <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
        ${c.photoOwnerName ? `<div class="votes">On ${escapeHtml(c.photoOwnerName)}'s photo</div>` : ''}
        ${c.missed ? '' : `<div class="votes">${c.votes} ${c.votes === 1 ? 'vote' : 'votes'}</div>`}
      </div>
    </div>
  `).join('');

  app.innerHTML = `
    <div class="screen sf-g sf-results">
      <div class="sf-res-top">
        <span class="sf-pill">Round ${r.round} / ${state.totalRounds} results</span>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <h1 class="sf-vote-title prompt-text">${escapeHtml(r.prompt)}</h1>
      ${winners.length ? sfWinnerHeroHtml(state, winners) : ''}
      ${rest.length ? `<div class="sf-rest ${winners.length ? '' : 'is-all'}">${restHtml}</div>` : ''}
      ${sfScoreboardHtml(state)}
      ${sfNextBarHtml(state)}
    </div>
  `;
  sfWireNext();
  if (winners.length) sfConfetti(document.querySelector('.sf-hero'));
}

function renderCaptionResultsScreen(state, r) {
  let body;
  if (r.skipped) {
    body = `<p class="subtitle" style="text-align:center;">${escapeHtml(r.subjectName)} didn't snap a photo — the round was skipped, no points.</p>`;
  } else if (!r.captions.length) {
    body = `
      <div class="sf-cap-photo is-small">${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId))}</div>
      <p class="subtitle" style="text-align:center;">Nobody wrote a caption in time — no points.</p>
    `;
  } else {
    const captionsHtml = r.captions.map((c) => `
      <div class="caption-card ${c.isWinner ? 'winner' : ''}">
        ${c.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
        <p>${escapeHtml(c.text)}</p>
        <div class="caption-author">${playerNameHtml(c.name, looksOf(state, c.id))}${c.isWinner ? ` · +${r.points} pts` : ''}</div>
      </div>
    `).join('');
    body = `
      <div class="sf-cap-photo is-small">${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId))}</div>
      <p class="subtitle" style="text-align:center;">${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))} picked the best caption</p>
      <div class="caption-list">${captionsHtml}</div>
    `;
  }

  app.innerHTML = `
    <div class="screen sf-g sf-results">
      <div class="sf-res-top">
        <span class="sf-pill">Round ${r.round} / ${state.totalRounds} results</span>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <h1 class="sf-vote-title"><span>Photo of</span> ${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))}</h1>
      ${body}
      ${sfScoreboardHtml(state)}
      ${sfNextBarHtml(state)}
    </div>
  `;
  sfWireNext();
  if (!r.skipped && r.captions && r.captions.some((c) => c.isWinner)) sfConfetti(document.querySelector('.sf-results .caption-card.winner'));
}

// ------------------------------------------------------------- GAMEOVER ---

function rankGroups(players) {
  const groups = [];
  for (const p of players) {
    const last = groups[groups.length - 1];
    if (last && last.score === p.score) last.players.push(p);
    else groups.push({ score: p.score, players: [p] });
  }
  return groups;
}

const PODIUM_LABEL = { 1: '1st', 2: '2nd', 3: '3rd' };

function buildPodiumHtml(players) {
  const groups = rankGroups(players).slice(0, 3);
  const spots = groups.map((g, i) => ({ place: i + 1, group: g }));
  // vizuální pořadí zleva doprava: 2. – 1. – 3.
  const order = [spots[1], spots[0], spots[2]].filter(Boolean);

  return `<div class="podium">
    ${order.map((s) => `
      <div class="podium-spot place-${s.place}">
        ${s.place === 1 ? `<span class="podium-crown" aria-hidden="true">${sfCrownSvg()}</span>` : ''}
        <div class="podium-avatars">${s.group.players.map((p) => avatarHtml(p.name, p.looks, s.place === 1 ? 84 : 68)).join('')}</div>
        <div class="podium-names">${s.group.players.map((p) => playerNameHtml(p.name, p.looks)).join(' & ')}</div>
        <div class="podium-bar">
          <span class="podium-bar-label" aria-label="${PODIUM_LABEL[s.place]}">${s.place}</span>
          <span class="podium-score num">${s.group.score} pts</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

// Minimální počet hráčů pro start — Impostor ve dvou nedává smysl.
// většina módů se hraje od 3 hráčů, Twins od 4 (hlídá to i server)
function minPlayersFor(mode) {
  return mode === 'twins' ? 6 : 3; // Twins od 6 hráčů (aspoň 3 dvojice)
}

// Mince za dohranou hru: server pošle kolik, připíšou se jen jednou
// (podle gameId), i když gameover obrazovka přijde vícekrát.
function creditGameReward(reward) {
  if (!reward || !reward.gameId || !reward.total) return;
  let done = [];
  try { done = JSON.parse(localStorage.getItem('vyraz_rewarded') || '[]'); } catch { /* ignore */ }
  if (done.includes(reward.gameId)) return;
  const d = shopLoad();
  d.coins += reward.total;
  shopSave(d);
  setTimeout(() => playSfx('coins'), 1300); // až po fanfáře za konec hry
  done.push(reward.gameId);
  try { localStorage.setItem('vyraz_rewarded', JSON.stringify(done.slice(-50))); } catch { /* ignore */ }
}

function rewardCardHtml(reward) {
  if (!reward) return '';
  const rows = [
    ['For finishing', reward.participation],
    ['For your place', reward.place],
    ['For rounds won', reward.rounds],
  ].filter(([, v]) => v > 0);
  return `
    <section class="reward-card sf-reward" aria-label="Coins earned">
      <div class="sf-reward-head"><span>You earned</span><span class="reward-total">${COIN_SVG}<span class="num" id="reward-num" data-to="${reward.total}">+${reward.total}</span></span></div>
      <div class="reward-rows">
        ${rows.map(([label, v]) => `<div><span>${label}</span><span class="num">+${v}</span></div>`).join('')}
      </div>
    </section>`;
}

function renderGameOverScreen(state) {
  mountedKey = 'gameover';
  stopCamera();
  creditGameReward(state.reward);
  const packLabel = state.mode !== 'caption' && state.mode !== 'hunt' && state.mode !== 'copycat' && QUESTION_PACK_INFO[state.promptPack]
    ? ` · ${QUESTION_PACK_INFO[state.promptPack].label}` : '';

  app.innerHTML = `
    <div class="screen sf-g sf-over">
      <div class="sf-over-head">
        <h1>Game over!</h1>
        <span class="sf-over-sub">${state.totalRounds} rounds · ${modeDisplayName(state.mode)}${packLabel}</span>
        <span class="sf-sr winners-line">${state.players.filter((p) => state.winners.includes(p.name)).map((p) => playerNameHtml(p.name, p.looks)).join(' & ')} ${state.winners.length > 1 ? '<span>win the game!</span>' : '<span>wins the game!</span>'}</span>
      </div>

      ${buildPodiumHtml(state.players)}

      ${rewardCardHtml(state.reward)}

      <section class="sf-card sf-sb">
        <h2 class="sf-h3">Final standings</h2>
        <div class="scoreboard">${scoreboardRowsHtml(state.players)}</div>
      </section>

      ${galleryHtml(state)}

      <div class="sf-start-bar sf-over-bar">
        ${state.isHost
          ? `<button id="again-btn" class="btn btn-primary btn-block sf-start">Play again</button>`
          : `<p class="sf-wait-host"><span class="sf-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Waiting for the host to start a new game…</span></p>`}
        <button id="menu-btn" class="btn btn-ghost btn-block">Main menu</button>
      </div>
    </div>
  `;

  if (state.isHost) {
    document.getElementById('again-btn').onclick = () => send({ type: 'play_again' });
  }
  document.getElementById('menu-btn').onclick = leaveLobby;
  wireGallery(state);
  sfConfetti(document.querySelector('.podium'));
  const rn = document.getElementById('reward-num');
  if (rn) sfCountUp(rn, Number(rn.dataset.to) || 0);
}

// ------------------------------------------------------------ DISPATCH ---

function renderApp(state) {
  // Hostitel spustil zamčený mód na vstupenku → vstupenka se spotřebuje.
  if (state.isHost && lastState && lastState.phase === 'lobby' && state.phase !== 'lobby'
      && lastState.code === state.code && !isModeUnlocked(state.mode)) {
    useTicket(state.mode);
  }
  playPhaseSounds(lastState, state);
  lastState = state;

  playMusic(state.phase === 'lobby' ? 'lobby' : 'main');

  // GAMES VISUAL PASS 2026-10-05: třída módu na body (akcentní barva módu v CSS)
  for (const c of [...document.body.classList]) if (c.startsWith('gm-')) document.body.classList.remove(c);
  if (state.mode) document.body.classList.add('gm-' + state.mode);
  document.body.classList.toggle('imp-role', !!state.isImpostor); // hráč s rolí impostora zůstane v červené

  if (state.phase === 'lobby') return renderLobbyScreen(state);

  if (state.phase === 'submitting') {
    if (state.youSubmitted || submittedLocally) {
      if (!mountedKey.startsWith('submitting-waiting')) buildWaitingView(state);
      else patchWaitingCount(state);
    } else {
      if (!mountedKey.startsWith('submitting-camera')) buildCameraView(state);
      else sfPatchSnapped(state); // jinak necháváme kameru běžet, jen aktualizujeme "x of y snapped"
    }
    return;
  }

  if (state.phase === 'drawing') {
    if (state.youDone || drawDoneLocally) {
      if (mountedKey !== `draw-waiting-${state.round}`) buildDrawWaitingView(state);
      else patchDrawCount(state);
    } else if (mountedKey !== `draw-canvas-${state.round}`) {
      buildDrawingView(state);
    }
    return;
  }

  if (state.phase === 'voting') {
    if (mountedKey !== `voting-${state.round}`) buildVotingView(state);
    else patchVoteCount(state);
    return;
  }

  if (state.phase === 'impostor_voting') {
    if (mountedKey !== `ivote-${state.round}`) buildImpostorVotingView(state);
    else patchImpostorVoting(state);
    return;
  }

  if (renderTwinsPhase(state)) return;
  if (renderCopycatPhase(state)) return;

  if (state.phase === 'subject_photo') {
    if (state.isSubject) {
      if (mountedKey !== `subject-photo-${state.round}`) buildSubjectPhotoView(state);
    } else if (mountedKey !== `subject-wait-${state.round}`) {
      buildSubjectWaitView(state);
    }
    return;
  }

  if (state.phase === 'captioning') {
    const expected = state.isSubject
      ? `captioning-subject-${state.round}`
      : state.youCaptioned
        ? `captioning-done-${state.round}`
        : `captioning-write-${state.round}`;
    if (mountedKey !== expected) buildCaptioningView(state);
    else patchCaptionCount(state);
    return;
  }

  if (state.phase === 'judging') {
    if (mountedKey !== `judging-${state.round}`) buildJudgingView(state);
    return;
  }

  if (state.phase === 'results') return renderResultsScreen(state);
  if (state.phase === 'gameover') return renderGameOverScreen(state);
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
}

// countdown ticker — nezávislý na příchozích zprávách, ať je plynulý
setInterval(() => {
  if (!lastState || !lastState.deadlineAt) return;
  const el = document.getElementById('timer-el');
  if (!el) return;
  const remaining = Math.max(0, Math.ceil((lastState.deadlineAt - Date.now()) / 1000));
  if (el.classList.contains('sf-ring')) sfTickRing(el, lastState.deadlineAt, remaining);
  else {
    el.innerHTML = `${icon('timer')}<span>${remaining}s</span>`;
    el.classList.toggle('low', remaining <= 5);
  }
  timerSounds(lastState.deadlineAt, remaining);
  // ~1 s před koncem odešli rozdělanou práci (server přepne fázi přesně při vypršení času)
  if (autoPartial && autoPartial.key === mountedKey && autoPartial.firedFor !== lastState.deadlineAt
      && lastState.deadlineAt - Date.now() <= 1100) {
    autoPartial.firedFor = lastState.deadlineAt;
    try { autoPartial.fire(); } catch { /* nic */ }
  }
}, 250);

// Tiknutí každou vteřinu v posledních 5 s a zvuk, když čas vyprší —
// každé zvuky jen jednou pro danou vteřinu a daný odpočet.
let tickDeadline = null;
let tickLastSecond = null;
let timeUpPlayedFor = null; // pro který odpočet už zazněl konec času
function timerSounds(deadlineAt, remaining) {
  if (tickDeadline !== deadlineAt) { tickDeadline = deadlineAt; tickLastSecond = remaining; return; }
  if (remaining === tickLastSecond) return;
  tickLastSecond = remaining;
  if (remaining === 0) playTimeUp(deadlineAt);
  else if (remaining <= 5) playSfx('timer-tick');
}

function playTimeUp(deadlineAt) {
  if (timeUpPlayedFor === deadlineAt) return;
  timeUpPlayedFor = deadlineAt;
  playSfx('time-up');
}

// Zvuky při přechodech mezi fázemi (porovná předchozí a nový stav).
function playPhaseSounds(prev, state) {
  if (!prev || prev.code !== state.code) return; // právě jsem se připojil — nic
  // Server přepne fázi přesně ve chvíli, kdy vyprší čas — odpočet tedy „0 s“
  // nikdy neukáže. Konec času poznáme tak, že skončil předchozí odpočet.
  // (Když všichni stihnou dřív, fáze se přepne před koncem a zvuk nezazní.)
  if (prev.deadlineAt && prev.deadlineAt !== state.deadlineAt && Date.now() >= prev.deadlineAt - 600) {
    playTimeUp(prev.deadlineAt);
  }
  if (prev.phase === 'lobby' && state.phase === 'lobby' && state.players.length > prev.players.length) playSfx('player-join');
  if ((state.joinRequests || []).length > (prev.joinRequests || []).length) playSfx('player-join');
  if (prev.phase === 'lobby' && state.phase !== 'lobby') playSfx('game-start');
  if (state.phase === 'results' && prev.phase !== 'results') {
    // Reaction → „wow“, Main Character → smích publika, ostatní módy dál potvrzovací zvuk
    playSfx(state.mode === 'classic' ? 'round-wow' : state.mode === 'caption' ? 'round-laugh' : 'round-results');
  }
  if (state.phase === 'gameover' && prev.phase !== 'gameover') playSfx('win');
}

// Úvodní splash (index.html) zmizí, jakmile se naváže spojení — nejdřív po 1 s, nejpozději po 7 s.
const splashShownAt = Date.now();
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.dataset.leaving) return;
  el.dataset.leaving = '1';
  setTimeout(() => {
    el.classList.add('is-hiding');
    setTimeout(() => el.remove(), 360);
  }, Math.max(0, 1000 - (Date.now() - splashShownAt)));
}
setTimeout(hideSplash, 7000);

renderStartScreen();
connect();
