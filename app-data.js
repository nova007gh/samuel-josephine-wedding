'use strict';

/* =========================================================
   IndexedDB — memory vault + key/value settings
   ========================================================= */
const DB_NAME = 'SJWeddingMemories';
const DB_VERSION = 2;
const STORE = 'memories';
const GB_STORE = 'guestbook';

function openMemoryDB(){
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath:'id', autoIncrement:true });
        store.createIndex('category', 'category', { unique:false });
        store.createIndex('createdAt', 'createdAt', { unique:false });
      }
      if (!db.objectStoreNames.contains(GB_STORE)) {
        const gb = db.createObjectStore(GB_STORE, { keyPath:'id', autoIncrement:true });
        gb.createIndex('createdAt', 'createdAt', { unique:false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addMemory(record){
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getMemories(){
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a,b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

async function deleteMemory(id){
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function updateMemory(record){
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function deleteMemoryGB(id){
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GB_STORE, 'readwrite');
    tx.objectStore(GB_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const SETTINGS_DB = 'SJWeddingSettings';
const SETTINGS_STORE = 'kv';

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
const CATEGORY_LABELS = {
  'sam-childhood':'Sam — Childhood',
  'jossy-childhood':'Jossy — Childhood',
  'adulthood':'Adulthood',
  'first-together':'First Together',
  'engagement':'Proposal & Engagement',
  'favorite-moments':'Favorite Moments'
};

/* built-in memories shown alongside guest uploads */
const SEED_MEMORIES = [
  { src:'assets/story/sam-childhood.jpg',   category:'sam-childhood',    caption:'Little Sam with big dreams.' },
  { src:'assets/story/jossy-childhood.jpg', category:'jossy-childhood',  caption:'Sweet Jossy, full of joy.' },
  { src:'assets/story/sam-adult.jpg',       category:'adulthood',        caption:'Sam, becoming who he is today.' },
  { src:'assets/story/jossy-adult.jpg',     category:'adulthood',        caption:'Jossy, radiant as ever.' },
  { src:'assets/story/facetime.jpg',        category:'first-together',   caption:'Late-night FaceTime calls across the ocean.' },
  { src:'assets/story/proposal.jpg',        category:'engagement',       caption:'She said YES! Accra, on her birthday.' },
  { src:'assets/story/now.jpg',             category:'favorite-moments', caption:'Engaged and forever.' },
  { src:'assets/couple-home.jpg',           category:'favorite-moments', caption:'#AlwaysAndForever' }
];

let activeGalleryFilter = 'all';
const objectUrls = new Set();

async function renderGallery(){
  const grid = document.getElementById('galleryGrid');
  const empty = document.getElementById('galleryEmpty');
  if (!grid || !empty) return;

  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls.clear();

  const uploaded = (await getMemories()).map(m => ({ ...m, seeded:false }));
  const seeded = SEED_MEMORIES.map(m => ({ ...m, type:'image/jpeg', seeded:true }));
  const all = [...uploaded, ...seeded];
  const items = activeGalleryFilter === 'all'
    ? all
    : all.filter(m => m.category === activeGalleryFilter);

  grid.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);

  for (const item of items){
    let url = item.src;
    if (!item.seeded){
      url = URL.createObjectURL(item.blob);
      objectUrls.add(url);
    }

    const card = document.createElement('article');
    card.className = 'mem-card';
    let media;
    if (item.type.startsWith('video/')){
      media = `<video controls playsinline preload="metadata" src="${url}"></video>`;
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
        ${item.seeded ? '' : `<button class="mem-del" data-id="${item.id}" type="button">Remove</button>`}
      </div>`;

    if (!item.type.startsWith('video/') && !item.type.startsWith('audio/')){
      card.querySelector('img').addEventListener('click', () =>
        openLightbox(url, item.caption || CATEGORY_LABELS[item.category] || ''));
    }
    grid.appendChild(card);
  }

  grid.querySelectorAll('.mem-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this memory?')) return;
      await deleteMemory(Number(btn.dataset.id));
      renderGallery();
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

  for (let i = 0; i < files.length; i++){
    const file = files[i];
    status.textContent = `Saving ${i + 1} of ${files.length}…`;
    await addMemory({
      category,
      caption: files.length === 1 ? caption : (caption ? `${caption} ${i + 1}` : ''),
      type: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
      blob: file,
      createdAt: Date.now() + i
    });
  }

  status.textContent = `${files.length} ${files.length === 1 ? 'memory' : 'memories'} saved.`;
  event.target.value = '';
  captionEl.value = '';
  await renderGallery();
  setTimeout(() => status.classList.add('hidden'), 2400);
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    activeGalleryFilter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    renderGallery();
  });
});

renderGallery().catch(console.error);

/* =========================================================
   Lightbox
   ========================================================= */
const lightbox = document.getElementById('lightbox');
const lightboxBody = document.getElementById('lightboxBody');
const lightboxCaption = document.getElementById('lightboxCaption');

function openLightbox(src, caption=''){
  if (!lightbox) return;
  lightboxBody.innerHTML = `<img src="${src}" alt="${escapeHTML(caption || 'Wedding photo')}">`;
  lightboxCaption.textContent = caption;
  lightbox.classList.remove('hidden');
  document.body.classList.add('locked');
}
function closeLightbox(){
  lightbox?.classList.add('hidden');
  lightboxBody.innerHTML = '';
  document.body.classList.remove('locked');
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
   Home couple photo
   ========================================================= */
const couplePhoto = document.getElementById('couplePhoto');
const couplePhotoFile = document.getElementById('couplePhotoFile');
const couplePlaceholder = document.getElementById('couplePlaceholder');

function showCouplePhoto(has){
  couplePhoto?.classList.toggle('hidden', !has);
  couplePlaceholder?.classList.toggle('hidden', has);
}

(async () => {
  try {
    const blob = await kvGet('welcomePhoto');
    if (blob && couplePhoto){
      couplePhoto.src = URL.createObjectURL(blob);
    } else if (couplePhoto){
      couplePhoto.src = 'assets/couple-home.jpg';
    }
    showCouplePhoto(true);
  } catch(err){
    console.warn(err);
    if (couplePhoto) couplePhoto.src = 'assets/couple-home.jpg';
    showCouplePhoto(true);
  }
})();

/* tap the photo itself to swap in a new one */
couplePhoto?.addEventListener('click', () => couplePhotoFile?.click());

couplePhotoFile?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  await kvSet('welcomePhoto', file);
  couplePhoto.src = URL.createObjectURL(file);
  showCouplePhoto(true);
  e.target.value = '';
});

/* =========================================================
   RSVP
   ========================================================= */
const RSVP_ENDPOINT = 'https://formsubmit.co/ajax/snyobeng@gmail.com';

const rsvpForm = document.getElementById('rsvpForm');
rsvpForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const status = document.getElementById('rsvpStatus');
  const submitBtn = rsvpForm.querySelector('[type="submit"]');
  const data = Object.fromEntries(new FormData(rsvpForm).entries());

  // always keep a local backup on this device
  const saved = JSON.parse(localStorage.getItem('sj_rsvps') || '[]');
  saved.push({ ...data, submittedAt:new Date().toISOString() });
  localStorage.setItem('sj_rsvps', JSON.stringify(saved));

  submitBtn.disabled = true;
  status.textContent = 'Sending your RSVP…';

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
    console.warn('RSVP send failed:', err);
    status.textContent =
      'We could not reach the server, but your RSVP is saved on this device. Please try again when you are back online.';
  } finally {
    submitBtn.disabled = false;
  }
});

/* =========================================================
   Add to calendar
   ========================================================= */
function buildICS(){
  const dt = d => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const start = new Date('2027-01-09T10:00:00+00:00');
  const end   = new Date('2027-01-09T22:00:00+00:00');
  return [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//S&J Wedding//EN','BEGIN:VEVENT',
    `UID:sj-wedding-${Date.now()}@samuelandjosephine`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    'SUMMARY:Samuel & Josephine Wedding',
    'DESCRIPTION:Traditional 10:00 AM / White Wedding 3:00 PM / Reception 6:00 PM. #AlwaysAndForever',
    'LOCATION:Accra, Ghana',
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
