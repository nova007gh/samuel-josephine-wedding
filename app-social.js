'use strict';

/* =========================================================
   Navigation for menu items / back links
   ========================================================= */
document.querySelectorAll('[data-goto]').forEach(el => {
  el.addEventListener('click', () => {
    teardownRecorders();
    switchView(el.dataset.goto);
  });
});
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', teardownRecorders));

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
    if (sheet) closeSheet(sheet.id);
  });
});
document.querySelectorAll('.sheet').forEach(sheet => {
  sheet.addEventListener('click', e => {
    if (e.target === sheet) closeSheet(sheet.id);
  });
});

function timeAgo(ts){
  const ms = toMillis(ts);
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

/* =========================================================
   Guest book — storage lives in firebase-data.js
   ========================================================= */

/* =========================================================
   Guest book — render
   ========================================================= */
let gbFilter = 'all';

function gbInitials(name){
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

function renderGuestBook(all){
  all = all || [];
  const list = document.getElementById('gbList');
  const empty = document.getElementById('gbEmpty');
  if (!list) return;

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
    if (item.selfieUrl){
      avatar = `<img class="gb-avatar" src="${item.selfieUrl}" alt="">`;
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
    replies: []
  });
  form.reset();
  closeSheet('gbModal');
});

if (typeof onGuestbook === 'function'){
  onGuestbook(renderGuestBook);
}

/* =========================================================
   Share memories — files go through a details sheet
   ========================================================= */
let pendingShare = null; // { blob, type, kind }
const shareKindLabels = {
  photo:'Share Photo', video:'Share Video', selfie:'Share Selfie',
  voice:'Voice Message', videomsg:'Video Message'
};

function openShareSheet(blob, type, kind, guestName=''){
  pendingShare = { blob, type, kind };
  document.getElementById('shareTitle').textContent = shareKindLabels[kind] || 'Share Memory';

  const preview = document.getElementById('sharePreview');
  preview.innerHTML = '';
  const url = URL.createObjectURL(blob);
  if (type.startsWith('image/')) preview.innerHTML = `<img src="${url}" alt="">`;
  else if (type.startsWith('video/')) preview.innerHTML = `<video src="${url}" controls playsinline></video>`;
  else if (type.startsWith('audio/')) preview.innerHTML = `<audio src="${url}" controls></audio>`;

  if (guestName){
    const nameInput = document.querySelector('#shareForm input[name="shareName"]');
    if (nameInput) nameInput.value = guestName;
  }
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
    blob: pendingShare.blob
  });
  pendingShare = null;
  e.target.reset();
  closeSheet('shareModal');
  teardownRecorders();
  switchView('gallery');
});

/* =========================================================
   Voice & video message pages (MediaRecorder)
   ========================================================= */
const MAX_REC_MS = 120000; // 02:00

function fmtTime(ms){
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

/* ---------- voice message page ---------- */
const voiceWave = document.getElementById('voiceWave');
const voiceCtx2d = voiceWave?.getContext('2d');
const voiceElapsed = document.getElementById('voiceElapsed');
const voiceRecBtn = document.getElementById('voiceRecBtn');
const voiceHint = document.getElementById('voiceHint');
const voiceReview = document.getElementById('voiceReview');
const voiceSubmit = document.getElementById('voiceSubmit');

let vStream = null, vRecorder = null, vChunks = [], vBlob = null;
let vTick = null, vStart = 0, vAudioCtx = null, vAnalyser = null, vRaf = null;

function drawWaveBars(levels){
  if (!voiceCtx2d) return;
  const { width:w, height:h } = voiceWave;
  voiceCtx2d.clearRect(0, 0, w, h);
  const n = levels.length;
  const barW = 5, gap = (w - n * barW) / (n + 1);
  voiceCtx2d.fillStyle = '#a97c2c';
  levels.forEach((lvl, i) => {
    const bh = Math.max(5, lvl * h);
    const x = gap + i * (barW + gap);
    voiceCtx2d.beginPath();
    voiceCtx2d.roundRect(x, (h - bh) / 2, barW, bh, 3);
    voiceCtx2d.fill();
  });
}
function drawIdleWave(){
  drawWaveBars(Array.from({ length:36 }, (_, i) => .1 + .22 * Math.abs(Math.sin(i * .55))));
}
drawIdleWave();

function animateVoiceWave(){
  if (!vAnalyser) return;
  const data = new Uint8Array(vAnalyser.frequencyBinCount);
  vAnalyser.getByteFrequencyData(data);
  const bars = 36;
  const step = Math.floor(data.length / bars) || 1;
  const levels = Array.from({ length:bars }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
    return Math.min(1, (sum / step / 255) * 1.6 + .06);
  });
  drawWaveBars(levels);
  vRaf = requestAnimationFrame(animateVoiceWave);
}

function stopVoice(discard){
  if (vRecorder && vRecorder.state === 'recording') vRecorder.stop();
  clearInterval(vTick);
  cancelAnimationFrame(vRaf);
  vStream?.getTracks().forEach(t => t.stop());
  vStream = null;
  vRecorder = null;
  vAnalyser = null;
  vAudioCtx?.close().catch(() => {});
  vAudioCtx = null;
  voiceRecBtn?.classList.remove('recording');
  if (discard){
    vBlob = null;
    if (voiceReview){ voiceReview.classList.add('hidden'); voiceReview.innerHTML = ''; }
    if (voiceSubmit) voiceSubmit.disabled = true;
    if (voiceElapsed) voiceElapsed.textContent = '00:00';
    if (voiceHint) voiceHint.textContent = 'Tap to start recording';
    drawIdleWave();
  }
}

voiceRecBtn?.addEventListener('click', async () => {
  if (vRecorder && vRecorder.state === 'recording'){
    vRecorder.stop();
    return;
  }
  try {
    vStream = await navigator.mediaDevices.getUserMedia({ audio:true });
  } catch {
    alert('We need microphone access to record your voice message. Please allow it and try again.');
    return;
  }
  vAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  vAnalyser = vAudioCtx.createAnalyser();
  vAnalyser.fftSize = 256;
  vAudioCtx.createMediaStreamSource(vStream).connect(vAnalyser);
  animateVoiceWave();

  vChunks = [];
  vRecorder = new MediaRecorder(vStream);
  vRecorder.ondataavailable = e => { if (e.data.size) vChunks.push(e.data); };
  vRecorder.onstop = () => {
    vBlob = new Blob(vChunks, { type: vRecorder?.mimeType || 'audio/webm' });
    stopVoice(false);
    const url = URL.createObjectURL(vBlob);
    voiceReview.classList.remove('hidden');
    voiceReview.innerHTML = `<audio src="${url}" controls></audio>`;
    voiceHint.textContent = 'Listen back, then submit or re-record';
    voiceSubmit.disabled = false;
  };
  vRecorder.start();
  vStart = Date.now();
  vTick = setInterval(() => {
    const ms = Date.now() - vStart;
    voiceElapsed.textContent = fmtTime(ms);
    if (ms >= MAX_REC_MS && vRecorder?.state === 'recording') vRecorder.stop();
  }, 200);
  voiceRecBtn.classList.add('recording');
  voiceReview.classList.add('hidden');
  voiceHint.textContent = 'Tap to stop recording';
  voiceSubmit.disabled = true;
});

voiceSubmit?.addEventListener('click', () => {
  if (!vBlob) return;
  openShareSheet(vBlob, vBlob.type || 'audio/webm', 'voice',
    document.getElementById('voiceName')?.value.trim() || '');
});

/* ---------- video message page ---------- */
const vmPreview = document.getElementById('vmPreview');
const vmOverlay = document.getElementById('vmOverlay');
const vmElapsed = document.getElementById('vmElapsed');
const vmRecordBtn = document.getElementById('vmRecord');
const vmReview = document.getElementById('vmReview');
const vmSubmit = document.getElementById('vmSubmit');
const vmFlash = document.getElementById('vmFlash');

let camStream = null, camFacing = 'user', torchOn = false;
let vmRecorder = null, vmChunks = [], vmBlob = null, vmTick = null, vmStart = 0;

async function startCamera(){
  camStream?.getTracks().forEach(t => t.stop());
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      audio:true,
      video:{ facingMode:camFacing }
    });
  } catch {
    alert('We need camera and microphone access to record your video message. Please allow it and try again.');
    return false;
  }
  vmPreview.srcObject = camStream;
  vmPreview.classList.toggle('mirrored', camFacing === 'user');
  vmPreview.play().catch(() => {});
  return true;
}

function stopVideoMsg(discard){
  if (vmRecorder && vmRecorder.state === 'recording') vmRecorder.stop();
  clearInterval(vmTick);
  camStream?.getTracks().forEach(t => t.stop());
  camStream = null;
  vmRecorder = null;
  torchOn = false;
  if (vmPreview) vmPreview.srcObject = null;
  vmRecordBtn?.classList.remove('recording');
  if (discard){
    vmBlob = null;
    if (vmReview){ vmReview.classList.add('hidden'); vmReview.innerHTML = ''; }
    if (vmSubmit) vmSubmit.disabled = true;
    if (vmElapsed){ vmElapsed.textContent = '00:00 / 02:00'; vmElapsed.classList.add('hidden'); }
    vmOverlay?.classList.remove('hidden');
    if (vmFlash) vmFlash.querySelector('small').textContent = 'Flash Off';
  }
}

function toggleVideoRecording(){
  if (vmRecorder && vmRecorder.state === 'recording'){
    vmRecorder.stop();
    return;
  }
  if (!camStream) return;
  vmChunks = [];
  vmRecorder = new MediaRecorder(camStream);
  vmRecorder.ondataavailable = e => { if (e.data.size) vmChunks.push(e.data); };
  vmRecorder.onstop = () => {
    clearInterval(vmTick);
    vmRecordBtn.classList.remove('recording');
    vmBlob = new Blob(vmChunks, { type: vmRecorder?.mimeType || 'video/webm' });
    const url = URL.createObjectURL(vmBlob);
    vmReview.classList.remove('hidden');
    vmReview.innerHTML = `<video src="${url}" controls playsinline></video>`;
    vmSubmit.disabled = false;
    vmElapsed.classList.add('hidden');
    vmOverlay.classList.remove('hidden');
    vmOverlay.querySelector('p').textContent = 'Tap to record again';
  };
  vmRecorder.start();
  vmStart = Date.now();
  vmTick = setInterval(() => {
    const ms = Date.now() - vmStart;
    vmElapsed.textContent = `${fmtTime(ms)} / 02:00`;
    if (ms >= MAX_REC_MS && vmRecorder?.state === 'recording') vmRecorder.stop();
  }, 200);
  vmRecordBtn.classList.add('recording');
  vmOverlay.classList.add('hidden');
  vmElapsed.classList.remove('hidden');
  vmReview.classList.add('hidden');
  vmSubmit.disabled = true;
}

vmRecordBtn?.addEventListener('click', toggleVideoRecording);
document.getElementById('vmViewfinder')?.addEventListener('click', e => {
  if (e.target.closest('video, .vf-overlay')) toggleVideoRecording();
});

document.getElementById('vmFlip')?.addEventListener('click', async () => {
  if (vmRecorder && vmRecorder.state === 'recording') return;
  camFacing = camFacing === 'user' ? 'environment' : 'user';
  await startCamera();
});

vmFlash?.addEventListener('click', async () => {
  const track = camStream?.getVideoTracks()[0];
  if (!track) return;
  const caps = track.getCapabilities?.();
  if (!caps || !caps.torch){
    vmFlash.querySelector('small').textContent = 'No Flash';
    setTimeout(() => { vmFlash.querySelector('small').textContent = torchOn ? 'Flash On' : 'Flash Off'; }, 1500);
    return;
  }
  torchOn = !torchOn;
  try {
    await track.applyConstraints({ advanced:[{ torch:torchOn }] });
    vmFlash.querySelector('small').textContent = torchOn ? 'Flash On' : 'Flash Off';
  } catch { torchOn = !torchOn; }
});

vmSubmit?.addEventListener('click', () => {
  if (!vmBlob) return;
  openShareSheet(vmBlob, vmBlob.type || 'video/webm', 'videomsg',
    document.getElementById('vmName')?.value.trim() || '');
});

/* ---------- open the pages ---------- */
document.getElementById('shareTypeVoice')?.addEventListener('click', () => {
  teardownRecorders();
  switchView('voicemsg');
});
document.getElementById('shareTypeVideoMsg')?.addEventListener('click', async () => {
  teardownRecorders();
  switchView('videomsg');
  await startCamera();
});

/* =========================================================
   Admin login
   ========================================================= */
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPassword = document.getElementById('adminPassword');
const adminLoginError = document.getElementById('adminLoginError');

function isAdminAuthenticated(){
  return sessionStorage.getItem('sj_admin_auth') === '1';
}

function checkAdminAuth(){
  const params = new URLSearchParams(window.location.search);
  const target = params.get('view') || (params.has('admin') ? 'admin' : null);
  if (target === 'admin'){
    if (isAdminAuthenticated()) switchView('admin');
    else switchView('adminlogin');
  }
}
checkAdminAuth();

adminLoginForm?.addEventListener('submit', e => {
  e.preventDefault();
  const value = adminPassword?.value || '';
  if (value === ADMIN_PASSWORD){
    sessionStorage.setItem('sj_admin_auth', '1');
    switchView('admin');
  } else {
    adminLoginError.textContent = 'Incorrect password. Please try again.';
    adminPassword?.select();
  }
});

document.querySelector('[data-goto="adminlogin"]')?.addEventListener('click', () => {
  if (isAdminAuthenticated()) switchView('admin');
});

/* =========================================================
   Admin dashboard
   ========================================================= */
let adminMemories = [];
let adminGuestbook = [];

function allSubmissions(){
  const mems = (adminMemories || []).map(m => ({ ...m, kind: m.kind || 'photo', type: m.type || 'image/jpeg' }));
  const gbs = (adminGuestbook || []).map(g => ({ ...g, kind: 'guestbook', type: 'guestbook' }));
  return [...mems, ...gbs];
}

function updateAdminStats(){
  const items = allSubmissions();
  const pending = items.filter(i => i.status !== 'approved').length;
  const approved = items.filter(i => i.status === 'approved').length;
  const total = items.length;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statPending', pending);
  set('statApproved', approved);
  set('statTotal', total);
}

function aqFilterMatches(item, filter){
  if (filter === 'all') return true;
  if (filter === 'guestbook') return item.kind === 'guestbook';
  if (filter === 'photo') return item.type?.startsWith('image/') || item.kind === 'photo' || item.kind === 'selfie';
  if (filter === 'video') return item.type?.startsWith('video/') || item.kind === 'videomsg' || item.kind === 'video';
  if (filter === 'voice') return item.type?.startsWith('audio/') || item.kind === 'voice';
  return true;
}

function renderApprovalQueue(){
  const list = document.getElementById('aqList');
  const empty = document.getElementById('aqEmpty');
  if (!list) return;

  const filter = document.querySelector('#aqFilters .chip.active')?.dataset.aqFilter || 'all';
  const items = allSubmissions().filter(i => i.status !== 'approved' && aqFilterMatches(i, filter));
  list.innerHTML = '';
  empty.classList.toggle('hidden', items.length > 0);

  for (const item of items){
    const card = document.createElement('article');
    card.className = 'aq-card';
    let media = '';
    if (item.kind === 'guestbook'){
      media = `<p><b>${escapeHTML(item.name)}</b> &mdash; ${escapeHTML(item.message)}</p>`;
    } else if (item.type.startsWith('image/')){
      media = `<img class="aq-media" src="${item.mediaUrl}" alt="">`;
    } else if (item.type.startsWith('video/')){
      media = `<video class="aq-media" controls playsinline src="${item.mediaUrl}"></video>`;
    } else if (item.type.startsWith('audio/')){
      media = `<audio controls src="${item.mediaUrl}"></audio>`;
    }
    const by = item.guestName || item.name || 'Guest';
    card.innerHTML = `
      ${media}
      <small>${escapeHTML(by)} &middot; ${timeAgo(item.createdAt)}</small>
      <div class="aq-actions">
        <button class="aq-approve" data-id="${item.id}" data-kind="${item.kind}" type="button">APPROVE</button>
        <button class="aq-reject" data-id="${item.id}" data-kind="${item.kind}" type="button">REJECT</button>
      </div>`;
    card.querySelector('.aq-approve').addEventListener('click', async e => {
      await updateStatus(e.target, 'approved');
    });
    card.querySelector('.aq-reject').addEventListener('click', async e => {
      await removeSubmission(e.target);
    });
    list.appendChild(card);
  }
}

async function updateStatus(btn, status){
  const kind = btn.dataset.kind;
  const id = btn.dataset.id;
  if (kind === 'guestbook') await gbUpdate({ id, status });
  else await updateMemory({ id, status });
}

async function removeSubmission(btn){
  const kind = btn.dataset.kind;
  const id = btn.dataset.id;
  if (kind === 'guestbook') await deleteMemoryGB(id);
  else await deleteMemory(id);
}

// admin real-time listeners
function startAdminListeners(){
  onMemories(items => { adminMemories = items; updateAdminStats(); renderApprovalQueue(); });
  onGuestbook(items => { adminGuestbook = items; updateAdminStats(); renderApprovalQueue(); });
}
startAdminListeners();

// expose helpers for admin
document.querySelectorAll('#aqFilters .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#aqFilters .chip').forEach(c => c.classList.toggle('active', c === chip));
    renderApprovalQueue();
  });
});

function teardownRecorders(){
  stopVoice(true);
  stopVideoMsg(true);
}

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
