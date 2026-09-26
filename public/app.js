const app = document.getElementById('app');

let ws = null;
let lastState = null;
let mountedKey = null;
let cameraStream = null;
let submittedLocally = false;
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

function send(obj) {
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
      if (msg.phase !== 'submitting') submittedLocally = false;
      if (msg.phase !== 'drawing') drawDoneLocally = false;
      if (msg.phase !== 'voting') votedLocallyFor = null;
      if (msg.code && msg.youId) saveSession(msg.code, msg.youId);
      renderApp(msg);
    } else if (msg.type === 'error') {
      showError(msg.message);
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
        <p>Připojování k serveru…</p>
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

const MODE_ICON_SPEECH = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 8 C90 8 114 26 114 48 C114 70 90 88 60 88 C52 88 44 87 37 84 L14 94 L22 74 C12 66 6 57 6 48 C6 26 30 8 60 8 Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="38" cy="48" r="5.5" fill="currentColor"/>
    <circle cx="60" cy="48" r="5.5" fill="currentColor"/>
    <circle cx="82" cy="48" r="5.5" fill="currentColor"/>
  </svg>`;

function modeDisplayName(mode) {
  if (mode === 'draw') return 'Domalovánka';
  if (mode === 'caption') return 'Main character';
  if (mode === 'impostor') return 'Impostor';
  return 'Výraz';
}

function brandHtml(state) {
  const modeName = modeDisplayName(state?.mode);
  return `<div class="brand"><img class="mark" src="icon.svg" alt=""><h1>${modeName}</h1></div>`;
}

// Úvodní obrazovka má dole lištu se dvěma záložkami: Hry a Shop.
let homeTab = 'games';

function renderStartScreen() {
  sendHello(); // jméno/vzhled se mohly změnit — ať to přátelé vidí aktuální
  if (homeTab === 'shop') return renderShopScreen();
  if (homeTab === 'friends') return renderFriendsScreen();
  if (profileOpen) return renderProfileScreen();
  renderGamesScreen();
}

function bottomNavHtml(active) {
  return `
    <nav class="bottom-nav">
      <button class="bottom-nav-btn ${active === 'games' ? 'active' : ''}" data-tab="games">${icon('gamepad')}<span>Hry</span></button>
      <button class="bottom-nav-btn ${active === 'shop' ? 'active' : ''}" data-tab="shop">${icon('bag')}<span>Shop</span></button>
      <button class="bottom-nav-btn ${active === 'friends' ? 'active' : ''}" data-tab="friends">${icon('users')}<span>Přátelé</span>${friendRequestsBadge()}</button>
    </nav>`;
}

function wireBottomNav() {
  document.querySelectorAll('.bottom-nav-btn').forEach((btn) => {
    btn.onclick = () => {
      if (homeTab === btn.dataset.tab) return;
      homeTab = btn.dataset.tab;
      shopView = 'shop'; // do shopu se vždycky vstupuje na obchod, ne do inventáře
      profileOpen = false;
      renderStartScreen();
      window.scrollTo(0, 0);
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
      <div class="brand"><img class="mark" src="icon.svg" alt=""><h1>Mogging face</h1></div>
      <div class="home-actions">
        <button id="rules-btn" class="text-btn">Pravidla</button>
        <button id="settings-btn" class="icon-btn" title="Nastavení">${icon('gear')}</button>
      </div>
    </div>

    ${profileCardHtml()}

    <div class="screen">
      <div class="join-card">
        <h2>Připojit se ke hře</h2>
        <div class="code-boxes" id="code-boxes">
          ${Array.from({ length: CODE_LEN }).map((_, i) => `<div class="code-box" data-i="${i}"></div>`).join('')}
          <input class="code-hidden-input" id="code-hidden" maxlength="${CODE_LEN}" autocomplete="off" autocapitalize="characters" inputmode="text">
        </div>
      </div>

      <div class="section-eyebrow">VYTVOŘIT HRU</div>
      <div class="mode-card" data-mode="classic">
        <div class="mode-icon-bg">${MODE_ICON_CAMERA}</div>
        <div class="ribbon">ZDARMA</div>
        <div class="mode-card-content">
          ${modeTile('classic')}
          <h3>Výraz</h3>
          <p>Padne věta, všichni se vyfotí s reakcí a hlasujete, čí výraz sedí nejlíp.</p>
        </div>
      </div>

      <div class="mode-card mode-card-draw ${isModeUnlocked('draw') ? '' : 'is-locked'}" data-mode="draw">
        <div class="mode-icon-bg">${MODE_ICON_PALETTE}</div>
        ${modeRibbonHtml('draw')}
        <div class="mode-card-content">
          ${modeTile('draw')}
          <h3>Domalovánka</h3>
          <p>Vyfoť se, pak máš chvíli na to si do fotky prstem něco dokreslit — a stejně jako u Výrazu se hlasuje a bodují místa.</p>
        </div>
      </div>

      <div class="mode-card mode-card-caption" data-mode="caption">
        <div class="mode-icon-bg">${MODE_ICON_SPEECH}</div>
        <div class="ribbon">ZDARMA</div>
        <div class="mode-card-content">
          ${modeTile('caption')}
          <h3>Main character</h3>
          <p>Jeden hráč se vyfotí, ostatní vymyslí nejlepší popisek k fotce a on sám vybere vítěze.</p>
        </div>
      </div>

      <div class="mode-card mode-card-impostor ${isModeUnlocked('impostor') ? '' : 'is-locked'}" data-mode="impostor">
        <div class="mode-icon-bg">${MODE_ICON_SPY}</div>
        ${modeRibbonHtml('impostor')}
        <div class="mode-card-content">
          ${modeTile('impostor')}
          <h3>Impostor</h3>
          <p>Všichni se fotí podle stejného zadání — jen impostor má jiné. Poznáte z fotek, kdo to je?</p>
        </div>
      </div>

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
      const create = () => withName((name) => connect(() => send({ type: 'create_lobby', name, mode, looks: myLooks() })));
      // placený mód může založit jen ten, kdo ho má odemčený nebo má vstupenku
      if (!canHostMode(mode)) return showPartyPackOffer(mode, create);
      create();
    };
  });

  document.getElementById('rules-btn').onclick = () => showRulesModal();
  document.getElementById('settings-btn').onclick = () => showSettingsModal(renderStartScreen);
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
    <h2>Jak se jmenuješ?</h2>
    <div class="field">
      <input id="modal-name-input" maxlength="20" placeholder="Např. Kuba">
    </div>
    <button id="modal-name-go" class="btn btn-primary btn-block">Pokračovat</button>
  `);
  const input = modal.querySelector('#modal-name-input');
  input.focus();
  const go = () => {
    const name = input.value.trim();
    if (!name) return showError('Napiš prosím nějaké jméno.');
    localStorage.setItem('vyraz_name', name);
    closeModal();
    onReady(name);
  };
  modal.querySelector('#modal-name-go').onclick = go;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

function showSettingsModal(onSaved) {
  const modal = openModal(`
    <h2>Nastavení</h2>
    <div class="field">
      <input id="modal-settings-name" maxlength="20" value="${escapeHtml(getSavedName())}" placeholder="Např. Kuba">
    </div>

    <div class="field">
      <label>Kamera</label>
      <button id="modal-camera-test" class="btn btn-ghost btn-block" type="button">${icon('camera')} Povolit kameru v prohlížeči</button>
      <p class="camera-status" id="modal-camera-status"></p>
    </div>

    <button id="modal-settings-save" class="btn btn-primary btn-block">Uložit</button>
    <button class="modal-close" id="modal-settings-close">Zavřít</button>
  `);
  modal.querySelector('#modal-settings-save').onclick = () => {
    const name = modal.querySelector('#modal-settings-name').value.trim();
    if (name) localStorage.setItem('vyraz_name', name);
    closeModal();
    if (onSaved) onSaved();
  };
  modal.querySelector('#modal-settings-close').onclick = closeModal;

  modal.querySelector('#modal-camera-test').onclick = async () => {
    const statusEl = modal.querySelector('#modal-camera-status');
    statusEl.innerHTML = 'Žádám prohlížeč o přístup…';
    statusEl.className = 'camera-status';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      statusEl.innerHTML = `${icon('checkCircle')} Kamera je povolená a funguje.`;
      statusEl.className = 'camera-status ok';
    } catch (err) {
      statusEl.innerHTML = `${icon('xCircle')} Přístup ke kameře se nepovedlo získat. Zkontroluj oprávnění appky/prohlížeče pro tuhle stránku v nastavení telefonu.`;
      statusEl.className = 'camera-status bad';
    }
  };
}

const RULES_BY_MODE = {
  classic: [
    'Hostitel založí lobby a pošle kamarádům kód.',
    'Každé kolo padne věta, která se týká náhodného spoluhráče z lobby.',
    'Všichni mají 30 vteřin se s reakcí vyfotit.',
    'Kdo to nestihne, má místo fotky smutný obličej „Nestihl to!!“.',
    'Fotky se odhalí najednou a hlasujete, která sedí k zadání nejlíp — pro sebe hlasovat nejde.',
    'Body podle pořadí v hlasování — 1. místo 100 b., další o kousek míň. Shodný počet hlasů = shodné body.',
    'Po posledním kole vyhrává, kdo má nejvíc bodů celkem.',
  ],
  draw: [
    'Hostitel založí lobby a pošle kamarádům kód.',
    'Každé kolo padne věta, která se týká náhodného spoluhráče z lobby.',
    'Všichni mají 30 vteřin se s reakcí vyfotit.',
    'Pak máš chvíli čas si do své fotky prstem něco dokreslit (kolik vteřin, nastaví hostitel).',
    'Fotky se odhalí najednou a hlasujete, která je nejlepší — pro sebe hlasovat nejde.',
    'Body podle pořadí v hlasování — 1. místo 100 b., další o kousek míň. Shodný počet hlasů = shodné body.',
    'Po posledním kole vyhrává, kdo má nejvíc bodů celkem.',
  ],
  caption: [
    'Hostitel založí lobby a pošle kamarádům kód.',
    'Každé kolo je „main character“ jiný hráč — postupně se vystřídají všichni.',
    'Main character se vyfotí, na fotku má neomezený čas.',
    'Ostatní k jeho fotce napíšou vtipný popisek (čas nastaví hostitel).',
    'Main character si přečte popisky bez jmen a vybere ten nejlepší.',
    'Autor vítězného popisku dostane 100 b.',
    'Po posledním kole vyhrává, kdo má nejvíc bodů celkem.',
  ],
  impostor: [
    'Hostitel založí lobby — hraje se aspoň ve 3.',
    'Každé kolo dostanou všichni stejné zadání na fotku, jen jeden náhodný hráč — impostor — má jiné, podobné.',
    'Impostor ví, že je impostor, ale nezná zadání ostatních.',
    'Všichni mají 30 vteřin se vyfotit.',
    'Pak se ukážou všechny fotky i se jmény a máte 30 vteřin hlasovat, kdo je impostor.',
    'Když má impostor nejvíc hlasů, vyhrávají ostatní: každý +100 b. a +3 mince.',
    'Když unikne (i při remíze), vyhrává impostor: +250 b. a +10 mincí.',
  ],
};

function showRulesModal(initialMode = 'classic') {
  const modes = ['classic', 'draw', 'caption', 'impostor'];
  openModal(`
    <h2>Jak se hraje</h2>
    <div class="rules-tabs">
      ${modes.map((m) => `
        <button class="rules-tab rules-tab-${m}" data-mode="${m}">
          ${modeTile(m)}
          <span>${modeDisplayName(m)}</span>
        </button>`).join('')}
    </div>
    <div class="rules-list" id="rules-list"></div>
    <button class="modal-close" id="modal-rules-close">Zavřít</button>
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

function optionPicker(id, values, current, suffix = '') {
  return `<div class="option-picker" id="picker-${id}">
    ${values.map((v) => `<button class="option-chip ${v === current ? 'active' : ''}" data-value="${v}">${v}${suffix}</button>`).join('')}
  </div>`;
}

function wireOptionPicker(id, onPick) {
  const wrap = document.getElementById(`picker-${id}`);
  if (!wrap) return;
  wrap.querySelectorAll('.option-chip').forEach((btn) => {
    btn.onclick = () => onPick(Number(btn.getAttribute('data-value')));
  });
}

function renderLobbyScreen(state) {
  mountedKey = 'lobby';
  stopCamera();
  document.body.classList.remove('home-bg', 'has-bottom-nav');
  const players = state.players;
  app.innerHTML = `
    <div class="lobby-top">
      <button id="back-btn" class="back-btn" title="Zpět na úvod">${icon('back')}</button>
      ${brandHtml(state)}
    </div>
    <div class="screen">
      <div class="code-display">${escapeHtml(state.code)}</div>
      <button class="btn btn-ghost btn-block invite-btn" id="invite-btn">${icon('users')} Pozvat přátele</button>


      <div class="card">
        <h3 style="margin-bottom:12px;">Hráči (${players.length})</h3>
        <div class="player-list">
          ${players.map((p) => `
            <div class="player-row">
              <span class="name"><span class="dot ${p.connected ? '' : 'off'}"></span>${avatarHtml(p.name, p.looks, 34)}${playerNameHtml(p.name, p.looks)}${p.isYou ? ' (ty)' : ''}</span>
              <span class="player-row-actions">
                ${p.isHost ? '<span class="badge">Host</span>' : ''}
                ${!p.isYou && p.friendCode && !isFriend(p.friendCode) && !getSentRequests().some((r) => r.code === p.friendCode)
                  ? `<button class="add-friend-mini" data-add-friend="${p.friendCode}" data-name="${escapeHtml(p.name)}" aria-label="Přidat do přátel">${icon('plus')}</button>`
                  : ''}
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      ${state.isHost ? `
        <div class="card setting-card">
          <h3 class="setting-title">${icon('rounds')} Počet kol</h3>
          ${optionPicker('rounds', ROUND_OPTIONS, state.totalRounds)}
        </div>

        ${state.drawEnabled ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('brush')} Čas na dokreslení</h3>
            ${optionPicker('draw-seconds', DRAW_SECONDS_OPTIONS, state.drawSeconds, 's')}
          </div>
        ` : ''}

        ${state.mode === 'caption' ? `
          <div class="card setting-card">
            <h3 class="setting-title">${icon('timer')} Čas na psaní popisku</h3>
            ${optionPicker('caption-seconds', CAPTION_SECONDS_OPTIONS, state.captionSeconds, 's')}
          </div>
        ` : ''}

        <button id="start-btn" class="btn btn-primary btn-block" ${players.length < minPlayersFor(state.mode) ? 'disabled' : ''}>
          ${players.length < minPlayersFor(state.mode)
            ? `Potřeba aspoň ${minPlayersFor(state.mode)} hráči`
            : isModeUnlocked(state.mode) ? 'Spustit hru' : `Spustit hru ${icon('ticket')} 1`}
        </button>
      ` : `
        <p class="subtitle" style="text-align:center;">Čeká se, až hostitel (${escapeHtml(players.find((p) => p.isHost)?.name || '')}) spustí hru…</p>
      `}
    </div>
  `;

  if (state.isHost) {
    wireOptionPicker('rounds', (v) => send({ type: 'set_rounds', rounds: v }));
    wireOptionPicker('draw-seconds', (v) => send({ type: 'set_draw_settings', seconds: v }));
    wireOptionPicker('caption-seconds', (v) => send({ type: 'set_caption_settings', seconds: v }));
    document.getElementById('start-btn').onclick = () => {
      // zamčený mód bez vstupenky (třeba po "Hrát znovu") — nabídni koupi
      if (!canHostMode(state.mode)) return showPartyPackOffer(state.mode, () => renderLobbyScreen(lastState));
      send({ type: 'start_game' });
    };
  }
  document.getElementById('back-btn').onclick = leaveLobby;
  document.getElementById('invite-btn').onclick = showInviteFriendsModal;
  document.querySelectorAll('[data-add-friend]').forEach((b) => {
    b.onclick = () => {
      sendFriendRequest(b.dataset.addFriend, b.dataset.name);
      b.remove();
    };
  });
}

function leaveLobby() {
  clearSession();
  hideReconnectOverlay();
  send({ type: 'leave_lobby' });
  lastState = null;
  submittedLocally = false;
  votedLocallyFor = null;
  drawDoneLocally = false;
  renderStartScreen();
}

// ----------------------------------------------------------- SUBMITTING ---

async function buildCameraView(state) {
  mountedKey = `submitting-camera-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        ${roleBadgeHtml(state)}
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      <div class="timer" id="timer-el">--</div>
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
        <span>Nepovedlo se získat přístup ke kameře.<br>Zkontroluj oprávnění prohlížeče.</span>
      </div>`;
  }

  document.getElementById('shutter-btn').onclick = () => capturePhoto();
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
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);

  const flash = document.getElementById('flash-el');
  if (flash) { flash.classList.add('on'); setTimeout(() => flash.classList.remove('on'), 350); }

  send({ type: 'submit_photo', photoDataUrl: dataUrl });
  stopCamera();

  if (lastState && lastState.phase === 'subject_photo') {
    // fáze se po odeslání změní skoro okamžitě, žádný mezikrok navíc netřeba
    return;
  }
  submittedLocally = true;
  buildWaitingView(lastState);
}

function buildWaitingView(state) {
  mountedKey = `submitting-waiting-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="prompt-box">
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        ${roleBadgeHtml(state)}
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      ${bigIcon('checkCircle', 'good')}
      <h3>Fotka odeslána!</h3>
      <p class="subtitle" id="wait-count-text">Čeká se na ostatní…</p>
      <div class="timer" id="timer-el">--</div>
    </div>
  `;
  patchWaitingCount(state);
}

function patchWaitingCount(state) {
  const el = document.getElementById('wait-count-text');
  if (el) el.textContent = `Odevzdalo ${state.submittedCount} / ${state.activeCount} hráčů…`;
}

// ------------------------------------------------------------ POPISOVÁNKA ---

async function buildSubjectPhotoView(state) {
  mountedKey = `subject-photo-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">Ty jsi dnes objekt fotky! Zachyť se — ostatní pak vymyslí, co se na fotce děje.</div>
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
        <span>Nepovedlo se získat přístup ke kameře.<br>Zkontroluj oprávnění prohlížeče.</span>
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
      <p class="subtitle" style="text-align:center;">Čeká se, až se ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} vyfotí…</p>
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
        <p class="subtitle">Ostatní teď popisují tvoji fotku…</p>
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
        <p class="subtitle">Popisek odeslán!</p>
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
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">Napiš, co si myslíš, že se na fotce hráče ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} děje.</div>
      </div>
      <div class="timer" id="timer-el">--</div>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:260px; width:100%; margin:0 auto;')}
      <div class="field">
        <textarea id="caption-input" class="caption-textarea" maxlength="140" rows="3" placeholder="Např. Právě zjistil, že mu ujel autobus před nosem…"></textarea>
      </div>
      <button id="caption-submit" class="btn btn-primary btn-block">Odeslat popisek</button>
    </div>
  `;
  document.getElementById('caption-submit').onclick = () => {
    const text = document.getElementById('caption-input').value.trim();
    if (!text) return showError('Napiš nějaký popisek.');
    send({ type: 'submit_caption', text });
  };
}

function patchCaptionCount(state) {
  const el = document.getElementById('caption-count-text');
  if (el) el.textContent = `Popsalo ${state.captionedCount} / ${state.captionEligibleCount} hráčů…`;
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
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds} — výběr</div>
        <div class="prompt-text">${state.isSubject
          ? 'Vyber nejlepší popisek své fotky.'
          : `${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} teď vybírá nejlepší popisek…`}</div>
      </div>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:220px; width:100%; margin:0 auto 18px;')}
      <div class="caption-list">${cardsHtml || '<p class="wait-note">Nikdo nestihl napsat popisek.</p>'}</div>
    </div>
  `;

  if (state.isSubject) {
    document.querySelectorAll('.caption-card[data-id]').forEach((el) => {
      el.onclick = () => {
        document.querySelectorAll('.caption-card').forEach((c) => c.classList.add('disabled'));
        el.classList.remove('disabled');
        el.classList.add('picked');
        send({ type: 'pick_caption', authorId: el.getAttribute('data-id') });
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
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds} — dokresli si to</div>
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
        <button id="draw-clear" class="btn btn-ghost btn-block">Vymazat</button>
        <button id="draw-done" class="btn btn-primary btn-block">Hotovo</button>
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
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      ${bigIcon('brush')}
      <h3>${state.youMissed ? 'Tentokrát nic k dokreslení' : 'Kresba hotová!'}</h3>
      <p class="subtitle" id="draw-count-text">Čeká se na ostatní…</p>
      <div class="timer" id="timer-el">--</div>
    </div>
  `;
  patchDrawCount(state);
}

function patchDrawCount(state) {
  const el = document.getElementById('draw-count-text');
  if (el) el.textContent = `Dokreslilo ${state.doneCount} / ${state.activeCount} hráčů…`;
}

// --------------------------------------------------------------- VOTING ---

function buildVotingView(state) {
  mountedKey = `voting-${state.round}`;
  const cardsHtml = state.cards.map((c) => {
    if (c.isOwn) {
      return `
        <div class="vote-card own">
          ${c.photoDataUrl ? `<img src="${c.photoDataUrl}">` : `<div class="missed"><span class="emoji">${icon('sad')}</span>Nestihl(a) jsi to!!</div>`}
          <div class="tag">Tvoje – nelze volit</div>
        </div>`;
    }
    if (c.missed) {
      return `
        <div class="vote-card disabled">
          <div class="missed"><span class="emoji">${icon('sad')}</span>Nestihl(a) to!!</div>
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
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds} — hlasování</div>
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
    ? `Hlas odeslán. Hlasovalo ${state.votedCount} / ${state.activeCount}…`
    : `Hlasovalo ${state.votedCount} / ${state.activeCount}…`;
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
  if (r.kind === 'impostor') return renderImpostorResults(state, r);

  const cardsHtml = r.cards.map((c) => `
    <div class="result-card ${c.isWinner ? 'winner' : ''}">
      ${c.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
      ${c.missed
        ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Nestihl(a) to!!</div>`
        : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
      <div class="meta">
        <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
        ${c.missed ? '' : `<div class="votes">${c.votes} ${c.votes === 1 ? 'hlas' : c.votes < 5 ? 'hlasy' : 'hlasů'} · +${c.points} b.</div>`}
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
        <div class="eyebrow">Výsledky kola ${r.round} / ${state.totalRounds}</div>
        <div class="prompt-text">${escapeHtml(r.prompt)}</div>
      </div>
      <div class="grid">${cardsHtml}</div>

      <div class="card">
        <h3 style="margin-bottom:10px;">Celkové skóre</h3>
        <div class="scoreboard">${scoreboardHtml}</div>
      </div>

      ${state.isHost
        ? `<button id="next-btn" class="btn btn-primary btn-block">${state.round >= state.totalRounds ? 'Zobrazit konečné výsledky' : 'Další kolo'}</button>`
        : `<p class="wait-note">Čeká se, až hostitel spustí další kolo…</p>`}
    </div>
  `;

  if (state.isHost) {
    document.getElementById('next-btn').onclick = () => send({ type: 'next_round' });
  }
}

function renderCaptionResultsScreen(state, r) {
  let body;
  if (r.skipped) {
    body = `<p class="subtitle" style="text-align:center;">${escapeHtml(r.subjectName)} nestihl(a) vyfotit se — kolo se přeskočilo, nikdo nedostal body.</p>`;
  } else if (!r.captions.length) {
    body = `
      ${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId), 'max-width:220px; width:100%; margin:0 auto 16px;')}
      <p class="subtitle" style="text-align:center;">Nikdo nestihl napsat popisek — nikdo nedostal body.</p>
    `;
  } else {
    const captionsHtml = r.captions.map((c) => `
      <div class="caption-card ${c.isWinner ? 'winner' : ''}">
        ${c.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
        <p>${escapeHtml(c.text)}</p>
        <div class="caption-author">${playerNameHtml(c.name, looksOf(state, c.id))}${c.isWinner ? ` · +${r.points} b.` : ''}</div>
      </div>
    `).join('');
    body = `
      ${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId), 'max-width:220px; width:100%; margin:0 auto 16px;')}
      <p class="subtitle" style="text-align:center;">${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))} vybral(a) nejlepší popisek</p>
      <div class="caption-list">${captionsHtml}</div>
    `;
  }

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Výsledky kola ${r.round} / ${state.totalRounds}</div>
        <div class="prompt-text">Fotka hráče ${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))}</div>
      </div>
      ${body}
      <div class="card">
        <h3 style="margin-bottom:10px;">Celkové skóre</h3>
        <div class="scoreboard">${scoreboardRowsHtml(state.players)}</div>
      </div>
      ${state.isHost
        ? `<button id="next-btn" class="btn btn-primary btn-block">${state.round >= state.totalRounds ? 'Zobrazit konečné výsledky' : 'Další kolo'}</button>`
        : `<p class="wait-note">Čeká se, až hostitel spustí další kolo…</p>`}
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

const PODIUM_LABEL = { 1: '1. místo', 2: '2. místo', 3: '3. místo' };

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
        <div class="podium-score num">${s.group.score} b.</div>
        <div class="podium-bar">
          <span class="podium-bar-label">${PODIUM_LABEL[s.place]}</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

// Minimální počet hráčů pro start — Impostor ve dvou nedává smysl.
function minPlayersFor(mode) {
  return mode === 'impostor' ? 3 : 2;
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
  done.push(reward.gameId);
  try { localStorage.setItem('vyraz_rewarded', JSON.stringify(done.slice(-50))); } catch { /* ignore */ }
}

function rewardCardHtml(reward) {
  if (!reward) return '';
  const rows = [
    ['Za dohranou hru', reward.participation],
    ['Za umístění', reward.place],
    ['Za vyhraná kola', reward.rounds],
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
      <p class="subtitle">${state.winners.length > 1 ? 'vyhráli hru!' : 'vyhrál(a) hru!'}</p>

      ${buildPodiumHtml(state.players)}

      ${rewardCardHtml(state.reward)}

      <div class="card" style="width:100%;">
        <h3 style="margin-bottom:10px;">Konečné pořadí</h3>
        <div class="scoreboard">${scoreboardHtml}</div>
      </div>

      ${state.isHost
        ? `<div class="btn-row">
            <button id="again-btn" class="btn btn-primary btn-block">Hrát znovu</button>
            <button id="menu-btn" class="btn btn-ghost btn-block">Do menu</button>
          </div>`
        : `<p class="wait-note">Čeká se, až hostitel spustí novou hru…</p>
           <button id="menu-btn" class="btn btn-ghost btn-block">Do menu</button>`}
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
  lastState = state;

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
}, 250);

renderStartScreen();
connect();
