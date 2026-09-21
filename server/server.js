'use strict';

/* =========================================================
   Wedding app API — self-hosted on the VPS
   Express + SQLite + disk uploads. Sits behind nginx at /api/.
   ========================================================= */

const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || '/var/lib/wedding';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const MAX_UPLOAD = 64 * 1024 * 1024; // 64MB
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

if (!ADMIN_PASSWORD){
  console.error('ADMIN_PASSWORD env var is required. Refusing to start.');
  process.exit(1);
}

/* ---------- database ---------- */
const db = new Database(path.join(DATA_DIR, 'wedding.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  name TEXT, phone TEXT, email TEXT, relation TEXT,
  attending INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  checkedInAt INTEGER
);
CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  name TEXT, email TEXT, phone TEXT, attending TEXT,
  plusOne INTEGER, guestCount INTEGER, song TEXT, message TEXT,
  submittedAt INTEGER
);
CREATE TABLE IF NOT EXISTS guestbook (
  id TEXT PRIMARY KEY,
  name TEXT, message TEXT, status TEXT DEFAULT 'pending',
  likes INTEGER DEFAULT 0, replies TEXT DEFAULT '[]',
  selfieUrl TEXT, createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  category TEXT, caption TEXT, guestName TEXT, kind TEXT,
  status TEXT DEFAULT 'pending', type TEXT, name TEXT, size INTEGER,
  mediaUrl TEXT, createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT, auth TEXT, createdAt INTEGER
);
`);

/* column added after launch — migrate existing databases safely */
try { db.exec(`ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'pending'`); } catch {}

/* ---------- helpers ---------- */
const uid = () => crypto.randomUUID();
const now = () => Date.now();

/* coerce to trimmed string with a max length; '' when missing */
function str(v, max){
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
}

function gbRow(r){
  if (!r) return r;
  let replies = [];
  try { replies = JSON.parse(r.replies || '[]'); } catch {}
  return { ...r, replies };
}

/* ---------- uploads ---------- */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/heic': '.heic', 'image/heif': '.heif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/3gpp': '.3gp',
  'audio/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg',
  'audio/wav': '.wav', 'audio/aac': '.aac', 'audio/x-m4a': '.m4a'
};
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname || '').toLowerCase().replace(/[^.\w]/g, '') || '.bin';
    cb(null, `${uid()}${ext.slice(0, 10)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image|video|audio)\//.test(file.mimetype || '');
    cb(ok ? null : new Error('Only image, video and audio files are allowed.'), ok);
  }
});

/* ---------- rate limiting (small in-memory buckets) ---------- */
const buckets = new Map();
function rateLimit(max, windowMs){
  return (req, res, next) => {
    const key = `${req.ip}:${req.path.split('/').slice(0, 3).join('/')}`;
    const nowMs = Date.now();
    let b = buckets.get(key);
    if (!b || nowMs - b.start > windowMs){ b = { start: nowMs, count: 0 }; buckets.set(key, b); }
    if (++b.count > max) return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.', code: 'auth/too-many-requests' });
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, b] of buckets) if (b.start < cutoff) buckets.delete(k);
}, 10 * 60 * 1000).unref();

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', true);

const publicWrite = rateLimit(60, 60 * 1000);
const loginLimit = rateLimit(10, 60 * 1000);

/* ---------- admin auth ---------- */
function requireAdmin(req, res, next){
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || '');
  const token = m && m[1];
  if (!token) return res.status(401).json({ error: 'Not signed in.', code: 'auth/invalid-credential' });
  const row = db.prepare('SELECT createdAt FROM sessions WHERE token = ?').get(token);
  if (!row || now() - row.createdAt > SESSION_TTL_MS){
    if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'auth/invalid-credential' });
  }
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/admin/login', loginLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (ADMIN_EMAIL && str(email, 200).toLowerCase() !== ADMIN_EMAIL.toLowerCase()){
    return res.status(401).json({ error: 'Incorrect email or password.', code: 'auth/invalid-credential' });
  }
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)){
    return res.status(401).json({ error: 'Incorrect email or password. Please try again.', code: 'auth/invalid-credential' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, createdAt) VALUES (?, ?)').run(token, now());
  res.json({ token });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = /^Bearer\s+(.+)$/.exec(req.headers.authorization || '')[1];
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

/* ---------- guests (check-in) ---------- */
app.post('/api/guests', publicWrite, (req, res) => {
  const g = req.body || {};
  const name = str(g.name, 120);
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const id = uid();
  db.prepare(`INSERT INTO guests (id, name, phone, email, relation, attending, checkedInAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, str(g.phone, 60), str(g.email, 200), str(g.relation, 120),
         g.attending === false ? 0 : 1, now());
  res.json({ id });
  notifyAll('New guest checked in', `${name} just ${g.attending === false ? 'joined to explore' : 'checked in to attend'} — pending your approval`);
});

/* ---------- RSVPs ---------- */
app.post('/api/rsvps', publicWrite, (req, res) => {
  const r = req.body || {};
  const name = str(r.name, 120);
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  const id = uid();
  db.prepare(`INSERT INTO rsvps (id, name, email, phone, attending, plusOne, guestCount, song, message, submittedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, str(r.email, 200), str(r.phone, 60), str(r.attending, 60),
         Math.min(Math.max(parseInt(r.plusOne, 10) || 0, 0), 20),
         Math.min(Math.max(parseInt(r.guestCount, 10) || 1, 1), 20),
         str(r.song, 200), str(r.message, 2000), now());
  res.json({ ok: true, id });
});

/* ---------- guestbook ---------- */
app.get('/api/guestbook', (req, res) => {
  const rows = db.prepare(`SELECT * FROM guestbook WHERE status = 'approved' ORDER BY createdAt DESC`).all();
  res.json(rows.map(gbRow));
});

app.post('/api/guestbook', publicWrite, upload.single('selfie'), (req, res) => {
  const name = str(req.body.name, 120);
  const message = str(req.body.message, 2000);
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required.' });
  const id = uid();
  const selfieUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare(`INSERT INTO guestbook (id, name, message, status, likes, replies, selfieUrl, createdAt)
              VALUES (?, ?, ?, 'pending', 0, '[]', ?, ?)`)
    .run(id, name, message, selfieUrl, now());
  res.json({ id, name, message, status: 'pending', likes: 0, replies: [], selfieUrl, createdAt: now() });
  notifyAll('New guest book message', `${name} left a message — pending your approval`);
});

/* guests may like / reply on approved entries only */
app.post('/api/guestbook/:id/like', publicWrite, (req, res) => {
  const delta = parseInt(req.body && req.body.delta, 10) === -1 ? -1 : 1;
  const row = db.prepare(`SELECT status FROM guestbook WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'approved') return res.status(403).json({ error: 'This message is not public yet.' });
  db.prepare(`UPDATE guestbook SET likes = MAX(0, likes + ?) WHERE id = ?`).run(delta, req.params.id);
  res.json({ ok: true });
});

app.post('/api/guestbook/:id/reply', publicWrite, (req, res) => {
  const name = str(req.body && req.body.name, 120);
  const text = str(req.body && req.body.text, 2000);
  if (!name || !text) return res.status(400).json({ error: 'Name and reply text are required.' });
  const row = db.prepare(`SELECT status, replies FROM guestbook WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'approved') return res.status(403).json({ error: 'This message is not public yet.' });
  let replies = [];
  try { replies = JSON.parse(row.replies || '[]'); } catch {}
  if (replies.length >= 200) return res.status(400).json({ error: 'Reply limit reached.' });
  replies.push({ name, text, at: now() });
  db.prepare(`UPDATE guestbook SET replies = ? WHERE id = ?`).run(JSON.stringify(replies), req.params.id);
  res.json({ ok: true });
});

/* ---------- memories ---------- */
app.get('/api/memories', (req, res) => {
  const rows = db.prepare(`SELECT * FROM memories WHERE status = 'approved' ORDER BY createdAt DESC`).all();
  res.json(rows);
});

app.post('/api/memories', publicWrite, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A media file is required.' });
  const id = uid();
  const record = {
    id,
    category: str(req.body.category, 60),
    caption: str(req.body.caption, 500),
    guestName: str(req.body.guestName, 120),
    kind: str(req.body.kind, 30) || 'photo',
    status: 'pending',
    type: req.file.mimetype || 'application/octet-stream',
    name: str(req.body.name, 200) || req.file.filename,
    size: req.file.size,
    mediaUrl: `/uploads/${req.file.filename}`,
    createdAt: now()
  };
  db.prepare(`INSERT INTO memories (id, category, caption, guestName, kind, status, type, name, size, mediaUrl, createdAt)
              VALUES (@id, @category, @caption, @guestName, @kind, @status, @type, @name, @size, @mediaUrl, @createdAt)`)
    .run(record);
  res.json(record);
  const what = { photo:'a photo', video:'a video', selfie:'a selfie', voice:'a voice message', videomsg:'a video message', music:'a song' }[record.kind] || 'a memory';
  notifyAll('New upload pending review', `${record.guestName || 'A guest'} shared ${what} — pending your approval`);
});

/* ---------- admin: full feeds ---------- */
app.get('/api/admin/guestbook', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM guestbook ORDER BY createdAt DESC`).all().map(gbRow));
});
app.get('/api/admin/memories', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM memories ORDER BY createdAt DESC`).all());
});
app.get('/api/admin/guests', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM guests ORDER BY checkedInAt DESC`).all());
});
app.get('/api/admin/rsvps', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT * FROM rsvps ORDER BY submittedAt DESC`).all());
});

/* ---------- admin: moderate guestbook ---------- */
app.patch('/api/admin/guestbook/:id', requireAdmin, (req, res) => {
  const row = db.prepare(`SELECT * FROM guestbook WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const status = ['pending', 'approved'].includes(req.body.status) ? req.body.status : row.status;
  const name = req.body.name !== undefined ? str(req.body.name, 120) : row.name;
  const message = req.body.message !== undefined ? str(req.body.message, 2000) : row.message;
  db.prepare(`UPDATE guestbook SET status = ?, name = ?, message = ? WHERE id = ?`)
    .run(status, name, message, req.params.id);
  res.json({ ok: true });
  if (status === 'approved' && row.status !== 'approved')
    notifyAll('Guest Book', `${name} shared a message — tap to read it`);
});

app.delete('/api/admin/guestbook/:id', requireAdmin, (req, res) => {
  const row = db.prepare(`SELECT selfieUrl FROM guestbook WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM guestbook WHERE id = ?`).run(req.params.id);
  if (row && row.selfieUrl) unlinkUpload(row.selfieUrl);
  res.json({ ok: true });
});

/* ---------- admin: moderate memories ---------- */
app.patch('/api/admin/memories/:id', requireAdmin, (req, res) => {
  const row = db.prepare(`SELECT * FROM memories WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const next = {
    status: ['pending', 'approved'].includes(req.body.status) ? req.body.status : row.status,
    caption: req.body.caption !== undefined ? str(req.body.caption, 500) : row.caption,
    category: req.body.category !== undefined ? str(req.body.category, 60) : row.category,
    guestName: req.body.guestName !== undefined ? str(req.body.guestName, 120) : row.guestName
  };
  db.prepare(`UPDATE memories SET status = @status, caption = @caption, category = @category, guestName = @guestName WHERE id = @id`)
    .run({ ...next, id: req.params.id });
  res.json({ ok: true });
  if (next.status === 'approved' && row.status !== 'approved'){
    const what = { photo:'a photo', video:'a video', selfie:'a selfie', voice:'a voice message', videomsg:'a video message' }[row.kind] || 'a memory';
    notifyAll('New memory published', `${next.guestName || 'A guest'} shared ${what} — tap to see it`);
  }
});

function unlinkUpload(mediaUrl){
  const file = path.basename(mediaUrl || '');
  if (!file) return;
  fs.unlink(path.join(UPLOADS_DIR, file), () => {});
}

app.delete('/api/admin/memories/:id', requireAdmin, (req, res) => {
  const row = db.prepare(`SELECT mediaUrl FROM memories WHERE id = ?`).get(req.params.id);
  db.prepare(`DELETE FROM memories WHERE id = ?`).run(req.params.id);
  if (row) unlinkUpload(row.mediaUrl);
  res.json({ ok: true });
});

/* ---------- site settings (couple photo, wedding song) ---------- */
app.get('/api/settings', (req, res) => {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) out[row.key] = row.value;
  res.json(out);
});

/* admin swaps a site asset; the previous file is removed to save disk */
function setSettingFile(res, file, key, extra){
  const prev = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const url = `/uploads/${file.filename}`;
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  stmt.run(key, url);
  for (const [k, v] of Object.entries(extra || {})) stmt.run(k, v);
  if (prev && prev.value && prev.value !== url) unlinkUpload(prev.value);
  res.json({ url, ...(extra || {}) });
}

const PHOTO_SLOTS = new Set([
  'couple', 'landing', 'welcome', 'attend',
  'sam-childhood', 'jossy-childhood', 'sam-adult', 'jossy-adult',
  'facetime', 'proposal', 'now'
]);

app.post('/api/admin/settings/photo/:slot?', requireAdmin, upload.single('file'), (req, res) => {
  const slot = req.params.slot || 'couple';
  if (!PHOTO_SLOTS.has(slot)) return res.status(400).json({ error: 'Unknown photo slot.' });
  if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
  if (!/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Photo must be an image.' });
  const key = slot === 'couple' ? 'couplePhotoUrl' : `photo:${slot}`;
  setSettingFile(res, req.file, key);
});

app.post('/api/admin/settings/song', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An audio file is required.' });
  if (!/^audio\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Song must be an audio file.' });
  setSettingFile(res, req.file, 'songUrl', { songLabel: str(req.body.label, 200) || req.file.originalname || '' });
});

/* ---------- admin: text settings (wedding details, reusable template) ---------- */
const TEXT_SETTING_KEYS = new Set([
  'weddingNameA', 'weddingNameB', 'weddingFormal',
  'weddingDateISO', 'weddingDateLabel', 'weddingVenue', 'weddingHashtag',
  'weddingTagline', 'rsvpDeadline', 'storyText', 'events', 'mapUrl'
]);

app.patch('/api/admin/settings', requireAdmin, (req, res) => {
  const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
                           ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  let saved = 0;
  for (const [k, v] of Object.entries(req.body || {})){
    if (!TEXT_SETTING_KEYS.has(k)) continue;
    stmt.run(k, str(v, 8000));
    saved++;
  }
  res.json({ ok: true, saved });
});

/* ---------- guests: view & edit their own pending uploads ---------- */
function lookupIds(body){
  return Array.isArray(body && body.ids)
    ? body.ids.slice(0, 50).map(i => str(i, 64)).filter(Boolean)
    : [];
}

app.post('/api/memories/mine', publicWrite, (req, res) => {
  const ids = lookupIds(req.body);
  if (!ids.length) return res.json([]);
  res.json(db.prepare(`SELECT * FROM memories WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids));
});

app.patch('/api/memories/:id', publicWrite, (req, res) => {
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'pending') return res.status(403).json({ error: 'Already published — only admin can edit it.' });
  db.prepare('UPDATE memories SET caption = ?, guestName = ?, category = ? WHERE id = ?').run(
    req.body.caption !== undefined ? str(req.body.caption, 500) : row.caption,
    req.body.guestName !== undefined ? str(req.body.guestName, 120) : row.guestName,
    req.body.category !== undefined ? str(req.body.category, 60) : row.category,
    req.params.id
  );
  res.json({ ok: true });
});

app.post('/api/guestbook/mine', publicWrite, (req, res) => {
  const ids = lookupIds(req.body);
  if (!ids.length) return res.json([]);
  res.json(db.prepare(`SELECT * FROM guestbook WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(gbRow));
});

app.patch('/api/guestbook/:id', publicWrite, (req, res) => {
  const row = db.prepare('SELECT * FROM guestbook WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'pending') return res.status(403).json({ error: 'Already published — only admin can edit it.' });
  db.prepare('UPDATE guestbook SET name = ?, message = ? WHERE id = ?').run(
    req.body.name !== undefined ? str(req.body.name, 120) : row.name,
    req.body.message !== undefined ? str(req.body.message, 2000) : row.message,
    req.params.id
  );
  res.json({ ok: true });
});

/* ---------- web push ---------- */
let webpush = null;
try { webpush = require('web-push'); } catch { console.warn('web-push not installed — notifications disabled'); }

const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
let vapid = null;
if (webpush){
  try {
    vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  } catch {
    vapid = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapid));
  }
  webpush.setVapidDetails(`mailto:${ADMIN_EMAIL || 'admin@localhost'}`, vapid.publicKey, vapid.privateKey);
}

app.get('/api/push/vapid', (req, res) => {
  if (!vapid) return res.status(503).json({ error: 'Push notifications are not configured.' });
  res.json({ key: vapid.publicKey });
});

app.post('/api/push/subscribe', publicWrite, (req, res) => {
  const s = req.body || {};
  const endpoint = str(s.endpoint, 600);
  const p256dh = str(s.keys && s.keys.p256dh, 300);
  const auth = str(s.keys && s.keys.auth, 300);
  if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Invalid subscription.' });
  db.prepare(`INSERT INTO push_subs (endpoint, p256dh, auth, createdAt) VALUES (?, ?, ?, ?)
              ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`)
    .run(endpoint, p256dh, auth, now());
  res.json({ ok: true });
});

/* notify every subscribed device; dead subscriptions are pruned */
function notifyAll(title, body){
  if (!webpush || !vapid) return;
  const payload = JSON.stringify({ title, body, icon: '/assets/icons/icon-192.png', url: '/' });
  for (const sub of db.prepare('SELECT * FROM push_subs').all()){
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    ).catch(err => {
      if (err.statusCode === 404 || err.statusCode === 410)
        db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(sub.endpoint);
    });
  }
}

/* ---------- admin: guests & rsvps ---------- */
app.patch('/api/admin/guests/:id', requireAdmin, (req, res) => {
  const row = db.prepare(`SELECT * FROM guests WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  const g = req.body || {};
  db.prepare(`UPDATE guests SET name = ?, phone = ?, email = ?, relation = ?, attending = ?, status = ? WHERE id = ?`)
    .run(
      g.name !== undefined ? str(g.name, 120) : row.name,
      g.phone !== undefined ? str(g.phone, 60) : row.phone,
      g.email !== undefined ? str(g.email, 200) : row.email,
      g.relation !== undefined ? str(g.relation, 120) : row.relation,
      g.attending !== undefined ? (g.attending ? 1 : 0) : row.attending,
      ['pending', 'approved'].includes(g.status) ? g.status : row.status,
      req.params.id
    );
  if (g.status === 'approved' && row.status !== 'approved')
    notifyAll('Guest approved', `${row.name} is on the guest list`);
  res.json({ ok: true });
});

app.delete('/api/admin/guests/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM guests WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/admin/rsvps/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM rsvps WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

/* ---------- errors ---------- */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'){
    return res.status(413).json({ error: 'File is too large (max 64MB).' });
  }
  console.warn('Request error:', err.message);
  res.status(400).json({ error: err.message || 'Bad request.' });
});

app.listen(PORT, HOST, () => {
  console.log(`wedding-api listening on http://${HOST}:${PORT}`);
});
