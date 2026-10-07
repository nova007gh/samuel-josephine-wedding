'use strict';

/* =========================================================
   Server data layer is in api-data.js
   This file keeps gallery rendering, site settings, RSVP, etc.
   ========================================================= */

const SETTINGS_DB = 'SJWeddingSettings';
const SETTINGS_STORE = 'kv';

/* Server-backed site settings (photos, song, wedding details).
   Declared first: gallery rendering below runs at parse time and reads it. */
let siteSettings = {};

function openSettingsDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SETTINGS_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvSet(key, value){
  const db = await openSettingsDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).put(value, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function kvGet(key){
  const db = await openSettingsDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const r = tx.objectStore(SETTINGS_STORE).get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvRemove(key){
  const db = await openSettingsDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    tx.objectStore(SETTINGS_STORE).delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

function escapeHTML(value=''){
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

/* =========================================================
   Gallery
   ========================================================= */
/* albums shown as cover cards on the gallery landing */
const GALLERY_ALBUMS = [
  { id:'childhood',      label:'Childhood',      cover:'assets/story/sam-childhood.jpg', photoKey:'sam-childhood' },
  { id:'adulthood',      label:'Adulthood',      cover:'assets/story/sam-adult.jpg',     photoKey:'sam-adult' },
  { id:'first-together', label:'First Together', cover:'assets/story/facetime.jpg',      photoKey:'facetime' },
  { id:'engagement',     label:'Engagement',     cover:'assets/story/proposal.jpg',      photoKey:'proposal' },
  { id:'wedding-photos', label:'Wedding Photos', cover:'assets/couple-home.jpg',         photoKey:'couple' },
  { id:'wedding-videos', label:'Wedding Videos', cover:'assets/story/now.jpg',           photoKey:'now' },
  { id:'voice-messages', label:'Voice & Music',  cover:'assets/story/facetime.jpg',      photoKey:'facetime' },
  { id:'video-messages', label:'Video Messages', cover:'assets/story/proposal.jpg',      photoKey:'proposal' }
];

/* the album a guest upload belongs in when they don't pick one */
function defaultAlbumFor(type, kind){
  if (kind === 'voice' || /^audio\//.test(type || '')) return 'voice-messages';
  if (kind === 'videomsg') return 'video-messages';
  if (/^video\//.test(type || '')) return 'wedding-videos';
  return 'wedding-photos';
}

const CATEGORY_LABELS = {
  ...Object.fromEntries(GALLERY_ALBUMS.map(a => [a.id, a.label])),
  /* not a Gallery album any more — it lives on Our Story — but the label is
     still handy if an admin surface ever needs to name the bucket */
  'sj-gallery': 'S&J Gallery'
};

/* built-in memories shown alongside guest uploads */
const SEED_MEMORIES = [
  { src:'assets/story/sam-childhood.jpg',   photoKey:'sam-childhood',   category:'childhood',      caption:'Little Sam with big dreams.' },
  { src:'assets/story/jossy-childhood.jpg', photoKey:'jossy-childhood', category:'childhood',      caption:'Sweet Jossy, full of joy.' },
  { src:'assets/story/sam-adult.jpg',       photoKey:'sam-adult',       category:'adulthood',      caption:'Sam, becoming who he is today.' },
  { src:'assets/story/jossy-adult.jpg',     photoKey:'jossy-adult',     category:'adulthood',      caption:'Jossy, radiant as ever.' },
  { src:'assets/story/facetime.jpg',        photoKey:'facetime',        category:'first-together', caption:'Late-night FaceTime calls across the ocean.' },
  { src:'assets/story/now.jpg',             photoKey:'now',             category:'first-together', caption:'Together at last.' },
  { src:'assets/story/proposal.jpg',        photoKey:'proposal',        category:'engagement',     caption:'She said YES! Accra, on her birthday.' },
  { src:'assets/couple-home.jpg',           photoKey:'couple',          category:'engagement',     caption:'#AlwaysAndForever' }
];

let activeGalleryFilter = 'all';   // album id, or 'all'
let activeGalleryKind = 'all';     // all | photos | videos | selfies | voice | messages
let latestMemories = [];

/* does an item match the active media-type chip? */
function matchesKind(item){
  const t = item.type || '';
  switch (activeGalleryKind){
    case 'photos':   return t.startsWith('image/');
    case 'videos':   return t.startsWith('video/');
    case 'voice':    return t.startsWith('audio/');
    case 'selfies':  return item.kind === 'selfie';
    case 'messages': return item.kind === 'videomsg' || item.kind === 'voice';
    default:         return true;
  }
}

function allGalleryItems(){
  // Only show approved memories to users; seed memories are always visible.
  // S&J Gallery is deliberately excluded: the couple's own album is presented
  // on the Our Story page, and duplicating it here would show the same photos
  // in two places.
  const uploaded = latestMemories
    .filter(m => m.status === 'approved' && m.category !== 'sj-gallery')
    .map(m => ({ ...m, seeded:false }));
  const seeded = SEED_MEMORIES.map(m => ({ ...m, src: sitePhoto(m.photoKey, m.src), type:'image/jpeg', seeded:true }));
  return [...uploaded, ...seeded];
}

/* ---- album cover cards ---- */
function renderAlbums(){
  const host = document.getElementById('galleryCats');
  if (!host) return;
  const items = allGalleryItems().filter(matchesKind);

  host.innerHTML = GALLERY_ALBUMS.map(album => {
    const count = items.filter(m => m.category === album.id).length;
    const cover = items.find(m => m.category === album.id && (m.src || m.mediaUrl) &&
      (m.type || '').startsWith('image/'));
    const src = (cover && (cover.src || cover.mediaUrl)) || sitePhoto(album.photoKey, album.cover);

    return `
      <button class="cat-card" data-album="${album.id}" type="button">
        <span class="cat-thumb"><img loading="lazy" decoding="async" src="${src}" alt="${escapeHTML(album.label)}"></span>
        <span class="cat-name">${escapeHTML(album.label)}</span>
        <span class="cat-count">${count}</span>
      </button>`;
  }).join('');

  host.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => openAlbum(card.dataset.album));
  });
}

function openAlbum(id){
  activeGalleryFilter = id;
  document.getElementById('galleryCats')?.classList.add('hidden');
  document.getElementById('galleryDetail')?.classList.remove('hidden');
  const title = document.getElementById('galleryDetailTitle');
  if (title) title.textContent = CATEGORY_LABELS[id] || 'Memories';
  renderGallery();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeAlbum(){
  activeGalleryFilter = 'all';
  document.getElementById('galleryDetail')?.classList.add('hidden');
  document.getElementById('galleryCats')?.classList.remove('hidden');
  renderAlbums();
}

document.getElementById('galleryBack')?.addEventListener('click', closeAlbum);

document.getElementById('shareUploadBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('uploadPanel');
  panel?.classList.toggle('hidden');
  if (panel && !panel.classList.contains('hidden')){
    panel.scrollIntoView({ behavior:'smooth', block:'center' });
  }
});

let galleryRenderKey = '';

function renderGallery(memories){
  if (Array.isArray(memories)) latestMemories = memories;
  renderAlbums();

  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('galleryEmpty');
  if (!grid || !empty) return;

  const all = allGalleryItems().filter(matchesKind);
  const items = activeGalleryFilter === 'all'
    ? all
    : all.filter(m => m.category === activeGalleryFilter);

  /* Rebuilding the grid destroys any <video>/<audio> mid-playback, so the
     15s feed poll would cut playback off. Skip the rebuild when nothing
     visible has changed, and never interrupt media that is playing. */
  const key = activeGalleryFilter + '/' + activeGalleryKind + '#' +
    items.map(m => (m.id || m.src) + ':' + (m.status || '') + ':' + (m.caption || '')).join('|');
  if (key === galleryRenderKey && grid.children.length) return;
  const playing = [...grid.querySelectorAll('video, audio')].some(el => !el.paused && !el.ended);
  if (playing) return;
  galleryRenderKey = key;

  grid.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);

  for (const item of items){
    let url = item.src || item.mediaUrl;

    const card = document.createElement('article');
    card.className = 'mem-card';
    let media;
    if (item.type.startsWith('video/')){
      media = `<div class="mem-media">
        <video controls playsinline preload="metadata" controlslist="nodownload" src="${url}"></video>
        <button class="mem-expand" type="button" title="Watch full screen" aria-label="Watch full screen">&#9974;</button>
      </div>`;
    } else if (item.type.startsWith('audio/')){
      media = `<div class="mem-audio"><span class="mem-audio-icon">&#127908;</span><audio controls preload="metadata" src="${url}"></audio></div>`;
    } else {
      media = `<img loading="lazy" decoding="async" src="${url}" alt="${escapeHTML(item.caption || 'Wedding memory')}">`;
    }

    const byline = item.guestName ? `<p class="mem-by">by ${escapeHTML(item.guestName)}</p>` : '';
    card.innerHTML = `
      ${media}
      <div class="mem-meta">
        <span class="mem-cat">${escapeHTML(CATEGORY_LABELS[item.category] || item.category)}</span>
        <p class="mem-cap">${escapeHTML(item.caption || 'A beautiful memory')}</p>
        ${byline}
        ${item.seeded || !isAdmin() ? '' : `<button class="mem-del" data-id="${item.id}" type="button">Remove</button>`}
      </div>`;

    const label = item.caption || CATEGORY_LABELS[item.category] || '';
    if (!item.type.startsWith('video/') && !item.type.startsWith('audio/')){
      card.querySelector('img').addEventListener('click', () => openLightbox(url, label, item.type));
    }
    card.querySelector('.mem-expand')?.addEventListener('click', () => {
      card.querySelector('video')?.pause();
      openLightbox(url, label, item.type);
    });
    grid.appendChild(card);
  }

  grid.querySelectorAll('.mem-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this memory?')) return;
      try { await deleteMemory(btn.dataset.id); }
      catch(err){ console.warn('Delete failed:', err); alert('Could not remove this memory.'); }
    });
  });
}

document.getElementById('memoryFiles')?.addEventListener('change', async event => {
  const files = [...event.target.files];
  if (!files.length) return;

  const category = document.getElementById('memoryCategory').value;
  const captionEl = document.getElementById('memoryCaption');
  const caption = captionEl.value.trim();
  const status = document.getElementById('uploadStatus');

  status.classList.remove('hidden');
  event.target.disabled = true;

  let saved = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i++){
    const file = files[i];
    status.textContent = `Saving ${i + 1} of ${files.length}…`;
    try {
      await addMemory({
        category,
        caption: files.length === 1 ? caption : (caption ? `${caption} ${i + 1}` : ''),
        type: file.type || 'application/octet-stream',
        name: file.name,
        size: file.size,
        blob: file,
        status: 'pending',
        guestName: (typeof getGuest === 'function' ? getGuest()?.name : '') || ''
      });
      saved++;
    } catch(err){
      console.warn('Upload failed:', file.name, err);
      failed++;
    }
  }

  event.target.disabled = false;
  event.target.value = '';
  if (failed && !saved){
    status.textContent = 'Upload failed. Please check your connection and try again.';
  } else {
    captionEl.value = '';
    status.textContent = `${saved} ${saved === 1 ? 'memory' : 'memories'} saved${failed ? ` (${failed} failed)` : ''}. Pending approval — Samuel & Jossy will review shortly.`;
  }
  setTimeout(() => status.classList.add('hidden'), 6000);
});

document.querySelectorAll('#galleryChips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    activeGalleryKind = chip.dataset.kind;
    document.querySelectorAll('#galleryChips .chip')
      .forEach(c => c.classList.toggle('active', c === chip));
    renderGallery();
  });
});

renderAlbums();

if (typeof onMemories === 'function'){
  onMemories(rows => { renderGallery(rows); renderTimeline(); renderSjStoryPanel(); });
}

/* =========================================================
   Lightbox
   ========================================================= */
const lightbox = document.getElementById('lightbox');
const lightboxBody = document.getElementById('lightboxBody');
const lightboxCaption = document.getElementById('lightboxCaption');

function openLightbox(src, caption='', type='image'){
  if (!lightbox) return;
  lightboxBody.innerHTML = type.startsWith('video/')
    ? `<video src="${src}" controls playsinline autoplay preload="metadata"></video>`
    : type.startsWith('audio/')
      ? `<audio src="${src}" controls autoplay preload="metadata"></audio>`
      : `<img src="${src}" alt="${escapeHTML(caption || 'Wedding photo')}">`;
  lightboxCaption.textContent = caption;
  lightbox.classList.remove('hidden');
  document.body.classList.add('locked');
}
function closeLightbox(){
  lightbox?.classList.add('hidden');
  /* stop playback before dropping the element so audio can't keep going */
  lightboxBody?.querySelectorAll('video, audio').forEach(el => { el.pause(); el.removeAttribute('src'); });
  if (lightboxBody) lightboxBody.innerHTML = '';
  document.body.classList.remove('locked');
  /* a detached media element's pause event can't reach document — tell the
     song-ducking tracker directly so the wedding song un-mutes now */
  if (typeof reconcileDucking === 'function') reconcileDucking();
}
document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) closeLightbox();
});

/* timeline photos open in the lightbox too */
document.querySelectorAll('.tl-photo img').forEach(img => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    const card = img.closest('.tl-row')?.querySelector('.tl-card h4');
    openLightbox(img.getAttribute('src'), card ? card.textContent : '');
  });
});

/* =========================================================
   Site settings — couple photo & story photos live on the server.
   Admin changes them from the dashboard; every guest sees the result.
   ========================================================= */
const SITE_PHOTO_SLOTS = [
  { slot:'couple',          label:'Couple Photo (Home)',   def:'assets/couple-home.jpg' },
  { slot:'landing',         label:'Landing Page Art',      def:'assets/landing-invite.jpg' },
  { slot:'welcome',         label:'Welcome Background',    def:'assets/welcome-bg.jpg' },
  { slot:'attend',          label:'Enter Screen Art',      def:'assets/attend-bg.jpg' },
  { slot:'sam-childhood',   label:'Sam — Childhood',       def:'assets/story/sam-childhood.jpg' },
  { slot:'jossy-childhood', label:'Jossy — Childhood',     def:'assets/story/jossy-childhood.jpg' },
  { slot:'sam-adult',       label:'Sam — Adult',           def:'assets/story/sam-adult.jpg' },
  { slot:'jossy-adult',     label:'Jossy — Adult',         def:'assets/story/jossy-adult.jpg' },
  { slot:'facetime',        label:'FaceTime',              def:'assets/story/facetime.jpg' },
  { slot:'proposal',        label:'The Proposal',          def:'assets/story/proposal.jpg' },
  { slot:'now',             label:'Engaged Now',           def:'assets/story/now.jpg' },
  { slot:'admin-heart',     label:'Home Heart Photo',      def:'assets/couple-home.jpg' }
];
const SLOT_DEFS = Object.fromEntries(SITE_PHOTO_SLOTS.map(s => [s.slot, s.def]));

/* story timeline defaults — declared before the init block below runs
   (the const would be in the temporal dead zone during init otherwise) */
const DEFAULT_STORY_ITEMS = [
  { slot:'sam-childhood',   m:'APR', d:'12', y:'1996', emoji:'\u{1F476}', title:'BIG SAM',   text:'Little Sam with big dreams and a kind heart.' },
  { slot:'jossy-childhood', m:'APR', d:'18', y:'1997', emoji:'\u{1F483}', title:'JOSSY THE TEENAGER', text:'Sweet Jossy, full of joy, faith and love.' },
  { slot:'sam-adult',       m:'MAY', d:'20', y:'2018', emoji:'\u{1F393}', title:'SAM BEING A MAN',          text:'Growing, learning and becoming who we are today.' },
  { slot:'jossy-adult',     m:'JUN', d:'10', y:'2019', emoji:'\u{1F4AC}', title:'JOSSY MATURED INTO A PERFECT WOMAN',      text:'A simple comment changed everything. \u201cVery pretty\u201d \u{1F60A}' },
  { slot:'facetime',        m:'JUN', d:'13', y:'2019', emoji:'\u2708',   title:'FACETIME CALLS',       text:'I asked her to be my wife on FaceTime. \u2764' },
  { slot:'proposal',        m:'OCT', d:'10', y:'2019', emoji:'\u{1F48D}', title:'SHE SAID YES!',  text:'Traveled from Atlanta to Accra and surprised her with the question of a lifetime. She said YES! \u{1F48D}' },
  { slot:'now',             m:'NOW', d:'',   y:'\u2764', emoji:'\u{1F495}', title:'ENGAGED & FOREVER', text:"Now we're building our forever together. \u{1F495}" },
];

function sitePhoto(slot, fallback){
  if (!slot) return fallback;
  const key = slot === 'couple' ? 'couplePhotoUrl' : `photo:${slot}`;
  /* the admin heart follows the couple photo until it gets its own */
  if (slot === 'admin-heart' && !siteSettings[key]) return sitePhoto('couple', fallback);
  return siteSettings[key] || fallback;
}

function applySitePhotos(){
  document.querySelectorAll('[data-site-photo]').forEach(img => {
    img.src = sitePhoto(img.dataset.sitePhoto, SLOT_DEFS[img.dataset.sitePhoto] || img.getAttribute('src'));
  });
  /* the landing screen shows the bundled invitation art; uploading Landing
     Page Art in Site Settings replaces it, and the code-rendered card
     stays available as the no-art fallback */
  const landUrl = siteSettings['photo:landing'] || SLOT_DEFS.landing;
  const lFrame = document.getElementById('landingFrame');
  const lArt = document.getElementById('landingArt');
  lFrame?.classList.toggle('landing-frame--card', !landUrl);
  if (lArt){
    lArt.classList.toggle('hidden', !landUrl);
    if (landUrl) lArt.src = landUrl;
  }
}

/* remember which photo is in each slot so the next page load can apply it
   before the network answers — otherwise the bundled default flashes first */
function cacheSitePhotos(){
  try {
    const map = {};
    document.querySelectorAll('[data-site-photo]').forEach(img => { map[img.dataset.sitePhoto] = img.src; });
    localStorage.setItem('sj_site_photos', JSON.stringify(map));
  } catch {}
}

const couplePhoto = document.getElementById('couplePhoto');
const couplePhotoFile = document.getElementById('couplePhotoFile');
const couplePlaceholder = document.getElementById('couplePlaceholder');

function showCouplePhoto(has){
  couplePhoto?.classList.toggle('hidden', !has);
  couplePlaceholder?.classList.toggle('hidden', has);
}

(async () => {
  try {
    siteSettings = await getSettings();
  } catch(err){
    console.warn('Site settings unavailable:', err);
    siteSettings = {};
  }
  renderTimeline();
  applySitePhotos();
  cacheSitePhotos();
  applyWeddingDetails();
  fillWeddingForm();
  syncSiteSettings();   // seeds the live-sync baseline
  if (couplePhoto) couplePhoto.src = sitePhoto('couple', 'assets/couple-home.jpg');
  showCouplePhoto(true);
  renderAlbums();
  renderGallery();
  renderSiteSettings();
  renderHomeLikes();
})();

/* only the couple (admin) can change the photo — it is shared for all guests */
couplePhoto?.addEventListener('click', () => { if (isAdmin()) couplePhotoFile?.click(); });
couplePlaceholder?.addEventListener('click', e => { if (!isAdmin()) e.preventDefault(); });

async function saveSitePhoto(file, slot){
  const res = await uploadSitePhoto(file, slot);
  siteSettings[slot === 'couple' ? 'couplePhotoUrl' : `photo:${slot}`] = res.url;
  applySitePhotos();
  cacheSitePhotos();
  if (couplePhoto) couplePhoto.src = sitePhoto('couple', 'assets/couple-home.jpg');
  renderAlbums();
  renderGallery();
  renderSiteSettings();
}

couplePhotoFile?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !isAdmin()) return;
  try { await saveSitePhoto(file, 'couple'); }
  catch(err){
    console.warn('Photo update failed:', err);
    alert('Could not update the photo. Are you still signed in as admin?');
  }
});

/* ---------- Admin dashboard: Site Settings ---------- */
let pendingPhotoSlot = 'couple';
let pendingPhotoCard = null;
const sitePhotoInput = document.getElementById('sitePhotoInput');
const songFileInput = document.getElementById('songFileInput');

function renderSiteSettings(){
  const grid = document.getElementById('settingsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const s of SITE_PHOTO_SLOTS){
    const card = document.createElement('article');
    card.className = 'aq-card';
    card.innerHTML = `
      <img class="aq-media${s.slot === 'admin-heart' ? ' heart-preview' : ''}" src="${sitePhoto(s.slot, s.def)}" alt="${escapeHTML(s.label)}">
      <small>${escapeHTML(s.label)}</small>
      <div class="aq-actions"><button class="aq-approve" type="button">CHANGE</button></div>`;
    card.querySelector('button').addEventListener('click', () => {
      pendingPhotoSlot = s.slot;
      pendingPhotoCard = card;
      sitePhotoInput?.click();
    });
    grid.appendChild(card);
  }
  const label = document.getElementById('songSettingLabel');
  renderSongList();
  fillStoryEditor();
  fillAnnouncement();
  renderAdminEmails();
}

/* the wedding playlist — songs[] in settings; songUrl mirrors song 1 */
function getSongList(){
  try {
    const list = JSON.parse(siteSettings.songs || '[]');
    if (list.length) return list;
  } catch {}
  return siteSettings.songUrl ? [{ url: siteSettings.songUrl, label: siteSettings.songLabel || 'Wedding song' }] : [];
}
function renderSongList(){
  const wrap = document.getElementById('songList');
  const label = document.getElementById('songSettingLabel');
  if (!wrap) return;
  const songs = getSongList();
  wrap.innerHTML = '';
  songs.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'song-row';
    row.innerHTML = `
      <span class="song-num">${i + 1}</span>
      <audio controls preload="metadata" src="${s.url}"></audio>
      <span class="song-name">${escapeHTML(s.label || `Song ${i + 1}`)}</span>
      ${isAdmin() ? `<span class="song-actions">
        ${i === 0 ? '<span class="song-first-badge" title="This song opens the playlist">PLAYS 1ST</span>' : ''}
        <span class="song-order">
          <button class="song-up" type="button" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
          <button class="song-down" type="button" aria-label="Move down" ${i === songs.length - 1 ? 'disabled' : ''}>&#9660;</button>
        </span>
        <button class="aq-reject song-del" type="button">REMOVE</button></span>` : ''}`;
    const applyOrder = res => {
      siteSettings.songs = JSON.stringify(res.songs || []);
      siteSettings.songUrl = res.songs?.[0]?.url || '';
      siteSettings.songLabel = res.songs?.[0]?.label || '';
      renderSiteSettings();
      if (typeof loadSong === 'function') loadSong();
    };
    row.querySelector('.song-up')?.addEventListener('click', async () => {
      try { applyOrder(await songMove(i, i - 1)); }
      catch { alert('Could not reorder. Are you still signed in?'); }
    });
    row.querySelector('.song-down')?.addEventListener('click', async () => {
      try { applyOrder(await songMove(i, i + 1)); }
      catch { alert('Could not reorder. Are you still signed in?'); }
    });
    row.querySelector('.song-del')?.addEventListener('click', async () => {
      if (!confirm(`Remove "${s.label || 'this song'}"?`)) return;
      try {
        const res = await deleteSiteSong(i);
        siteSettings.songs = JSON.stringify(res.songs || []);
        siteSettings.songUrl = res.songs?.[0]?.url || '';
        siteSettings.songLabel = res.songs?.[0]?.label || '';
        renderSiteSettings();
        if (typeof loadSong === 'function') loadSong();
      } catch(err){ alert('Could not remove the song. Are you still signed in?'); }
    });
    wrap.appendChild(row);
  });
  if (label) label.textContent = songs.length
    ? `${songs.length} song${songs.length > 1 ? 's' : ''} — plays in order for every guest`
    : 'No songs uploaded yet';
}
renderSiteSettings();

sitePhotoInput?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !isAdmin()) return;
  // instant local preview + saving state while it uploads
  const img = pendingPhotoCard?.querySelector('img');
  const btn = pendingPhotoCard?.querySelector('button');
  const prevSrc = img?.src;
  if (img) img.src = URL.createObjectURL(file);
  if (btn){ btn.disabled = true; btn.textContent = 'SAVING…'; }
  try { await saveSitePhoto(file, pendingPhotoSlot); }
  catch(err){
    console.warn('Photo update failed:', err);
    if (img && prevSrc) img.src = prevSrc;
    alert('Could not update the photo. Are you still signed in as admin?');
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = 'CHANGE'; }
    pendingPhotoCard = null;
  }
});

document.getElementById('songChangeBtn')?.addEventListener('click', () => {
  if (isAdmin()) songFileInput?.click();
});

songFileInput?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !isAdmin()) return;
  const btn = document.getElementById('songChangeBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'SAVING…'; }
  try {
    const res = await uploadSiteSong(file, file.name);
    siteSettings.songs = JSON.stringify(res.songs || []);
    siteSettings.songUrl = res.songs?.[0]?.url || res.url;
    siteSettings.songLabel = res.songs?.[0]?.label || file.name;
    renderSiteSettings();
    if (typeof loadSong === 'function') loadSong();
  } catch(err){
    console.warn('Song upload failed:', err);
    alert('Could not upload the song. Are you still signed in as admin?');
  } finally {
    const btn = document.getElementById('songChangeBtn');
    if (btn){ btn.disabled = false; btn.textContent = 'CHANGE SONG'; }
  }
});

/* =========================================================
   Wedding details — admin-editable text shown to every guest
   (names, date, venue, hashtag, schedule, story, RSVP deadline)
   ========================================================= */
const WED_DEFAULTS = {
  weddingNameA: 'Sam',
  weddingNameB: 'Jossy',
  weddingFormal: 'SAMUEL & JOSEPHINE',
  weddingDateISO: '2027-01-09T10:00',
  weddingVenue: 'Accra, Ghana',
  weddingHashtag: '#AlwaysAndForever',
  weddingTagline: 'OUR FOREVER STARTS HERE',
  rsvpDeadline: 'Dec 01, 2026',
  storyText: '',
  mapUrl: '',
  events: '[{"icon":"⛪","time":"10:00 AM","name":"Traditional Wedding"},{"icon":"💍","time":"3:00 PM","name":"White Wedding"},{"icon":"🥂","time":"6:00 PM","name":"Reception"}]'
};

function wed(key){ return siteSettings[key] || WED_DEFAULTS[key] || ''; }

function applyWeddingDetails(){
  const det = {};
  for (const k of Object.keys(WED_DEFAULTS)) det[k] = wed(k);
  window.weddingDetails = det;

  const d = new Date(det.weddingDateISO);
  const valid = !Number.isNaN(d.getTime());
  const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const monthsShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const dateLabel = valid
    ? d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
    : 'January 9, 2027';

  document.querySelectorAll('[data-wed]').forEach(el => {
    switch (el.dataset.wed){
      case 'nameA':     el.textContent = det.weddingNameA; break;
      case 'nameB':     el.textContent = det.weddingNameB; break;
      case 'formal':    el.textContent = det.weddingFormal; break;
      case 'tagline':   el.textContent = det.weddingTagline; break;
      case 'dateLabel': el.textContent = dateLabel; break;
      case 'venue':     el.textContent = det.weddingVenue.toUpperCase(); break;
      case 'hashtag':   el.textContent = det.weddingHashtag; break;
      case 'month':     el.textContent = valid ? MONTHS[d.getMonth()] : 'JANUARY'; break;
      case 'day':       el.textContent = valid ? String(d.getDate()).padStart(2,'0') : '09'; break;
      case 'year':      el.textContent = valid ? String(d.getFullYear()) : '2027'; break;
    }
  });

  const bigday = document.getElementById('bigdayDate');
  if (bigday && valid)
    bigday.innerHTML = `${String(d.getDate()).padStart(2,'0')} <b>|</b> ${monthsShort[d.getMonth()]} <b>|</b> ${d.getFullYear()}`;

  const deadline = document.getElementById('rsvpDeadlineText');
  if (deadline) deadline.textContent = `Kindly respond before ${det.rsvpDeadline}`;

  const story = document.getElementById('storyText');
  if (story && det.storyText) story.textContent = det.storyText;

  // schedule rows rebuilt from the events setting
  const sched = document.getElementById('schedRows');
  if (sched){
    let events = [];
    try { events = JSON.parse(det.events) || []; } catch {}
    sched.innerHTML = events.map(ev => `
      <div class="sched-row">
        <span class="sched-icon">${ev.icon || '❤'}</span>
        <span class="sched-time">${escapeHTML(ev.time || '')}</span>
        <span class="sched-name">${escapeHTML(ev.name || '')}</span>
      </div>`).join('');
  }

  if (valid && typeof window.setWeddingDate === 'function') window.setWeddingDate(det.weddingDateISO);
}

/* ---------- admin: Wedding Details form ---------- */
const WED_INPUTS = {
  wedNameA:'weddingNameA', wedNameB:'weddingNameB', wedFormal:'weddingFormal',
  wedDate:'weddingDateISO', wedVenue:'weddingVenue', wedMapUrl:'mapUrl',
  wedHashtag:'weddingHashtag', wedTagline:'weddingTagline',
  wedDeadline:'rsvpDeadline', wedStory:'storyText'
};
const WED_EVENT_ICONS = ['⛪','💍','🥂'];

function fillWeddingForm(){
  for (const [id, key] of Object.entries(WED_INPUTS)){
    const el = document.getElementById(id);
    if (el) el.value = siteSettings[key] || (key === 'storyText' ? '' : WED_DEFAULTS[key] || '');
  }
  let events = [];
  try { events = JSON.parse(wed('events')) || []; } catch {}
  for (let i = 1; i <= 3; i++){
    const t = document.getElementById(`wedEv${i}Time`);
    const n = document.getElementById(`wedEv${i}Name`);
    if (t) t.value = events[i-1]?.time || '';
    if (n) n.value = events[i-1]?.name || '';
  }
}

document.getElementById('wedSaveBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const status = document.getElementById('wedSaveStatus');
  if (!isAdmin()){
    if (status) status.textContent = 'Sign in as admin first to save wedding details.';
    return;
  }
  const fields = {};
  for (const [id, key] of Object.entries(WED_INPUTS)){
    const el = document.getElementById(id);
    if (el && el.value.trim()) fields[key] = el.value.trim();
  }
  const events = [1,2,3].map(i => ({
    icon: WED_EVENT_ICONS[i-1],
    time: document.getElementById(`wedEv${i}Time`)?.value.trim() || '',
    name: document.getElementById(`wedEv${i}Name`)?.value.trim() || ''
  })).filter(ev => ev.name || ev.time);
  if (events.length) fields.events = JSON.stringify(events);

  btn.disabled = true;
  btn.textContent = 'SAVING…';
  if (status) status.textContent = '';
  try {
    await patchSettings(fields);
    Object.assign(siteSettings, fields);
    applyWeddingDetails();
    if (status) status.textContent = 'Saved — every guest now sees the new details.';
  } catch(err){
    console.warn('Details save failed:', err);
    if (status) status.textContent = 'Save failed — are you still signed in?';
  } finally {
    btn.disabled = false;
    btn.textContent = 'SAVE DETAILS';
  }
});

/* ---------- Our Story timeline — admin-editable, guest-likeable ---------- */
function getStoryItems(){
  try {
    const list = JSON.parse(siteSettings.storyItems || '[]');
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return DEFAULT_STORY_ITEMS;
}
function getStoryLikes(){
  try { return JSON.parse(siteSettings.storyLikes || '{}') || {}; } catch { return {}; }
}
function myStoryLikes(){
  try { return JSON.parse(localStorage.getItem('sj_story_likes') || '[]'); } catch { return []; }
}

const TL_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
let timelineRenderKey = '';
function renderTimeline(){
  const tl = document.querySelector('.timeline');
  if (!tl) return;
  const likes = getStoryLikes();
  const mine = new Set(myStoryLikes());
  const items = getStoryItems();
  /* the couple's album continues the story — S&J Gallery uploads append
     after the written moments, oldest first so it reads chronologically */
  const sj = (latestMemories || [])
    .filter(m => m.status === 'approved' && m.category === 'sj-gallery' && m.mediaUrl)
    .slice()
    .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));

  /* feeds poll every 15s — rebuilding would stomp scroll position and
     kill any playing video, so only repaint when content actually changed */
  const key = JSON.stringify([items, sj.map(m => [m.id, m.caption]), likes, isAdmin()]);
  if (key === timelineRenderKey) return;
  if ([...tl.querySelectorAll('video, audio')].some(el => !el.paused && !el.ended)) return;
  timelineRenderKey = key;

  tl.innerHTML = items.map((it, i) => {
    const id = it.slot || `item-${i}`;
    const liked = mine.has(id);
    const card = `<div class="tl-card">
        <h4>${escapeHTML(it.title || '')}</h4>
        <p>${escapeHTML(it.text || '')}</p>
        <button class="tl-like ${liked ? 'liked' : ''}" data-like="${escapeHTML(id)}" type="button" aria-label="Love this moment">
          <span class="tl-heart">&#10084;</span><b class="tl-count">${likes[id] || 0}</b>
        </button>
        ${isAdmin() ? `<button class="tl-edit" data-edit-idx="${i}" type="button" aria-label="Edit this moment">&#9998;</button>` : ''}
      </div>`;
    const date = `<div class="tl-date">${it.m ? `<span>${escapeHTML(it.m)}</span>` : ''}${it.d ? `<b>${escapeHTML(it.d)}</b>` : ''}${it.y ? `<span>${escapeHTML(it.y)}</span>` : ''}</div>`;
    const photo = `<div class="tl-photo"><img src="${SLOT_DEFS[it.slot] || 'assets/story/now.jpg'}" data-site-photo="${escapeHTML(it.slot || '')}" alt="${escapeHTML(it.title || '')}" loading="lazy"></div>`;
    const pair = i % 2
      ? `<div class="tl-pair tl-pair--rev">${photo}${date}</div>`
      : `<div class="tl-pair">${date}${photo}</div>`;
    const node = `<span class="tl-node">${it.emoji || '&#10084;'}</span>`;
    return `<div class="tl-row">${i % 2 ? card + node + pair : pair + node + card}</div>`;
  }).join('')
  + (sj.length ? `<div class="tl-section"><span>S&amp;J GALLERY</span></div>` : '')
  + sj.map((m, j) => {
    const i = items.length + j;
    const liked = mine.has(m.id);
    const d = new Date(toMillis(m.createdAt));
    const card = `<div class="tl-card">
        <h4>${escapeHTML(m.caption || 'S&J GALLERY')}</h4>
        <p>Shared by Sam &amp; Jossy</p>
        <button class="tl-like ${liked ? 'liked' : ''}" data-like="${escapeHTML(m.id)}" type="button" aria-label="Love this memory">
          <span class="tl-heart">&#10084;</span><b class="tl-count">${likes[m.id] || 0}</b>
        </button>
        ${isAdmin() ? `<button class="tl-edit-sj" type="button" aria-label="Manage in S&J Gallery">&#9998;</button>` : ''}
      </div>`;
    const date = `<div class="tl-date"><span>${TL_MONTHS[d.getMonth()]}</span><b>${d.getDate()}</b><span>${d.getFullYear()}</span></div>`;
    const photo = (m.type || '').startsWith('video/')
      ? `<div class="tl-photo"><video src="${m.mediaUrl}" controls playsinline preload="metadata"></video></div>`
      : `<div class="tl-photo"><img src="${m.mediaUrl}" alt="${escapeHTML(m.caption || 'S&J memory')}" loading="lazy"></div>`;
    const pair = i % 2
      ? `<div class="tl-pair tl-pair--rev">${photo}${date}</div>`
      : `<div class="tl-pair">${date}${photo}</div>`;
    const node = `<span class="tl-node">&#128155;</span>`;
    return `<div class="tl-row">${i % 2 ? card + node + pair : pair + node + card}</div>`;
  }).join('');
  applySitePhotos();
}

/* ---------- live sync — admin edits reach every open phone ---------- */
const liveSnap = {};
function snapOf(s, pick){
  return JSON.stringify(Object.keys(s).filter(pick).sort().map(k => [k, s[k]]));
}
async function syncSiteSettings(){
  if (document.visibilityState === 'hidden') return;
  let fresh;
  try { fresh = await getSettings(); } catch { return; }
  const groups = {
    story:   k => k === 'storyItems' || k === 'storyLikes',
    photos:  k => k === 'couplePhotoUrl' || k.startsWith('photo:'),
    details: k => k.startsWith('wedding') || ['events','mapUrl','rsvpDeadline','storyText'].includes(k),
    songs:   k => k === 'songs' || k === 'songUrl',
    likes:   k => k === 'homeLikes'
  };
  const changed = {};
  for (const [g, pick] of Object.entries(groups)){
    const snap = snapOf(fresh, pick);
    changed[g] = liveSnap[g] !== undefined && liveSnap[g] !== snap;
    liveSnap[g] = snap;
  }
  for (const k of Object.keys(siteSettings)) if (!(k in fresh)) delete siteSettings[k];
  Object.assign(siteSettings, fresh);
  if (changed.story) renderTimeline();
  if (changed.photos){ applySitePhotos(); cacheSitePhotos(); }
  if (changed.details) applyWeddingDetails();
  if (changed.songs && typeof loadSong === 'function') loadSong();
  if (changed.likes) renderHomeLikes();
  /* keep the admin's lists current, but never overwrite a field being typed in */
  if ((changed.story || changed.songs) && isAdmin() && !document.activeElement?.closest('[data-view="admin"]'))
    renderSiteSettings();
}
setInterval(syncSiteSettings, 15000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncSiteSettings(); });

/* tap a story photo → open it full screen */
document.addEventListener('click', e => {
  const img = e.target.closest('.tl-photo img');
  if (!img) return;
  const title = img.closest('.tl-row')?.querySelector('.tl-card h4')?.textContent || img.alt || '';
  openLightbox(img.currentSrc || img.src, title);
});

/* ---------- S&J Gallery panel on Our Story ---------- */
function renderSjStoryPanel(){
  const grid = document.getElementById('sjStoryGrid');
  const empty = document.getElementById('sjStoryEmpty');
  if (!grid || !empty) return;

  const items = (latestMemories || [])
    .filter(m => m.status === 'approved' && m.category === 'sj-gallery' && m.mediaUrl)
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)); // newest first

  empty.classList.toggle('hidden', items.length > 0);
  grid.innerHTML = items.map(m => {
    const isVid = (m.type || '').startsWith('video/');
    const media = isVid
      ? `<div class="mem-media"><video src="${m.mediaUrl}" controls playsinline preload="metadata"></video></div>`
      : `<img loading="lazy" decoding="async" src="${m.mediaUrl}" alt="${escapeHTML(m.caption || 'S&J memory')}">`;
    return `<article class="mem-card">
      ${media}
      <div class="mem-meta">
        <p class="mem-cap">${escapeHTML(m.caption || '—')}</p>
        <small>Shared by Sam &amp; Jossy</small>
      </div>
    </article>`;
  }).join('');

  /* photos open in lightbox */
  grid.querySelectorAll('img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const caption = img.closest('.mem-card')?.querySelector('.mem-cap')?.textContent || '';
      openLightbox(img.currentSrc || img.src, caption);
    });
  });
}

/* Re-render when the S&J Gallery tab is opened */
document.querySelector('[data-story-tab="sjgallery"]')?.addEventListener('click', renderSjStoryPanel);

/* admin pencil on a story card — jump straight to that moment in the editor */
document.addEventListener('click', e => {
  const btn = e.target.closest('.tl-edit');
  if (!btn) return;
  switchView('admin');
  const i = parseInt(btn.dataset.editIdx, 10) || 0;
  const sel = document.getElementById('storyEditSelect');
  if (sel){ sel.value = String(i); loadStoryEditorItem(i); }
  document.getElementById('storyEditSelect')?.closest('.aq-card')?.scrollIntoView({ block:'center', behavior:'smooth' });
});

/* admin pencil on an S&J timeline row — jump to the album on the dashboard */
document.addEventListener('click', e => {
  if (!e.target.closest('.tl-edit-sj')) return;
  switchView('admin');
  document.getElementById('sjGrid')?.scrollIntoView({ block:'center', behavior:'smooth' });
});

/* heart toggle — optimistic UI, server reconciles the real count */
document.addEventListener('click', async e => {
  const btn = e.target.closest('.tl-like');
  if (!btn) return;
  const id = btn.dataset.like;
  const mine = new Set(myStoryLikes());
  const liked = mine.has(id);
  const delta = liked ? -1 : 1;
  const countEl = btn.querySelector('.tl-count');
  if (countEl) countEl.textContent = Math.max(0, (parseInt(countEl.textContent, 10) || 0) + delta);
  btn.classList.toggle('liked', !liked);
  if (liked) mine.delete(id); else mine.add(id);
  localStorage.setItem('sj_story_likes', JSON.stringify([...mine]));
  try {
    const res = await likeStoryItem(id, delta);
    if (countEl) countEl.textContent = res.likes;
  } catch {}
});

/* admin story editor */
function fillStoryEditor(){
  const sel = document.getElementById('storyEditSelect');
  if (!sel) return;
  sel.innerHTML = getStoryItems()
    .map((it, i) => `<option value="${i}">${i + 1}. ${escapeHTML(it.title || it.slot || 'Moment')}</option>`)
    .join('');
  loadStoryEditorItem(0);
}
function loadStoryEditorItem(i){
  const it = getStoryItems()[i] || {};
  for (const [id, v] of Object.entries({
    storyEditMonth: it.m, storyEditDay: it.d, storyEditYear: it.y,
    storyEditEmoji: it.emoji, storyEditTitle: it.title, storyEditText: it.text
  })){
    const el = document.getElementById(id);
    if (el) el.value = v || '';
  }
}
document.getElementById('storyEditSelect')?.addEventListener('change', e => loadStoryEditorItem(parseInt(e.target.value, 10)));
document.getElementById('storySaveBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const status = document.getElementById('storySaveStatus');
  if (!isAdmin()){
    if (status) status.textContent = 'Sign in as admin first to edit the story.';
    return;
  }
  const items = getStoryItems();
  const i = parseInt(document.getElementById('storyEditSelect')?.value || '0', 10);
  if (!items[i]) return;
  items[i] = {
    ...items[i],
    m:     (document.getElementById('storyEditMonth')?.value.trim() || '').toUpperCase().slice(0, 9),
    d:     (document.getElementById('storyEditDay')?.value.trim() || '').slice(0, 2),
    y:     (document.getElementById('storyEditYear')?.value.trim() || '').slice(0, 4),
    emoji: document.getElementById('storyEditEmoji')?.value.trim() || '&#10084;',
    title: document.getElementById('storyEditTitle')?.value.trim() || '',
    text:  document.getElementById('storyEditText')?.value.trim() || ''
  };
  btn.disabled = true; btn.textContent = 'SAVING…';
  if (status) status.textContent = '';
  try {
    await patchSettings({ storyItems: JSON.stringify(items) });
    /* read it back from the server so "saved" means saved in the database */
    const fresh = await getSettings();
    const stored = JSON.parse(fresh.storyItems || '[]')[i] || {};
    if (stored.title !== items[i].title || stored.m !== items[i].m || stored.d !== items[i].d || stored.y !== items[i].y)
      throw new Error('Server did not keep the change');
    siteSettings.storyItems = fresh.storyItems;
    renderTimeline();
    fillStoryEditor();
    loadStoryEditorItem(i);
    document.getElementById('storyEditSelect').value = String(i);
    if (status) status.textContent = `✓ Saved to the database — every guest now sees "${items[i].title}" (${[items[i].m, items[i].d, items[i].y].filter(Boolean).join(' ')}).`;
  } catch(err){
    console.warn('Story save failed:', err);
    if (status) status.textContent = 'Save failed — are you still signed in?';
  } finally {
    btn.disabled = false; btn.textContent = 'SAVE MOMENT';
  }
});

/* ---------- announcements to all guests ---------- */
function fillAnnouncement(){
  let ann = null;
  try { ann = JSON.parse(siteSettings.announcement || 'null'); } catch {}
  if (!ann){ refreshAnnouncePreview(); return; }
  const t = document.getElementById('announceText');
  const e = document.getElementById('announceEvery');
  if (t) t.value = ann.text || '';
  if (e) e.value = ann.everyMin || 0;
  const pa = document.getElementById('announcePhotoA');
  const pb = document.getElementById('announcePhotoB');
  if (pa && ann.photoA) pa.value = ann.photoA;
  if (pb && ann.photoB) pb.value = ann.photoB;
  refreshAnnouncePreview();
}

/* thumbnails above each picker + a live copy of the guest pop-up */
function refreshAnnouncePreview(){
  const a = document.getElementById('announcePhotoA')?.value || 'sam-adult';
  const b = document.getElementById('announcePhotoB')?.value || 'jossy-adult';
  const pa = document.getElementById('announcePreviewA');
  const pb = document.getElementById('announcePreviewB');
  if (pa) pa.src = sitePhoto(a, 'assets/seal-logo.png');
  if (pb) pb.src = sitePhoto(b, 'assets/seal-logo.png');
  const toast = document.getElementById('announcePreviewToast');
  if (toast && typeof announceMarkup === 'function')
    toast.innerHTML = announceMarkup({
      text: document.getElementById('announceText')?.value.trim() || 'Your announcement appears here',
      photoA: a, photoB: b
    });
}
['announcePhotoA','announcePhotoB','announceText'].forEach(id =>
  document.getElementById(id)?.addEventListener(id === 'announceText' ? 'input' : 'change', refreshAnnouncePreview));

/* tap a thumbnail → upload your own image for that side */
let annUploadSide = 'a';
document.querySelectorAll('.ann-preview').forEach(btn => btn.addEventListener('click', () => {
  if (!isAdmin()) return;
  annUploadSide = btn.dataset.annSide;
  document.getElementById('announcePhotoFile')?.click();
}));
document.getElementById('announcePhotoFile')?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !isAdmin()) return;
  const side = annUploadSide;
  const slot = `announce-${side}`;
  const status = document.getElementById('announceStatus');
  const img = document.getElementById(side === 'a' ? 'announcePreviewA' : 'announcePreviewB');
  const btn = img?.closest('.ann-preview');
  /* instant local preview while the upload runs */
  const localUrl = URL.createObjectURL(file);
  if (img) img.src = localUrl;
  btn?.classList.add('uploading');
  if (status) status.textContent = 'Uploading photo…';
  try {
    const res = await uploadSitePhoto(file, slot);
    siteSettings[`photo:${slot}`] = res.url;
    const sel = document.getElementById(side === 'a' ? 'announcePhotoA' : 'announcePhotoB');
    if (sel) sel.value = slot;
    refreshAnnouncePreview();
    if (status) status.textContent = 'Photo saved — tap SEND ANNOUNCEMENT to use it.';
  } catch(err){
    console.warn('Announcement photo upload failed:', err);
    if (status) status.textContent = 'Photo upload failed — are you still signed in?';
    refreshAnnouncePreview();
  } finally {
    btn?.classList.remove('uploading');
    URL.revokeObjectURL(localUrl);
  }
});
document.getElementById('announceSendBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const status = document.getElementById('announceStatus');
  const text = document.getElementById('announceText')?.value.trim();
  const everyMin = parseInt(document.getElementById('announceEvery')?.value, 10) || 0;
  const photoA = document.getElementById('announcePhotoA')?.value;
  const photoB = document.getElementById('announcePhotoB')?.value;
  if (!isAdmin()){ if (status) status.textContent = 'Sign in as admin first.'; return; }
  if (!text){ if (status) status.textContent = 'Write a message first.'; return; }
  btn.disabled = true; btn.textContent = 'SENDING…';
  try {
    const res = await sendAnnouncement(text, everyMin, photoA, photoB);
    siteSettings.announcement = JSON.stringify(res.announcement);
    /* show it right here, right now — no waiting for the poll */
    if (typeof showAnnouncement === 'function') showAnnouncement(res.announcement);
    if (status) status.textContent = everyMin
      ? `Sent — every guest sees it now, and again every ${everyMin} min.`
      : 'Sent — popping up on every guest\'s screen now.';
  } catch(err){
    if (status) status.textContent = 'Could not send — are you still signed in?';
  } finally {
    btn.disabled = false; btn.textContent = 'SEND ANNOUNCEMENT';
  }
});
/* home heart — a tap sends love to the couple (golden burst + shared count);
   admins go to the dashboard, and guests whose check-in email is on the admin
   list get the admin sign-in instead */
const homeHeart = document.getElementById('homeHeart');
function heartBurst(el){
  for (let i = 0; i < 7; i++){
    const p = document.createElement('span');
    p.className = 'heart-particle';
    p.textContent = '❤';
    p.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 70}px`);
    p.style.setProperty('--rot', `${(Math.random() * 2 - 1) * 50}deg`);
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    el.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
}
function renderHomeLikes(){
  const countEl = document.getElementById('homeLikeCount');
  if (!countEl) return;
  countEl.textContent = parseInt(siteSettings.homeLikes || '0', 10) || 0;
  homeHeart?.classList.toggle('liked', localStorage.getItem('sj_home_liked') === '1');
}
homeHeart?.addEventListener('click', async () => {
  if (isAdmin()){
    switchView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const email = (getGuest()?.email || '').trim().toLowerCase();
  if (email){
    try {
      const r = await checkAdminEmail(email);
      if (r.allowed){
        switchView('adminlogin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } catch {}
  }
  const mine = localStorage.getItem('sj_home_liked') === '1';
  const delta = mine ? -1 : 1;
  const countEl = document.getElementById('homeLikeCount');
  homeHeart.classList.toggle('liked', !mine);
  heartBurst(homeHeart);
  if (countEl) countEl.textContent = Math.max(0, (parseInt(countEl.textContent, 10) || 0) + delta);
  localStorage.setItem('sj_home_liked', mine ? '0' : '1');
  try {
    const res = await likeHome(delta);
    if (countEl) countEl.textContent = res.likes;
    siteSettings.homeLikes = String(res.likes);
  } catch {}
});

/* ---------- admin access emails (dashboard) ---------- */
async function renderAdminEmails(){
  const wrap = document.getElementById('adminEmailList');
  if (!wrap) return;
  if (!isAdmin()){ wrap.innerHTML = ''; return; }
  try {
    const { emails } = await getAdminEmails();
    wrap.innerHTML = emails.length ? emails.map(e => `
      <div class="admin-email-row">
        <span>${escapeHTML(e)}</span>
        <button class="aq-reject song-del" type="button" data-email="${escapeHTML(e)}">REMOVE</button>
      </div>`).join('') : '<small>No admin emails yet — add one below.</small>';
  } catch { wrap.innerHTML = '<small>Could not load the list.</small>'; }
}
document.getElementById('adminEmailList')?.addEventListener('click', async e => {
  const btn = e.target.closest('[data-email]');
  if (!btn) return;
  if (!confirm(`Remove ${btn.dataset.email} from admin access?`)) return;
  btn.disabled = true;
  try { await removeAdminEmail(btn.dataset.email); renderAdminEmails(); }
  catch { btn.disabled = false; alert('Could not remove — are you still signed in?'); }
});
document.getElementById('adminEmailAdd')?.addEventListener('click', async () => {
  const input = document.getElementById('adminEmailInput');
  const status = document.getElementById('adminEmailStatus');
  const email = (input?.value || '').trim();
  if (!email) return;
  try {
    await addAdminEmail(email);
    input.value = '';
    if (status) status.textContent = `${email} can now reach the admin sign-in from the heart.`;
    renderAdminEmails();
  } catch { if (status) status.textContent = 'Could not add — check the email and your sign-in.'; }
});
document.getElementById('adminEmailInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); document.getElementById('adminEmailAdd')?.click(); }
});
document.getElementById('announceStopBtn')?.addEventListener('click', async () => {
  const status = document.getElementById('announceStatus');
  try {
    await stopAnnouncement();
    delete siteSettings.announcement;
    document.getElementById('announceText').value = '';
    if (status) status.textContent = 'Announcement cleared.';
  } catch { if (status) status.textContent = 'Could not clear — are you still signed in?'; }
});

const RSVP_ENDPOINT = 'https://formsubmit.co/ajax/snyobeng@gmail.com';

const rsvpForm = document.getElementById('rsvpForm');
rsvpForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const status = document.getElementById('rsvpStatus');
  const submitBtn = rsvpForm.querySelector('[type="submit"]');
  const data = Object.fromEntries(new FormData(rsvpForm).entries());

  // normalize field names for the admin dashboard
  const rsvpRecord = {
    name: data.fullName || '',
    email: data.email || '',
    phone: data.phone || '',
    attending: data.attendance || '',
    plusOne: Number(data.guestCount) > 1 ? Number(data.guestCount) - 1 : 0,
    guestCount: Number(data.guestCount) || 1,
    song: data.song || '',
    message: data.message || ''
  };

  submitBtn.disabled = true;
  status.textContent = 'Sending your RSVP…';

  // Firestore is the record of truth; the email is a courtesy copy
  let savedToDb = false;
  try { await addRsvp(rsvpRecord); savedToDb = true; }
  catch(err){ console.warn('RSVP save failed:', err); }

  try {
    const res = await fetch(RSVP_ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body: JSON.stringify({
        _subject: `Wedding RSVP — ${data.fullName}`,
        _template: 'table',
        'Full name': data.fullName,
        'Email': data.email || '—',
        'Attendance': data.attendance,
        'Guests': data.guestCount,
        'Song request': data.song || '—',
        'Message': data.message || '—'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    status.textContent = 'Thank you! Your RSVP has been sent to Sam & Jossy. ❤';
    rsvpForm.reset();
  } catch(err){
    console.warn('RSVP email failed:', err);
    if (savedToDb){
      status.textContent = 'Thank you! Your RSVP has been received by Sam & Jossy. ❤';
      rsvpForm.reset();
    } else {
      status.textContent =
        'We could not send your RSVP right now. Please check your connection and try again.';
    }
  } finally {
    submitBtn.disabled = false;
  }
});

/* =========================================================
   Add to calendar
   ========================================================= */
function buildICS(){
  const det = window.weddingDetails || {};
  const dt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const start = new Date(det.weddingDateISO || '2027-01-09T10:00');
  const end   = new Date(start.getTime() + 12 * 3600 * 1000);
  let events = [];
  try { events = JSON.parse(det.events || '[]'); } catch {}
  const desc = events.map(ev => `${ev.name} ${ev.time}`).join(' / ');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//S&J Wedding//EN','BEGIN:VEVENT',
    `UID:sj-wedding-${Date.now()}@wedding`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    `SUMMARY:${det.weddingFormal || 'Wedding'}`,
    `DESCRIPTION:${[desc, det.weddingHashtag].filter(Boolean).join('. ')}`,
    `LOCATION:${det.weddingVenue || ''}`,
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
}

document.getElementById('addToCalendar')?.addEventListener('click', () => {
  const blob = new Blob([buildICS()], { type:'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'samuel-josephine-wedding.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

/* =========================================================
   Install prompt
   ========================================================= */
let deferredPrompt = null;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  installButton?.classList.remove('hidden');
});

installButton?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.classList.add('hidden');
});

window.addEventListener('appinstalled', () => installButton?.classList.add('hidden'));
