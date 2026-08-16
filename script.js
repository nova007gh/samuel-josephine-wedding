
const intro = document.getElementById('intro');
const site = document.getElementById('site');
const sealButton = document.getElementById('sealButton');

sealButton.addEventListener('click', () => {
  intro.classList.add('opening');
  setTimeout(() => {
    intro.classList.add('hidden');
    site.classList.remove('hidden');
    document.body.classList.remove('locked');
    window.scrollTo({top:0, behavior:'instant'});
  }, 850);
});

const target = new Date('2027-01-09T10:00:00+00:00');
function updateCountdown(){
  const diff = Math.max(0, target - new Date());
  const d = Math.floor(diff/86400000);
  const h = Math.floor((diff%86400000)/3600000);
  const m = Math.floor((diff%3600000)/60000);
  const s = Math.floor((diff%60000)/1000);
  document.getElementById('days').textContent = String(d).padStart(3,'0');
  document.getElementById('hours').textContent = String(h).padStart(2,'0');
  document.getElementById('minutes').textContent = String(m).padStart(2,'0');
  document.getElementById('seconds').textContent = String(s).padStart(2,'0');
}
updateCountdown(); setInterval(updateCountdown,1000);

const form = document.getElementById('rsvpForm');
const modal = document.getElementById('successModal');
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const submissions = JSON.parse(localStorage.getItem('sj_rsvps') || '[]');
  submissions.push({...data, submittedAt:new Date().toISOString()});
  localStorage.setItem('sj_rsvps', JSON.stringify(submissions));
  document.getElementById('formStatus').textContent = 'RSVP saved.';
  modal.classList.remove('hidden');
  form.reset();
});
document.getElementById('closeModal').addEventListener('click', ()=>modal.classList.add('hidden'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});

const menuButton = document.getElementById('menuButton');
const navLinks = document.getElementById('navLinks');
menuButton.addEventListener('click',()=>navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>navLinks.classList.remove('open')));


// Progressive Web App support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}

let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.classList.remove('hidden');
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installButton.classList.add('hidden');
  });
}

window.addEventListener('appinstalled', () => {
  if (installButton) installButton.classList.add('hidden');
});


// ---------- Editable love story ----------
const defaultStory = `What began with a simple Instagram connection became something neither of us could ignore. Samuel saw Josephine’s beautiful picture, left the comment “very pretty,” and she responded. That small moment opened the door to conversations that quickly became something much deeper. Just three days later, during a FaceTime call, Samuel asked Josephine to be his wife. Four months later, Samuel traveled from Atlanta to Accra to finally meet her in person. The next day, on Josephine’s birthday, he surprised her with a proposal and a beautiful diamond ring — and she said YES. Now, surrounded by family and friends, they are preparing to begin their forever together.`;

const storyText = document.getElementById('storyText');
const storyEditor = document.getElementById('storyEditor');
const savedStory = localStorage.getItem('sj_love_story') || defaultStory;

if (storyText) storyText.textContent = savedStory;
if (storyEditor) storyEditor.value = savedStory;

document.getElementById('saveStory')?.addEventListener('click', () => {
  const value = storyEditor.value.trim() || defaultStory;
  localStorage.setItem('sj_love_story', value);
  storyText.textContent = value;
});

document.getElementById('resetStory')?.addEventListener('click', () => {
  localStorage.removeItem('sj_love_story');
  storyEditor.value = defaultStory;
  storyText.textContent = defaultStory;
});

// ---------- IndexedDB memory vault ----------
const DB_NAME = 'SJWeddingMemories';
const DB_VERSION = 1;
const STORE = 'memories';
let activeMemoryFilter = 'all';

function openMemoryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addMemory(record) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getMemories() {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a,b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

async function deleteMemory(id) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

const categoryLabels = {
  'samuel-childhood': 'Samuel — Childhood',
  'josephine-childhood': 'Josephine — Childhood',
  'samuel-adulthood': 'Samuel — Adulthood',
  'josephine-adulthood': 'Josephine — Adulthood',
  'first-together': 'Our First Pictures Together',
  'couple-videos': 'Our Videos Together',
  'engagement': 'Proposal & Engagement',
  'favorite-moments': 'Favorite Moments'
};

function escapeHTML(value='') {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

async function renderMemories() {
  const gallery = document.getElementById('memoryGallery');
  const empty = document.getElementById('memoryEmpty');
  if (!gallery || !empty) return;

  const all = await getMemories();
  const items = activeMemoryFilter === 'all' ? all : all.filter(m => m.category === activeMemoryFilter);
  gallery.innerHTML = '';

  empty.classList.toggle('hidden', items.length > 0);

  for (const item of items) {
    const url = URL.createObjectURL(item.blob);
    const card = document.createElement('article');
    card.className = 'memory-card';

    const media = item.type.startsWith('video/')
      ? `<video controls playsinline preload="metadata" src="${url}"></video>`
      : `<img loading="lazy" decoding="async" src="${url}" alt="${escapeHTML(item.caption || categoryLabels[item.category] || 'Wedding memory')}" />`;

    card.innerHTML = `
      ${media}
      <div class="memory-meta">
        <span class="memory-category">${escapeHTML(categoryLabels[item.category] || item.category)}</span>
        <p class="memory-caption">${escapeHTML(item.caption || 'A beautiful memory')}</p>
        <div class="memory-actions">
          <button class="memory-delete" data-id="${item.id}">Remove</button>
        </div>
      </div>`;
    gallery.appendChild(card);
  }

  gallery.querySelectorAll('.memory-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this memory from the gallery?')) return;
      await deleteMemory(Number(btn.dataset.id));
      renderMemories();
    });
  });
}

document.getElementById('memoryFiles')?.addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;

  const category = document.getElementById('memoryCategory').value;
  const caption = document.getElementById('memoryCaption').value.trim();
  const progress = document.getElementById('uploadProgress');
  const progressText = document.getElementById('uploadProgressText');

  progress.classList.remove('hidden');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    progressText.textContent = `Saving ${i + 1} of ${files.length}: ${file.name}`;

    await addMemory({
      category,
      caption: files.length === 1 ? caption : (caption ? `${caption} ${i+1}` : ''),
      type: file.type || 'application/octet-stream',
      name: file.name,
      size: file.size,
      blob: file,
      createdAt: Date.now() + i
    });
  }

  progressText.textContent = `${files.length} ${files.length === 1 ? 'memory' : 'memories'} saved successfully.`;
  event.target.value = '';
  document.getElementById('memoryCaption').value = '';
  await renderMemories();

  setTimeout(() => progress.classList.add('hidden'), 2200);
});

document.querySelectorAll('.memory-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeMemoryFilter = tab.dataset.filter;
    document.querySelectorAll('.memory-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderMemories();
  });
});

renderMemories().catch(console.error);

// ---------- Welcome hero photo (persisted in IndexedDB) ----------
const WELCOME_DB = 'SJWeddingSettings';
const WELCOME_STORE = 'kv';

function openSettingsDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(WELCOME_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WELCOME_STORE)) db.createObjectStore(WELCOME_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvSet(key, value){
  const db = await openSettingsDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction(WELCOME_STORE,'readwrite');
    tx.objectStore(WELCOME_STORE).put(value, key);
    tx.oncomplete = res; tx.onerror = ()=>rej(tx.error);
  });
}
async function kvGet(key){
  const db = await openSettingsDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction(WELCOME_STORE,'readonly');
    const r = tx.objectStore(WELCOME_STORE).get(key);
    r.onsuccess = ()=>res(r.result);
    r.onerror = ()=>rej(r.error);
  });
}

const welcomePhoto = document.getElementById('welcomePhoto');
const welcomePhotoFile = document.getElementById('welcomePhotoFile');

(async () => {
  try {
    const blob = await kvGet('welcomePhoto');
    if (blob && welcomePhoto) welcomePhoto.src = URL.createObjectURL(blob);
  } catch(e){ console.warn(e); }
})();

welcomePhotoFile?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await kvSet('welcomePhoto', file);
  welcomePhoto.src = URL.createObjectURL(file);
  e.target.value = '';
});

// ---------- Guest stepper + attendee names ----------
const guestCountInput = document.getElementById('guestCount');
const attendeeList = document.getElementById('attendeeList');

function renderAttendees(){
  const n = Math.max(1, Math.min(6, parseInt(guestCountInput.value || '1', 10)));
  const existing = [...attendeeList.querySelectorAll('input')].map(i => i.value);
  attendeeList.innerHTML = '';
  for (let i = 0; i < n; i++){
    const input = document.createElement('input');
    input.type = 'text';
    input.name = `attendee${i+1}`;
    input.placeholder = i === 0 ? 'Full name' : `Guest ${i+1} full name`;
    input.value = existing[i] || '';
    if (i === 0) input.required = true;
    attendeeList.appendChild(input);
  }
}

document.querySelectorAll('.stepper-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const step = parseInt(btn.dataset.step, 10);
    const next = Math.max(1, Math.min(6, (parseInt(guestCountInput.value,10) || 1) + step));
    guestCountInput.value = next;
    renderAttendees();
  });
});
renderAttendees();

// ---------- Add to Calendar (ICS) ----------
function buildICS(){
  const dt = (d) => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const start = new Date('2027-01-09T10:00:00+00:00'); // Ghana GMT
  const end   = new Date('2027-01-09T22:00:00+00:00');
  const lines = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//S&J Wedding//EN','BEGIN:VEVENT',
    `UID:sj-wedding-${Date.now()}@samuelandjosephine`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(start)}`,
    `DTEND:${dt(end)}`,
    'SUMMARY:Samuel & Josephine Wedding',
    'DESCRIPTION:Traditional 10:00 AM • White Wedding 3:00 PM • Reception 6:00 PM. #AlwaysAndForever',
    'LOCATION:Accra, Ghana',
    'END:VEVENT','END:VCALENDAR'
  ];
  return lines.join('\r\n');
}
document.getElementById('addToCalendar')?.addEventListener('click', () => {
  const blob = new Blob([buildICS()], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'samuel-josephine-wedding.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
});

// ---------- Secondary install button ----------
const installButton2 = document.getElementById('installButton2');
window.addEventListener('beforeinstallprompt', () => {
  if (installButton2) installButton2.classList.remove('hidden');
});
installButton2?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton2.classList.add('hidden');
});
