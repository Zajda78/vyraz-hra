// Mód IMPOSTOR — všichni dostanou stejné zadání na fotku, jen jeden
// náhodný hráč (impostor) má jiné, podobné. Po focení se ukážou fotky
// i se jmény a hlasuje se, kdo je impostor.

const MODE_ICON_SPY = `
  <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34 44 L40 16 C41 11 46 10 49 12 L60 19 L71 12 C74 10 79 11 80 16 L86 44" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M8 46 C30 57 90 57 112 46" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M28 68 C44 58 76 58 92 68 C86 84 70 84 60 75 C50 84 34 84 28 68 Z" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>
  </svg>`;

// Nápověda nad zadáním — pro všechny stejná, impostor o své roli neví
// (jiný text pro impostora by ho prozradil).
function roleBadgeHtml(state) {
  if (state.mode !== 'impostor') return '';
  return `<div class="role-badge">${icon('spy')} Someone got a different prompt — could it be you?</div>`;
}

// ------------------------------------------------------------ hlasování ---

function buildImpostorVotingView(state) {
  mountedKey = `ivote-${state.round}`;
  stopCamera();

  // spolu-impostor (jen pro impostora; při 7+ hráčích jsou dva)
  const fellowIds = state.fellowImpostorIds || [];
  const fellowCards = state.cards.filter((c) => fellowIds.includes(c.id));
  const fellowHtml = fellowCards.length ? `
      <div class="impostor-banner fellow-banner">
        <div class="impostor-banner-title">${tr('Your fellow impostor:', getLang())} ${fellowCards.map((c) => playerNameHtml(c.name, looksOf(state, c.id))).join(', ')}</div>
      </div>` : '';

  const cardsHtml = state.cards.map((c) => {
    const looks = looksOf(state, c.id);
    const photo = c.missed
      ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`
      : `<img src="${c.photoDataUrl}">`;
    return `
      <div class="ivote-card ${c.isOwn ? 'own' : ''} ${fellowIds.includes(c.id) ? 'fellow' : ''}" ${c.isOwn ? '' : `data-id="${c.id}"`}>
        <div class="ivote-photo">${photo}${!c.isOwn && !c.missed ? likeBtnHtml(c.id) : ''}</div>
        <div class="ivote-name">${playerNameHtml(c.name, looks)}${c.isOwn ? ' (you)' : ''}</div>
      </div>`;
  }).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="prompt-box">
        <div class="eyebrow">${promptPackBadge(state)}Round ${state.round} / ${state.totalRounds} — who's the impostor?</div>
        ${state.isImpostor ? '' : roleBadgeHtml(state)}
        ${state.isImpostor ? '' : `<div class="prompt-text">${escapeHtml(state.prompt)}</div>`}
      </div>
      ${state.isImpostor ? `
      <div class="impostor-banner">
        <div class="impostor-banner-title">${icon('spy')} You're the impostor! Don't get caught.</div>
        <div class="impostor-prompts">
          <div><span>${tr('Everyone had', getLang())}</span>${escapeHtml(state.civilPrompt || '')}</div>
          <div class="imp"><span>${tr('You had', getLang())}</span>${escapeHtml(state.impostorPrompt || state.prompt || '')}</div>
        </div>
      </div>` : ''}
      ${fellowHtml}
      <div class="timer" id="timer-el">--</div>
      ${state.dualVote ? `<div class="pick-two-note">${tr('Pick 2 people — you can change your picks', getLang())}</div>` : ''}
      <div class="grid" id="ivote-grid">${cardsHtml}</div>
      <p class="wait-note" id="ivote-count"></p>
    </div>
  `;

  document.querySelectorAll('.ivote-card[data-id]').forEach((el) => {
    el.onclick = () => {
      send({ type: 'cast_vote', targetId: el.dataset.id });
      playSfx('vote');
      if (state.dualVote) {
        // stejná logika jako na serveru: klepnutí odebere vybraného, třetí nahradí nejstarší
        const cur = [...document.querySelectorAll('.ivote-card.selected')].map((c) => c.dataset.id);
        const at = cur.indexOf(el.dataset.id);
        if (at >= 0) cur.splice(at, 1); else { cur.push(el.dataset.id); while (cur.length > 2) cur.shift(); }
        markImpostorVote(cur);
      } else {
        markImpostorVote(el.dataset.id);
      }
    };
  });
  wireLikes(state);
  patchImpostorVoting(state);
}

// targetId = jedno id, nebo pole id (2 impostoři → až 2 vybrané karty s fajfkou)
function markImpostorVote(targetId) {
  const sel = new Set(Array.isArray(targetId) ? targetId : [targetId]);
  document.querySelectorAll('.ivote-card[data-id]').forEach((c) => {
    const on = sel.has(c.dataset.id);
    c.classList.toggle('selected', on);
    const photo = c.querySelector('.ivote-photo');
    const chk = c.querySelector('.ivote-check');
    if (on && !chk && photo) photo.insertAdjacentHTML('beforeend', `<div class="ivote-check">${icon('check')}</div>`);
    if (!on && chk) chk.remove();
  });
}

function patchImpostorVoting(state) {
  if (state.dualVote) markImpostorVote(state.yourVotes || []);
  else if (state.yourVote) markImpostorVote(state.yourVote);
  applyLikes(state.myLikes);
  const el = document.getElementById('ivote-count');
  if (el) el.textContent = state.youVoted
    ? `Vote sent (you can change it). ${state.votedCount} / ${state.activeCount} voted…`
    : (state.dualVote && (state.yourVotes || []).length === 1
      ? `Pick 1 more person… ${state.votedCount} / ${state.activeCount} voted…`
      : `${state.votedCount} / ${state.activeCount} voted…`);
}

// ------------------------------------------------------------ výsledky ---

function renderImpostorResults(state, r) {
  const impIds = r.impostorIds || [r.impostorId];
  const multi = impIds.length > 1;
  const caughtIds = r.caughtIds || (r.caught ? impIds : []);
  const youImpostor = impIds.includes(state.youId);
  const youCaught = caughtIds.includes(state.youId);
  const myImpPoints = youImpostor ? ((r.impostorPointsById || {})[state.youId] ?? r.impostorPoints) : 0;
  const allCaught = caughtIds.length === impIds.length;
  const youWon = r.caught ? !youImpostor : youImpostor;
  const gain = r.caught
    ? (youImpostor ? null : { points: r.civPoints, coins: r.civCoins })
    : (youImpostor ? { points: myImpPoints, coins: r.impostorCoins } : null);
  // impostor dostane body vždy (i když je chycený) — podle počtu správných hlasů
  const youGuessed = (r.guessedIds || []).includes(state.youId);
  const guessBonus = youGuessed ? (r.guessBonus || 0) * ((r.guessCountById || {})[state.youId] || 1) : 0;
  // kdo impostora uhodl, dostane bonus navíc (i když ho skupina neodhalila)
  const shownGain = youImpostor
    ? { points: myImpPoints, coins: youCaught ? 0 : r.impostorCoins }
    : (gain || guessBonus ? { points: (gain ? gain.points : 0) + guessBonus, coins: gain ? gain.coins : 0 } : null);
  const guessedText = r.correctVotes > 0
    ? `${r.correctVotes} of ${r.eligibleVoters} guessed the ${multi ? 'impostors' : 'impostor'}`
    : (multi ? 'Nobody guessed the impostors' : 'Nobody guessed the impostor');
  const impBanner = youCaught
    ? (myImpPoints > 0 ? `You were caught… but still got +${myImpPoints} pts` : 'You were caught… no points this time')
    : `You escaped! +${myImpPoints} pts`;
  const outcomeTitle = !multi
    ? (r.caught ? 'Impostor caught!' : 'The impostor escaped!')
    : (allCaught ? 'Impostors caught!' : (r.caught ? 'One impostor was caught!' : 'The impostors escaped!'));

  const impostorCards = impIds.map((id) => r.cards.find((c) => c.id === id)).filter(Boolean);
  const others = r.cards.filter((c) => !c.isImpostor);
  const revealHtml = impIds.map((id) => {
    const card = r.cards.find((c) => c.id === id);
    const looks = looksOf(state, id);
    const name = (r.impostorNames || [r.impostorName])[impIds.indexOf(id)];
    const pts = (r.impostorPointsById || {})[id] ?? r.impostorPoints;
    return `
      <div class="impostor-reveal">
        <div class="impostor-reveal-label">${icon('spy')} IMPOSTOR</div>
        ${card && !card.missed
          ? framedPhotoHtml(card.photoDataUrl, looks, 'max-width:200px; width:100%; margin:0 auto;')
          : `<div class="impostor-missed">${icon('sad')}</div>`}
        <div class="impostor-reveal-name">${playerNameHtml(name, looks)}</div>
        <div class="impostor-reveal-pts">+${pts} pts</div>
        <div class="impostor-reveal-votes">${card ? card.votes : 0} ${card && card.votes === 1 ? 'vote' : 'votes'}</div>
      </div>`;
  }).join('');

  const othersHtml = others.map((c) => `
    <div class="result-card">
      ${c.missed
        ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`
        : resultPhotoHtml(c.photoDataUrl, looksOf(state, c.id))}
      <div class="meta">
        <div class="name">${playerNameHtml(c.name, looksOf(state, c.id))}</div>
        <div class="votes">${c.votes} ${c.votes === 1 ? 'vote' : 'votes'}</div>
      </div>
    </div>
  `).join('');

  app.innerHTML = `
    ${brandHtml(state)}
    <div class="screen">
      <div class="impostor-outcome ${r.caught ? 'caught' : 'escaped'}">
        <div class="impostor-outcome-title">${outcomeTitle}</div>
        <div class="impostor-outcome-sub">${youImpostor
          ? impBanner
          : (youWon ? 'You won this round' : 'You lost this round')}</div>
        <div class="impostor-outcome-sub">${guessedText}</div>
        ${youGuessed ? `<div class="impostor-outcome-sub">${(r.guessCountById || {})[state.youId] > 1 ? 'You guessed both impostors!' : `You guessed ${multi ? 'an' : 'the'} impostor!`} +${guessBonus} bonus pts</div>` : ''}
        ${shownGain ? `<div class="impostor-gain">+${shownGain.points} pts${shownGain.coins ? ` · ${COIN_SVG}<span class="num">+${shownGain.coins}</span>` : ''}</div>` : ''}
      </div>

      ${revealHtml}

      <div class="impostor-prompts">
        <div><span>${tr('Everyone had', getLang())}</span>${escapeHtml(r.civilPrompt)}</div>
        <div class="imp"><span>${tr('Impostor had', getLang())}</span>${escapeHtml(r.impostorPrompt)}</div>
      </div>

      <div class="grid">${othersHtml}</div>

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
