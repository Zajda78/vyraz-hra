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
      if (msg.phase !== 'voting') votedLocallyFor = null;
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
  clearTimeout(errorTimer);
  let el = document.getElementById('error-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'error-banner';
    el.className = 'error-banner';
    el.style.position = 'fixed';
    el.style.left = '16px';
    el.style.right = '16px';
    el.style.bottom = '16px';
    el.style.zIndex = '999';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
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
      { id: 'classic', name: 'Reaction', tagline: 'React to the prompt — best face wins', players: 3, bg: () => MODE_ICON_CAMERA },
      { id: 'caption', name: 'Main Character', tagline: 'One photo, everyone captions it', players: 3, bg: () => MODE_ICON_SPEECH },
    ],
  },
  {
    title: 'PARTY PACK',
    partyPack: true, // placené módy — zlaté štítky u zamčených
    modes: [
      { id: 'draw', name: 'Doodle', tagline: 'Snap a selfie, doodle on it, vote', players: 3, bg: () => MODE_ICON_PALETTE },
      { id: 'impostor', name: 'Impostor', tagline: 'One player got a different prompt', players: 3, bg: () => MODE_ICON_SPY },
      { id: 'hunt', name: 'Snap Hunt', tagline: 'Find the thing, snap it, vote', players: 3, bg: () => MODE_ICON_LOUPE },
      { id: 'copycat', name: 'Copycat', tagline: 'Copy the face, best copy wins', players: 3, bg: () => MODE_ICON_COPY },
    ],
  },
];

function modeMenuHtml() {
  return MODE_MENU.map((group) => `
    <div class="mode-group-head">
      <div class="section-eyebrow">${group.title}</div>
    </div>
    <div class="mode-grid">
      ${group.modes.map((m) => `
        <div class="mode-card mode-card-${m.id} ${m.wide ? 'wide' : 'compact'} ${isModeUnlocked(m.id) ? '' : 'is-locked'}" data-mode="${m.id}">
          <div class="mode-icon-bg">${m.bg()}</div>
          ${group.partyPack && !isModeUnlocked(m.id) ? modeRibbonHtml(m.id, { compact: !m.wide }) : ''}
          <div class="mode-card-content">
            ${modeTile(m.id)}
            <h3>${m.name}${m.isNew ? '<span class="mode-new-tag">NEW</span>' : ''}</h3>
            <p>${escapeHtml(m.tagline)}</p>
            <span class="mode-players">${icon('users')} ${m.players}+</span>
          </div>
        </div>`).join('')}
    </div>`).join('');
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
  return 'Reaction';
}

function brandHtml(state) {
  const modeName = modeDisplayName(state?.mode);
  const inGame = state && state.phase && state.phase !== 'lobby';
  return `<div class="brand game-brand"><img class="mark" src="icon.svg" alt=""><h1>${modeName}</h1>
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
  `);
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
      <div class="brand"><img class="mark" src="icon.svg" alt=""><h1>face-it</h1>${devBadgeHtml()}</div>
      <div class="home-actions">
        <button id="rules-btn" class="text-btn">Rules</button>
        <button id="settings-btn" class="icon-btn" title="Settings">${icon('gear')}</button>
      </div>
    </div>

    ${profileCardHtml()}

    <div class="screen">
      <div class="join-card">
        <h2>Join a game</h2>
        <div class="code-boxes" id="code-boxes">
          ${Array.from({ length: CODE_LEN }).map((_, i) => `<div class="code-box" data-i="${i}"></div>`).join('')}
          <input class="code-hidden-input" id="code-hidden" maxlength="${CODE_LEN}" autocomplete="off" autocapitalize="characters" inputmode="text">
        </div>
      </div>

      ${modeMenuHtml()}

    </div>
    ${bottomNavHtml('games')}
  `;
  document.body.classList.add('has-bottom-nav');
  wireBottomNav();

  const hidden = document.getElementById('code-hidden');
  const boxesWrap = document.getElementById('code-boxes');

  function renderCodeBoxes() {
    boxesWrap.querySelectorAll('.code-box').forEach((box, i) => {
      box.textContent = joinCode[i] || '';
      box.classList.toggle('filled', !!joinCode[i]);
      box.classList.toggle('active', i === joinCode.length);
    });
  }
  renderCodeBoxes();

  boxesWrap.addEventListener('click', () => hidden.focus());

  hidden.addEventListener('input', () => {
    joinCode = hidden.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN);
    hidden.value = joinCode;
    renderCodeBoxes();
    if (joinCode.length === CODE_LEN) {
      hidden.blur();
      attemptJoin(joinCode);
    }
  });

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

function openModal(html) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-sheet">${html}</div>`;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
  document.body.appendChild(backdrop);
  return backdrop;
}

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

// Nastavení — jen povolení kamery (jméno se mění v profilu přes tužku).
function showSettingsModal() {
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="modal-settings-close" aria-label="Close">${icon('close')}</button></div>
    <h2>Settings</h2>
    <div class="setting-block-title">${icon('chat')} Language</div>
    ${languagePickerHtml()}
    ${volumeSlidersHtml()}
    <button id="modal-camera-test" class="btn btn-primary btn-block" type="button">${icon('camera')} Allow camera access</button>
    <p class="camera-status" id="modal-camera-status"></p>
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

  modal.querySelector('#modal-camera-test').onclick = async () => {
    const statusEl = modal.querySelector('#modal-camera-status');
    statusEl.innerHTML = 'Asking your browser for access…';
    statusEl.className = 'camera-status';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      statusEl.innerHTML = `${icon('checkCircle')} Camera is allowed and working.`;
      statusEl.className = 'camera-status ok';
    } catch (err) {
      statusEl.innerHTML = `${icon('xCircle')} Couldn't access the camera. Check the camera permission for this site in your phone settings.`;
      statusEl.className = 'camera-status bad';
    }
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
    'Each round everyone gets the same photo prompt, except one random player — the impostor — who gets a different one: sometimes very similar, sometimes completely different.',
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

function showRulesModal(initialMode = 'classic') {
  const modes = ['classic', 'draw', 'caption', 'impostor', 'hunt', 'copycat'];
  openModal(`
    <h2>How to play</h2>
    <div class="rules-tabs">
      ${modes.map((m) => `
        <button class="rules-tab rules-tab-${m}" data-mode="${m}">
          ${modeTile(m)}
          <span>${modeDisplayName(m)}</span>
        </button>`).join('')}
    </div>
    <div class="rules-list" id="rules-list"></div>
    <button class="modal-close" id="modal-rules-close">Close</button>
  `);

  function show(mode) {
    document.querySelectorAll('.rules-tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    document.getElementById('rules-list').innerHTML = RULES_BY_MODE[mode]
      .map((t, i) => `<div class="item"><span class="num">${i + 1}</span><span>${escapeHtml(t)}</span></div>`)
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
  app.innerHTML = `
    <div class="lobby-top">
      <button id="back-btn" class="back-btn" title="Back to home">${icon('back')}</button>
      ${brandHtml(state)}
    </div>
    <div class="screen ${state.pending ? 'lobby-pending' : ''}">
      <div class="code-display ${state.pending ? 'is-pending' : ''}">${state.pending ? '<span></span><span></span><span></span><span></span>' : escapeHtml(state.code)}</div>
      ${!state.isHost && promptPackBadge(state) ? `<div style="text-align:center">${promptPackBadge(state)}</div>` : ''}
      <button class="btn btn-ghost btn-block invite-btn" id="invite-btn">${icon('users')} Invite friends</button>


      ${joinRequestsHtml(state)}

      <div class="card">
        <h3 style="margin-bottom:12px;">Players (${players.length})</h3>
        <div class="player-list">
          ${players.map((p) => `
            <div class="player-row">
              <span class="name"><span class="dot ${p.connected ? '' : 'off'}"></span>${avatarHtml(p.name, p.looks, 34)}${playerNameHtml(p.name, p.looks)}${p.isYou ? ' (you)' : ''}</span>
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
        </div>
      </div>

      ${state.isHost ? `
        ${state.mode !== 'caption' && state.mode !== 'hunt' && state.mode !== 'copycat' ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('chat')} Question pack</h3>
            ${packPickerHtml(state.promptPack)}
          </div>
        ` : ''}

        <div class="card setting-card">
          <h3 class="setting-title">${icon('rounds')} Rounds</h3>
          ${optionPicker('rounds', ROUND_OPTIONS, state.totalRounds)}
        </div>

        ${state.drawEnabled ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('brush')} Doodle time</h3>
            ${optionPicker('draw-seconds', DRAW_SECONDS_OPTIONS, state.drawSeconds, 's')}
          </div>
        ` : ''}

        ${state.mode === 'hunt' ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('search')} What to hunt</h3>
            ${huntPackPickerHtml(state.huntPack)}
          </div>
          <div class="card setting-card">
            <h3 class="setting-title">${icon('timer')} Hunt time</h3>
            ${optionPicker('hunt-seconds', HUNT_SECONDS_OPTIONS, state.huntSeconds, 's')}
          </div>
        ` : ''}

        ${state.mode === 'caption' ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('timer')} Caption time</h3>
            ${optionPicker('caption-seconds', CAPTION_SECONDS_OPTIONS, state.captionSeconds, 's')}
          </div>
        ` : ''}

        ${state.mode === 'copycat' ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('timer')} Photo shown for</h3>
            ${optionPicker('peek-seconds', PEEK_SECONDS_OPTIONS, state.peekSeconds, 's')}
          </div>
        ` : ''}

        ${addBotButtonHtml(state)}
        <button id="start-btn" class="btn btn-primary btn-block" ${players.length < minPlayersFor(state.mode) ? 'disabled' : ''}>
          ${players.length < minPlayersFor(state.mode)
            ? `Need at least ${minPlayersFor(state.mode)} players`
            : isModeUnlocked(state.mode) ? 'Start game' : `Start game ${icon('ticket')} 1`}
        </button>
      ` : `
        <p class="subtitle" style="text-align:center;">Waiting for the host (${escapeHtml(players.find((p) => p.isHost)?.name || '')}) to start…</p>
      `}
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
  app.innerHTML = `
    <div class="screen center join-pending">
      <div class="x-close-row"><button class="x-close" id="cancel-join" aria-label="Cancel">${icon('close')}</button></div>
      <div class="code-display">${escapeHtml(msg.code)}</div>
      <div class="join-pending-spinner"></div>
      <h2>Waiting for the host</h2>
      <p class="join-pending-host">${msg.hostName ? `${escapeHtml(msg.hostName)} has to let you in` : 'The host has to let you in'}</p>
    </div>`;
  document.getElementById('cancel-join').onclick = () => {
    send({ type: 'cancel_join' });
    renderStartScreen();
  };
}

function joinRequestsHtml(state) {
  const reqs = state.joinRequests || [];
  if (!state.isHost || !reqs.length) return '';
  return `
    <div class="card join-requests">
      <h3>Wants to join (${reqs.length})</h3>
      ${reqs.map((r) => `
        <div class="player-row">
          <span class="name">${avatarHtml(r.name, r.looks, 34)}${playerNameHtml(r.name, r.looks)}</span>
          <span class="player-row-actions">
            <button class="req-btn req-yes" data-approve="${r.id}" aria-label="Let in">${icon('check')}</button>
            <button class="req-btn req-no" data-deny="${r.id}" aria-label="Decline">${icon('close')}</button>
          </span>
        </div>`).join('')}
    </div>`;
}

function wireLobbyHostControls() {
  document.querySelectorAll('[data-approve]').forEach((b) => { b.onclick = () => send({ type: 'approve_join', id: b.dataset.approve }); });
  document.querySelectorAll('[data-deny]').forEach((b) => { b.onclick = () => send({ type: 'deny_join', id: b.dataset.deny }); });
  document.querySelectorAll('[data-kick]').forEach((b) => {
    b.onclick = () => {
      const modal = openModal(`
        <div class="x-close-row"><button class="x-close" id="kick-cancel" aria-label="Close">${icon('close')}</button></div>
        <h2>Remove ${b.dataset.name}?</h2>
        <button class="btn btn-danger btn-block" id="kick-yes">Remove from lobby</button>
      `);
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
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds}</div>
        ${roleBadgeHtml(state)}
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      <div class="timer" id="timer-el">--</div>
      <div class="camera-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <div class="flash" id="flash-el"></div>
      </div>
      <div class="shutter-row">
        <button id="shutter-btn" class="shutter" title="Take photo"></button>
        ${state.mode === 'hunt' ? `<button id="flip-btn" class="flip-cam-btn" aria-label="Flip camera">${icon('flip')}</button>` : ''}
      </div>
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

// Spustí kameru podle cameraFacing do #cam-video.
async function startCameraStream() {
  const video = document.getElementById('cam-video');
  if (!video) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false,
    });
    video.srcObject = cameraStream;
    video.classList.toggle('rear', cameraFacing === 'environment');
  } catch (err) {
    document.querySelector('.camera-wrap').innerHTML = `
      <div class="missed" style="justify-content:center;">
        <span class="emoji">${icon('cameraOff')}</span>
        <span>Couldn't access the camera.<br>Check your browser permissions.</span>
      </div>`;
  }
}

function capturePhoto() {
  const video = document.getElementById('cam-video');
  if (!video || !video.videoWidth) return;
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
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds}</div>
        ${roleBadgeHtml(state)}
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      ${lastSentPhoto && lastSentPhoto.round === state.round
        ? `<div class="sent-photo"><img src="${lastSentPhoto.url}" alt=""><span class="sent-check">${icon('check')}</span></div>`
        : bigIcon('checkCircle', 'good')}
      <h3>Photo sent!</h3>
      <p class="subtitle" id="wait-count-text">Waiting for the others…</p>
      <div class="timer" id="timer-el">--</div>
    </div>
  `;
  patchWaitingCount(state);
}

function patchWaitingCount(state) {
  const el = document.getElementById('wait-count-text');
  if (el) el.textContent = `${state.submittedCount} / ${state.activeCount} players done…`;
}

// ------------------------------------------------------------ POPISOVÁNKA ---

async function buildSubjectPhotoView(state) {
  mountedKey = `subject-photo-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">You're the main character! Snap yourself — everyone else will caption what's going on.</div>
      </div>
      <div class="camera-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <div class="flash" id="flash-el"></div>
      </div>
      <div class="shutter-row">
        <button id="shutter-btn" class="shutter" title="Vyfotit"></button>
      </div>
    </div>
  `;

  const video = document.getElementById('cam-video');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false,
    });
    video.srcObject = cameraStream;
  } catch (err) {
    document.querySelector('.camera-wrap').innerHTML = `
      <div class="missed" style="justify-content:center;">
        <span class="emoji">${icon('cameraOff')}</span>
        <span>Couldn't access the camera.<br>Check your browser permissions.</span>
      </div>`;
  }

  document.getElementById('shutter-btn').onclick = () => capturePhoto();
}

function buildSubjectWaitView(state) {
  mountedKey = `subject-wait-${state.round}`;
  stopCamera();
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      ${bigIcon('camera')}
      <p class="subtitle" style="text-align:center;">Waiting for ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} to snap a photo…</p>
    </div>
  `;
}

function buildCaptioningView(state) {
  stopCamera();

  if (state.isSubject) {
    mountedKey = `captioning-subject-${state.round}`;
    app.innerHTML = `
      ${brandHtml(state)}
      <div class="screen center">
        ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:260px; width:100%;')}
        <p class="subtitle">Everyone is captioning your photo…</p>
        <p class="wait-note" id="caption-count-text"></p>
        <div class="timer" id="timer-el">--</div>
      </div>
    `;
    patchCaptionCount(state);
    return;
  }

  if (state.youCaptioned) {
    mountedKey = `captioning-done-${state.round}`;
    app.innerHTML = `
      ${brandHtml(state)}
      <div class="screen center">
        ${bigIcon('checkCircle', 'good')}
        <p class="subtitle">Caption sent!</p>
        <p class="wait-note" id="caption-count-text"></p>
        <div class="timer" id="timer-el">--</div>
      </div>
    `;
    patchCaptionCount(state);
    return;
  }

  mountedKey = `captioning-write-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">What's going on in ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))}'s photo? Write a caption.</div>
      </div>
      <div class="timer" id="timer-el">--</div>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:260px; width:100%; margin:0 auto;')}
      <div class="field">
        <textarea id="caption-input" class="caption-textarea" maxlength="140" rows="3" placeholder="e.g. Just watched the bus leave without him…"></textarea>
      </div>
      <button id="caption-submit" class="btn btn-primary btn-block">Send caption</button>
    </div>
  `;
  document.getElementById('caption-submit').onclick = () => {
    const text = document.getElementById('caption-input').value.trim();
    if (!text) return showError('Write a caption first.');
    send({ type: 'submit_caption', text });
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
    <div class="caption-card ${state.isSubject ? '' : 'readonly'}" data-id="${c.id}">
      <p>${escapeHtml(c.text)}</p>
    </div>
  `).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds} — pick</div>
        <div class="prompt-text">${state.isSubject
          ? 'Pick the best caption for your photo.'
          : `${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} is picking the best caption…`}</div>
      </div>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:220px; width:100%; margin:0 auto 18px;')}
      <div class="caption-list">${cardsHtml || '<p class="wait-note">Nobody wrote a caption in time.</p>'}</div>
    </div>
  `;

  if (state.isSubject) {
    document.querySelectorAll('.caption-card[data-id]').forEach((el) => {
      el.onclick = () => {
        document.querySelectorAll('.caption-card').forEach((c) => c.classList.add('disabled'));
        el.classList.remove('disabled');
        el.classList.add('picked');
        send({ type: 'pick_caption', authorId: el.getAttribute('data-id') });
        playSfx('vote');
      };
    });
  }
}

// --------------------------------------------------------------- DRAWING ---

const DRAW_COLORS = ['#ffffff', '#111111', '#F0483A', '#F0B429', '#3FAE6B', '#1C5D99'];

function buildDrawingView(state) {
  mountedKey = `draw-canvas-${state.round}`;
  stopCamera();

  if (state.youMissed) {
    drawDoneLocally = true;
    buildDrawWaitingView(state);
    return;
  }

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds} — doodle time</div>
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      <div class="timer" id="timer-el">--</div>
      <div class="camera-wrap draw-stage">
        <img id="draw-photo" src="${state.yourPhotoDataUrl}">
        <canvas id="draw-canvas"></canvas>
      </div>
      <div class="swatches" id="swatches">
        ${DRAW_COLORS.map((c, i) => `<button class="swatch ${i === 0 ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
      </div>
      <div class="btn-row">
        <button id="draw-clear" class="btn btn-ghost btn-block">Clear</button>
        <button id="draw-done" class="btn btn-primary btn-block">Done</button>
      </div>
    </div>
  `;

  const stage = document.querySelector('.draw-stage');
  const img = document.getElementById('draw-photo');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  let color = DRAW_COLORS[0];
  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function sizeCanvas() {
    const rect = stage.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
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
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = posFromEvent(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x;
    lastY = p.y;
  }
  function end() { drawing = false; }

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);

  document.querySelectorAll('.swatch').forEach((sw) => {
    sw.onclick = () => {
      color = sw.getAttribute('data-color');
      document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s === sw));
    };
  });

  document.getElementById('draw-clear').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('draw-done').onclick = () => finishDrawing(img, canvas);
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
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      ${bigIcon('brush')}
      <h3>${state.youMissed ? 'Nothing to doodle this time' : 'Doodle done!'}</h3>
      <p class="subtitle" id="draw-count-text">Waiting for the others…</p>
      <div class="timer" id="timer-el">--</div>
    </div>
  `;
  patchDrawCount(state);
}

function patchDrawCount(state) {
  const el = document.getElementById('draw-count-text');
  if (el) el.textContent = `${state.doneCount} / ${state.activeCount} players done…`;
}

// --------------------------------------------------------------- VOTING ---

function buildVotingView(state) {
  mountedKey = `voting-${state.round}`;
  const cardsHtml = state.cards.map((c) => {
    if (c.isOwn) {
      return `
        <div class="vote-card own">
          ${c.photoDataUrl ? `<img src="${c.photoDataUrl}">` : `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`}
          <div class="tag">Yours – can't vote</div>
        </div>`;
    }
    if (c.missed) {
      return `
        <div class="vote-card disabled">
          <div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>
        </div>`;
    }
    return `
      <div class="vote-card" data-id="${c.id}">
        <img src="${c.photoDataUrl}">
      </div>`;
  }).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds} — vote</div>
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      <div class="timer" id="timer-el">--</div>
      <div class="grid" id="vote-grid">${cardsHtml}</div>
      <p class="wait-note" id="vote-count-text"></p>
    </div>
  `;

  document.querySelectorAll('.vote-card[data-id]').forEach((el) => {
    el.onclick = () => {
      if (votedLocallyFor) return;
      const targetId = el.getAttribute('data-id');
      votedLocallyFor = targetId;
      send({ type: 'cast_vote', targetId });
      playSfx('vote');
      document.querySelectorAll('.vote-card[data-id]').forEach((c) => {
        c.classList.toggle('selected', c === el);
        if (c !== el) c.classList.add('disabled');
      });
      el.insertAdjacentHTML('beforeend', `<div class="check">${icon('check')}</div>`);
    };
  });

  patchVoteCount(state);
}

function patchVoteCount(state) {
  const el = document.getElementById('vote-count-text');
  if (el) el.textContent = state.youVoted
    ? `Vote sent. ${state.votedCount} / ${state.activeCount} voted…`
    : `${state.votedCount} / ${state.activeCount} voted…`;
}

// -------------------------------------------------------------- RESULTS ---

function scoreboardRowsHtml(players) {
  return players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''}">
      <span class="sb-player"><span class="rank">${i + 1}.</span>${avatarHtml(p.name, p.looks, 28)}${playerNameHtml(p.name, p.looks)}</span>
      <span class="num" style="color:var(--gold); font-weight:700;">${p.score}</span>
    </div>
  `).join('');
}

function renderResultsScreen(state) {
  mountedKey = `results-${state.round}`;
  stopCamera();
  const r = state.result;

  if (r.kind === 'caption') return renderCaptionResultsScreen(state, r);
  if (r.kind === 'copycat') return renderCopyResultsScreen(state, r);
  if (r.kind === 'impostor') return renderImpostorResults(state, r);

  const cardsHtml = r.cards.map((c) => `
    <div class="result-card ${c.isWinner ? 'winner' : ''}">
      ${c.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
      ${c.missed
        ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`
        : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
      <div class="meta">
        <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
        ${c.missed ? '' : `<div class="votes">${c.votes} ${c.votes === 1 ? 'vote' : 'votes'} · +${c.points} pts</div>`}
      </div>
    </div>
  `).join('');

  const scoreboardHtml = state.players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''}">
      <span class="sb-player"><span class="rank">${i + 1}.</span>${avatarHtml(p.name, p.looks, 28)}${playerNameHtml(p.name, p.looks)}</span>
      <span class="num" style="color:var(--gold); font-weight:700;">${p.score}</span>
    </div>
  `).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Round ${r.round} / ${state.totalRounds} results</div>
        <div class="prompt-text">${escapeHtml(r.prompt)}</div>
      </div>
      <div class="grid">${cardsHtml}</div>

      <div class="card">
        <h3 style="margin-bottom:10px;">Scoreboard</h3>
        <div class="scoreboard">${scoreboardHtml}</div>
      </div>

      ${state.isHost
        ? `<button id="next-btn" class="btn btn-primary btn-block">${state.round >= state.totalRounds ? 'Show final results' : 'Next round'}</button>`
        : `<p class="wait-note">Waiting for the host to start the next round…</p>`}
    </div>
  `;

  if (state.isHost) {
    document.getElementById('next-btn').onclick = () => send({ type: 'next_round' });
  }
}

function renderCaptionResultsScreen(state, r) {
  let body;
  if (r.skipped) {
    body = `<p class="subtitle" style="text-align:center;">${escapeHtml(r.subjectName)} didn't snap a photo — the round was skipped, no points.</p>`;
  } else if (!r.captions.length) {
    body = `
      ${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId), 'max-width:220px; width:100%; margin:0 auto 16px;')}
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
      ${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId), 'max-width:220px; width:100%; margin:0 auto 16px;')}
      <p class="subtitle" style="text-align:center;">${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))} picked the best caption</p>
      <div class="caption-list">${captionsHtml}</div>
    `;
  }

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Round ${r.round} / ${state.totalRounds} results</div>
        <div class="prompt-text">${tr('Photo of', getLang())} ${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))}</div>
      </div>
      ${body}
      <div class="card">
        <h3 style="margin-bottom:10px;">Scoreboard</h3>
        <div class="scoreboard">${scoreboardRowsHtml(state.players)}</div>
      </div>
      ${state.isHost
        ? `<button id="next-btn" class="btn btn-primary btn-block">${state.round >= state.totalRounds ? 'Show final results' : 'Next round'}</button>`
        : `<p class="wait-note">Waiting for the host to start the next round…</p>`}
    </div>
  `;

  if (state.isHost) {
    document.getElementById('next-btn').onclick = () => send({ type: 'next_round' });
  }
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
        <span class="podium-medal">${medalSvg(s.place)}</span>
        <div class="podium-avatars">${s.group.players.map((p) => avatarHtml(p.name, p.looks, s.place === 1 ? 52 : 40)).join('')}</div>
        <div class="podium-names">${s.group.players.map((p) => playerNameHtml(p.name, p.looks)).join(' & ')}</div>
        <div class="podium-score num">${s.group.score} pts</div>
        <div class="podium-bar">
          <span class="podium-bar-label">${PODIUM_LABEL[s.place]}</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

// Minimální počet hráčů pro start — Impostor ve dvou nedává smysl.
// všechny módy se hrají od 3 hráčů (hlídá to i server)
function minPlayersFor() {
  return 3;
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
    <div class="reward-card">
      <div class="reward-total">${COIN_SVG}<span class="num">+${reward.total}</span></div>
      <div class="reward-rows">
        ${rows.map(([label, v]) => `<div><span>${label}</span><span class="num">+${v}</span></div>`).join('')}
      </div>
    </div>`;
}

function renderGameOverScreen(state) {
  mountedKey = 'gameover';
  stopCamera();
  creditGameReward(state.reward);
  const scoreboardHtml = state.players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''}">
      <span class="sb-player"><span class="rank">${i + 1}.</span>${avatarHtml(p.name, p.looks, 28)}${playerNameHtml(p.name, p.looks)}</span>
      <span class="num" style="color:var(--gold); font-weight:700;">${p.score}</span>
    </div>
  `).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="winners-line">${state.players.filter((p) => state.winners.includes(p.name)).map((p) => playerNameHtml(p.name, p.looks)).join(' & ')}</div>
      <p class="subtitle">${state.winners.length > 1 ? 'win the game!' : 'wins the game!'}</p>

      ${buildPodiumHtml(state.players)}

      ${rewardCardHtml(state.reward)}

      <div class="card" style="width:100%;">
        <h3 style="margin-bottom:10px;">Final standings</h3>
        <div class="scoreboard">${scoreboardHtml}</div>
      </div>

      ${state.isHost
        ? `<div class="btn-row">
            <button id="again-btn" class="btn btn-primary btn-block">Play again</button>
            <button id="menu-btn" class="btn btn-ghost btn-block">Main menu</button>
          </div>`
        : `<p class="wait-note">Waiting for the host to start a new game…</p>
           <button id="menu-btn" class="btn btn-ghost btn-block">Main menu</button>`}
    </div>
  `;

  if (state.isHost) {
    document.getElementById('again-btn').onclick = () => send({ type: 'play_again' });
  }
  document.getElementById('menu-btn').onclick = leaveLobby;
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

  if (state.phase === 'lobby') return renderLobbyScreen(state);

  if (state.phase === 'submitting') {
    if (state.youSubmitted || submittedLocally) {
      if (!mountedKey.startsWith('submitting-waiting')) buildWaitingView(state);
      else patchWaitingCount(state);
    } else {
      if (!mountedKey.startsWith('submitting-camera')) buildCameraView(state);
      // jinak necháváme kameru běžet, nic nepřekreslujeme
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
  el.innerHTML = `${icon('timer')}<span>${remaining}s</span>`;
  el.classList.toggle('low', remaining <= 5);
  timerSounds(lastState.deadlineAt, remaining);
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
  if (state.phase === 'results' && prev.phase !== 'results') playSfx('round-results');
  if (state.phase === 'gameover' && prev.phase !== 'gameover') playSfx('win');
}

renderStartScreen();
connect();
