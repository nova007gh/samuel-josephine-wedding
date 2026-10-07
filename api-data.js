'use strict';

/* =========================================================
   API-backed data layer
   Talks to the self-hosted Node/SQLite API on this same origin
   (/api/...). Replaces the old Firebase layer — same function
   names so the rest of the app is unchanged.
   ========================================================= */

const API_BASE = '/api';
const ADMIN_TOKEN_KEY = 'sj_admin_token';
const POLL_MS = 15000;

/* ---------- device identity for the security log ----------
   A random per-browser id + the connection's effective type ride along
   on every API call so the server can attribute events to a device. */
const DEVICE_ID = (() => {
  let id = localStorage.getItem('sj_device_id');
  if (!id){
    id = (crypto.randomUUID ? crypto.randomUUID() : 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36));
    try { localStorage.setItem('sj_device_id', id); } catch {}
  }
  return id;
})();
function deviceNetType(){
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c ? (c.effectiveType || c.type || '') : '';
}

function toMillis(ts){
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return Number(ts) || Date.now();
}

function newestFirst(field){
  return (a, b) => toMillis(b[field]) - toMillis(a[field]);
}

/* ---------- admin session ---------- */
let adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || null;
const authListeners = [];

function setAdminToken(token){
  adminToken = token || null;
  if (adminToken) localStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
  authListeners.forEach(cb => { try { cb(!!adminToken); } catch(err){ console.warn(err); } });
}

function onAdminAuth(callback){
  authListeners.push(callback);
  callback(!!adminToken);
}

/* ---------- fetch helper ---------- */
async function api(path, opts = {}){
  const { method = 'GET', body, form = null, admin = false } = opts;
  const headers = { 'X-Device-Id': DEVICE_ID, 'X-Network-Type': deviceNetType() };
  if (admin && adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';

  let res;
  const ctrl = new AbortController();
  /* large phone videos on mobile data need far more than 2 minutes */
  const timer = setTimeout(() => ctrl.abort(), form ? 15 * 60000 : 15000);
  /* counted so an app-update reload never interrupts an upload */
  if (form) window.__uploadsInFlight = (window.__uploadsInFlight || 0) + 1;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: ctrl.signal,
      cache: 'no-store'
    });
  } catch(e){
    const err = new Error('No connection. Please check your network and try again.');
    err.code = 'auth/network-request-failed';
    throw err;
  } finally {
    clearTimeout(timer);
    if (form) window.__uploadsInFlight--;
  }

  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok){
    const err = new Error((data && data.error) || `Request failed (${res.status}).`);
    err.code = (data && data.code)
      || (res.status === 401 || res.status === 403 ? 'auth/invalid-credential'
        : res.status === 429 ? 'auth/too-many-requests' : 'unknown');
    // expired/invalid admin session: drop it so the UI falls back to login
    if (admin && res.status === 401 && adminToken) setAdminToken(null);
    throw err;
  }
  return data;
}

/* Feeds poll the API so new approved content appears without realtime sockets.
   Returns an unsubscribe function, same contract as the old listeners. */
function pollFeed(path, callback, admin){
  let stopped = false;
  async function tick(){
    if (stopped) return;
    try {
      const rows = await api(path, { admin });
      callback(Array.isArray(rows) ? rows : []);
      if (admin && typeof reportAdminFeed === 'function') reportAdminFeed(path, null);
    } catch(err){
      console.warn('Feed unavailable:', err.message || err);
      if (admin && typeof reportAdminFeed === 'function') reportAdminFeed(path, err);
    }
  }
  tick();
  const timer = setInterval(tick, POLL_MS);
  return () => { stopped = true; clearInterval(timer); };
}

/* ---------- Memories (shared media) ---------- */
async function addMemory(record){
  const fd = new FormData();
  if (record.blob){
    const name = record.name || 'media';
    fd.append('file', record.blob, name);
  }
  fd.append('category', record.category || '');
  fd.append('caption', record.caption || '');
  fd.append('guestName', record.guestName || '');
  fd.append('kind', record.kind || 'photo');
  fd.append('type', record.type || '');
  fd.append('name', record.name || '');
  if (record.size) fd.append('size', String(record.size));
  return await api('/memories', { method: 'POST', form: fd });
}

function onMemories(callback){
  return pollFeed('/memories', rows => callback(rows.slice().sort(newestFirst('createdAt'))));
}

function onAllMemories(callback){
  return pollFeed('/admin/memories', rows => callback(rows.slice().sort(newestFirst('createdAt'))), true);
}

/* the couple's own album — admin-published, lands approved instantly */
async function addCoupleMemory(file, caption){
  const fd = new FormData();
  fd.append('file', file, file.name || 'memory');
  fd.append('caption', caption || '');
  fd.append('name', file.name || '');
  return await api('/admin/gallery', { method: 'POST', form: fd, admin: true });
}

async function deleteMemory(id){
  await api(`/admin/memories/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

async function updateMemory(record){
  const { id, ...data } = record;
  await api(`/admin/memories/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
}

/* ---------- Guest Book ---------- */
async function gbAdd(record){
  const fd = new FormData();
  fd.append('name', record.name || '');
  fd.append('message', record.message || '');
  if (record.selfie) fd.append('selfie', record.selfie, record.selfie.name || 'selfie');
  return await api('/guestbook', { method: 'POST', form: fd });
}

function onGuestbook(callback){
  return pollFeed('/guestbook', rows => callback(rows.slice().sort(newestFirst('createdAt'))));
}

function onAllGuestbook(callback){
  return pollFeed('/admin/guestbook', rows => callback(rows.slice().sort(newestFirst('createdAt'))), true);
}

async function gbUpdate(record){
  const { id, ...data } = record;
  await api(`/admin/guestbook/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
}

async function gbLike(id, delta){
  await api(`/guestbook/${encodeURIComponent(id)}/like`, { method: 'POST', body: { delta } });
}

async function gbReply(id, reply){
  await api(`/guestbook/${encodeURIComponent(id)}/reply`, { method: 'POST', body: reply });
}

async function deleteMemoryGB(id){
  await api(`/admin/guestbook/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

/* ---------- RSVPs ---------- */
async function addRsvp(data){
  await api('/rsvps', { method: 'POST', body: data });
}

function onRsvps(callback){
  return pollFeed('/admin/rsvps', rows => callback(rows.slice().sort(newestFirst('submittedAt'))), true);
}

/* ---------- Guests (check-in system) ---------- */
async function addGuest(guest){
  const res = await api('/guests', { method: 'POST', body: guest });
  return res.id;
}

/* ---------- phone OTP — registration & returning-guest sign-in ----------
   channel 'sms' (default) or 'email'; email is the bridge while SMS
   sender approval is pending with the providers */
async function sendOtp(phone, purpose, name, opts){
  return await api('/otp/send', { method: 'POST', body: { phone, purpose, name, ...(opts || {}) } });
}
async function verifyOtp(phone, code){
  return await api('/otp/verify', { method: 'POST', body: { phone, code } });
}
async function guestLogin(phone, code){
  return await api('/guests/login', { method: 'POST', body: { phone, code } });
}
/* does this number already have a check-in? first name only, for the greeting */
async function lookupGuest(phone){
  return await api('/guests/lookup', { method: 'POST', body: { phone } });
}

/* public approved guest list (name + attending only) */
function onPublicGuests(callback){
  return pollFeed('/guests', rows => callback(rows.slice().sort(newestFirst('checkedInAt'))));
}

function onGuests(callback){
  return pollFeed('/admin/guests', rows => callback(rows.slice().sort(newestFirst('checkedInAt'))), true);
}

async function deleteGuest(id){
  await api(`/admin/guests/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

async function updateGuest(id, data){
  await api(`/admin/guests/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
}

/* the couple often keeps the authoritative list on paper, so they can add a
   guest themselves instead of only reacting to self check-ins */
async function addAdminGuest(data){
  const res = await api('/admin/guests', { method: 'POST', body: data, admin: true });
  return res.id;
}

async function addAdminRsvp(data){
  const res = await api('/admin/rsvps', { method: 'POST', body: data, admin: true });
  return res.id;
}

async function updateRsvp(id, data){
  await api(`/admin/rsvps/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
}

async function deleteRsvp(id){
  await api(`/admin/rsvps/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

/* gift funds - admin can manage the three fund cards */
async function getGiftFunds(){
  const rows = await api('/gift-funds');
  return rows;
}

async function getAdminGiftFunds(){
  return await api('/admin/gift-funds', { admin: true });
}

async function addGiftFund(data){
  return await api('/admin/gift-funds', { method: 'POST', body: data, admin: true });
}

async function updateGiftFund(id, data){
  return await api(`/admin/gift-funds/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
}

async function deleteGiftFund(id){
  return await api(`/admin/gift-funds/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

/* MoMo settings - admin only */
async function getMomoSettings(){
  return await api('/admin/momo-settings', { admin: true });
}

async function updateMomoSettings(data){
  return await api('/admin/momo-settings', { method: 'PATCH', body: data, admin: true });
}

/* ---------- Site settings (couple photo, wedding song) ---------- */
async function getSettings(){
  return await api('/settings');
}

async function uploadSitePhoto(file, slot = 'couple'){
  const fd = new FormData();
  fd.append('file', file, file.name || 'photo');
  return await api(`/admin/settings/photo/${encodeURIComponent(slot)}`, { method: 'POST', form: fd, admin: true });
}

async function uploadSiteSong(file, label){
  const fd = new FormData();
  fd.append('file', file, file.name || 'song');
  if (label) fd.append('label', label);
  return await api('/admin/settings/song', { method: 'POST', form: fd, admin: true });
}
async function deleteSiteSong(index){
  return await api(`/admin/settings/song/${index}`, { method: 'DELETE', admin: true });
}
async function songPlayFirst(index){
  return await api(`/admin/settings/song/${index}/first`, { method: 'POST', admin: true });
}
async function songMove(index, to){
  return await api(`/admin/settings/song/${index}/move`, { method: 'POST', body: { to }, admin: true });
}
async function likeStoryItem(itemId, delta){
  return await api('/story-likes', { method: 'POST', body: { itemId, delta } });
}
async function likeHome(delta){
  return await api('/home-like', { method: 'POST', body: { delta } });
}
/* is this checked-in email allowed through to the admin sign-in? */
async function checkAdminEmail(email){
  return await api('/admin-email-check', { method: 'POST', body: { email } });
}
async function getAdminEmails(){
  return await api('/admin/emails', { admin: true });
}
async function addAdminEmail(email){
  return await api('/admin/emails', { method: 'POST', body: { email }, admin: true });
}
async function removeAdminEmail(email){
  return await api(`/admin/emails/${encodeURIComponent(email)}`, { method: 'DELETE', admin: true });
}
async function getSecurityEvents(){
  return await api('/admin/security', { admin: true });
}
async function clearSecurityEvents(){
  return await api('/admin/security', { method: 'DELETE', admin: true });
}
async function sendAnnouncement(text, everyMin, photoA, photoB){
  return await api('/admin/announce', { method: 'POST', body: { text, everyMin, photoA, photoB }, admin: true });
}
async function stopAnnouncement(){
  return await api('/admin/announce', { method: 'DELETE', admin: true });
}

async function patchSettings(fields){
  return await api('/admin/settings', { method: 'PATCH', body: fields, admin: true });
}

/* ---------- guest's own uploads (edit while still pending) ---------- */
const MY_UPLOADS_KEY = 'sj_my_uploads';
function myUploadIds(){
  try { return JSON.parse(localStorage.getItem(MY_UPLOADS_KEY) || '[]'); } catch { return []; }
}
function rememberUpload(kind, id){
  if (!id) return;
  const list = myUploadIds();
  list.push({ kind, id });
  localStorage.setItem(MY_UPLOADS_KEY, JSON.stringify(list.slice(-60)));
}
async function fetchMyUploads(){
  const list = myUploadIds();
  const memIds = list.filter(u => u.kind === 'memory').map(u => u.id);
  const gbIds = list.filter(u => u.kind === 'guestbook').map(u => u.id);
  const [mems, gbs] = await Promise.all([
    memIds.length ? api('/memories/mine', { method:'POST', body:{ ids: memIds } }) : [],
    gbIds.length ? api('/guestbook/mine', { method:'POST', body:{ ids: gbIds } }) : []
  ]);
  return [
    ...mems.map(m => ({ ...m, _kind: 'memory' })),
    ...gbs.map(g => ({ ...g, _kind: 'guestbook' }))
  ].sort(newestFirst('createdAt'));
}
async function editMyMemory(id, data){
  return await api(`/memories/${encodeURIComponent(id)}`, { method:'PATCH', body: data });
}
/* guests can remove their own submissions while still pending */
function forgetUpload(id){
  localStorage.setItem(MY_UPLOADS_KEY, JSON.stringify(myUploadIds().filter(u => u.id !== id)));
}
async function deleteMyMemory(id){
  await api(`/memories/${encodeURIComponent(id)}`, { method: 'DELETE' });
  forgetUpload(id);
}
async function deleteMyGuestbook(id){
  await api(`/guestbook/${encodeURIComponent(id)}`, { method: 'DELETE' });
  forgetUpload(id);
}

async function editMyGuestbook(id, data){
  return await api(`/guestbook/${encodeURIComponent(id)}`, { method:'PATCH', body: data });
}

/* ---------- web push ---------- */
function urlB64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribePush(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const { key } = await api('/push/vapid');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(key)
  });
  await api('/push/subscribe', { method:'POST', body: sub.toJSON() });
  return true;
}

async function enableNotifications(){
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted' && await Notification.requestPermission() !== 'granted')
    return 'denied';
  try { return (await subscribePush()) ? 'on' : 'unsupported'; }
  catch(err){ console.warn('Push subscribe failed:', err); return 'error'; }
}

async function notificationsEnabled(){
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

/* ---------- Admin auth ---------- */
async function adminSignIn(email, password){
  const res = await api('/admin/login', { method: 'POST', body: { email, password } });
  setAdminToken(res.token);
}

async function adminSignOut(){
  try { await api('/admin/logout', { method: 'POST', admin: true }); }
  catch {}
  setAdminToken(null);
}
