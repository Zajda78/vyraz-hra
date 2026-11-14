// Copycat — originál vyfotí grimasu, ostatní ji 3 s vidí a pak ji zkopírují z hlavy.
// Fáze: copy_original -> copy_peek -> copy_copying -> copy_pick -> results.
// Skript se načítá před app.js; funkce jsou globální a volá je renderApp().

// hostitel volí, kolik vteřin je vidět fotka originálu
const PEEK_SECONDS_OPTIONS = [2, 3, 5, 8, 10];

// Čekací obrazovka (originál čeká na ostatní, ostatní na originál…)
function copyWaitHtml(state, iconName, bodyHtml) {
  return sfStatusHtml(state, { pill: sfRoundPill(state), art: `<div class="sf-art">${icon(iconName)}</div>`, h: bodyHtml });
}

// Originál fotí sám sebe — bez časového limitu (kamera stejná jako u Main Character).
async function buildCopyOriginalView(state) {
  mountedKey = `copy-original-${state.round}`;
  app.innerHTML = `
    <div class="screen sf-g sf-cam">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: '<span>Strike a pose — the crazier, the better!</span>', ring: false, small: true })}
      ${sfCameraHtml(state, false)}
    </div>
  `;
  cameraFacing = 'user';
  await startCameraStream();
  document.getElementById('shutter-btn').onclick = () => capturePhoto();
}

function buildCopyOriginalWaitView(state) {
  mountedKey = `copy-owait-${state.round}`;
  stopCamera();
  app.innerHTML = sfStatusHtml(state, {
    pill: sfRoundPill(state),
    art: `<div class="sf-art is-avatar">${avatarHtml(state.subjectName, looksOf(state, state.subjectId), 72)}</div>`,
    h: `${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))} <span>is striking a pose…</span>`,
  });
}

// Ostatní vidí originál 3 s s velkým odpočtem 3-2-1.
function buildCopyPeekView(state) {
  mountedKey = `copy-peek-${state.round}`;
  stopCamera();
  if (state.isSubject) {
    app.innerHTML = sfStatusHtml(state, {
      pill: sfRoundPill(state),
      art: `<div class="sf-art is-avatar">${avatarHtml(state.subjectName, looksOf(state, state.subjectId), 72)}</div>`,
      h: 'The others are memorising your face…',
    });
    return;
  }
  app.innerHTML = `
    <div class="screen sf-g sf-peek">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: '<span>Memorise it!</span>', ring: false })}
      <div class="sf-peek-photo">${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}</div>
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
    <div class="screen sf-g sf-cam">
      ${sfHeadHtml(state, { pill: sfRoundPill(state), title: `<span>Copy the face of</span> ${playerNameHtml(state.subjectName, looksOf(state, state.subjectId))}!` })}
      ${sfCameraHtml(state, false)}
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
  if (state.isSubject) {
    app.innerHTML = sfStatusHtml(state, {
      pill: sfRoundPill(state), ring: 'small',
      art: `<div class="sf-art is-avatar">${avatarHtml(state.subjectName, looksOf(state, state.subjectId), 72)}</div>`,
      h: 'Everyone is copying your face…',
      sub: '<span class="sf-sr" id="wait-count-text">Waiting for the others…</span>',
      card: sfWaitCardHtml(),
    });
  } else {
    app.innerHTML = `
      <div class="screen sf-g sf-waiting">
        ${sfHeadHtml(state, { pill: sfRoundPill(state), title: '', ring: 'small', small: true })}
        <div class="sf-sent">
          ${sent ? `<div class="sf-sent-photo"><img src="${lastSentPhoto.url}" alt=""></div>` : `<div class="sf-sent-photo is-empty">${icon('camera')}</div>`}
          <span class="sf-sent-check" role="img" aria-label="Photo saved">${icon('check')}</span>
        </div>
        <div class="sf-nice"><b>Nice shot!</b><span>Nobody sees it until the vote.</span></div>
        ${sfWaitCardHtml()}
        <p class="sf-sr" id="wait-count-text">Waiting for the others…</p>
      </div>`;
  }
  patchWaitingCount(state);
}

// Originál vybírá nejlepší kopii (anonymně, zamíchané); ostatní se dívají.
function buildCopyPickView(state) {
  mountedKey = `copy-pick-${state.round}`;
  stopCamera();
  const cardsHtml = state.copyCards.map((c) => `
    <div class="vote-card ${state.isSubject ? '' : 'disabled'}" data-id="${c.id}"><img src="${c.photoDataUrl}"></div>
  `).join('');
  const subj = playerNameHtml(state.subjectName, looksOf(state, state.subjectId));
  app.innerHTML = `
    <div class="screen sf-g sf-vote sf-judge">
      <div class="sf-judge-top">
        <div class="sf-judge-photo">${framedPhotoHtml(state.subjectPhotoDataUrl, looksOf(state, state.subjectId))}</div>
        <div class="sf-judge-text">
          <span class="sf-pill">${sfRoundPill(state, 'pick')}</span>
          <h1>${state.isSubject ? 'Pick the best copy of your face.' : `${subj} <span>is picking the best copy…</span>`}</h1>
        </div>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <div class="grid sf-pickable">${cardsHtml}</div>
    </div>
  `;
  if (state.isSubject) {
    document.querySelectorAll('.vote-card[data-id]').forEach((el) => {
      el.onclick = () => {
        document.querySelectorAll('.vote-card').forEach((c) => c.classList.add('disabled'));
        el.classList.remove('disabled');
        el.classList.add('selected');
        document.querySelectorAll('.sf-pickable').forEach((g) => g.classList.add('has-pick'));
        send({ type: 'pick_copy', authorId: el.getAttribute('data-id') });
        playSfx('pick');
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
          ? sfMissedHtml()
          : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
        <div class="meta">
          <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
          ${c.isWinner ? `<div class="votes">+${r.points} pts</div>` : ''}
        </div>
      </div>`).join('');
    body = `
      ${`<div class="sf-cap-photo is-small">${framedPhotoHtml(r.photoDataUrl, looksOf(state, r.subjectId))}</div>`}
      ${r.winnerId
        ? `<p class="subtitle" style="text-align:center;">${playerNameHtml(r.subjectName, looksOf(state, r.subjectId))} picked the best copy</p>`
        : `<p class="subtitle" style="text-align:center;">Nobody sent a copy in time — no points.</p>`}
      <div class="grid">${cardsHtml}</div>`;
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
  if (!r.skipped && r.winnerId) sfConfetti(document.querySelector('.sf-results .result-card.winner'));
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
