'use strict';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const opening = $('#opening');
const sealButton = $('#sealButton');
const landingFrame = $('#landingFrame');
const attendScreen = $('#attendScreen');
const welcomeScreen = $('#welcomeScreen');
const welcome2Screen = $('#welcome2Screen');
const guestLoginScreen = $('#guestLoginScreen');
const app = $('#app');

/* ---- Guest session helpers ---- */
function getGuest(){ return JSON.parse(sessionStorage.getItem('sj_guest') || 'null'); }
function setGuest(g){ sessionStorage.setItem('sj_guest', JSON.stringify(g)); }
function clearGuest(){ sessionStorage.removeItem('sj_guest'); }
function isAdmin(){ return sessionStorage.getItem('sj_admin_auth') === '1'; }

/* ---- Show a gate screen with transition ---- */
function showGate(screen){
  [welcomeScreen, welcome2Screen, attendScreen, guestLoginScreen].forEach(s => s?.classList.add('hidden'));
  screen.classList.remove('hidden', 'exit');
  void screen.offsetWidth;
}
function hideGate(screen){
  screen.classList.add('exit');
  setTimeout(() => screen.classList.add('hidden'), 650);
}

/* ---- Enter the main app ---- */
function enterApp(){
  opening.classList.add('hidden');
  welcomeScreen?.classList.add('hidden');
  welcome2Screen?.classList.add('hidden');
  attendScreen?.classList.add('hidden');
  guestLoginScreen?.classList.add('hidden');
  app.classList.remove('hidden');
  document.body.classList.remove('locked');
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateGuestUI();
}

/* ---- Seal break on landing page ---- */
function handleSealButtonClick(){
  if (opening.classList.contains('breaking')) return;
  opening.classList.add('breaking');
  if (sealButton) sealButton.disabled = true;

  // swap in the cracked-seal artwork for the burst moment
  const art = $('#landingArt');
  if (art) art.src = 'assets/seal-burst.jpg';

  // landing fades out, then the envelope welcome screen appears
  setTimeout(() => opening.classList.add('opening-envelope'), 900);
  setTimeout(() => {
    opening.classList.add('hidden');
    showGate(welcomeScreen);
    // canvases can only be measured once the screen is visible
    requestAnimationFrame(() => requestAnimationFrame(resizeWeddingCanvases));
  }, 1550);
}
sealButton?.addEventListener('click', handleSealButtonClick);
sealButton?.addEventListener('touchstart', e => {
  e.preventDefault();
  handleSealButtonClick();
}, { passive:false });

/* =========================================================
   SCREEN 2 — Canvas wax seal shatter
   ========================================================= */
const invitation     = document.getElementById('invitation');
const welcomeImage   = document.getElementById('welcomeImage');
const sealHitArea    = document.getElementById('sealHitArea');
const sealCanvas     = document.getElementById('sealCanvas');
const particleCanvas = document.getElementById('particleCanvas');

const sealCtx     = sealCanvas?.getContext('2d', { alpha:true }) || null;
const particleCtx = particleCanvas?.getContext('2d', { alpha:true }) || null;

/* Wax seal region inside the 740x1600 artwork (assets/welcome-bg.jpg) */
const SEAL_CROP = { x:90, y:603, width:560, height:560 };

const GRID_COLUMNS = 7;
const GRID_ROWS = 7;
const MAX_DPR = 2;
const PARTICLE_COUNT = 95;
const SEAL_ANIMATION_DURATION = 1800;

let sealFragments = [];
let goldParticles = [];
let sealIsBreaking = false;
let sealAnimationFrame = null;
let sealAnimationStart = null;

function getDpr(){ return Math.min(window.devicePixelRatio || 1, MAX_DPR); }

function resizeCanvas(canvas, ctx, cssW, cssH){
  const dpr = getDpr();
  canvas.width  = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeWeddingCanvases(){
  if (!sealCtx || !particleCtx || !sealHitArea || !invitation) return;
  const sealRect = sealHitArea.getBoundingClientRect();
  const invRect  = invitation.getBoundingClientRect();
  if (!sealRect.width || !invRect.width) return;   // screen still hidden

  resizeCanvas(sealCanvas, sealCtx, sealRect.width, sealRect.height);
  resizeCanvas(particleCanvas, particleCtx, invRect.width, invRect.height);
  if (!sealIsBreaking) drawWholeSeal();
}

function drawWholeSeal(){
  if (!sealCtx || !welcomeImage?.complete || !welcomeImage.naturalWidth) return;
  const rect = sealHitArea.getBoundingClientRect();
  if (!rect.width) return;

  sealCtx.clearRect(0, 0, rect.width, rect.height);
  sealCtx.save();
  sealCtx.beginPath();
  sealCtx.arc(rect.width/2, rect.height/2, Math.min(rect.width, rect.height)/2, 0, Math.PI*2);
  sealCtx.closePath();
  sealCtx.clip();
  sealCtx.drawImage(welcomeImage,
    SEAL_CROP.x, SEAL_CROP.y, SEAL_CROP.width, SEAL_CROP.height,
    0, 0, rect.width, rect.height);
  sealCtx.restore();
}

function createSealFragments(){
  sealFragments = [];
  const rect = sealHitArea.getBoundingClientRect();
  const pieceW = rect.width / GRID_COLUMNS;
  const pieceH = rect.height / GRID_ROWS;
  const cx = rect.width / 2;
  const cy = rect.height / 2;

  for (let row = 0; row < GRID_ROWS; row++){
    for (let col = 0; col < GRID_COLUMNS; col++){
      const x = col * pieceW;
      const y = row * pieceH;
      const dX = (x + pieceW/2) - cx;
      const dY = (y + pieceH/2) - cy;
      const distance = Math.hypot(dX, dY);
      if (distance > rect.width * 0.51) continue;

      const angle = Math.atan2(dY, dX) + (Math.random() - 0.5) * 0.85;
      const normalized = Math.min(distance / (rect.width / 2), 1);
      const speed = 3.8 + Math.random() * 6.5 + normalized * 2.4;

      sealFragments.push({
        sourceX: SEAL_CROP.x + (col / GRID_COLUMNS) * SEAL_CROP.width,
        sourceY: SEAL_CROP.y + (row / GRID_ROWS) * SEAL_CROP.height,
        sourceWidth:  SEAL_CROP.width / GRID_COLUMNS,
        sourceHeight: SEAL_CROP.height / GRID_ROWS,
        x, y,
        width: pieceW + 1.2,
        height: pieceH + 1.2,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - (1 + Math.random() * 3.5),
        gravity: 0.16 + Math.random() * 0.14,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.34,
        scale: 1,
        opacity: 1,
        delay: Math.random() * 130
      });
    }
  }
}

function createGoldParticles(){
  goldParticles = [];
  const sealRect = sealHitArea.getBoundingClientRect();
  const invRect  = invitation.getBoundingClientRect();
  const cx = sealRect.left - invRect.left + sealRect.width / 2;
  const cy = sealRect.top  - invRect.top  + sealRect.height / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++){
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.6 + Math.random() * 8.3;
    goldParticles.push({
      x: cx + (Math.random() - .5) * 15,
      y: cy + (Math.random() - .5) * 15,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - Math.random() * 1.5,
      gravity: .055 + Math.random() * .085,
      size: .8 + Math.random() * 3.5,
      life: 1,
      decay: .009 + Math.random() * .017,
      color: Math.random() > .42 ? '#f7d77c' : '#b88128',
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - .5) * .15,
      shape: Math.random() > .55 ? 'spark' : 'ember'
    });
  }
}

function drawGoldParticles(){
  if (!particleCtx) return;
  const rect = invitation.getBoundingClientRect();
  particleCtx.clearRect(0, 0, rect.width, rect.height);

  goldParticles.forEach(p => {
    p.velocityY += p.gravity;
    p.x += p.velocityX;
    p.y += p.velocityY;
    p.rotation += p.rotationSpeed;
    p.life -= p.decay;
    if (p.life <= 0) return;

    particleCtx.save();
    particleCtx.translate(p.x, p.y);
    particleCtx.rotate(p.rotation);
    particleCtx.globalAlpha = Math.max(p.life, 0);
    particleCtx.fillStyle = p.color;
    particleCtx.shadowColor = '#ffd977';
    particleCtx.shadowBlur = 7 + p.size * 2;

    if (p.shape === 'spark'){
      particleCtx.fillRect(-p.size * .3, -p.size * 1.7, p.size * .6, p.size * 3.4);
    } else {
      particleCtx.beginPath();
      particleCtx.arc(0, 0, p.size, 0, Math.PI * 2);
      particleCtx.fill();
    }
    particleCtx.restore();
  });

  goldParticles = goldParticles.filter(p => p.life > 0);
}

function drawSealFragments(elapsed){
  if (!sealCtx) return;
  const rect = sealHitArea.getBoundingClientRect();
  sealCtx.clearRect(0, 0, rect.width, rect.height);

  sealFragments.forEach(piece => {
    if (elapsed < piece.delay){
      sealCtx.drawImage(welcomeImage,
        piece.sourceX, piece.sourceY, piece.sourceWidth, piece.sourceHeight,
        piece.x, piece.y, piece.width, piece.height);
      return;
    }

    piece.velocityY += piece.gravity;
    piece.x += piece.velocityX;
    piece.y += piece.velocityY;
    piece.rotation += piece.rotationSpeed;
    piece.scale *= .9968;
    piece.opacity -= .0088;
    if (piece.opacity <= 0) return;

    sealCtx.save();
    sealCtx.globalAlpha = Math.max(piece.opacity, 0);
    sealCtx.translate(piece.x + piece.width/2, piece.y + piece.height/2);
    sealCtx.rotate(piece.rotation);

    const perspectiveX = .58 + Math.abs(Math.cos(piece.rotation * 1.8)) * .42;
    sealCtx.scale(piece.scale * perspectiveX, piece.scale);

    sealCtx.drawImage(welcomeImage,
      piece.sourceX, piece.sourceY, piece.sourceWidth, piece.sourceHeight,
      -piece.width/2, -piece.height/2, piece.width, piece.height);

    sealCtx.strokeStyle = 'rgba(255,221,139,.58)';
    sealCtx.lineWidth = 1;
    sealCtx.strokeRect(-piece.width/2, -piece.height/2, piece.width, piece.height);

    sealCtx.beginPath();
    sealCtx.moveTo(-piece.width/2, -piece.height/2);
    sealCtx.lineTo(piece.width/2, -piece.height/2);
    sealCtx.strokeStyle = 'rgba(255,245,204,.42)';
    sealCtx.stroke();
    sealCtx.restore();
  });
}

function animateSealBreak(timestamp){
  if (!sealIsBreaking) return;
  if (sealAnimationStart === null) sealAnimationStart = timestamp;
  const elapsed = timestamp - sealAnimationStart;

  drawSealFragments(elapsed);
  drawGoldParticles();

  if (elapsed < SEAL_ANIMATION_DURATION || goldParticles.length > 0){
    sealAnimationFrame = requestAnimationFrame(animateSealBreak);
    return;
  }

  finishSealBreak();
}

function finishSealBreak(){
  if (!sealIsBreaking) return;
  if (sealAnimationFrame) cancelAnimationFrame(sealAnimationFrame);
  if (sealBreakFallbackTimer) clearTimeout(sealBreakFallbackTimer);
  sealAnimationFrame = null;
  sealBreakFallbackTimer = null;

  sealCtx?.clearRect(0, 0, sealCanvas.width, sealCanvas.height);
  particleCtx?.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  if (sealCanvas) sealCanvas.style.opacity = '0';

  openInvitation();
  sealIsBreaking = false;
}

/* The page advances ONLY because the guest intentionally tapped the seal. */
let sealBreakFallbackTimer = null;
function breakWeddingSeal(){
  if (sealIsBreaking) return;
  sealIsBreaking = true;

  createSealFragments();
  createGoldParticles();

  sealHitArea.classList.add('is-breaking');
  invitation.classList.add('is-breaking', 'is-shaking');

  if (typeof navigator.vibrate === 'function'){
    try { navigator.vibrate([35, 20, 50]); } catch(e){}
  }

  sealAnimationStart = null;
  sealAnimationFrame = requestAnimationFrame(animateSealBreak);
  // Fallback for browsers that throttle/pause rAF (low-power, PIP, hidden iframes).
  sealBreakFallbackTimer = setTimeout(finishSealBreak, SEAL_ANIMATION_DURATION + 600);
}

function openInvitation(){
  hideGate(welcomeScreen);
  setTimeout(() => showGate(welcome2Screen), 650);
}

sealHitArea?.addEventListener('click', breakWeddingSeal);
sealHitArea?.addEventListener('touchstart', e => {
  e.preventDefault();
  breakWeddingSeal();
}, { passive:false });
sealHitArea?.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' '){
    e.preventDefault();
    breakWeddingSeal();
  }
});

let sealResizeFrame = null;
window.addEventListener('resize', () => {
  if (sealResizeFrame) cancelAnimationFrame(sealResizeFrame);
  sealResizeFrame = requestAnimationFrame(() => {
    resizeWeddingCanvases();
    sealResizeFrame = null;
  });
}, { passive:true });

function initializeWelcomePage(){
  if (!welcomeImage) return;
  if (welcomeImage.complete && welcomeImage.naturalWidth > 0) resizeWeddingCanvases();
  else welcomeImage.addEventListener('load', resizeWeddingCanvases, { once:true });
}
initializeWelcomePage();

/* ---- Screen 3: "ENTER OUR WEDDING" ---- */
const enterWeddingBtn = $('#enterWeddingBtn');
let enterWeddingFired = false;
function handleEnterWedding(){
  if (enterWeddingFired) return;
  enterWeddingFired = true;
  if (enterWeddingBtn) enterWeddingBtn.disabled = true;
  document.querySelector('.invitation--welcome2')?.classList.add('is-entering');
  if (typeof navigator.vibrate === 'function'){
    try { navigator.vibrate(25); } catch(e){}
  }
  setTimeout(() => {
    hideGate(welcome2Screen);
    setTimeout(() => showGate(attendScreen), 650);
  }, 260);
}
window.handleEnterWedding = handleEnterWedding;
enterWeddingBtn?.addEventListener('click', handleEnterWedding);
// touchstart fallback — some mobile browsers drop click on transparent buttons
enterWeddingBtn?.addEventListener('touchstart', e => {
  e.preventDefault();
  handleEnterWedding();
}, { passive:false });

/* ---- Attendance question ---- */
const attendActions = $('#attendActions');
const attendDeclinePanel = $('#attendDeclinePanel');

$('#attendYes')?.addEventListener('click', () => {
  hideGate(attendScreen);
  setTimeout(() => showGate(guestLoginScreen), 650);
});

$('#attendNo')?.addEventListener('click', () => {
  attendActions?.classList.add('hidden');
  attendDeclinePanel?.classList.remove('hidden');
  setTimeout(() => $('#attendBrowse')?.focus(), 220);
});

$('#attendChange')?.addEventListener('click', () => {
  attendDeclinePanel?.classList.add('hidden');
  attendActions?.classList.remove('hidden');
  setTimeout(() => $('#attendNo')?.focus(), 200);
});

$('#attendBrowse')?.addEventListener('click', () => {
  hideGate(attendScreen);
  setTimeout(enterApp, 650);
});

/* ---- Guest login form ---- */
$('#guestLoginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#guestLoginError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const name = $('#guestName').value.trim();
  const phone = $('#guestPhone').value.trim();
  const email = $('#guestEmail').value.trim();
  const relation = $('#guestRelation').value;

  if (!name || !phone || !email || !relation){
    if (err) err.textContent = 'Please fill in all fields.';
    return;
  }

  const guest = { name, phone, email, relation, attending:true, checkedInAt:new Date().toISOString() };

  // Show loading state on the button
  if (submitBtn){
    submitBtn.disabled = true;
    submitBtn.dataset.label = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Opening your experience…';
  }

  // Save to Firebase if available, but never let it block the form.
  // A hanging Firestore promise (offline / network / rules) would otherwise
  // freeze the check-in forever.
  try {
    if (typeof addGuest === 'function'){
      const savePromise = addGuest(guest);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase save timeout')), 4000)
      );
      const id = await Promise.race([savePromise, timeout]);
      if (id) guest.id = id;
    }
  } catch(ferr){ console.warn('Firebase guest save skipped:', ferr); }

  setGuest(guest);
  if (err) err.textContent = '';
  hideGate(guestLoginScreen);
  setTimeout(enterApp, 650);
});

/* ---- Update UI based on guest session ---- */
function updateGuestUI(){
  const guest = getGuest();
  // show guest name in home hero
  if (guest){
    const hero = document.querySelector('.home-eyebrow');
    if (hero) hero.textContent = `WELCOME, ${guest.name.toUpperCase()}`;
  }
}

$('#enterFromHome')?.addEventListener('click', () => {
  // Smooth scroll to the countdown section
  const bigday = document.querySelector('.bigday');
  if (bigday) bigday.scrollIntoView({ behavior:'smooth', block:'center' });
});

/* ---------------------------------------------------------
   Tab navigation
   --------------------------------------------------------- */
const SUBVIEW_TAB = {
  guestbook:'more', memories:'more', rsvp:'more', voicemsg:'more', videomsg:'more',
  admin:'more', adminlogin:'more', approvals:'more', voiceAdmin:'more', videoAdmin:'more',
  rsvpAdmin:'more', guestlist:'more'
};
function switchView(name){
  const tabName = SUBVIEW_TAB[name] || name;
  $$('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  // Home shows the music control; every other screen shows the menu button
  const onHome = name === 'home';
  $('#musicToggle')?.classList.toggle('hidden', !onHome);
  $('#menuToggle')?.classList.toggle('hidden', onHome);

  window.scrollTo({ top: 0, behavior: 'instant' });
}
$$('.tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.tab)));

/* ---------------------------------------------------------
   Story segmented control
   --------------------------------------------------------- */
$$('.segmented button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.segmented button').forEach(b => b.classList.toggle('active', b === btn));
    $$('[data-story-panel]').forEach(p => {
      p.classList.toggle('hidden', p.dataset.storyPanel !== btn.dataset.storyTab);
    });
  });
});

/* ---------------------------------------------------------
   How we met
   --------------------------------------------------------- */
const HOW_WE_MET = `What began with a simple Instagram connection became something neither of us could ignore. Samuel saw Josephine's beautiful picture, left the comment "very pretty," and she responded. That small moment opened the door to conversations that quickly became something much deeper. Just three days later, during a FaceTime call, Samuel asked Josephine to be his wife. Four months later, Samuel traveled from Atlanta to Accra to finally meet her in person. The next day, on Josephine's birthday, he surprised her with a proposal and a beautiful diamond ring — and she said YES.`;

const storyTextEl = $('#storyText');
if (storyTextEl) storyTextEl.textContent = localStorage.getItem('sj_love_story') || HOW_WE_MET;

/* ---------------------------------------------------------
   Countdown to the wedding
   --------------------------------------------------------- */
const WEDDING_DATE = new Date('2027-01-09T10:00:00+00:00');
function updateCountdown(){
  const diff = Math.max(0, WEDDING_DATE - new Date());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('days', String(d));
  set('hours', String(h).padStart(2, '0'));
  set('minutes', String(m).padStart(2, '0'));
  set('seconds', String(s).padStart(2, '0'));
}
updateCountdown();
setInterval(updateCountdown, 1000);

/* ---------------------------------------------------------
   Music toggle
   --------------------------------------------------------- */
const music = $('#backgroundMusic');
let currentSongUrl = null;

async function loadSong(){
  try {
    const blob = await kvGet('weddingSong');
    const label = await kvGet('weddingSongLabel');
    if (blob && music){
      if (currentSongUrl) URL.revokeObjectURL(currentSongUrl);
      currentSongUrl = URL.createObjectURL(blob);
      music.src = currentSongUrl;
      music.load();
      const labelEl = document.getElementById('songLabel');
      if (labelEl) labelEl.textContent = label || 'Song loaded';
      const toggle = document.getElementById('musicToggle');
      if (toggle) toggle.classList.add('has-song');
    }
  } catch(err){ console.warn(err); }
}
loadSong();

async function saveSong(file){
  try {
    await kvSet('weddingSong', file);
    await kvSet('weddingSongLabel', file.name);
    await loadSong();
    if (music && music.paused === false){ music.play().catch(() => {}); }
  } catch(err){ console.warn(err); }
}

document.getElementById('songUpload')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file && file.type.startsWith('audio/')) saveSong(file);
  e.target.value = '';
});

$('#musicToggle')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  if (!music || !music.src) {
    alert('Upload a wedding song from the More menu first.');
    return;
  }
  if (music.paused) {
    await music.play().catch(() => {});
    btn.classList.add('is-on');
  } else {
    music.pause();
    btn.classList.remove('is-on');
  }
});

/* ---------------------------------------------------------
   Map link
   --------------------------------------------------------- */
$('#viewMap')?.addEventListener('click', () => {
  window.open('https://www.google.com/maps/search/?api=1&query=Accra%2C+Ghana', '_blank', 'noopener');
});

/* ---------------------------------------------------------
   Scroll reveal — timeline and cards fade in as you scroll
   --------------------------------------------------------- */
(() => {
  const targets = $$('.tl-row, .story-quote, .date-card, .schedule, .hash-bar');
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .18, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(el => { el.classList.add('reveal'); io.observe(el); });
})();

/* ---------------------------------------------------------
   PWA
   --------------------------------------------------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(console.error);
  });
}
