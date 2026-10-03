// Přátelé — PROTOTYP. Každý telefon má trvalý 6místný kód přítele.
// Seznam přátel si drží telefon sám (localStorage), server jen ví, kdo je
// zrovna online a v jaké lobby — díky tomu se jde k příteli připojit bez
// kódu lobby a posílat pozvánky.

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIENDS_POLL_MS = 4000;

function getFriendCode() {
  let code = null;
  try { code = localStorage.getItem('vyraz_friend_code'); } catch { /* ignore */ }
  if (!code) {
    const buf = new Uint32Array(6);
    crypto.getRandomValues(buf);
    code = [...buf].map((n) => FRIEND_CODE_ALPHABET[n % FRIEND_CODE_ALPHABET.length]).join('');
    try { localStorage.setItem('vyraz_friend_code', code); } catch { /* ignore */ }
  }
  return code;
}

function loadList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
}
const getFriends = () => loadList('vyraz_friends'); // [{ code, name, looks }]
const getFriendRequests = () => loadList('vyraz_friend_requests'); // příchozí
const getSentRequests = () => loadList('vyraz_friend_sent'); // odeslané, čekají na přijetí

function isFriend(code) {
  return getFriends().some((f) => f.code === code);
}

// Představí telefon serveru (kód přítele, jméno, vzhled) — volá se po
// každém připojení a při změně jména/vzhledu.
function sendHello() {
  send({ type: 'hello', friendCode: getFriendCode(), name: getSavedName() || 'Player', looks: myLooks(), friends: getFriends().map((f) => f.code) });
  sendDevLogin(); // jen když má tohle zařízení vývojářský klíč
}

// Poslední známý stav přátel ze serveru: kód → { online, name, looks, lobby }
let friendStatuses = {};

function requestFriendStatuses() {
  const codes = getFriends().map((f) => f.code);
  if (codes.length) send({ type: 'friends_status', codes });
}

// Na obrazovce přátel a v okně pozvánek se stav obnovuje každé 4 s.
setInterval(() => {
  if (mountedKey === 'friends' || document.getElementById('invite-friends-list')) requestFriendStatuses();
}, FRIENDS_POLL_MS);

function addFriend(friend) {
  const list = getFriends().filter((f) => f.code !== friend.code);
  list.push({ code: friend.code, name: friend.name, looks: friend.looks || null });
  saveList('vyraz_friends', list);
  saveList('vyraz_friend_requests', getFriendRequests().filter((r) => r.code !== friend.code));
  saveList('vyraz_friend_sent', getSentRequests().filter((r) => r.code !== friend.code));
  sendHello(); // server pozná vzájemné přátelství
}

function sendFriendRequest(code, name) {
  code = String(code || '').toUpperCase().trim();
  if (!/^[A-Z2-9]{6}$/.test(code)) return showError('Friend codes have 6 characters.');
  if (code === getFriendCode()) return showError('You can\'t add yourself as a friend.');
  if (isFriend(code)) return showToast('You\'re already friends.');
  // když mi ten hráč už žádost poslal, rovnou ji přijmu
  const incoming = getFriendRequests().find((r) => r.code === code);
  if (incoming) return acceptFriend(incoming);
  send({ type: 'friend_request', code });
  const sent = getSentRequests().filter((r) => r.code !== code);
  sent.push({ code, name: name || null });
  saveList('vyraz_friend_sent', sent);
  showToast('Friend request sent');
}

function acceptFriend(req) {
  send({ type: 'friend_accept', code: req.code });
  addFriend(req);
  showToast(`${req.name || req.code} is now your friend`);
}

function declineFriend(code) {
  saveList('vyraz_friend_requests', getFriendRequests().filter((r) => r.code !== code));
}

function removeFriend(code) {
  saveList('vyraz_friends', getFriends().filter((f) => f.code !== code));
  delete friendStatuses[code];
  sendHello();
}

function joinFriend(code) {
  withName((name) => connect(() => send({ type: 'join_friend', code, name, looks: myLooks() })));
}

// Zprávy ze serveru, které se týkají přátel. Vrací true, když ji zpracuje.
function handleFriendMessage(msg) {
  if (msg.type === 'friends_status') {
    for (const f of msg.friends) {
      friendStatuses[f.code] = f;
      // průběžně aktualizuj uložené jméno a vzhled přítele; profil (profilovka,
      // sbírka) chodí jen od vzájemných přátel a ukládá se pro případ, že je offline
      if ((f.online && f.name) || f.profile) {
        const list = getFriends();
        const item = list.find((x) => x.code === f.code);
        if (item) {
          if (f.online && f.name) { item.name = f.name; item.looks = f.looks; }
          if (f.profile) { item.looks = f.profile.looks; item.ownedCount = f.profile.ownedCount; }
          saveList('vyraz_friends', list);
        }
      }
    }
    if (mountedKey === 'friends') patchFriendsList();
    patchFriendProfile();
    if (document.getElementById('invite-friends-list')) patchInviteList();
    return true;
  }
  if (msg.type === 'friend_request') {
    if (isFriend(msg.from.code)) return true;
    // žádost od někoho, komu jsem ji taky poslal → rovnou přátelé
    if (getSentRequests().some((r) => r.code === msg.from.code)) {
      acceptFriend(msg.from);
    } else {
      const list = getFriendRequests().filter((r) => r.code !== msg.from.code);
      list.push(msg.from);
      saveList('vyraz_friend_requests', list);
      showToast(`${msg.from.name} sent you a friend request`);
    }
    refreshFriendsUi();
    return true;
  }
  if (msg.type === 'friend_accepted') {
    addFriend(msg.from);
    showToast(`${msg.from.name} accepted your friend request`);
    refreshFriendsUi();
    return true;
  }
  if (msg.type === 'invite') {
    showInviteReceived(msg);
    return true;
  }
  return false;
}

// Po změně přátel překresli, co je zrovna vidět (seznam / odznak v liště).
function refreshFriendsUi() {
  if (mountedKey === 'friends') renderFriendsScreen();
  else if (!lastState && document.querySelector('.bottom-nav')) renderStartScreen();
}

function friendRequestsBadge() {
  const n = getFriendRequests().length;
  return n ? `<span class="nav-badge">${n}</span>` : '';
}

// --------------------------------------------------------- obrazovka ---

function friendStatusLabel(st) {
  if (!st || !st.online) return { text: 'Offline', cls: 'off' };
  if (!st.lobby) return { text: 'Online', cls: 'on' };
  const mode = modeDisplayName(st.lobby.mode);
  if (st.lobby.joinable) return { text: `In lobby · ${mode} · ${st.lobby.count} ${st.lobby.count === 1 ? 'player' : 'players'}`, cls: 'lobby' };
  return { text: `Playing · ${mode}`, cls: 'playing' };
}

function friendRowHtml(f) {
  const st = friendStatuses[f.code];
  const label = friendStatusLabel(st);
  const canJoin = st && st.online && st.lobby && st.lobby.joinable;
  return `
    <div class="friend-row" data-code="${f.code}">
      <div class="friend-open" data-profile="${f.code}" role="button" tabindex="0" aria-label="View profile">
        <div class="friend-avatar">${avatarHtml(f.name || '?', f.looks, 44)}<span class="presence-dot ${label.cls}"></span></div>
        <div class="friend-info">
          ${playerNameHtml(f.name || f.code, f.looks)}
          <span class="friend-status ${label.cls}">${label.text}</span>
        </div>
      </div>
      ${canJoin ? `<button class="friend-join" data-join="${f.code}">Join</button>` : ''}
      <button class="friend-remove" data-remove="${f.code}" aria-label="Remove friend">${icon('close')}</button>
    </div>`;
}

function renderFriendsScreen() {
  mountedKey = 'friends';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  sendHello();
  requestFriendStatuses();

  const requests = getFriendRequests();
  const sent = getSentRequests();

  app.innerHTML = `
    <div class="home-top">
      <div class="brand"><img class="mark" src="icon.svg" alt=""><h1>Friends</h1></div>
    </div>

    <div class="screen">
      <div class="my-code-card">
        <div class="my-code-label">Your friend code</div>
        <div class="my-code">${getFriendCode()}</div>
        <button class="chip-btn" id="copy-code">${icon('copy')} Copy</button>
      </div>

      <div class="qr-btn-row">
        <button class="btn btn-ghost" id="my-qr-btn">My QR code</button>
        <button class="btn btn-ghost" id="scan-qr-btn">Scan QR</button>
      </div>

      <div class="add-friend">
        <input id="add-friend-input" maxlength="6" placeholder="Friend code" autocomplete="off" autocapitalize="characters">
        <button class="btn btn-primary" id="add-friend-btn">${icon('plus')} Add</button>
      </div>

      ${requests.length ? `
        <div class="section-eyebrow">FRIEND REQUESTS</div>
        <div class="friend-list">
          ${requests.map((r) => `
            <div class="friend-row">
              <div class="friend-avatar">${avatarHtml(r.name || '?', r.looks, 44)}</div>
              <div class="friend-info">${playerNameHtml(r.name || r.code, r.looks)}<span class="friend-status">${r.code}</span></div>
              <button class="friend-join" data-accept="${r.code}">Accept</button>
              <button class="friend-remove" data-decline="${r.code}" aria-label="Decline">${icon('close')}</button>
            </div>`).join('')}
        </div>` : ''}

      <div class="section-eyebrow">FRIENDS</div>
      <div class="friend-list" id="friend-list"></div>

      ${sent.length ? `
        <div class="section-eyebrow">PENDING</div>
        <div class="friend-list">
          ${sent.map((r) => `
            <div class="friend-row pending">
              <div class="friend-info">${r.name ? playerNameHtml(r.name, null) : `<span class="player-name">${r.code}</span>`}<span class="friend-status">${r.code}</span></div>
            </div>`).join('')}
        </div>` : ''}
    </div>
    ${bottomNavHtml('friends')}
  `;

  wireBottomNav();
  patchFriendsList();

  const input = document.getElementById('add-friend-input');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  const add = () => { sendFriendRequest(input.value); renderFriendsScreen(); };
  document.getElementById('add-friend-btn').onclick = add;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  document.getElementById('my-qr-btn').onclick = showMyQrModal;
  document.getElementById('scan-qr-btn').onclick = showScanQrModal;

  document.getElementById('copy-code').onclick = async () => {
    try {
      await navigator.clipboard.writeText(getFriendCode());
      showToast('Code copied');
    } catch {
      showToast(`Your code: ${getFriendCode()}`);
    }
  };

  document.querySelectorAll('[data-accept]').forEach((b) => {
    b.onclick = () => {
      acceptFriend(getFriendRequests().find((r) => r.code === b.dataset.accept));
      renderFriendsScreen();
    };
  });
  document.querySelectorAll('[data-decline]').forEach((b) => {
    b.onclick = () => { declineFriend(b.dataset.decline); renderFriendsScreen(); };
  });
}

// Překreslí jen seznam přátel (stav online se mění každé 4 s).
function patchFriendsList() {
  const el = document.getElementById('friend-list');
  if (!el) return;
  const friends = getFriends();
  // online a v lobby nahoře
  const rank = (f) => {
    const st = friendStatuses[f.code];
    if (st?.lobby?.joinable) return 0;
    if (st?.online) return 1;
    return 2;
  };
  friends.sort((a, b) => rank(a) - rank(b));
  el.innerHTML = friends.length
    ? friends.map(friendRowHtml).join('')
    : `<div class="friends-empty">${icon('users')}<span>No friends yet. Send a friend your code, or add them from a lobby.</span></div>`;

  el.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => joinFriend(b.dataset.join); });
  el.querySelectorAll('[data-profile]').forEach((b) => {
    b.onclick = () => showFriendProfile(b.dataset.profile);
    b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showFriendProfile(b.dataset.profile); } };
  });
  el.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = () => {
      const f = getFriends().find((x) => x.code === b.dataset.remove);
      removeFriend(b.dataset.remove);
      showToast(`${f?.name || 'Friend'} removed from friends`);
      patchFriendsList();
    };
  });
}

// ------------------------------------------------------ profil přítele ---

// Karta jedné nasazené věci (rámeček / barva jména) — náhled, název, vzácnost.
function friendSkinCardHtml(sectionId, itemId, friendName) {
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  const item = findShopItem(sectionId, itemId);
  const title = sectionId === 'frame' ? 'Photo frame' : 'Name color';
  let preview;
  if (item && sectionId === 'frame') preview = shopItemPreview(section, item);
  else if (item) preview = `<div class="name-preview"><span style="${nameStyleFor(item)}">${escapeHtml(friendName)}</span></div>`;
  else if (sectionId === 'frame') preview = `<div class="frame-preview" style="background:rgba(255,255,255,0.12)"><div class="frame-inner">${icon('camera')}</div></div>`;
  else preview = `<div class="name-preview"><span style="color:#fff">${escapeHtml(friendName)}</span></div>`;
  const rar = item ? RARITIES[item.rarity] : null;
  return `
    <div class="fp-card ${item ? 'has-rarity' : ''}" style="${rar ? `--rc:${rar.color}` : ''}">
      <div class="fp-card-title">${title}</div>
      ${preview}
      <div class="shop-item-name">${item ? item.name : 'Default'}</div>
      ${rar ? `<div class="fp-rarity">${rar.label}</div>` : ''}
    </div>`;
}

function friendProfileBodyHtml(f) {
  const st = friendStatuses[f.code];
  const label = friendStatusLabel(st);
  const name = f.name || f.code;
  const total = SHOP_SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const owned = Number.isInteger(f.ownedCount) ? f.ownedCount : null;
  return `
    <div class="fp-hero">
      <div class="friend-avatar">${avatarHtml(name, f.looks, 128)}</div>
      <div class="fp-name">${playerNameHtml(name, f.looks)}</div>
      <div class="fp-status ${label.cls}"><span class="fp-dot ${label.cls}"></span>${label.text}</div>
    </div>
    ${owned !== null ? `<div class="fp-collection">${icon('hanger')}<span class="num">${owned} / ${total}</span><span>skins</span></div>` : ''}
    <div class="section-eyebrow">SKINS</div>
    <div class="fp-cards">
      ${friendSkinCardHtml('frame', f.looks && f.looks.frame, name)}
      ${friendSkinCardHtml('name', f.looks && f.looks.name, name)}
    </div>`;
}

function showFriendProfile(code) {
  const f = getFriends().find((x) => x.code === code);
  if (!f) return;
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="fp-close" aria-label="Close">${icon('close')}</button></div>
    <div id="fp-body" data-code="${code}">${friendProfileBodyHtml(f)}</div>
  `);
  modal.querySelector('#fp-close').onclick = closeModal;
  requestFriendStatuses();
}

// Stav přítele se obnovuje každé 4 s — otevřené okno profilu se překreslí.
function patchFriendProfile() {
  const body = document.getElementById('fp-body');
  if (!body) return;
  const f = getFriends().find((x) => x.code === body.dataset.code);
  if (f) body.innerHTML = friendProfileBodyHtml(f);
}

// ----------------------------------------------------------- pozvánky ---

// koho už jsem z téhle lobby pozval (ať po obnovení seznamu nezmizí "Pozváno")
let invitedCodes = new Set();
let invitedForLobby = null;

function showInviteFriendsModal() {
  if (invitedForLobby !== lastState?.code) {
    invitedCodes = new Set();
    invitedForLobby = lastState?.code || null;
  }
  requestFriendStatuses();
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="invite-close" aria-label="Close">${icon('close')}</button></div>
    <h2>Invite friends</h2>
    <div class="friend-list" id="invite-friends-list" style="margin-top:16px"></div>
  `);
  modal.querySelector('#invite-close').onclick = closeModal;
  patchInviteList();
}

function patchInviteList() {
  const el = document.getElementById('invite-friends-list');
  if (!el) return;
  const inLobby = new Set((lastState?.players || []).map((p) => p.friendCode).filter(Boolean));
  const friends = getFriends().filter((f) => !inLobby.has(f.code));
  if (!friends.length) {
    el.innerHTML = `<div class="friends-empty">${icon('users')}<span>No more friends to invite.</span></div>`;
    return;
  }
  friends.sort((a, b) => (friendStatuses[b.code]?.online ? 1 : 0) - (friendStatuses[a.code]?.online ? 1 : 0));
  el.innerHTML = friends.map((f) => {
    const st = friendStatuses[f.code];
    const label = friendStatusLabel(st);
    return `
      <div class="friend-row">
        <div class="friend-avatar">${avatarHtml(f.name || '?', f.looks, 40)}<span class="presence-dot ${label.cls}"></span></div>
        <div class="friend-info">${playerNameHtml(f.name || f.code, f.looks)}<span class="friend-status ${label.cls}">${label.text}</span></div>
        ${st?.online
          ? (invitedCodes.has(f.code)
            ? `<button class="friend-join" disabled>Invited</button>`
            : `<button class="friend-join" data-invite="${f.code}">Invite</button>`)
          : ''}
      </div>`;
  }).join('');
  el.querySelectorAll('[data-invite]').forEach((b) => {
    b.onclick = () => {
      send({ type: 'invite_friend', code: b.dataset.invite });
      invitedCodes.add(b.dataset.invite);
      patchInviteList();
    };
  });
}

function showInviteReceived(msg) {
  // uprostřed rozehrané hry pozvánku jen oznámíme, ať nikoho nevyhodí ze hry
  if (lastState && lastState.phase !== 'lobby' && lastState.phase !== 'gameover') {
    showToast(`${msg.from.name} invited you to ${modeDisplayName(msg.mode)}`);
    return;
  }
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="invite-no" aria-label="Close">${icon('close')}</button></div>
    <div class="invite-received">
      ${avatarHtml(msg.from.name, msg.from.looks, 72)}
      <h2>${playerNameHtml(msg.from.name, msg.from.looks)} invited you to play</h2>
      <div class="invite-mode">${modeTile(msg.mode)}<span>${modeDisplayName(msg.mode)}</span></div>
      <button class="btn btn-primary btn-block" id="invite-yes">Join</button>
    </div>
  `);
  modal.querySelector('.invite-mode').classList.add(`mode-color-${msg.mode}`);
  modal.querySelector('#invite-no').onclick = closeModal;
  modal.querySelector('#invite-yes').onclick = () => {
    closeModal();
    withName((name) => connect(() => send({ type: 'join_lobby', code: msg.lobbyCode, name, looks: myLooks() })));
  };
}
