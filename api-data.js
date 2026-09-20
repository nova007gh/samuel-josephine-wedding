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

function toMillis(ts){
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return Number(ts) || Date.now();
}

function newestFirst(field){
  return (a, b) => toMillis(b[field]) - toMillis(a[field]);
}

/* ---------- admin session ---------- */
let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || null;
const authListeners = [];

function setAdminToken(token){
  adminToken = token || null;
  if (adminToken) sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  authListeners.forEach(cb => { try { cb(!!adminToken); } catch(err){ console.warn(err); } });
}

function onAdminAuth(callback){
  authListeners.push(callback);
  callback(!!adminToken);
}

/* ---------- fetch helper ---------- */
async function api(path, opts = {}){
  const { method = 'GET', body, form = null, admin = false } = opts;
  const headers = {};
  if (admin && adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';

  let res;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), form ? 120000 : 15000);
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
      signal: ctrl.signal
    });
  } catch(e){
    const err = new Error('No connection. Please check your network and try again.');
    err.code = 'auth/network-request-failed';
    throw err;
  } finally {
    clearTimeout(timer);
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
    } catch(err){
      console.warn('Feed unavailable:', err.message || err);
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

function onGuests(callback){
  return pollFeed('/admin/guests', rows => callback(rows.slice().sort(newestFirst('checkedInAt'))), true);
}

async function deleteGuest(id){
  await api(`/admin/guests/${encodeURIComponent(id)}`, { method: 'DELETE', admin: true });
}

async function updateGuest(id, data){
  await api(`/admin/guests/${encodeURIComponent(id)}`, { method: 'PATCH', body: data, admin: true });
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
