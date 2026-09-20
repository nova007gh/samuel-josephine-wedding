'use strict';

/* =========================================================
   Firebase-backed data layer
   Replaces the old IndexedDB functions for shared data
   ========================================================= */

function toMillis(ts){
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return Number(ts) || Date.now();
}

/* Bounded writes: when the backend is unreachable (offline, DB not yet
   provisioned), the Firestore SDK retries forever and the promise never
   settles. Race every write against a timeout so the UI can fail cleanly. */
const WRITE_TIMEOUT_MS = 10000;

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => {
      const err = new Error('The request timed out. Check your connection and try again.');
      err.code = 'deadline-exceeded';
      reject(err);
    }, ms || WRITE_TIMEOUT_MS))
  ]);
}

function tsField(){
  return firebase.firestore.FieldValue.serverTimestamp();
}

function docsOf(snapshot){
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

function newestFirst(field){
  return (a, b) => toMillis(b[field]) - toMillis(a[field]);
}

/* Guests only ever see approved content. Filtering on a single field keeps
   the query on Firestore's automatic index (no composite index needed), so
   ordering happens client-side. */
function onApproved(ref, callback){
  return ref().where('status', '==', 'approved').onSnapshot(snapshot => {
    callback(docsOf(snapshot).sort(newestFirst('createdAt')));
  }, err => console.warn('Live feed unavailable:', err));
}

/* ---------- Memories (shared media) ---------- */
const memoriesRef = () => db.collection('memories');

async function uploadMedia(file, id, folder){
  if (!file) return null;
  const path = `${folder}/${id}/${file.name || 'media'}`;
  const ref = storage.ref().child(path);
  await withTimeout(ref.put(file), 60000);
  return await withTimeout(ref.getDownloadURL());
}

async function addMemory(record){
  const doc = memoriesRef().doc();
  const id = doc.id;
  let file = record.blob;
  if (record.name && !file.name) file = new File([file], record.name, { type: file.type });
  const mediaUrl = await uploadMedia(file, id, 'memories');
  const data = {
    id,
    category: record.category,
    caption: record.caption || '',
    guestName: record.guestName || '',
    kind: record.kind || 'photo',
    status: record.status || 'pending',
    type: record.type || 'image/jpeg',
    name: record.name || '',
    size: record.size || 0,
    mediaUrl,
    createdAt: tsField()
  };
  await withTimeout(doc.set(data));
  return data;
}

function onMemories(callback){
  return onApproved(memoriesRef, callback);
}

function onAllMemories(callback){
  return memoriesRef().orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    callback(docsOf(snapshot));
  }, err => console.warn('Admin memories feed failed:', err));
}

async function deleteMemory(id){
  await withTimeout(memoriesRef().doc(id).delete());
}

async function updateMemory(record){
  const { id, ...data } = record;
  await withTimeout(memoriesRef().doc(id).update(data));
}

/* ---------- Guest Book ---------- */
const guestbookRef = () => db.collection('guestbook');

async function gbAdd(record){
  const doc = guestbookRef().doc();
  const id = doc.id;
  const selfieUrl = await uploadMedia(record.selfie, id, 'guestbook');
  const data = {
    id,
    name: record.name,
    message: record.message,
    status: record.status || 'pending',
    likes: 0,
    replies: [],
    selfieUrl,
    createdAt: tsField()
  };
  await withTimeout(doc.set(data));
  return data;
}

function onGuestbook(callback){
  return onApproved(guestbookRef, callback);
}

function onAllGuestbook(callback){
  return guestbookRef().orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    callback(docsOf(snapshot));
  }, err => console.warn('Admin guestbook feed failed:', err));
}

async function gbUpdate(record){
  const { id, ...data } = record;
  await withTimeout(guestbookRef().doc(id).update(data));
}

/* Guests may only touch likes/replies; the rules reject anything else. */
async function gbLike(id, delta){
  await withTimeout(guestbookRef().doc(id).update({
    likes: firebase.firestore.FieldValue.increment(delta)
  }));
}

async function gbReply(id, reply){
  await withTimeout(guestbookRef().doc(id).update({
    replies: firebase.firestore.FieldValue.arrayUnion(reply)
  }));
}

async function deleteMemoryGB(id){
  await withTimeout(guestbookRef().doc(id).delete());
}

/* ---------- RSVPs ---------- */
const rsvpsRef = () => db.collection('rsvps');

async function addRsvp(data){
  const doc = rsvpsRef().doc();
  await withTimeout(doc.set({
    id: doc.id,
    ...data,
    submittedAt: tsField()
  }));
}

function onRsvps(callback){
  return rsvpsRef().orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
    callback(docsOf(snapshot));
  }, err => console.warn('Admin RSVP feed failed:', err));
}

/* ---------- Guests (check-in system) ---------- */
const guestsRef = () => db.collection('guests');

async function addGuest(guest){
  const doc = guestsRef().doc();
  const data = {
    id: doc.id,
    name: guest.name,
    phone: guest.phone,
    email: guest.email,
    relation: guest.relation,
    attending: guest.attending !== false,
    checkedInAt: tsField()
  };
  await withTimeout(doc.set(data));
  return data.id;
}

function onGuests(callback){
  return guestsRef().orderBy('checkedInAt', 'desc').onSnapshot(snapshot => {
    callback(docsOf(snapshot));
  }, err => console.warn('Admin guest feed failed:', err));
}

async function deleteGuest(id){
  await withTimeout(guestsRef().doc(id).delete());
}

async function updateGuest(id, data){
  await withTimeout(guestsRef().doc(id).update(data));
}

/* ---------- Admin auth ---------- */
function adminSignIn(email, password){
  return auth.signInWithEmailAndPassword(email, password);
}

function adminSignOut(){
  return auth.signOut();
}

function onAdminAuth(callback){
  return auth.onAuthStateChanged(user => callback(!!user));
}
