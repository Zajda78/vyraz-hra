// Copycat — originál vyfotí grimasu, ostatní ji 3 s vidí a pak ji zkopírují z hlavy.
// Fáze: copy_original -> copy_peek -> copy_copying -> copy_pick -> results.
// Skript se načítá před app.js; funkce jsou globální a volá je renderApp().

// hostitel volí, kolik vteřin je vidět fotka originálu
const PEEK_SECONDS_OPTIONS = [2, 3, 5, 8, 10];

// Čekací obrazovka (originál čeká na ostatní, ostatní na originál…)
function copyWaitHtml(state, iconName, bodyHtml) {
  return `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="eyebrow">Round ${state.round} / ${state.totalRounds}</div>
      ${bigIcon(iconName)}
      ${bodyHtml}
    </div>`;
}

// Originál fotí sám sebe — bez časového limitu (kamera stejná jako u Main Character).
async function buildCopyOriginalView(state) {
  mountedKey = `copy-original-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Round ${state.round} / ${state.totalRounds}</div>
        <h3 class="copy-prompt">Strike a pose — the crazier, the better!</h3>
      </div>
      <div class="camera-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <div class="flash" id="flash-el"></div>
      </div>
      <div class="shutter-row">
        <button id="shutter-btn" class="shutter" title="Take photo"></button>
      </div>
    </div>
  `;
  cameraFacing = 'user';
  await startCameraStream();
  document.getElementById('shutter-btn').onclick = () => capturePhoto();
}

function buildCopyOriginalWaitView(state) {
  mountedKey = `copy-owait-${state.round}`;
  stopCamera();
  app.innerHTML = copyWaitHtml(state, 'camera', `
    <h3>${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} is striking a pose…</h3>`);
}

// Ostatní vidí originál 3 s s velkým odpočtem 3-2-1.
function buildCopyPeekView(state) {
  mountedKey = `copy-peek-${state.round}`;
  stopCamera();
  if (state.isSubject) {
    app.innerHTML = copyWaitHtml(state, 'timer', `<h3>The others are memorising your face…</h3>`);
    return;
  }
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="eyebrow">Round ${state.round} / ${state.totalRounds}</div>
      <h2 class="copy-prompt">Memorise it!</h2>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:340px; width:100%; margin:0 auto;')}
      <div class="copy-count" id="copy-count">3</div>
    </div>
  `;
  patchCopyCount();
}

function patchCopyCount() {
  const el = document.getElementById('copy-count');
  if (!el || !lastState || !lastState.deadlineAt) return;
  const n = Math.max(1, Math.ceil((lastState.deadlineAt - Date.now()) / 1000));
  if (el.textContent !== String(n)) el.textContent = String(n);
}
setInterval(patchCopyCount, 100);

// Kopírování — selfie kamera bez originálu, s odpočtem.
async function buildCopyCameraView(state) {
  mountedKey = `copy-camera-${state.round}`;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Round ${state.round} / ${state.totalRounds}</div>
        <h3 class="copy-prompt">Copy the face of ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))}!</h3>
      </div>
      <div class="timer" id="timer-el">--</div>
      <div class="camera-wrap">
        <video id="cam-video" autoplay playsinline muted></video>
        <div class="flash" id="flash-el"></div>
      </div>
      <div class="shutter-row">
        <button id="shutter-btn" class="shutter" title="Take photo"></button>
      </div>
    </div>
  `;
  cameraFacing = 'user';
  await startCameraStream();
  document.getElementById('shutter-btn').onclick = () => capturePhoto();
}

// Po odeslání kopie (nebo když je hráč originál) — čekání na ostatní.
function buildCopyWaitingView(state) {
  mountedKey = `copy-waiting-${state.round}`;
  stopCamera();
  const sent = lastSentPhoto && lastSentPhoto.round === state.round;
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen center">
      <div class="eyebrow">Round ${state.round} / ${state.totalRounds}</div>
      ${state.isSubject
        ? `${bigIcon('timer')}<h3>Everyone is copying your face…</h3>`
        : `${sent
            ? `<div class="sent-photo"><img src="${lastSentPhoto.url}" alt=""><span class="sent-check">${icon('check')}</span></div>`
            : bigIcon('checkCircle', 'good')}
           <h3>Photo sent!</h3>`}
      <p class="subtitle" id="wait-count-text">Waiting for the others…</p>
      <div class="timer" id="timer-el">--</div>
    </div>
  `;
  patchWaitingCount(state);
}

// Originál vybírá nejlepší kopii (anonymně, zamíchané); ostatní se dívají.
function buildCopyPickView(state) {
  mountedKey = `copy-pick-${state.round}`;
  stopCamera();
  const cardsHtml = state.copyCards.map((c) => `
    <div class="vote-card ${state.isSubject ? '' : 'disabled'}" data-id="${c.id}"><img src="${c.photoDataUrl}"></div>
  `).join('');
  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">Round ${state.round} / ${state.totalRounds} — pick</div>
        <h3 class="copy-prompt">${state.isSubject
          ? 'Pick the best copy of your face.'
          : `${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} is picking the best copy…`}</h3>
      </div>
      ${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId), 'max-width:220px; width:100%; margin:0 auto 18px;')}
      <div class="grid">${cardsHtml}</div>
    </div>
  `;
  if (state.isSubject) {
    document.querySelectorAll('.vote-card[data-id]').forEach((el) => {
      el.onclick = () => {
        document.querySelectorAll('.vote-card').forEach((c) => c.classList.add('disabled'));
        el.classList.remove('disabled');
        el.classList.add('selected');
        send({ type: 'pick_copy', authorId: el.getAttribute('data-id') });
        playSfx('vote');
      };
    });
  }
}

function renderCopyResultsScreen(state, r) {
  let body;
  if (r.skipped) {
    body = `<p class="subtitle" style="text-align:center;">${escapeHtml(r.subjectName)} didn't snap a photo — the round was skipped, no points.</p>`;
  } else {
    const cardsHtml = r.copies.map((c) => `
      <div class="result-card ${c.isWinner ? 'winner' : ''}">
        ${c.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
        ${c.missed
          ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`
          : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
        <div class="meta">
          <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
          ${c.isWinner ? `<div class="votes">+${r.points} pts</div>` : ''}
        </div>
      </div>`).join('');
    body = `
      ${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId), 'max-width:220px; width:100%; margin:0 auto 16px;')}
      ${r.winnerId
        ? `<p class="subtitle" style="text-align:center;">${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))} picked the best copy</p>`
        : `<p class="subtitle" style="text-align:center;">Nobody sent a copy in time — no points.</p>`}
      <div class="grid">${cardsHtml}</div>`;
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
  if (state.isHost) document.getElementById('next-btn').onclick = () => send({ type: 'next_round' });
}

// Rozcestník pro renderApp() — vrací true, když fázi obsloužil.
function renderCopycatPhase(state) {
  if (state.phase === 'copy_original') {
    if (state.isSubject) {
      if (mountedKey !== `copy-original-${state.round}`) buildCopyOriginalView(state);
    } else if (mountedKey !== `copy-owait-${state.round}`) buildCopyOriginalWaitView(state);
    return true;
  }
  if (state.phase === 'copy_peek') {
    if (mountedKey !== `copy-peek-${state.round}`) buildCopyPeekView(state);
    return true;
  }
  if (state.phase === 'copy_copying') {
    if (state.isSubject || state.youSubmitted || submittedLocally) {
      if (mountedKey !== `copy-waiting-${state.round}`) buildCopyWaitingView(state);
      else patchWaitingCount(state);
    } else if (mountedKey !== `copy-camera-${state.round}`) buildCopyCameraView(state);
    return true;
  }
  if (state.phase === 'copy_pick') {
    if (mountedKey !== `copy-pick-${state.round}`) buildCopyPickView(state);
    return true;
  }
  return false;
}
