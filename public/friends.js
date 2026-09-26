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
  send({ type: 'hello', friendCode: getFriendCode(), name: getSavedName() || 'Hráč', looks: myLooks() });
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
}

function sendFriendRequest(code, name) {
  code = String(code || '').toUpperCase().trim();
  if (!/^[A-Z2-9]{6}$/.test(code)) return showError('Kód přítele má 6 znaků.');
  if (code === getFriendCode()) return showError('Sám sebe si do přátel přidat nejde.');
  if (isFriend(code)) return showToast('Už jste přátelé.');
  // když mi ten hráč už žádost poslal, rovnou ji přijmu
  const incoming = getFriendRequests().find((r) => r.code === code);
  if (incoming) return acceptFriend(incoming);
  send({ type: 'friend_request', code });
  const sent = getSentRequests().filter((r) => r.code !== code);
  sent.push({ code, name: name || null });
  saveList('vyraz_friend_sent', sent);
  showToast('Žádost o přátelství odeslána');
}

function acceptFriend(req) {
  send({ type: 'friend_accept', code: req.code });
  addFriend(req);
  showToast(`${req.name || req.code} je teď tvůj přítel`);
}

function declineFriend(code) {
  saveList('vyraz_friend_requests', getFriendRequests().filter((r) => r.code !== code));
}

function removeFriend(code) {
  saveList('vyraz_friends', getFriends().filter((f) => f.code !== code));
  delete friendStatuses[code];
}

function joinFriend(code) {
  withName((name) => connect(() => send({ type: 'join_friend', code, name, looks: myLooks() })));
}

// Zprávy ze serveru, které se týkají přátel. Vrací true, když ji zpracuje.
function handleFriendMessage(msg) {
  if (msg.type === 'friends_status') {
    for (const f of msg.friends) {
      friendStatuses[f.code] = f;
      // průběžně aktualizuj uložené jméno a vzhled přítele
      if (f.online && f.name) {
        const list = getFriends();
        const item = list.find((x) => x.code === f.code);
        if (item) { item.name = f.name; item.looks = f.looks; saveList('vyraz_friends', list); }
      }
    }
    if (mountedKey === 'friends') patchFriendsList();
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
      showToast(`${msg.from.name} ti poslal(a) žádost o přátelství`);
    }
    refreshFriendsUi();
    return true;
  }
  if (msg.type === 'friend_accepted') {
    addFriend(msg.from);
    showToast(`${msg.from.name} přijal(a) tvou žádost o přátelství`);
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
  if (st.lobby.joinable) return { text: `V lobby · ${mode} · ${st.lobby.count} ${st.lobby.count >= 2 && st.lobby.count <= 4 ? 'hráči' : st.lobby.count === 1 ? 'hráč' : 'hráčů'}`, cls: 'lobby' };
  return { text: `Hraje · ${mode}`, cls: 'playing' };
}

function friendRowHtml(f) {
  const st = friendStatuses[f.code];
  const label = friendStatusLabel(st);
  const canJoin = st && st.online && st.lobby && st.lobby.joinable;
  return `
    <div class="friend-row" data-code="${f.code}">
      <div class="friend-avatar">${avatarHtml(f.name || '?', f.looks, 44)}<span class="presence-dot ${label.cls}"></span></div>
      <div class="friend-info">
        ${playerNameHtml(f.name || f.code, f.looks)}
        <span class="friend-status ${label.cls}">${label.text}</span>
      </div>
      ${canJoin ? `<button class="friend-join" data-join="${f.code}">Připojit</button>` : ''}
      <button class="friend-remove" data-remove="${f.code}" aria-label="Odebrat z přátel">${icon('close')}</button>
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
      <div class="brand"><img class="mark" src="icon.svg" alt=""><h1>Přátelé</h1></div>
    </div>

    <div class="screen">
      <div class="my-code-card">
        <div class="my-code-label">Tvůj kód přítele</div>
        <div class="my-code">${getFriendCode()}</div>
        <button class="chip-btn" id="copy-code">${icon('copy')} Zkopírovat</button>
      </div>

      <div class="add-friend">
        <input id="add-friend-input" maxlength="6" placeholder="Kód přítele" autocomplete="off" autocapitalize="characters">
        <button class="btn btn-primary" id="add-friend-btn">${icon('plus')} Přidat</button>
      </div>

      ${requests.length ? `
        <div class="section-eyebrow">ŽÁDOSTI O PŘÁTELSTVÍ</div>
        <div class="friend-list">
          ${requests.map((r) => `
            <div class="friend-row">
              <div class="friend-avatar">${avatarHtml(r.name || '?', r.looks, 44)}</div>
              <div class="friend-info">${playerNameHtml(r.name || r.code, r.looks)}<span class="friend-status">${r.code}</span></div>
              <button class="friend-join" data-accept="${r.code}">Přijmout</button>
              <button class="friend-remove" data-decline="${r.code}" aria-label="Odmítnout">${icon('close')}</button>
            </div>`).join('')}
        </div>` : ''}

      <div class="section-eyebrow">PŘÁTELÉ</div>
      <div class="friend-list" id="friend-list"></div>

      ${sent.length ? `
        <div class="section-eyebrow">ČEKÁ NA PŘIJETÍ</div>
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

  document.getElementById('copy-code').onclick = async () => {
    try {
      await navigator.clipboard.writeText(getFriendCode());
      showToast('Kód zkopírován');
    } catch {
      showToast(`Tvůj kód: ${getFriendCode()}`);
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
    : `<div class="friends-empty">${icon('users')}<span>Zatím nemáš žádné přátele. Pošli kamarádovi svůj kód, nebo si ho přidej v lobby.</span></div>`;

  el.querySelectorAll('[data-join]').forEach((b) => { b.onclick = () => joinFriend(b.dataset.join); });
  el.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = () => {
      const f = getFriends().find((x) => x.code === b.dataset.remove);
      removeFriend(b.dataset.remove);
      showToast(`${f?.name || 'Přítel'} odebrán(a) z přátel`);
      patchFriendsList();
    };
  });
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
    <div class="x-close-row"><button class="x-close" id="invite-close" aria-label="Zavřít">${icon('close')}</button></div>
    <h2>Pozvat přátele</h2>
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
    el.innerHTML = `<div class="friends-empty">${icon('users')}<span>Žádní další přátelé k pozvání.</span></div>`;
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
            ? `<button class="friend-join" disabled>Pozváno</button>`
            : `<button class="friend-join" data-invite="${f.code}">Pozvat</button>`)
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
    showToast(`${msg.from.name} tě zve do hry ${modeDisplayName(msg.mode)}`);
    return;
  }
  const modal = openModal(`
    <div class="x-close-row"><button class="x-close" id="invite-no" aria-label="Zavřít">${icon('close')}</button></div>
    <div class="invite-received">
      ${avatarHtml(msg.from.name, msg.from.looks, 72)}
      <h2>${playerNameHtml(msg.from.name, msg.from.looks)} tě zve do hry</h2>
      <div class="invite-mode">${modeTile(msg.mode)}<span>${modeDisplayName(msg.mode)}</span></div>
      <button class="btn btn-primary btn-block" id="invite-yes">Připojit se</button>
    </div>
  `);
  modal.querySelector('.invite-mode').classList.add(`mode-color-${msg.mode}`);
  modal.querySelector('#invite-no').onclick = closeModal;
  modal.querySelector('#invite-yes').onclick = () => {
    closeModal();
    withName((name) => connect(() => send({ type: 'join_lobby', code: msg.lobbyCode, name, looks: myLooks() })));
  };
}
