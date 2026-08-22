'use strict';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const opening = $('#opening');
const sealButton = $('#sealButton');
const landingFrame = $('#landingFrame');
const attendScreen = $('#attendScreen');
const welcomeScreen = $('#welcomeScreen');
const guestLoginScreen = $('#guestLoginScreen');
const app = $('#app');

/* ---- Guest session helpers ---- */
function getGuest(){ return JSON.parse(sessionStorage.getItem('sj_guest') || 'null'); }
function setGuest(g){ sessionStorage.setItem('sj_guest', JSON.stringify(g)); }
function clearGuest(){ sessionStorage.removeItem('sj_guest'); }
function isAdmin(){ return sessionStorage.getItem('sj_admin_auth') === '1'; }

/* ---- Show a gate screen with transition ---- */
function showGate(screen){
  [welcomeScreen, attendScreen, guestLoginScreen].forEach(s => s?.classList.add('hidden'));
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
  attendScreen?.classList.add('hidden');
  guestLoginScreen?.classList.add('hidden');
  app.classList.remove('hidden');
  document.body.classList.remove('locked');
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateGuestUI();
}

/* ---- Seal break on landing page ---- */
sealButton?.addEventListener('click', () => {
  if (opening.classList.contains('breaking')) return;
  opening.classList.add('breaking');
  sealButton.disabled = true;

  // landing fades out, then the envelope welcome screen appears
  setTimeout(() => opening.classList.add('opening-envelope'), 900);
  setTimeout(() => {
    opening.classList.add('hidden');
    showGate(welcomeScreen);
  }, 1550);
});

/* ---- Welcome screen -> attendance question ---- */
$('#enterWedding')?.addEventListener('click', () => {
  hideGate(welcomeScreen);
  setTimeout(() => showGate(attendScreen), 650);
});

/* ---- Attendance question ---- */
$('#attendYes')?.addEventListener('click', () => {
  hideGate(attendScreen);
  setTimeout(() => showGate(guestLoginScreen), 650);
});

$('#attendNo')?.addEventListener('click', () => {
  $('#attendDecline')?.classList.remove('hidden');
  $('#attendBrowse')?.classList.remove('hidden');
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

$('#enterFromHome')?.addEventListener('click', () => switchView('story'));

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
