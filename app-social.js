'use strict';

/* =========================================================
   Navigation for menu items / back links
   ========================================================= */
document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.goto));
});

/* =========================================================
   Sheets (bottom modals)
   ========================================================= */
function openSheet(id){
  document.getElementById(id)?.classList.remove('hidden');
  document.body.classList.add('locked');
}
function closeSheet(id){
  document.getElementById(id)?.classList.add('hidden');
  document.body.classList.remove('locked');
}
document.querySelectorAll('[data-close-sheet]').forEach(btn => {
  btn.addEventListener('click', () => {
    const sheet = btn.closest('.sheet');
    if (sheet?.id === 'recModal') stopRecorder(true);
    if (sheet) closeSheet(sheet.id);
  });
});
document.querySelectorAll('.sheet').forEach(sheet => {
  sheet.addEventListener('click', e => {
    if (e.target === sheet){
      if (sheet.id === 'recModal') stopRecorder(true);
      closeSheet(sheet.id);
    }
  });
});

function timeAgo(ts){
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

/* =========================================================
   Guest book — storage
   ========================================================= */
async function gbAdd(record){
  const db = await openMemoryDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(GB_STORE, 'readwrite');
    tx.objectStore(GB_STORE).add(record);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function gbAll(){
  const db = await openMemoryDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(GB_STORE, 'readonly');
    const r = tx.objectStore(GB_STORE).getAll();
    r.onsuccess = () => res(r.result.sort((a,b) => b.createdAt - a.createdAt));
    r.onerror = () => rej(r.error);
  });
}
async function gbUpdate(record){
  const db = await openMemoryDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(GB_STORE, 'readwrite');
    tx.objectStore(GB_STORE).put(record);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

/* =========================================================
   Guest book — render
   ========================================================= */
let gbFilter = 'all';
const gbObjectUrls = new Set();

function gbInitials(name){
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

async function renderGuestBook(){
  const list = document.getElementById('gbList');
  const empty = document.getElementById('gbEmpty');
  if (!list) return;

  gbObjectUrls.forEach(URL.revokeObjectURL);
  gbObjectUrls.clear();

  const all = await gbAll();
  const counts = {
    all: all.length,
    pending: all.filter(m => m.status === 'pending').length,
    approved: all.filter(m => m.status === 'approved').length
  };
  document.querySelectorAll('[data-gb-filter]').forEach(chip => {
    const key = chip.dataset.gbFilter;
    chip.textContent = `${key[0].toUpperCase() + key.slice(1)} (${counts[key]})`;
  });

  const items = gbFilter === 'all' ? all : all.filter(m => m.status === gbFilter);
  list.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);

  for (const item of items){
    let avatar;
    if (item.selfie){
      const url = URL.createObjectURL(item.selfie);
      gbObjectUrls.add(url);
      avatar = `<img class="gb-avatar" src="${url}" alt="">`;
    } else {
      avatar = `<span class="gb-avatar gb-avatar--initials">${escapeHTML(gbInitials(item.name))}</span>`;
    }

    const card = document.createElement('article');
    card.className = 'gb-card';
    const replies = (item.replies || []).map(r =>
      `<p class="gb-reply"><b>${escapeHTML(r.name)}:</b> ${escapeHTML(r.text)}</p>`).join('');

    card.innerHTML = `
      <div class="gb-head">
        ${avatar}
        <div class="gb-who">
          <strong>${escapeHTML(item.name)}</strong>
          <small>${timeAgo(item.createdAt)}</small>
        </div>
        <span class="gb-badge gb-badge--${item.status}">${item.status === 'approved' ? 'Approved' : 'Pending'}</span>
      </div>
      <p class="gb-msg">${escapeHTML(item.message)}</p>
      ${replies ? `<div class="gb-replies">${replies}</div>` : ''}
      <div class="gb-actions">
        <button class="gb-like${item.liked ? ' liked' : ''}" type="button">&#10084; Like <b>${item.likes || 0}</b></button>
        <button class="gb-replybtn" type="button">&#128172; Reply</button>
      </div>
      <form class="gb-replyform hidden">
        <input name="replyName" type="text" required placeholder="Your name" />
        <input name="replyText" type="text" required placeholder="Write a reply&hellip;" />
        <button type="submit">Send</button>
      </form>`;

    card.querySelector('.gb-like').addEventListener('click', async () => {
      item.liked = !item.liked;
      item.likes = Math.max(0, (item.likes || 0) + (item.liked ? 1 : -1));
      await gbUpdate(item);
      renderGuestBook();
    });
    card.querySelector('.gb-replybtn').addEventListener('click', () => {
      card.querySelector('.gb-replyform').classList.toggle('hidden');
    });
    card.querySelector('.gb-replyform').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      item.replies = item.replies || [];
      item.replies.push({ name: fd.get('replyName').trim(), text: fd.get('replyText').trim() });
      await gbUpdate(item);
      renderGuestBook();
    });

    list.appendChild(card);
  }
}

document.querySelectorAll('[data-gb-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    gbFilter = chip.dataset.gbFilter;
    document.querySelectorAll('[data-gb-filter]').forEach(c => c.classList.toggle('active', c === chip));
    renderGuestBook();
  });
});

document.getElementById('gbAddBtn')?.addEventListener('click', () => openSheet('gbModal'));

document.getElementById('gbForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const selfie = fd.get('gbSelfie');
  await gbAdd({
    name: fd.get('gbName').trim(),
    message: fd.get('gbMessage').trim(),
    selfie: selfie && selfie.size ? selfie : null,
    status: 'pending',
    likes: 0,
    liked: false,
    replies: [],
    createdAt: Date.now()
  });
  form.reset();
  closeSheet('gbModal');
  await renderGuestBook();
});

renderGuestBook().catch(console.error);

/* =========================================================
   Share memories — files go through a details sheet
   ========================================================= */
let pendingShare = null; // { blob, type, kind }
const shareKindLabels = {
  photo:'Share Photo', video:'Share Video', selfie:'Share Selfie',
  voice:'Voice Message', videomsg:'Video Message'
};

function openShareSheet(blob, type, kind){
  pendingShare = { blob, type, kind };
  document.getElementById('shareTitle').textContent = shareKindLabels[kind] || 'Share Memory';

  const preview = document.getElementById('sharePreview');
  preview.innerHTML = '';
  const url = URL.createObjectURL(blob);
  if (type.startsWith('image/')) preview.innerHTML = `<img src="${url}" alt="">`;
  else if (type.startsWith('video/')) preview.innerHTML = `<video src="${url}" controls playsinline></video>`;
  else if (type.startsWith('audio/')) preview.innerHTML = `<audio src="${url}" controls></audio>`;
  openSheet('shareModal');
}

document.getElementById('shareTypePhoto')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) openShareSheet(file, file.type, 'photo');
  e.target.value = '';
});
document.getElementById('shareTypeVideo')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) openShareSheet(file, file.type, 'video');
  e.target.value = '';
});
document.getElementById('shareTypeSelfie')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) openShareSheet(file, file.type, 'selfie');
  e.target.value = '';
});

document.getElementById('shareForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!pendingShare) return;
  const fd = new FormData(e.target);
  await addMemory({
    category: fd.get('shareCategory'),
    caption: fd.get('shareCaption').trim(),
    guestName: fd.get('shareName').trim(),
    kind: pendingShare.kind,
    status: 'pending',
    type: pendingShare.type || 'application/octet-stream',
    name: `${pendingShare.kind}-${Date.now()}`,
    size: pendingShare.blob.size,
    blob: pendingShare.blob,
    createdAt: Date.now()
  });
  pendingShare = null;
  e.target.reset();
  closeSheet('shareModal');
  await renderGallery();
  switchView('gallery');
});

/* =========================================================
   Voice / video recorder (MediaRecorder)
   ========================================================= */
let recStream = null;
let recRecorder = null;
let recChunks = [];
let recBlob = null;
let recMode = 'voice';
let recTick = null;
let recStarted = 0;

const recTimer = document.getElementById('recTimer');
const recHint = document.getElementById('recHint');
const recToggle = document.getElementById('recToggle');
const recSave = document.getElementById('recSave');
const recWave = document.getElementById('recWave');
const recVideoPreview = document.getElementById('recVideoPreview');
const recReview = document.getElementById('recReview');

function fmtTime(ms){
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

async function openRecorder(mode){
  recMode = mode;
  recBlob = null;
  recChunks = [];
  document.getElementById('recTitle').textContent = mode === 'voice' ? 'Voice Message' : 'Video Message';
  recTimer.textContent = '00:00';
  recHint.textContent = 'Tap the button to start recording';
  recSave.disabled = true;
  recReview.classList.add('hidden');
  recReview.innerHTML = '';
  recToggle.classList.remove('recording');
  recWave.classList.toggle('hidden', mode !== 'voice');
  recVideoPreview.classList.toggle('hidden', mode !== 'videomsg');

  try {
    recStream = await navigator.mediaDevices.getUserMedia(
      mode === 'voice' ? { audio:true } : { audio:true, video:{ facingMode:'user' } });
  } catch(err){
    alert('We need microphone' + (mode === 'videomsg' ? ' and camera' : '') + ' access to record. Please allow it and try again.');
    return;
  }
  if (mode === 'videomsg'){
    recVideoPreview.srcObject = recStream;
    recVideoPreview.play().catch(() => {});
  }
  openSheet('recModal');
}

recToggle?.addEventListener('click', () => {
  if (recRecorder && recRecorder.state === 'recording'){
    recRecorder.stop();
    return;
  }
  if (!recStream) return;
  recChunks = [];
  recRecorder = new MediaRecorder(recStream);
  recRecorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  recRecorder.onstop = () => {
    clearInterval(recTick);
    recToggle.classList.remove('recording');
    recWave.classList.remove('active');
    recBlob = new Blob(recChunks, { type: recRecorder.mimeType || (recMode === 'voice' ? 'audio/webm' : 'video/webm') });
    const url = URL.createObjectURL(recBlob);
    recReview.classList.remove('hidden');
    recReview.innerHTML = recMode === 'voice'
      ? `<audio src="${url}" controls></audio>`
      : `<video src="${url}" controls playsinline></video>`;
    if (recMode === 'videomsg') recVideoPreview.classList.add('hidden');
    recHint.textContent = 'Listen back, then use or re-record';
    recSave.disabled = false;
  };
  recRecorder.start();
  recStarted = Date.now();
  recTick = setInterval(() => { recTimer.textContent = fmtTime(Date.now() - recStarted); }, 250);
  recToggle.classList.add('recording');
  recWave.classList.add('active');
  recReview.classList.add('hidden');
  recHint.textContent = 'Recording… tap again to stop';
  recSave.disabled = true;
  if (recMode === 'videomsg') recVideoPreview.classList.remove('hidden');
});

function stopRecorder(discard){
  if (recRecorder && recRecorder.state === 'recording') recRecorder.stop();
  clearInterval(recTick);
  recStream?.getTracks().forEach(t => t.stop());
  recStream = null;
  recRecorder = null;
  recVideoPreview.srcObject = null;
  if (discard) recBlob = null;
}

recSave?.addEventListener('click', () => {
  if (!recBlob) return;
  const blob = recBlob;
  const type = blob.type || (recMode === 'voice' ? 'audio/webm' : 'video/webm');
  const kind = recMode;
  stopRecorder(false);
  closeSheet('recModal');
  openShareSheet(blob, type, kind);
});

document.getElementById('shareTypeVoice')?.addEventListener('click', () => openRecorder('voice'));
document.getElementById('shareTypeVideoMsg')?.addEventListener('click', () => openRecorder('videomsg'));

/* =========================================================
   RSVP — attendance toggle + guest stepper
   ========================================================= */
const attendInput = document.querySelector('#rsvpForm input[name="attendance"]');
document.querySelectorAll('.attend-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.attend-btn').forEach(b => b.classList.toggle('active', b === btn));
    if (attendInput) attendInput.value = btn.dataset.attend;
  });
});

const guestInput = document.querySelector('#rsvpForm input[name="guestCount"]');
const guestDisplay = document.getElementById('guestCountDisplay');
function setGuests(n){
  const v = Math.min(10, Math.max(1, n));
  if (guestInput) guestInput.value = v;
  if (guestDisplay) guestDisplay.textContent = v;
}
document.getElementById('guestMinus')?.addEventListener('click', () => setGuests(Number(guestInput.value) - 1));
document.getElementById('guestPlus')?.addEventListener('click', () => setGuests(Number(guestInput.value) + 1));
