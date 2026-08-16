'use strict';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* ---------------------------------------------------------
   Screen 1 — seal break, shards and dust
   --------------------------------------------------------- */
function buildBurst(){
  const host = $('#sealBurst');
  if (!host) return;

  const shards = 18;
  for (let i = 0; i < shards; i++){
    const angle = (Math.PI * 2 * i) / shards + (Math.random() - .5) * .35;
    const dist = 90 + Math.random() * 130;
    const el = document.createElement('span');
    el.className = 'shard';
    el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * dist - 30}px`);
    el.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    el.style.setProperty('--sz', `${8 + Math.random() * 16}px`);
    el.style.setProperty('--dur', `${.75 + Math.random() * .5}s`);
    el.style.setProperty('--delay', `${(Math.random() * .12).toFixed(2)}s`);
    host.appendChild(el);
  }

  const motes = 26;
  for (let i = 0; i < motes; i++){
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 170;
    const el = document.createElement('span');
    el.className = 'dust';
    el.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--ty', `${Math.sin(angle) * dist - 40}px`);
    el.style.setProperty('--sz', `${3 + Math.random() * 5}px`);
    el.style.setProperty('--dur', `${.8 + Math.random() * .6}s`);
    el.style.setProperty('--delay', `${(Math.random() * .2).toFixed(2)}s`);
    host.appendChild(el);
  }
}
buildBurst();

const opening = $('#opening');
const sealButton = $('#sealButton');
const landingFrame = $('#landingFrame');
const welcomeReveal = $('#welcomeReveal');

sealButton?.addEventListener('click', () => {
  if (opening.classList.contains('breaking')) return;
  opening.classList.add('breaking');
  sealButton.disabled = true;

  setTimeout(() => opening.classList.add('opening-envelope'), 900);
  setTimeout(() => {
    landingFrame.classList.add('hidden');
    welcomeReveal.classList.remove('hidden');
  }, 1550);
});

/* ---------------------------------------------------------
   Screen 2 -> app
   --------------------------------------------------------- */
$('#enterWedding')?.addEventListener('click', () => {
  opening.classList.add('exit');
  setTimeout(() => {
    opening.classList.add('hidden');
    $('#app').classList.remove('hidden');
    document.body.classList.remove('locked');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, 620);
});

$('#enterFromHome')?.addEventListener('click', () => switchView('story'));

/* ---------------------------------------------------------
   Tab navigation
   --------------------------------------------------------- */
const SUBVIEW_TAB = { guestbook:'more', memories:'more', rsvp:'more' };
function switchView(name){
  const tabName = SUBVIEW_TAB[name] || name;
  $$('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
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
$('#musicToggle')?.addEventListener('click', async e => {
  const btn = e.currentTarget;
  if (!music || !music.getAttribute('src')) {
    btn.classList.toggle('is-on');
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
