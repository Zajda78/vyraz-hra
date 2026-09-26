// Profil hráče — ukazuje nasazenou kosmetiku ze shopu (rámeček + barva
// jména). Zatím jen lokálně v tomhle telefonu, stejně jako shop.

// ------------------------------------------------ vzhled hráčů ve hře ---
// looks = { frame: id | null, name: id | null } — posílá se přes server,
// takže každý ve hře vidí rámečky a barvy jmen ostatních.

function myLooks() {
  const d = shopLoad();
  return { frame: d.equipped.frame || null, name: d.equipped.name || null };
}

function findShopItem(sectionId, itemId) {
  if (!itemId) return null;
  const section = SHOP_SECTIONS.find((s) => s.id === sectionId);
  return (section && section.items.find((i) => i.id === itemId)) || null;
}

function looksOf(state, playerId) {
  const p = (state.players || []).find((x) => x.id === playerId);
  return p ? p.looks : null;
}

function playerNameHtml(name, looks) {
  const item = findShopItem('name', looks && looks.name);
  return `<span class="player-name ${item ? 'is-styled' : ''}" style="${item ? nameStyleFor(item) : ''}">${escapeHtml(name)}</span>`;
}

// Avatar (první písmeno jména) v rámečku podle looks. size = šířka v px.
function avatarHtml(name, looks, size) {
  const frame = findShopItem('frame', looks && looks.frame);
  const letter = escapeHtml((name || '?').charAt(0).toUpperCase());
  const pad = Math.max(2, Math.round(size * 0.055));
  return `
    <div class="framed-avatar" style="width:${size}px; height:${size}px; padding:${pad}px; border-radius:${Math.round(size * 0.24)}px; background:${frame ? frame.style : 'rgba(255,255,255,0.14)'}">
      <div class="framed-avatar-inner" style="border-radius:${Math.round(size * 0.19)}px; font-size:${Math.round(size * 0.4)}px">${letter}</div>
      ${frameDecorHtml(frame)}
    </div>`;
}

// Fotka v rámečku hráče — jen tam, kde je jasné, čí fotka to je
// (při hlasování ne, to musí zůstat anonymní).
function framedPhotoHtml(src, looks, wrapStyle = '') {
  const frame = findShopItem('frame', looks && looks.frame);
  return `
    <div class="photo-frame ${frame ? 'has-frame' : ''}" style="${wrapStyle}${frame ? ` background:${frame.style};` : ''}">
      <div class="camera-wrap"><img src="${src}"></div>
      ${frameDecorHtml(frame)}
    </div>`;
}

function resultPhotoHtml(src, looks) {
  const frame = findShopItem('frame', looks && looks.frame);
  if (!frame) return `<img class="photo" src="${src}">`;
  return `<div class="result-photo-frame" style="background:${frame.style}"><img class="photo" src="${src}">${frameDecorHtml(frame)}</div>`;
}

// Avatar přihlášeného hráče v nasazeném rámečku.
function framedAvatarHtml(size) {
  return avatarHtml(getSavedName() || '?', myLooks(), size);
}

// Jméno v nasazené barvě.
function styledNameHtml(fallback = 'Jméno') {
  const data = shopLoad();
  return `<span class="styled-name" style="${nameStyleFor(equippedItem(data, 'name'))}">${escapeHtml(getSavedName() || fallback)}</span>`;
}

// Karta profilu na hlavní stránce (záložka Hry).
function profileCardHtml() {
  return `
    <div class="profile-card" id="profile-card" role="button" tabindex="0">
      ${framedAvatarHtml(48)}
      <div class="profile-card-text">
        ${getSavedName() ? `Tvoje jméno je ${styledNameHtml()}` : 'Nastav si jméno'}
      </div>
      <button id="change-name-btn" class="chip-btn chip-icon" title="Upravit profil" aria-label="Upravit profil">${icon('pencil')}</button>
    </div>`;
}

function wireProfileCard() {
  document.getElementById('profile-card').onclick = (e) => {
    if (e.target.closest('#change-name-btn')) return;
    openProfile();
  };
  document.getElementById('change-name-btn').onclick = showEditProfileModal;
}

let profileOpen = false;

function openProfile() {
  profileOpen = true;
  renderStartScreen();
  window.scrollTo(0, 0);
}

function closeProfile() {
  profileOpen = false;
  renderStartScreen();
  window.scrollTo(0, 0);
}

function renderProfileScreen() {
  mountedKey = 'profile';
  stopCamera();
  document.body.classList.add('home-bg', 'has-bottom-nav');
  const data = shopLoad();
  const totalItems = SHOP_SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const pct = Math.round((data.owned.length / totalItems) * 100);

  app.innerHTML = `
    <div class="lobby-top">
      <button id="profile-back" class="back-btn" title="Zpět">${icon('back')}</button>
      <div class="brand"><h1>Profil</h1></div>
    </div>

    <div class="screen">
      <div class="profile-hero">
        ${framedAvatarHtml(128)}
        <div class="profile-hero-name">
          ${styledNameHtml('Bez jména')}
          <button id="profile-rename" class="chip-btn chip-icon" title="Upravit profil" aria-label="Upravit profil">${icon('pencil')}</button>
        </div>
      </div>

      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">${COIN_SVG}<span class="num">${data.coins}</span></div>
          <div class="profile-stat-label">Mince</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${icon('backpack')}<span class="num">${data.owned.length} / ${totalItems}</span></div>
          <div class="profile-stat-label">Sbírka</div>
          <div class="profile-progress"><div style="width:${pct}%"></div></div>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="profile-edit-looks">${icon('backpack')} Upravit vzhled</button>
      <button class="btn btn-ghost btn-block" id="profile-shop">${icon('bag')} Otevřít bednu v shopu</button>
    </div>
    ${bottomNavHtml('games')}
  `;

  wireBottomNav();
  // "Hry" v liště z profilu vrátí na hlavní stránku
  document.querySelector('.bottom-nav-btn[data-tab="games"]').onclick = closeProfile;
  document.getElementById('profile-back').onclick = closeProfile;
  document.getElementById('profile-rename').onclick = showEditProfileModal;
  document.getElementById('profile-edit-looks').onclick = () => {
    profileOpen = false;
    homeTab = 'shop';
    openInventory();
  };
  document.getElementById('profile-shop').onclick = () => {
    profileOpen = false;
    homeTab = 'shop';
    backToShop();
  };
}

// ------------------------------------------------- úprava profilu ---
// Tužka u jména otevře okno, kde jde změnit jméno a zároveň nasadit
// věci z inventáře. Nasazení platí hned, jméno se uloží tlačítkem.

function editProfileBodyHtml(nameDraft) {
  const data = shopLoad();
  const sectionsHtml = SHOP_SECTIONS.map((section) => {
    const ownedItems = section.items.filter((i) => data.owned.includes(i.id));
    const tiles = [inventoryTileHtml(section, null, !data.equipped[section.id])]
      .concat(ownedItems.map((item) => inventoryTileHtml(section, item, data.equipped[section.id] === item.id)))
      .join('');
    return `
      <div class="section-eyebrow">${section.title.toUpperCase()}</div>
      <div class="shop-grid">${tiles}</div>`;
  }).join('');

  return `
    <div class="x-close-row"><button class="x-close" id="edit-profile-close" aria-label="Zavřít">${icon('close')}</button></div>
    <h2>Upravit profil</h2>
    <div class="edit-profile-preview">
      ${avatarHtml(nameDraft || '?', myLooks(), 88)}
      ${playerNameHtml(nameDraft || 'Jméno', myLooks())}
    </div>
    <div class="field">
      <input id="edit-profile-name" maxlength="20" value="${escapeHtml(nameDraft)}" placeholder="Tvoje jméno">
    </div>
    <button id="edit-profile-save" class="btn btn-primary btn-block">Uložit jméno</button>
    <div class="edit-profile-inventory">
      ${sectionsHtml}
      ${data.owned.length === 0 ? `<button class="btn btn-ghost btn-block" id="edit-profile-shop">${icon('bag')} Otevřít truhlu v shopu</button>` : ''}
    </div>
  `;
}

// Po zavření úpravy profilu se vždycky vrací na domovskou stránku (Hry).
function goHome() {
  profileOpen = false;
  homeTab = 'games';
  shopView = 'shop';
  renderStartScreen();
  window.scrollTo(0, 0);
}

function showEditProfileModal() {
  let nameDraft = getSavedName();
  const modal = openModal('');
  const sheet = modal.querySelector('.modal-sheet');
  // ťuknutí na ztmavené pozadí okno zavře (openModal) — a vrátí domů
  modal.addEventListener('click', (e) => { if (e.target === modal) goHome(); });

  function render() {
    const scroll = sheet.scrollTop;
    sheet.innerHTML = editProfileBodyHtml(nameDraft);
    sheet.scrollTop = scroll;

    const input = sheet.querySelector('#edit-profile-name');
    input.addEventListener('input', () => {
      nameDraft = input.value;
      const preview = sheet.querySelector('.edit-profile-preview');
      preview.innerHTML = `${avatarHtml(nameDraft.trim() || '?', myLooks(), 88)}${playerNameHtml(nameDraft.trim() || 'Jméno', myLooks())}`;
    });

    sheet.querySelector('#edit-profile-save').onclick = () => {
      const name = nameDraft.trim();
      if (!name) return showError('Napiš prosím nějaké jméno.');
      localStorage.setItem('vyraz_name', name);
      closeModal();
      goHome();
    };
    sheet.querySelector('#edit-profile-close').onclick = () => {
      closeModal();
      goHome();
    };
    const toShop = sheet.querySelector('#edit-profile-shop');
    if (toShop) {
      toShop.onclick = () => {
        closeModal();
        profileOpen = false;
        homeTab = 'shop';
        backToShop();
      };
    }

    sheet.querySelectorAll('.inv-item').forEach((btn) => {
      btn.onclick = () => {
        const d = shopLoad();
        if (btn.dataset.id) d.equipped[btn.dataset.section] = btn.dataset.id;
        else delete d.equipped[btn.dataset.section];
        shopSave(d);
        render();
      };
    });
  }
  render();
}
