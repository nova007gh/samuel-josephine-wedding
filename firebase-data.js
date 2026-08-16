'use strict';

/* =========================================================
   Firebase-backed data layer
   Replaces the old IndexedDB functions for shared data
   ========================================================= */

function toMillis(ts){
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  return Number(ts) || Date.now();
}

function tsField(){
  return firebase.firestore.FieldValue.serverTimestamp();
}

/* ---------- Memories (shared media) ---------- */
const memoriesRef = () => db.collection('memories');

async function uploadMedia(file, id, folder){
  if (!file) return null;
  const path = `${folder}/${id}/${file.name || 'media'}`;
  const ref = storage.ref().child(path);
  await ref.put(file);
  return await ref.getDownloadURL();
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
  await doc.set(data);
  return data;
}

function getMemories(){
  return new Promise((resolve, reject) => {
    const unsubscribe = memoriesRef()
      .orderBy('createdAt', 'desc')
      .onSnapshot({ includeMetadataChanges: false }, snapshot => {
        resolve(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, reject);
    // cleanup after first result to avoid leaks? We want real-time, but here we promise once
    setTimeout(unsubscribe, 0);
  });
}

function onMemories(callback){
  return memoriesRef().orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

async function deleteMemory(id){
  await memoriesRef().doc(id).delete();
}

async function updateMemory(record){
  const { id, ...data } = record;
  await memoriesRef().doc(id).update(data);
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
    likes: record.likes || 0,
    liked: record.liked || false,
    replies: record.replies || [],
    selfieUrl,
    createdAt: tsField()
  };
  await doc.set(data);
  return data;
}

function gbAll(){
  return new Promise((resolve, reject) => {
    const unsubscribe = guestbookRef()
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        resolve(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, reject);
    setTimeout(unsubscribe, 0);
  });
}

function onGuestbook(callback){
  return guestbookRef().orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

async function gbUpdate(record){
  const { id, ...data } = record;
  await guestbookRef().doc(id).update(data);
}

async function deleteMemoryGB(id){
  await guestbookRef().doc(id).delete();
}

/* ---------- RSVPs ---------- */
const rsvpsRef = () => db.collection('rsvps');

async function addRsvp(data){
  const doc = rsvpsRef().doc();
  await doc.set({
    id: doc.id,
    ...data,
    submittedAt: tsField()
  });
}

function onRsvps(callback){
  return rsvpsRef().orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/* ---------- subscriptions registry ---------- */
const unsubscribers = new Set();

function registerUnsub(unsub){
  unsubscribers.add(unsub);
  return unsub;
}

function cleanupSubs(){
  unsubscribers.forEach(fn => fn());
  unsubscribers.clear();
}
