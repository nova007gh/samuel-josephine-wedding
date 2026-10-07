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
function getGuest(){
  try { return JSON.parse(localStorage.getItem('sj_guest') || 'null'); }
  catch { return null; }
}
function setGuest(g){ try { localStorage.setItem('sj_guest', JSON.stringify(g)); } catch {} }
function clearGuest(){ localStorage.removeItem('sj_guest'); localStorage.removeItem('sj_entered'); }

/* a check-in whose save failed (offline) is retried quietly on the next visit */
window.addEventListener('load', () => {
  const g = getGuest();
  if (!g?.unsaved || g.id || typeof addGuest !== 'function') return;
  const { unsaved, ...record } = g;
  addGuest(record).then(id => { if (id) setGuest({ ...record, id }); }).catch(() => {});
});

let adminSignedIn = false;
function isAdmin(){ return adminSignedIn; }

/* ---- Show a gate screen with transition ---- */
function showGate(screen){
  [welcomeScreen, welcome2Screen, attendScreen, guestLoginScreen].forEach(s => s?.classList.add('hidden'));
  screen.classList.remove('hidden', 'exit');
  if (screen === guestLoginScreen) showPane('form');
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
  /* mark the session BEFORE any UI work — a rendering error must never
     leave a checked-in guest looking logged-out on their next visit */
  try {
    localStorage.setItem('sj_entered', '1');
    /* baseline history entry, so the very first Back press lands on Home
       inside the app rather than unloading the page */
    if (!history.state) history.replaceState({ view:'home' }, '', '#home');
  } catch {}
  try { updateGuestUI(); } catch {}
  /* notifications start streaming only from here */
  window.dispatchEvent(new Event('sj:entered'));
}

/* A guest who has already opened the invitation goes straight in on their
   next visit — replaying the seal flow on every reload is jarring. */
function hasEntered(){
  /* only a guest who actually checked in (gave their details) skips the gates */
  try {
    return localStorage.getItem('sj_entered') === '1' &&
      (!!getGuest()?.name || !!localStorage.getItem('sj_admin_token'));
  } catch { return false; }
}

/* every guest must check in before using the app — send anyone who got
   past the gates without details back to the "Will you join us?" screen */
function requireCheckIn(){
  app.classList.add('hidden');
  document.body.classList.add('locked');
  opening.classList.add('hidden');
  attendDeclinePanel?.classList.add('hidden');
  attendActions?.classList.remove('hidden');
  showGate(attendScreen);
}
/* true whenever an invitation gate is on screen instead of the app */
function gateShowing(){
  return document.body.classList.contains('locked')
    || !opening?.classList.contains('hidden')
    || !!app?.classList.contains('hidden');
}
if (hasEntered()){
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('locked')) return;
    /* read the target before entering: enterApp() rewrites the hash to #home */
    const hash = (location.hash || '').replace('#', '');
    enterApp();
    if (hash && document.querySelector(`.view[data-view="${hash}"]`)) switchView(hash);
  });
}

/* ---- Seal break on landing page ---- */
function handleSealButtonClick(){
  if (opening.classList.contains('breaking')) return;
  opening.classList.add('breaking');
  if (sealButton) sealButton.disabled = true;

  // the seal-press pulse + envelope-open animation carries the transition;
  // the artwork has no burst frame, so it stays on screen while opening

  // landing fades out, then straight to the attend/check-in gate —
  // the ENTER OUR WEDDING splash was removed from the flow
  setTimeout(() => opening.classList.add('opening-envelope'), 900);
  setTimeout(() => {
    opening.classList.add('hidden');
    showGate(attendScreen);
  }, 1550);
}
sealButton?.addEventListener('click', handleSealButtonClick);
sealButton?.addEventListener('touchstart', e => {
  e.preventDefault();
  handleSealButtonClick();
}, { passive:false });

// the whole artwork opens the invitation — the seal position in the art
// can change (admin can swap the image), so don't rely on the hotspot alone
$('#landingFrame')?.addEventListener('click', handleSealButtonClick);

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
// the whole ENTER artwork advances — the painted button can shift if the
// admin swaps the image, so the invisible hotspot can't strand a guest
welcome2Screen?.addEventListener('click', handleEnterWedding);

/* ---- Attendance question ---- */
const attendActions = $('#attendActions');
const attendDeclinePanel = $('#attendDeclinePanel');

let pendingAttending = true; // YES path vs explore-first path

$('#attendYes')?.addEventListener('click', () => {
  pendingAttending = true;
  syncGuestRsvpPills();
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

/* "Explore anyway" still needs their details — open check-in as Exploring */
$('#attendBrowse')?.addEventListener('click', () => {
  pendingAttending = false;
  syncGuestRsvpPills();
  hideGate(attendScreen);
  setTimeout(() => showGate(guestLoginScreen), 650);
});

/* ---- Guest login form ---- */
/* RSVP pills inside the check-in form — prefilled from the attend screen,
   but the guest can change their answer right here */
let guestRsvpYes = true;
document.querySelectorAll('#guestRsvp .rsvp-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('#guestRsvp .rsvp-pill').forEach(x => x.classList.toggle('active', x === pill));
    guestRsvpYes = pill.dataset.rsvp === 'yes';
    syncCheckinParty();
  });
});
function syncGuestRsvpPills(){
  guestRsvpYes = pendingAttending !== false;
  document.querySelectorAll('#guestRsvp .rsvp-pill').forEach(x =>
    x.classList.toggle('active', (x.dataset.rsvp === 'yes') === guestRsvpYes));
  syncCheckinParty();
}

/* extra guests joining the checker's table — only matters if attending */
let checkinParty = 0;
function syncCheckinParty(){
  $('#checkinPartyRow')?.classList.toggle('hidden', !guestRsvpYes);
}
const setCheckinParty = n => { checkinParty = Math.min(9, Math.max(0, n)); $('#checkinCount').textContent = checkinParty ? `+${checkinParty}` : 'Just me'; };
$('#checkinMinus')?.addEventListener('click', () => setCheckinParty(checkinParty - 1));
$('#checkinPlus')?.addEventListener('click', () => setCheckinParty(checkinParty + 1));

/* reveal a "who invited you?" text field when the guest picks Other */
$('#guestRelation')?.addEventListener('change', e => {
  const isOther = e.target.value === 'Other';
  $('#guestRelationOtherWrap')?.classList.toggle('hidden', !isOther);
  const input = $('#guestRelationOther');
  if (input) input.required = isOther;
  if (isOther) input?.focus();
});

/* ---- country list — drives the flag'd calling-code picker and the
   home-country field; Ghana first, then common diaspora, then a-z ---- */
const COUNTRIES = [
  { n:'Ghana', d:'+233', f:'🇬🇭' },
  { n:'United States', d:'+1', f:'🇺🇸' },
  { n:'United Kingdom', d:'+44', f:'🇬🇧' },
  { n:'Canada', d:'+1', f:'🇨🇦' },
  { n:'Nigeria', d:'+234', f:'🇳🇬' },
  { n:'South Africa', d:'+27', f:'🇿🇦' },
  { n:'Germany', d:'+49', f:'🇩🇪' },
  { n:'Netherlands', d:'+31', f:'🇳🇱' },
  { n:'France', d:'+33', f:'🇫🇷' },
  { n:'Italy', d:'+39', f:'🇮🇹' },
  { n:'Australia', d:'+61', f:'🇦🇺' },
  { n:'Belgium', d:'+32', f:'🇧🇪' },
  { n:'Benin', d:'+229', f:'🇧🇯' },
  { n:'Botswana', d:'+267', f:'🇧🇼' },
  { n:'Brazil', d:'+55', f:'🇧🇷' },
  { n:'Burkina Faso', d:'+226', f:'🇧🇫' },
  { n:'Cameroon', d:'+237', f:'🇨🇲' },
  { n:'China', d:'+86', f:'🇨🇳' },
  { n:'Côte d\'Ivoire', d:'+225', f:'🇨🇮' },
  { n:'Denmark', d:'+45', f:'🇩🇰' },
  { n:'Egypt', d:'+20', f:'🇪🇬' },
  { n:'Ethiopia', d:'+251', f:'🇪🇹' },
  { n:'Finland', d:'+358', f:'🇫🇮' },
  { n:'Gambia', d:'+220', f:'🇬🇲' },
  { n:'India', d:'+91', f:'🇮🇳' },
  { n:'Ireland', d:'+353', f:'🇮🇪' },
  { n:'Israel', d:'+972', f:'🇮🇱' },
  { n:'Jamaica', d:'+1876', f:'🇯🇲' },
  { n:'Japan', d:'+81', f:'🇯🇵' },
  { n:'Kenya', d:'+254', f:'🇰🇪' },
  { n:'Liberia', d:'+231', f:'🇱🇷' },
  { n:'Mexico', d:'+52', f:'🇲🇽' },
  { n:'Morocco', d:'+212', f:'🇲🇦' },
  { n:'Norway', d:'+47', f:'🇳🇴' },
  { n:'Poland', d:'+48', f:'🇵🇱' },
  { n:'Portugal', d:'+351', f:'🇵🇹' },
  { n:'Qatar', d:'+974', f:'🇶🇦' },
  { n:'Rwanda', d:'+250', f:'🇷🇼' },
  { n:'Senegal', d:'+221', f:'🇸🇳' },
  { n:'Sierra Leone', d:'+232', f:'🇸🇱' },
  { n:'Spain', d:'+34', f:'🇪🇸' },
  { n:'Sweden', d:'+46', f:'🇸🇪' },
  { n:'Switzerland', d:'+41', f:'🇨🇭' },
  { n:'Tanzania', d:'+255', f:'🇹🇿' },
  { n:'Togo', d:'+228', f:'🇹🇬' },
  { n:'Trinidad & Tobago', d:'+1868', f:'🇹🇹' },
  { n:'Turkey', d:'+90', f:'🇹🇷' },
  { n:'Uganda', d:'+256', f:'🇺🇬' },
  { n:'Ukraine', d:'+380', f:'🇺🇦' },
  { n:'United Arab Emirates', d:'+971', f:'🇦🇪' },
  { n:'Zambia', d:'+260', f:'🇿🇲' },
  { n:'Zimbabwe', d:'+263', f:'🇿🇼' }
];

/* populate the country pickers; choosing a home country also swaps the
   calling code so the phone stays in sync */
const dialSel = $('#guestDialCode');
const countrySel = $('#guestCountry');
if (dialSel){
  dialSel.innerHTML = COUNTRIES.map(c =>
    `<option value="${c.d}" data-country="${c.n}">${c.f} ${c.n} (${c.d})</option>`).join('');
  dialSel.value = '+233';
}
if (countrySel){
  countrySel.innerHTML = `<option value="" disabled selected>Select your country</option>` +
    COUNTRIES.map(c => `<option value="${c.n}">${c.f} ${c.n}</option>`).join('');
  countrySel.addEventListener('change', () => {
    const c = COUNTRIES.find(x => x.n === countrySel.value);
    if (c && dialSel) dialSel.value = c.d;
  });
}

/* dial code + local digits → international format the server expects;
   a number typed with a leading + or 00 is trusted as already-intl */
function composePhone(){
  const raw = ($('#guestPhone')?.value || '').trim();
  if (raw.startsWith('+') || raw.startsWith('00')) return raw;
  const digits = raw.replace(/[^\d]/g, '').replace(/^0+/, '');
  return (dialSel?.value || '+233') + digits;
}

/* Ghana numbers get the code by SMS; international SMS is unreliable
   (US carriers block unregistered senders), so everyone else gets email */
function isGhanaPhone(p){
  const n = (p || '').trim();
  const intl = n.startsWith('00') ? '+' + n.slice(2).replace(/[^\d]/g, '') : n;
  return intl.startsWith('+233');
}

/* ---- Phone OTP — one pane shared by registration and returning sign-in ---- */
let otpMode = 'register';       /* 'register' | 'login' */
let otpPhone = '';
let otpChannel = 'sms';         /* 'sms' | 'email' — delivery channel for the code */
let otpEmail = '';              /* target/masked email shown in the hint */
let pendingGuest = null;

function showPane(which){
  $('#guestLoginForm')?.classList.toggle('hidden', which !== 'form');
  $('#returnPane')?.classList.toggle('hidden', which !== 'return');
  $('#otpPane')?.classList.toggle('hidden', which !== 'otp');
}
function setOtpHint(delivered){
  const hint = $('#otpHint');
  if (!hint) return;
  hint.textContent = '';
  if (delivered === 'sms'){
    hint.append('We texted a 6-digit code to ');
    const b = document.createElement('b');
    b.textContent = otpPhone;
    hint.append(b);
  } else if (delivered === 'email'){
    hint.append('We emailed a 6-digit code to ');
    const b = document.createElement('b');
    b.textContent = otpEmail;
    hint.append(b);
  } else if (delivered === 'call'){
    hint.append("We're calling ");
    const b = document.createElement('b');
    b.textContent = otpPhone;
    hint.append(b, ' — answer to hear your 6-digit code');
  } else {
    hint.textContent = 'Sam & Jossy have your code — just ask them for it';
  }
}
function syncOtpButtons(){
  /* hide the button for the active channel; offer the alternates */
  $('#otpEmailBtn')?.classList.toggle('hidden', otpChannel === 'email' || !otpEmail);
  /* intl SMS is blocked (A2P), so only Ghana numbers get the text option */
  $('#otpSmsBtn')?.classList.toggle('hidden', otpChannel === 'sms' || !isGhanaPhone(otpPhone));
  $('#otpCallBtn')?.classList.toggle('hidden', otpChannel === 'call' || isGhanaPhone(otpPhone));
}
function showOtpPane(phone, mode, delivered, resp){
  otpMode = mode; otpPhone = phone;
  /* undelivered ('admin') resends should retry the channel that fits the number */
  otpChannel = ['email', 'call', 'sms'].includes(delivered) ? delivered
             : (isGhanaPhone(phone) ? 'sms' : 'call');
  /* registration knows the typed email; sign-in only knows the masked one from the server */
  otpEmail = pendingGuest?.email || resp?.emailMasked || '';
  syncOtpButtons();
  setOtpHint(delivered);
  $('#otpError').textContent = '';
  $('#otpCode').value = '';
  showPane('otp');
  $('#otpCode')?.focus();
}
async function resendOtp(channel){
  const r = await sendOtp(otpPhone, otpMode, pendingGuest?.name,
    channel === 'email' ? { channel, email: pendingGuest?.email }
    : channel === 'call' ? { channel, email: pendingGuest?.email } : undefined);
  if (r.delivered === 'email' && r.emailMasked && !pendingGuest?.email) otpEmail = r.emailMasked;
  otpChannel = ['email', 'call', 'sms'].includes(r.delivered) ? r.delivered : otpChannel;
  syncOtpButtons();
  setOtpHint(r.delivered);
  $('#otpError').textContent = '';
}

/* new guest — details collected, phone verified by code, then saved */
async function finishCheckin(){
  const guest = pendingGuest;
  pendingGuest = null;
  try {
    if (typeof addGuest === 'function'){
      const savePromise = addGuest(guest);
      savePromise
        .then(id => { if (id){ const g = getGuest() || guest; g.id = id; delete g.unsaved; setGuest(g); } })
        .catch(() => { const g = getGuest() || guest; if (!g.id){ g.unsaved = true; setGuest(g); } });
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Guest save timeout')), 4000));
      const id = await Promise.race([savePromise, timeout]);
      if (id) guest.id = id;
    }
  } catch(ferr){ console.warn('Guest save still in progress:', ferr); }

  /* keep otpToken on the record — the unsaved-retry path needs it */
  setGuest(guest);
  hideGate(guestLoginScreen);
  setTimeout(enterApp, 650);
  // gesture context — good moment to offer notifications (fire & forget)
  if (typeof enableNotifications === 'function') enableNotifications().catch(() => {});
}

$('#guestLoginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#guestLoginError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const name = $('#guestName').value.trim();
  const phone = composePhone();
  const email = $('#guestEmail').value.trim();
  const city = $('#guestCity')?.value.trim() || '';
  const state = $('#guestState')?.value.trim() || '';
  const country = $('#guestCountry')?.value || '';
  const relationSel = $('#guestRelation').value;
  const relationOther = $('#guestRelationOther')?.value.trim();
  const relation = relationSel === 'Other' ? (relationOther ? `Other — ${relationOther}` : 'Other') : relationSel;

  if (!name || !phone || !email || !relationSel){
    if (err) err.textContent = 'Please fill in all fields.';
    return;
  }
  if (phone.replace(/[^\d]/g, '').length < 7){
    if (err) err.textContent = 'Enter a valid phone number.';
    $('#guestPhone')?.focus();
    return;
  }
  if (!city || !country){
    if (err) err.textContent = 'Please add your city and country — state is optional.';
    return;
  }
  if (relationSel === 'Other' && !relationOther){
    if (err) err.textContent = 'Please tell us who invited you.';
    $('#guestRelationOther')?.focus();
    return;
  }

  pendingGuest = { name, phone, email, city, state, country, relation,
                   attending:guestRsvpYes,
                   tableGuests: guestRsvpYes ? checkinParty : 0,
                   checkedInAt:new Date().toISOString() };

  if (submitBtn){
    submitBtn.disabled = true;
    submitBtn.dataset.label = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Sending code…';
  }
  try {
    const intl = !isGhanaPhone(phone);
    const r = await sendOtp(phone, 'register', name, intl ? { channel:'call', email } : undefined);
    showOtpPane(phone, 'register', r.delivered, r);
    if (err) err.textContent = '';
  } catch(x){
    if (err) err.textContent = x.message || 'Could not send the code — try again.';
    pendingGuest = null;
  } finally {
    if (submitBtn){ submitBtn.disabled = false; submitBtn.innerHTML = submitBtn.dataset.label; }
  }
});

/* returning guest — phone + code brings their check-in back */
$('#returnGuestLink')?.addEventListener('click', () => {
  $('#guestLoginError').textContent = '';
  $('#returnError').textContent = '';
  $('#returnRegister')?.classList.add('hidden');
  showPane('return');
  $('#returnPhone')?.focus();
});
const returnNotFound = () => {
  $('#returnError').textContent = 'No check-in found for that number.';
  $('#returnRegister')?.classList.remove('hidden');
};
$('#returnPhone')?.addEventListener('input', () => $('#returnRegister')?.classList.add('hidden'));
$('#returnSendBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const err = $('#returnError');
  const phone = $('#returnPhone').value.trim();
  if (!phone){ err.textContent = 'Enter your phone number.'; return; }
  err.textContent = '';
  $('#returnRegister')?.classList.add('hidden');

  /* same device + same number as the stored check-in → they already proved
     themselves once, let them straight back in without another code */
  const tailOf = v => (String(v || '').match(/\d/g) || []).join('').slice(-9);
  const saved = getGuest();
  if (saved?.name && tailOf(phone).length === 9 && tailOf(saved.phone) === tailOf(phone)){
    try { localStorage.setItem('sj_entered', '1'); } catch {}
    hideGate(guestLoginScreen);
    setTimeout(enterApp, 650);
    return;
  }

  btn.disabled = true;
  const label = btn.innerHTML;
  btn.innerHTML = 'Checking…';
  try {
    /* confirm the number actually checked in before spending an OTP send */
    let firstName = null;
    try {
      const lk = await lookupGuest(phone);
      firstName = lk.exists ? (lk.name || '') : null;
    } catch { firstName = undefined; }  /* lookup unreachable — let sendOtp decide */
    if (firstName === null){ returnNotFound(); return; }

    btn.innerHTML = firstName ? `Welcome back, ${firstName}! Sending code…` : 'Sending code…';
    const intl = !isGhanaPhone(phone);
    let r;
    try {
      r = await sendOtp(phone, 'login', undefined, intl ? { channel:'call' } : undefined);
    } catch(ex){
      if (!intl) throw ex;
      r = await sendOtp(phone, 'login');   /* call channel rejected — fall back to SMS */
    }
    pendingGuest = null;
    showOtpPane(phone, 'login', r.delivered, r);
  } catch(x){
    if (/no check-in/i.test(x.message || '')) returnNotFound();
    else err.textContent = x.message || 'Could not send the code — try again.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = label;
  }
});

$('#otpVerifyBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  const err = $('#otpError');
  const code = $('#otpCode').value.replace(/\D/g, '');
  if (code.length !== 6){ err.textContent = 'Enter the 6-digit code.'; return; }
  btn.disabled = true;
  const label = btn.innerHTML;
  btn.innerHTML = 'Verifying…';
  try {
    if (otpMode === 'login'){
      const r = await guestLogin(otpPhone, code);
      setGuest(r.guest);
      hideGate(guestLoginScreen);
      setTimeout(enterApp, 650);
      if (typeof enableNotifications === 'function') enableNotifications().catch(() => {});
    } else {
      const r = await verifyOtp(otpPhone, code);
      if (pendingGuest) pendingGuest.otpToken = r.otpToken;
      finishCheckin();
    }
  } catch(x){
    err.textContent = x.message || 'Verification failed — try again.';
    btn.disabled = false;
    btn.innerHTML = label;
  }
});
$('#otpCode')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#otpVerifyBtn')?.click();
});
$('#otpResendBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'Sending…';
  try {
    await resendOtp(otpChannel);
  } catch(x){
    $('#otpError').textContent = x.message || 'Could not resend — try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});
/* channel switchers — same code screen, alternate delivery */
$('#otpEmailBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await resendOtp('email');
  } catch(x){
    $('#otpError').textContent = x.message || 'Could not email the code — try again.';
  } finally {
    btn.disabled = false;
  }
});
$('#otpSmsBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await resendOtp('sms');
  } catch(x){
    $('#otpError').textContent = x.message || 'Could not text the code — try again.';
  } finally {
    btn.disabled = false;
  }
});
$('#otpCallBtn')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await resendOtp('call');
  } catch(x){
    $('#otpError').textContent = x.message || 'Could not call you — try again.';
  } finally {
    btn.disabled = false;
  }
});
document.querySelectorAll('[data-pane]').forEach(b =>
  b.addEventListener('click', () => showPane(b.dataset.pane === 'back' ? (otpMode === 'login' ? 'return' : 'form') : 'form')));

/* guest sign-out — clears this device's check-in; admin session untouched */
$('#guestSignOut')?.addEventListener('click', () => {
  if (!confirm('Sign out of this device? You can sign back in anytime with your phone number.')) return;
  clearGuest();
  location.href = '/';
});

/* ---- Update UI based on guest session ---- */
function updateGuestUI(){
  const guest = getGuest();
  // show guest name in home hero
  if (guest?.name){
    const hero = document.querySelector('.home-eyebrow');
    if (hero) hero.textContent = `WELCOME, ${guest.name.toUpperCase()}`;
  }
}

$('#enterFromHome')?.addEventListener('click', () => {
  // Guests who skipped check-in (chose "can't make it" → explore) get the
  // details form first — we still want their name/phone/email on record.
  if (!getGuest()){
    pendingAttending = false;
    syncGuestRsvpPills();
    showGate(guestLoginScreen);
    return;
  }
  // Smooth scroll to the countdown section
  const bigday = document.querySelector('.bigday');
  if (bigday) bigday.scrollIntoView({ behavior:'smooth', block:'center' });
});

/* ---------------------------------------------------------
   Tab navigation
   --------------------------------------------------------- */
const SUBVIEW_TAB = {
  guestbook:'more', rsvp:'more', voicemsg:'more', videomsg:'more',
  admin:'more', adminlogin:'more', approvals:'more', rsvpAdmin:'more', guestlist:'more',
  guestrsvp:'more', adminmedia:'more', adminvoice:'more', adminvideo:'more', security:'more'
};
const ADMIN_VIEWS = new Set(['admin', 'approvals', 'rsvpAdmin', 'guestlist', 'guestrsvp', 'adminmedia', 'adminvoice', 'adminvideo', 'security']);
/* Views are pushed onto browser history so the device Back button moves
   between screens instead of leaving the page — leaving would reload the
   app and replay the invitation gates. */
let currentView = 'home';
/* brief seal pulse between pages — visual only, never blocks taps */
function flashPageLoader(){
  const pl = document.getElementById('pageLoader');
  if (!pl) return;
  pl.classList.remove('hidden');
  requestAnimationFrame(() => pl.classList.add('show'));
  clearTimeout(flashPageLoader._t);
  flashPageLoader._t = setTimeout(() => {
    pl.classList.remove('show');
    setTimeout(() => pl.classList.add('hidden'), 200);
  }, 420);
}

function switchView(name, fromHistory = false){
  /* guest pages need a check-in; only the admin sign-in page is open to all */
  if (name !== 'adminlogin' && !ADMIN_VIEWS.has(name) && !isAdmin() && !getGuest()?.name && !gateShowing()){
    requireCheckIn();
    return;
  }
  /* signed-in admin never sees the login form — any path to it goes
     straight to the dashboard; only a real logout returns them here */
  if (name === 'adminlogin' && isAdmin()) name = 'admin';
  if (ADMIN_VIEWS.has(name) && !isAdmin()) name = 'adminlogin';
  if (name !== currentView) flashPageLoader();
  /* signed-in admin entering an admin view: probe the session so an
     expired token drops immediately instead of showing empty feeds */
  if (ADMIN_VIEWS.has(name) && isAdmin() && typeof api === 'function')
    api('/admin/guests', { admin: true }).catch(() => {});

  /* Render admin content views when navigated to directly */
  if (name === 'adminmedia' && typeof renderAdminContentView === 'function') renderAdminContentView('adminmedia');
  if (name === 'adminvoice' && typeof renderAdminContentView === 'function') renderAdminContentView('adminvoice');
  if (name === 'adminvideo' && typeof renderAdminContentView === 'function') renderAdminContentView('adminvideo');
  if (name === 'gifts' && typeof updateGiftAdminVisibility === 'function') updateGiftAdminVisibility();
  const tabName = SUBVIEW_TAB[name] || name;
  $$('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));

  /* the music button floats over every screen once a song exists;
     the menu button takes its header slot elsewhere */
  const onHome = name === 'home';
  $('#musicDock')?.classList.toggle('hidden', !music?.src);

  window.scrollTo({ top: 0, behavior: 'instant' });

  if (!fromHistory && name !== currentView){
    try { history.pushState({ view: name }, '', '#' + name); } catch {}
  }
  currentView = name;
}

window.addEventListener('popstate', e => {
  /* Back inside the app: go to the previous view, or fall back to Home so
     Back can never strand the guest on a half-dismissed invitation gate. */
  const target = (e.state && e.state.view) || 'home';
  if (typeof closeLightbox === 'function') closeLightbox();
  document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden'));
  /* enterApp() is idempotent — call it whenever a returning guest lands on a
     history entry that still shows the gate (including bfcache restores,
     where the body is no longer locked but the gate markup is visible) */
  if (hasEntered() && gateShowing()) enterApp();
  switchView(target, true);
});

/* a restored back/forward-cache page does not fire DOMContentLoaded */
window.addEventListener('pageshow', () => {
  if (hasEntered() && gateShowing()){
    enterApp();
    switchView((history.state && history.state.view) || 'home', true);
  }
});

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
let weddingDateMs = Date.parse('2027-01-09T10:00:00');
/* admin can retarget the countdown from Site Settings → Wedding Details */
window.setWeddingDate = iso => {
  const t = Date.parse(iso);
  if (!Number.isNaN(t)) weddingDateMs = t;
};
function updateCountdown(){
  const diff = Math.max(0, weddingDateMs - Date.now());
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
let songPlaylist = [];
let songIndex = 0;

function setSongTrack(i){
  const s = songPlaylist[i];
  if (!s || !music) return;
  songIndex = i;
  currentSongUrl = s.url;
  if (!music.src.endsWith(s.url)){ music.src = s.url; music.load(); }
  const labelEl = document.getElementById('songLabel');
  if (labelEl) labelEl.textContent = s.label || 'Song loaded';
}

async function loadSong(){
  try {
    const settings = await getSettings();
    let list = [];
    try { list = JSON.parse(settings.songs || '[]'); } catch {}
    if (!list.length && settings.songUrl) list = [{ url: settings.songUrl, label: settings.songLabel || 'Wedding song' }];
    if (!list.length || !music) return;
    songPlaylist = list;
    const wasPlaying = musicWanted;
    const cur = music.src ? songPlaylist.findIndex(s => music.src.endsWith(s.url)) : -1;
    setSongTrack(cur >= 0 ? cur : 0);
    const toggle = document.getElementById('musicToggle');
    if (toggle){ toggle.classList.add('has-song'); }
    document.getElementById('musicDock')?.classList.remove('hidden');
    const multi = songPlaylist.length > 1;
    document.getElementById('musicPrev')?.classList.toggle('hidden', !multi);
    document.getElementById('musicNext')?.classList.toggle('hidden', !multi);
    if (wasPlaying && music.paused) tryStartSong();
  } catch(err){ console.warn(err); }
}
music?.addEventListener('ended', () => {
  /* playlist advance — the audio element has no `loop` so 'ended' fires */
  if (songPlaylist.length > 1) setSongTrack((songIndex + 1) % songPlaylist.length);
  else music.currentTime = 0;
  tryStartSong();
});
function stepSong(dir){
  if (songPlaylist.length < 2) return;
  setSongTrack((songIndex + dir + songPlaylist.length) % songPlaylist.length);
  if (musicWanted !== false) tryStartSong();
}
$('#musicPrev')?.addEventListener('click', () => stepSong(-1));
$('#musicNext')?.addEventListener('click', () => stepSong(1));
// getSettings lives in api-data.js, which loads before this file
window.addEventListener('DOMContentLoaded', loadSong);

/* only the couple (admin) can change the song — it plays for all guests */
async function saveSong(file){
  if (!isAdmin()) return;
  try {
    await uploadSiteSong(file, file.name);
    await loadSong();
    /* admin just picked it — start it straight away so they hear it */
    if (music && music.src) music.play().then(() => $('#musicToggle')?.classList.add('is-on')).catch(() => {});
  } catch(err){
    console.warn('Song upload failed:', err);
    alert('Could not upload the song. Are you still signed in as admin?');
  }
}

document.getElementById('songUpload')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file && (file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac|m4b)$/i.test(file.name || ''))) saveSong(file);
  e.target.value = '';
});

/* ---------- autoplay + ducking ----------
   Browsers block audio until the first user gesture, so the song starts on
   the guest's first tap (the seal counts). While any other audio or video
   is playing, the wedding song is muted — not paused — and un-mutes when
   the other media stops, so the moment never loses its soundtrack. */
let musicWanted = true;           // guest hasn't paused it via the button

function tryStartSong(){
  if (!music || !music.src || !music.paused || !musicWanted) return;
  music.play().then(() => $('#musicToggle')?.classList.add('is-on')).catch(() => {});
}
['pointerdown','keydown'].forEach(ev =>
  document.addEventListener(ev, () => tryStartSong(), { passive:true })
);

/* track other media elements that are currently playing; reconcile from the
   set itself so a detached/lightbox-closed element can't wedge the mute on */
const liveMedia = new Set();
function reconcileDucking(){
  for (const el of liveMedia)
    if (el.paused || el.ended || !el.isConnected) liveMedia.delete(el);
  if (music) music.muted = liveMedia.size > 0;
}
document.addEventListener('play', e => {
  if (e.target === music || !(e.target instanceof HTMLMediaElement)) return;
  liveMedia.add(e.target);
  reconcileDucking();
}, true);
['pause','ended','emptied','error'].forEach(ev =>
  document.addEventListener(ev, e => {
    if (e.target !== music && e.target instanceof HTMLMediaElement) liveMedia.delete(e.target);
    reconcileDucking();
  }, true)
);
/* safety net: while muted, sweep for media that stopped without a
   document-visible event (e.g. lightbox emptied its DOM) */
setInterval(() => { if (music?.muted) reconcileDucking(); }, 1200);

$('#musicToggle')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  if (!music || !music.src) {
    alert(isAdmin() ? 'Upload a wedding song from Site Settings first.' : 'No wedding song yet — the couple will add one soon.');
    return;
  }
  if (music.paused) {
    musicWanted = true;
    await music.play().catch(() => {});
    btn.classList.add('is-on');
  } else {
    musicWanted = false;
    music.pause();
    btn.classList.remove('is-on');
  }
});

/* ---------------------------------------------------------
   Map link
   --------------------------------------------------------- */
$('#viewMap')?.addEventListener('click', () => {
  const det = window.weddingDetails || {};
  const url = det.mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(det.weddingVenue || 'Accra, Ghana')}`;
  window.open(url, '_blank', 'noopener');
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
  window.addEventListener('load', async () => {
    const hadController = !!navigator.serviceWorker.controller;
    let reg;
    try { reg = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }); }
    catch(err){ console.error(err); return; }
    /* phones that keep the app open (or installed on the home screen) never
       reload on their own — check for a new release regularly */
    const check = () => reg.update().catch(() => {});
    setInterval(check, 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });

    /* a new version took over: reload into it, but never mid-upload,
       mid-recording, or while someone is watching a video */
    let reloading = false;
    const busy = () => (window.__uploadsInFlight > 0) ||
      [...document.querySelectorAll('video, audio')].some(m => m.id !== 'backgroundMusic' && !m.paused) ||
      document.querySelector('.recording');
    const reloadWhenIdle = () => {
      if (reloading) return;
      if (busy()) return setTimeout(reloadWhenIdle, 5000);
      reloading = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadWhenIdle(); });
  });
}
