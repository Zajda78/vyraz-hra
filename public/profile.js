// Profil hráče — ukazuje nasazenou kosmetiku ze shopu (rámeček + barva
// jména). Zatím jen lokálně v tomhle telefonu, stejně jako shop.

// ------------------------------------------------ vzhled hráčů ve hře ---
// looks = { frame: id | null, name: id | null } — posílá se přes server,
// takže každý ve hře vidí rámečky a barvy jmen ostatních.

function myLooks() {
  const d = shopLoad();
  return { frame: d.equipped.frame || null, name: d.equipped.name || null, avatar: getAvatar(), ownedCount: d.owned.length };
}

// ------------------------------------------------------- profilovka ---
// Uložená jako malý čtvercový JPEG (data URL) v tomhle telefonu; posílá se
// serveru spolu se vzhledem, takže ji vidí i ostatní hráči.

const AVATAR_SIZE = 112;

function getAvatar() {
  try { return localStorage.getItem('vyraz_avatar') || null; } catch { return null; }
}

function setAvatar(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem('vyraz_avatar', dataUrl);
    else localStorage.removeItem('vyraz_avatar');
  } catch { /* ignore */ }
  sendHello();
}

// Načte vybraný obrázek, ořízne ho na čtverec ze středu a zmenší.
function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas.getContext('2d').drawImage(
        img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, AVATAR_SIZE, AVATAR_SIZE,
      );
      URL.revokeObjectURL(url);
      // server bere profilovky do ~24 000 znaků — detailní fotku uložit v nižší kvalitě
      let dataUrl = canvas.toDataURL('image/jpeg', 0.78);
      if (dataUrl.length > 22000) dataUrl = canvas.toDataURL('image/jpeg', 0.55);
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
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
  // profilovka jen z data URL obrázku — nic jiného se do src nepustí
  const avatar = looks && typeof looks.avatar === 'string' && looks.avatar.startsWith('data:image/') ? looks.avatar : null;
  return `
    <div class="framed-avatar" style="width:${size}px; height:${size}px; padding:${pad}px; border-radius:${Math.round(size * 0.24)}px; background:${frame ? frame.style : 'rgba(255,255,255,0.14)'}">
      <div class="framed-avatar-inner" style="border-radius:${Math.round(size * 0.19)}px; font-size:${Math.round(size * 0.4)}px">${avatar ? `<img class="avatar-img" src="${avatar}" alt="">` : letter}</div>
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
function styledNameHtml(fallback = 'Name') {
  const data = shopLoad();
  return `<span class="styled-name" style="${nameStyleFor(equippedItem(data, 'name'))}">${escapeHtml(getSavedName() || fallback)}</span>`;
}

// Karta profilu na hlavní stránce (záložka Hry).
function profileCardHtml() {
  return `
    <div class="profile-card" id="profile-card" role="button" tabindex="0">
      ${framedAvatarHtml(48)}
      <div class="profile-card-text">
        ${getSavedName() ? `Your name is ${styledNameHtml()}` : 'Set your name'}
      </div>
      <button id="change-name-btn" class="chip-btn chip-icon" title="Profile" aria-label="Open profile">${icon('pencil')}</button>
    </div>`;
}

function wireProfileCard() {
  // celá karta i tužka otevřou profil (úprava jména a vzhledu je v profilu)
  document.getElementById('profile-card').onclick = openProfile;
}

let profileOpen = false;

function openProfile() {
  profileOpen = true;
  renderStartScreen();
  window.scrollTo(0, 0);
  animateScreenIn(1);
}

function closeProfile() {
  profileOpen = false;
  renderStartScreen();
  window.scrollTo(0, 0);
  animateScreenIn(-1);
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
      <button id="profile-back" class="back-btn" title="Back">${icon('back')}</button>
      <div class="brand"><h1>Profile</h1></div>
    </div>

    <div class="screen">
      <div class="profile-hero">
        ${framedAvatarHtml(128)}
        <div class="profile-hero-name">
          ${styledNameHtml('No name')}
          <button id="profile-rename" class="chip-btn chip-icon" title="Edit profile" aria-label="Edit profile">${icon('pencil')}</button>
        </div>
      </div>

      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">${COIN_SVG}<span class="num">${data.coins}</span></div>
          <div class="profile-stat-label">Coins</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${icon('hanger')}<span class="num">${data.owned.length} / ${totalItems}</span></div>
          <div class="profile-stat-label">Collection</div>
          <div class="profile-progress"><div style="width:${pct}%"></div></div>
        </div>
      </div>

      <button class="btn btn-primary btn-block" id="profile-edit-looks">${icon('hanger')} Edit look</button>
      <button class="btn btn-ghost btn-block" id="profile-shop">${icon('bag')} Open a chest in the shop</button>
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
    openInventory(true);
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
  // skiny se nasazují jen v „Edit look“ (inventář), ne tady
  return `
    <div class="x-close-row"><button class="x-close" id="edit-profile-close" aria-label="Close">${icon('close')}</button></div>
    <h2>Edit profile</h2>
    <div class="edit-profile-preview">
      ${avatarHtml(nameDraft || '?', myLooks(), 88)}
      ${playerNameHtml(nameDraft || 'Name', myLooks())}
    </div>
    <div class="avatar-actions">
      <label class="chip-btn avatar-btn">${icon('image')} ${getAvatar() ? 'Change photo' : 'Add photo'}
        <input type="file" accept="image/*" id="avatar-file" hidden>
      </label>
      <label class="chip-btn avatar-btn">${icon('camera')} Selfie
        <input type="file" accept="image/*" capture="user" id="avatar-selfie" hidden>
      </label>
      ${getAvatar() ? `<button class="chip-btn avatar-btn" id="avatar-remove">${icon('close')} Remove</button>` : ''}
    </div>
    <div class="field">
      <input id="edit-profile-name" maxlength="20" value="${escapeHtml(nameDraft)}" placeholder="Your name">
    </div>
    <button id="edit-profile-save" class="btn btn-primary btn-block">Save name</button>
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

// Zavření / uložení úpravy profilu vrátí jen o krok zpět: z profilu zpátky na profil
// (překreslený, ať je vidět nové jméno / profilovka), jinak na hlavní stránku.
function stepBack() {
  if (profileOpen) { renderProfileScreen(); window.scrollTo(0, 0); }
  else goHome();
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
      preview.innerHTML = `${avatarHtml(nameDraft.trim() || '?', myLooks(), 88)}${playerNameHtml(nameDraft.trim() || 'Name', myLooks())}`;
    });

    const onPicked = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        setAvatar(await fileToAvatar(file));
        showToast('Profile photo updated');
      } catch {
        showError('Couldn\'t load that image.');
      }
      render();
    };
    sheet.querySelector('#avatar-file').addEventListener('change', onPicked);
    sheet.querySelector('#avatar-selfie').addEventListener('change', onPicked);
    const remove = sheet.querySelector('#avatar-remove');
    if (remove) remove.onclick = () => { setAvatar(null); render(); };

    sheet.querySelector('#edit-profile-save').onclick = () => {
      const name = nameDraft.trim();
      if (!name) return showError('Please enter a name.');
      localStorage.setItem('vyraz_name', name);
      closeModal();
      stepBack();
    };
    sheet.querySelector('#edit-profile-close').onclick = () => {
      closeModal();
      stepBack();
    };
  }
  render();
}
