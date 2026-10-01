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

  const cardsHtml = state.cards.map((c) => {
    const looks = looksOf(state, c.id);
    const photo = c.missed
      ? `<div class="missed"><span class="emoji">${icon('sad')}</span>Too slow!!</div>`
      : `<img src="${c.photoDataUrl}">`;
    return `
      <div class="ivote-card ${c.isOwn ? 'own' : ''}" ${c.isOwn ? '' : `data-id="${c.id}"`}>
        <div class="ivote-photo">${photo}</div>
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
      <div class="timer" id="timer-el">--</div>
      <div class="grid" id="ivote-grid">${cardsHtml}</div>
      <p class="wait-note" id="ivote-count"></p>
    </div>
  `;

  document.querySelectorAll('.ivote-card[data-id]').forEach((el) => {
    el.onclick = () => {
      send({ type: 'cast_vote', targetId: el.dataset.id });
      playSfx('vote');
      markImpostorVote(el.dataset.id);
    };
  });
  patchImpostorVoting(state);
}

function markImpostorVote(targetId) {
  document.querySelectorAll('.ivote-card[data-id]').forEach((c) => {
    c.classList.toggle('selected', c.dataset.id === targetId);
  });
}

function patchImpostorVoting(state) {
  if (state.yourVote) markImpostorVote(state.yourVote);
  const el = document.getElementById('ivote-count');
  if (el) el.textContent = state.youVoted
    ? `Vote sent (you can change it). ${state.votedCount} / ${state.activeCount} voted…`
    : `${state.votedCount} / ${state.activeCount} voted…`;
}

// ------------------------------------------------------------ výsledky ---

function renderImpostorResults(state, r) {
  const youImpostor = r.impostorId === state.youId;
  const youWon = r.caught ? !youImpostor : youImpostor;
  const gain = r.caught
    ? (youImpostor ? null : { points: r.civPoints, coins: r.civCoins })
    : (youImpostor ? { points: r.impostorPoints, coins: r.impostorCoins } : null);
  // impostor dostane body vždy (i když je chycený) — podle počtu správných hlasů
  const shownGain = youImpostor ? { points: r.impostorPoints, coins: r.caught ? 0 : r.impostorCoins } : gain;
  const guessedText = r.correctVotes > 0 ? `${r.correctVotes} of ${r.eligibleVoters} guessed the impostor` : 'Nobody guessed the impostor';
  const impBanner = r.caught
    ? (r.impostorPoints > 0 ? `You were caught… but still got +${r.impostorPoints} pts` : 'You were caught… no points this time')
    : `You escaped! +${r.impostorPoints} pts`;

  const impostorCard = r.cards.find((c) => c.isImpostor);
  const impostorLooks = looksOf(state, r.impostorId);
  const others = r.cards.filter((c) => !c.isImpostor);

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
        <div class="impostor-outcome-title">${r.caught ? 'Impostor caught!' : 'The impostor escaped!'}</div>
        <div class="impostor-outcome-sub">${youImpostor
          ? impBanner
          : (youWon ? 'You won this round' : 'You lost this round')}</div>
        <div class="impostor-outcome-sub">${guessedText}</div>
        ${shownGain ? `<div class="impostor-gain">+${shownGain.points} pts${shownGain.coins ? ` · ${COIN_SVG}<span class="num">+${shownGain.coins}</span>` : ''}</div>` : ''}
      </div>

      <div class="impostor-reveal">
        <div class="impostor-reveal-label">${icon('spy')} IMPOSTOR</div>
        ${impostorCard && !impostorCard.missed
          ? framedPhotoHtml(impostorCard.photoDataUrl, impostorLooks, 'max-width:200px; width:100%; margin:0 auto;')
          : `<div class="impostor-missed">${icon('sad')}</div>`}
        <div class="impostor-reveal-name">${playerNameHtml(r.impostorName, impostorLooks)}</div>
        <div class="impostor-reveal-pts">+${r.impostorPoints} pts</div>
        <div class="impostor-reveal-votes">${impostorCard ? impostorCard.votes : 0} ${impostorCard && impostorCard.votes === 1 ? 'vote' : 'votes'}</div>
      </div>

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
