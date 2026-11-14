// Twins — dvojice (u lichého počtu trojice) se snaží vyfotit stejný obličej, hlasuje se pro nejsynchronnější tým.
// Fáze: submitting (společná s ostatními módy) -> twins_voting -> results.
// Skript se načítá před app.js; funkce jsou globální a volá je renderApp().

// barva týmu podle jeho pořadí (A, B, C…)
const TWIN_COLORS = ['#38BDF8', '#F472B6', '#FBBF24', '#34D399', '#A78BFA'];
function twinColor(index) { return TWIN_COLORS[index % TWIN_COLORS.length]; }

function teamBadgeHtml(id, index) {
  return `<span class="team-badge" style="--tc:${twinColor(index)}">Team ${escapeHtml(id)}</span>`;
}

// Pruh „Tvoje dvojče: Jméno“ nad kamerou i na čekací obrazovce.
function twinsBannerHtml(state, withHint = true) {
  if (state.mode !== 'twins' || !state.twins || !state.twins.length || !state.myGroup) return '';
  const people = state.twins.map((t) => `
    <span class="twin-person">${avatarHtml(t.name, looksOf(state, t.id), 40)}${playerNameHtml(t.name, looksOf(state, t.id))}</span>`)
    .join('<span class="twin-amp">&amp;</span>');
  return `
    <div class="twin-banner" style="--tc:${twinColor(state.myGroup.index)}">
      <div class="twin-banner-head"><span class="twin-label">${state.twins.length > 1 ? 'Your twins' : 'Your twin'}</span>${teamBadgeHtml(state.myGroup.id, state.myGroup.index)}</div>
      <div class="twin-people">${people}</div>
      ${withHint ? '<div class="twin-hint">Make the same face — no talking!</div>' : ''}
    </div>`;
}

// Fotky jednoho týmu vedle sebe (hlasování i výsledky).
function twinPhotosHtml(state, members) {
  return `<div class="twin-photos n${members.length}">${members.map((m) => `
    <div class="twin-photo">
      ${m.missed
        ? sfMissedHtml()
        : `<img src="${m.photoDataUrl}" alt="">`}
      <div class="twin-name">${playerNameHtml(m.name, looksOf(state, m.id))}</div>
    </div>`).join('')}</div>`;
}

function buildTwinsVotingView(state) {
  mountedKey = `tvote-${state.round}`;
  stopCamera();
  const cardsHtml = state.twinGroups.map((g) => `
    <div class="twin-card ${g.isOwn ? 'own' : ''} ${!g.isOwn && !g.votable ? 'disabled' : ''} ${state.yourVote === g.id ? 'selected' : ''}"
         style="--tc:${twinColor(g.index)}" ${!g.isOwn && g.votable ? `data-id="${g.id}"` : ''}>
      <div class="twin-card-head">${teamBadgeHtml(g.id, g.index)}${g.isOwn ? '<span class="twin-own">Your team</span>' : ''}${!g.isOwn && g.votable ? likeBtnHtml(g.id) : ''}</div>
      ${twinPhotosHtml(state, g.members)}
    </div>`).join('');

  app.innerHTML = `
    <div class="screen sf-g sf-vote sf-tvote">
      <div class="sf-vote-top">
        <span class="sf-pill">${sfRoundPill(state, 'vote')}</span>
        <span class="sf-voted"><i></i><b class="sf-count-num num">0/${state.activeCount}</b><span>voted</span></span>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <div class="sf-vote-headrow">
        <div>
          <h1 class="sf-vote-title twin-question">Which team is most in sync?</h1>
          <p class="sf-vote-sub prompt-text">${escapeHtml(state.prompt)}</p>
        </div>
        ${sfRingHtml(true)}
      </div>
      <div class="twin-list sf-pickable">${cardsHtml}</div>
      <p class="sf-sr" id="vote-count-text"></p>
    </div>
  `;
  document.querySelectorAll('.twin-card[data-id]').forEach((el) => {
    el.onclick = () => {
      const targetId = el.getAttribute('data-id');
      if (votedLocallyFor === targetId) return; // už vybraný – nic
      votedLocallyFor = targetId;
      send({ type: 'cast_vote', targetId });
      playSfx('vote');
      markVoteSelection('.twin-card[data-id]', targetId);
    };
  });
  wireLikes(state);
  patchVoteCount(state);
}

function renderTwinResultsScreen(state, r) {
  const groupsHtml = r.groups.map((g) => `
    <div class="twin-card result ${g.isWinner ? 'winner' : ''}" style="--tc:${twinColor(g.index)}">
      ${g.isWinner ? `<div class="crown">${CROWN_SVG}</div>` : ''}
      <div class="twin-card-head">${teamBadgeHtml(g.id, g.index)}
        ${g.rank != null ? `<span class="twin-pts">${g.votes} ${g.votes === 1 ? 'vote' : 'votes'} · +${g.points} pts</span>` : ''}
      </div>
      ${twinPhotosHtml(state, g.members)}
    </div>`).join('');
  app.innerHTML = `
    <div class="screen sf-g sf-results">
      <div class="sf-res-top">
        <span class="sf-pill">Round ${r.round} / ${state.totalRounds} results</span>
        <button class="sf-exit" data-exit-game aria-label="Leave game">${icon('logout')}</button>
      </div>
      <h1 class="sf-vote-title prompt-text">${escapeHtml(r.prompt)}</h1>
      <div class="twin-list">${groupsHtml}</div>
      ${sfScoreboardHtml(state)}
      ${sfNextBarHtml(state)}
    </div>
  `;
  sfWireNext();
  if (r.groups.some((g) => g.isWinner)) sfConfetti(document.querySelector('.sf-results .twin-card.winner'));
}

// Rozcestník pro renderApp() — vrací true, když fázi obsloužil.
function renderTwinsPhase(state) {
  if (state.phase === 'twins_voting') {
    if (mountedKey !== `tvote-${state.round}`) buildTwinsVotingView(state);
    else patchVoteCount(state);
    return true;
  }
  return false;
}
