const app = document.getElementById('app');

let ws = null;
let lastState = null;
let mountedKey = null;
let cameraStream = null;
let submittedLocally = false;
let votedLocallyFor = null;
let drawDoneLocally = false;
let errorTimer = null;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function connect(onOpen) {
  if (ws && ws.readyState === WebSocket.OPEN) return onOpen && onOpen();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.addEventListener('open', () => onOpen && onOpen());
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') {
      if (msg.phase !== 'submitting') submittedLocally = false;
      if (msg.phase !== 'drawing') drawDoneLocally = false;
      if (msg.phase !== 'voting') votedLocallyFor = null;
      renderApp(msg);
    } else if (msg.type === 'error') {
      showError(msg.message);
    }
  });
  ws.addEventListener('close', () => {
    if (lastState) showError('Spojení se serverem spadlo. Zkus obnovit stránku.');
  });
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

function brandHtml(state) {
  const modeName = state?.mode === 'draw' ? 'Domalovánka' : 'Výraz';
  const modeEmoji = state?.mode === 'draw' ? '🖌️' : '🎭';
  return `<div class="brand"><div class="mark">${modeEmoji}</div><h1>${modeName}</h1></div>`;
}

function renderStartScreen() {
  mountedKey = 'start';
  stopCamera();
  document.body.classList.add('home-bg');
  joinCode = '';

  app.innerHTML = `
    <div class="home-top">
      <div class="brand"><div class="mark">🎭</div><h1>Výraz</h1></div>
      <div class="home-actions">
        <button id="rules-btn" class="text-btn">Pravidla</button>
        <button id="settings-btn" class="icon-btn" title="Nastavení">⚙️</button>
      </div>
    </div>

    <div class="player-name-row">
      <div class="player-name-info">
        <div class="player-avatar">${escapeHtml((getSavedName() || '?').charAt(0).toUpperCase())}</div>
        <span>${getSavedName()
          ? `Hraješ jako <strong>${escapeHtml(getSavedName())}</strong>`
          : `Zatím nemáš jméno`}</span>
      </div>
      <button id="change-name-btn" class="chip-btn">✏️ Změnit</button>
    </div>

    <div class="screen">
      <div class="join-card">
        <h2>Připojit se ke hře</h2>
        <div class="join-sub">Zadej ${CODE_LEN}místný kód od hostitele</div>
        <div class="code-boxes" id="code-boxes">
          ${Array.from({ length: CODE_LEN }).map((_, i) => `<div class="code-box" data-i="${i}"></div>`).join('')}
          <input class="code-hidden-input" id="code-hidden" maxlength="${CODE_LEN}" autocomplete="off" autocapitalize="characters" inputmode="text">
        </div>
      </div>

      <div class="section-eyebrow">VYTVOŘIT HRU</div>
      <div class="mode-card" data-mode="classic">
        <div class="glow"></div>
        <div class="ribbon">ZDARMA</div>
        <span class="mode-emoji">🎭</span>
        <h3>Výraz</h3>
        <p>Padne věta, všichni se vyfotí s reakcí a hlasujete, čí výraz sedí nejlíp.</p>
      </div>

      <div class="mode-card mode-card-draw" data-mode="draw">
        <div class="glow"></div>
        <div class="ribbon">ZDARMA</div>
        <span class="mode-emoji">🖌️</span>
        <h3>Domalovánka</h3>
        <p>Vyfoť se, pak máš chvíli na to si do fotky prstem něco dokreslit — a stejně jako u Výrazu se hlasuje a bodují místa.</p>
      </div>

      <p class="footer-note">Prototyp pro pár kamarádů. Fotky se posílají jen po dobu hry a nikam se natrvalo neukládají.</p>
    </div>
  `;

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
      withName((name) => connect(() => send({ type: 'create_lobby', name, mode })));
    };
  });

  document.getElementById('rules-btn').onclick = showRulesModal;
  document.getElementById('settings-btn').onclick = showSettingsModal;
  document.getElementById('change-name-btn').onclick = () => showSettingsModal(renderStartScreen);
}

function attemptJoin(code) {
  withName((name) => {
    connect(() => send({ type: 'join_lobby', name, code }));
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
    <p class="subtitle">Tohle jméno uvidí ostatní hráči ve hře.</p>
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
    <p class="subtitle">Tvoje jméno pro tento telefon.</p>
    <div class="field">
      <input id="modal-settings-name" maxlength="20" value="${escapeHtml(getSavedName())}" placeholder="Např. Kuba">
    </div>

    <div class="field">
      <label>Kamera</label>
      <button id="modal-camera-test" class="btn btn-ghost btn-block" type="button">📷 Povolit kameru v prohlížeči</button>
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
    statusEl.textContent = 'Žádám prohlížeč o přístup…';
    statusEl.className = 'camera-status';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      statusEl.textContent = '✅ Kamera je povolená a funguje.';
      statusEl.className = 'camera-status ok';
    } catch (err) {
      statusEl.textContent = '❌ Přístup ke kameře se nepovedlo získat. Zkontroluj oprávnění appky/prohlížeče pro tuhle stránku v nastavení telefonu.';
      statusEl.className = 'camera-status bad';
    }
  };
}

function showRulesModal() {
  const items = [
    'Hostitel založí lobby a pošle kamarádům kód.',
    'Každé kolo padne věta a všichni mají 30 vteřin se s reakcí vyfotit.',
    'Některé věty se týkají konkrétního spoluhráče z lobby — hra jeho jméno vybere náhodně.',
    'Kdo to nestihne, dostane místo fotky smutný emoji "Nestihl to!!".',
    'V Domalovánce je po vyfocení navíc chvíli čas si do fotky prstem něco dokreslit (hostitel nastaví kolik vteřin).',
    'Fotky se odhalí najednou a hlasujete, která sedí k zadání nejlíp — pro sebe hlasovat nejde.',
    'Body dostane každý podle pořadí v hlasování — 1. místo nejvíc, další o kousek míň. Při shodném počtu hlasů je i shodné pořadí a shodné body.',
    'Po posledním kole vyhrává, kdo má nejvíc bodů celkem.',
  ];
  openModal(`
    <h2>Jak se hraje</h2>
    <div class="rules-list">
      ${items.map((t, i) => `<div class="item"><span class="num">${i + 1}</span><span>${escapeHtml(t)}</span></div>`).join('')}
    </div>
    <button class="modal-close" id="modal-rules-close">Zavřít</button>
  `);
  document.getElementById('modal-rules-close').onclick = closeModal;
}

// ---------------------------------------------------------------- LOBBY ---

function renderLobbyScreen(state) {
  mountedKey = 'lobby';
  stopCamera();
  document.body.classList.remove('home-bg');
  const players = state.players;
  app.innerHTML = `
    <div class="lobby-top">
      <button id="back-btn" class="back-btn" title="Zpět na úvod">←</button>
      ${brandHtml(state)}
    </div>
    <div class="screen">
      <div class="code-display">${escapeHtml(state.code)}</div>
      <p class="subtitle" style="text-align:center;">Tenhle kód pošli kamarádům, ať se připojí.</p>

      <div class="card">
        <h3 style="margin-bottom:12px;">Hráči (${players.length})</h3>
        <div class="player-list">
          ${players.map((p) => `
            <div class="player-row">
              <span class="name"><span class="dot ${p.connected ? '' : 'off'}"></span>${escapeHtml(p.name)}${p.isYou ? ' (ty)' : ''}</span>
              ${p.isHost ? '<span class="badge">Host</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>

      ${state.isHost ? `
        <div class="card">
          <h3 style="margin-bottom:12px;">Počet kol</h3>
          <div class="stepper">
            <button id="rounds-minus">−</button>
            <span class="val" id="rounds-val">${state.totalRounds}</span>
            <button id="rounds-plus">+</button>
          </div>
        </div>

        ${state.drawEnabled ? `
          <div class="card">
            <h3 style="margin-bottom:12px;">🖌️ Čas na dokreslení</h3>
            <div class="stepper">
              <button id="draw-seconds-minus">−</button>
              <span class="val" id="draw-seconds-val">${state.drawSeconds}s</span>
              <button id="draw-seconds-plus">+</button>
            </div>
          </div>
        ` : ''}

        <button id="start-btn" class="btn btn-primary btn-block" ${players.length < 2 ? 'disabled' : ''}>
          ${players.length < 2 ? 'Potřeba aspoň 2 hráči' : 'Spustit hru'}
        </button>
      ` : `
        <p class="subtitle" style="text-align:center;">Čeká se, až hostitel (${escapeHtml(players.find((p) => p.isHost)?.name || '')}) spustí hru…</p>
        ${state.drawEnabled ? `<p class="subtitle" style="text-align:center;">Po fotce bude ${state.drawSeconds}s na dokreslení.</p>` : ''}
      `}
    </div>
  `;

  if (state.isHost) {
    document.getElementById('rounds-minus').onclick = () => send({ type: 'set_rounds', rounds: state.totalRounds - 1 });
    document.getElementById('rounds-plus').onclick = () => send({ type: 'set_rounds', rounds: state.totalRounds + 1 });
    document.getElementById('start-btn').onclick = () => send({ type: 'start_game' });
    if (state.drawEnabled) {
      document.getElementById('draw-seconds-minus').onclick = () => send({ type: 'set_draw_settings', seconds: state.drawSeconds - 5 });
      document.getElementById('draw-seconds-plus').onclick = () => send({ type: 'set_draw_settings', seconds: state.drawSeconds + 5 });
    }
  }
  document.getElementById('back-btn').onclick = leaveLobby;
}

function leaveLobby() {
  if (ws) {
    ws.close();
    ws = null;
  }
  lastState = null;
  submittedLocally = false;
  votedLocallyFor = null;
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
      <p class="wait-note">Ťukni na tlačítko a zachyť svůj výraz. Ostatní tvoji fotku neuvidí, dokud se neodhalí všechny.</p>
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
        <span class="emoji">📵</span>
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
  submittedLocally = true;
  stopCamera();
  buildWaitingView(lastState);
}

function buildWaitingView(state) {
  mountedKey = `submitting-waiting-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="prompt-box">
        <div class="eyebrow">Kolo ${state.round} / ${state.totalRounds}</div>
        <div class="prompt-text">${escapeHtml(state.prompt)}</div>
      </div>
      <span style="font-size:3rem;">✅</span>
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
      <span style="font-size:3rem;">🖌️</span>
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
          ${c.photoDataUrl ? `<img src="${c.photoDataUrl}">` : `<div class="missed"><span class="emoji">😢</span>Nestihl(a) jsi to!!</div>`}
          <div class="tag">Tvoje – nelze volit</div>
        </div>`;
    }
    if (c.missed) {
      return `
        <div class="vote-card disabled">
          <div class="missed"><span class="emoji">😢</span>Nestihl(a) to!!</div>
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
      <p class="subtitle" style="text-align:center;">Vyber fotku, která nejlíp sedí k zadání.</p>
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
      el.insertAdjacentHTML('beforeend', '<div class="check">✓</div>');
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

function renderResultsScreen(state) {
  mountedKey = `results-${state.round}`;
  stopCamera();
  const r = state.result;
  const cardsHtml = r.cards.map((c) => `
    <div class="result-card ${c.isWinner ? 'winner' : ''}">
      ${c.isWinner ? '<div class="crown">👑</div>' : ''}
      ${c.missed
        ? `<div class="missed"><span class="emoji">😢</span>Nestihl(a) to!!</div>`
        : `<img class="photo" src="${c.photoDataUrl}">`}
      <div class="meta">
        <div class="name">${escapeHtml(c.name)}</div>
        ${c.missed ? '' : `<div class="votes">${c.votes} ${c.votes === 1 ? 'hlas' : c.votes < 5 ? 'hlasy' : 'hlasů'} · +${c.points} b.</div>`}
      </div>
    </div>
  `).join('');

  const scoreboardHtml = state.players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''}">
      <span><span class="rank">${i + 1}.</span>${escapeHtml(p.name)}</span>
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

const PODIUM_MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };
const PODIUM_LABEL = { 1: '1. místo', 2: '2. místo', 3: '3. místo' };

function buildPodiumHtml(players) {
  const groups = rankGroups(players).slice(0, 3);
  const spots = groups.map((g, i) => ({ place: i + 1, group: g }));
  // vizuální pořadí zleva doprava: 2. – 1. – 3.
  const order = [spots[1], spots[0], spots[2]].filter(Boolean);

  return `<div class="podium">
    ${order.map((s) => `
      <div class="podium-spot place-${s.place}">
        <span class="podium-medal">${PODIUM_MEDAL[s.place]}</span>
        <div class="podium-names">${s.group.players.map((p) => escapeHtml(p.name)).join(' & ')}</div>
        <div class="podium-score num">${s.group.score} b.</div>
        <div class="podium-bar">
          <span class="podium-bar-label">${PODIUM_LABEL[s.place]}</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderGameOverScreen(state) {
  mountedKey = 'gameover';
  stopCamera();
  const scoreboardHtml = state.players.map((p, i) => `
    <div class="row ${p.isYou ? 'you' : ''}">
      <span><span class="rank">${i + 1}.</span>${escapeHtml(p.name)}</span>
      <span class="num" style="color:var(--gold); font-weight:700;">${p.score}</span>
    </div>
  `).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="winners-line">${escapeHtml(state.winners.join(' & '))}</div>
      <p class="subtitle">${state.winners.length > 1 ? 'vyhráli hru!' : 'vyhrál(a) hru!'}</p>

      ${buildPodiumHtml(state.players)}

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
  el.textContent = `⏱ ${remaining}s`;
  el.classList.toggle('low', remaining <= 5);
}, 250);

renderStartScreen();
