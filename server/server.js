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
const MAX_UPLOAD = 256 * 1024 * 1024; // 256MB — long phone videos
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
  city TEXT, state TEXT, country TEXT,
  attending INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  tableGuests INTEGER DEFAULT 0,
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
CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  code TEXT, expiresAt INTEGER, attempts INTEGER DEFAULT 0, sentAt INTEGER
);
CREATE TABLE IF NOT EXISTS otp_tokens (
  token TEXT PRIMARY KEY,
  phone TEXT, expiresAt INTEGER
);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT, auth TEXT, createdAt INTEGER
);
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  type TEXT, severity TEXT DEFAULT 'info',
  ip TEXT, ua TEXT, deviceId TEXT, net TEXT,
  geo TEXT DEFAULT '', path TEXT, detail TEXT,
  createdAt INTEGER
);
`);

/* column added after launch — migrate existing databases safely */
try { db.exec(`ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'pending'`); } catch {}
try { db.exec(`ALTER TABLE guests ADD COLUMN tableGuests INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE guests ADD COLUMN city TEXT`); } catch {}
try { db.exec(`ALTER TABLE guests ADD COLUMN state TEXT`); } catch {}
try { db.exec(`ALTER TABLE guests ADD COLUMN country TEXT`); } catch {}
try { db.exec(`ALTER TABLE otps ADD COLUMN channel TEXT DEFAULT 'sms'`); } catch {}

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
  /* .weba, not .webm — nginx maps it to audio/webm so <audio> gets a
     playable content type instead of video/webm */
  'audio/webm': '.weba', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg',
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
    let ok = /^(image|video|audio)\//.test(file.mimetype || '');
    /* some clients upload .m4a/.aac as application/octet-stream — allow
       known audio extensions on the song endpoint */
    if (!ok && req.path === '/api/admin/settings/song')
      ok = AUDIO_EXTS.has(path.extname(file.originalname || '').toLowerCase());
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
    if (++b.count > max){
      logSecurity('rate_limited', req, `${b.count - 1} requests/${windowMs / 1000}s cap on ${req.path}`, b.count > max * 3 ? 'warn' : 'info');
      return res.status(429).json({ error: 'Too many attempts. Please wait a moment and try again.', code: 'auth/too-many-requests' });
    }
    next();
  };
}
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, b] of buckets) if (b.start < cutoff) buckets.delete(k);
}, 10 * 60 * 1000).unref();

/* ---------- security event log ----------
   Anything suspicious lands in security_events and shows up on the admin
   dashboard's Security page; warn/high severities also push to the couple.
   Each row carries the request's IP, IP-geolocation (cached per IP),
   the browser-reported device id + network type, and the user agent. */
const geoCache = new Map();
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc|fd|::ffff:127)/;
async function geoFor(ip){
  if (!ip || PRIVATE_IP.test(ip)) return { country: 'local network' };
  const cached = geoCache.get(ip);
  if (cached) return cached;
  try {
    /* ip-api free tier — server-side only, ~45 lookups/min; public IPs only */
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,isp,org`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const g = j.status === 'success'
      ? { country: j.country || '', region: j.regionName || '', city: j.city || '', isp: j.isp || j.org || '' }
      : {};
    geoCache.set(ip, g);
    return g;
  } catch { return {}; }
}

/* dedupe push alerts — same offender+type pings at most once per 15 min */
const secNotifySent = new Map();
const SEC_LABELS = {
  admin_login_failed: 'Failed admin sign-in',
  admin_token_invalid: 'Invalid admin token used',
  rate_limited: 'Rate limit hit',
  otp_verify_failed: 'Wrong entry code',
  suspicious_input: 'Injection-shaped request'
};
function securityPush(type, ip, detail, severity){
  if (severity !== 'warn' && severity !== 'high') return;
  const key = `${type}:${ip}`;
  const last = secNotifySent.get(key) || 0;
  if (now() - last < 15 * 60 * 1000) return;
  secNotifySent.set(key, now());
  notifyAll('⚠ Security alert — snybena.com', `${SEC_LABELS[type] || type} from ${ip || 'unknown IP'} — ${str(detail, 140)}`);
}

function logSecurity(type, req, detail, severity = 'info'){
  try {
    const ip = str(req.ip || req.headers['x-forwarded-for'] || '', 60);
    const rec = {
      id: uid(), type, severity,
      ip,
      ua: str(req.headers['user-agent'], 300),
      deviceId: str(req.headers['x-device-id'], 80),
      net: str(req.headers['x-network-type'], 30),
      path: str(req.originalUrl || req.path, 200),
      detail: str(detail, 500), createdAt: now()
    };
    db.prepare(`INSERT INTO security_events (id, type, severity, ip, ua, deviceId, net, geo, path, detail, createdAt)
                VALUES (@id, @type, @severity, @ip, @ua, @deviceId, @net, '', @path, @detail, @createdAt)`).run(rec);
    geoFor(ip).then(g => {
      if (g && Object.keys(g).length)
        db.prepare('UPDATE security_events SET geo = ? WHERE id = ?').run(JSON.stringify(g), rec.id);
    }).catch(() => {});
    securityPush(type, ip, detail, severity);
  } catch (e) { console.warn('[security] log failed:', e.message); }
}

/* dedupe noisy repeats — a stale admin token in a polling tab would
   otherwise log once per request forever */
const secSeen = new Set();
function logSecurityOnce(key, type, req, detail, severity){
  if (secSeen.has(key)) return;
  secSeen.add(key);
  if (secSeen.size > 5000) secSeen.clear();
  logSecurity(type, req, detail, severity);
}

/* requests that look like SQLi / traversal / injected markup — detection
   only; every query here is already parameterized */
const SUS_URL = /(\bunion\b[\s\/\*]+\bselect\b|\bdrop\b[\s\/\*]+\btable\b|'\s*(or|and)\s+['0-9= ]|<\s*script|\.\.[\/\\]|\/etc\/passwd|xp_cmdshell|cmd\.exe|powershell|benchmark\s*\(|sleep\s*\()/i;
const SUS_BODY = /(\bunion\b[\s\/\*]+\bselect\b|\bdrop\b[\s\/\*]+\btable\b|'\s*(or|and)\s+['\d]+\s*=|xp_cmdshell)/i;
function scanForIntrusion(req){
  let url = req.originalUrl || '';
  try { url = decodeURIComponent(url); } catch {}
  if (SUS_URL.test(url)) return `suspicious URL: ${url.slice(0, 200)}`;
  const b = req.body;
  if (b && typeof b === 'object'){
    for (const v of Object.values(b)){
      if (typeof v === 'string' && SUS_BODY.test(v)) return `injection-shaped field: ${v.slice(0, 160)}`;
    }
  }
  return '';
}

/* ---------- app ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', true);
/* intrusion-shaped traffic is logged for the admin Security page — the
   request still proceeds (all queries are parameterized anyway) */
app.use((req, res, next) => {
  const hit = scanForIntrusion(req);
  if (hit) logSecurity('suspicious_input', req, hit, 'high');
  next();
});

const publicWrite = rateLimit(60, 60 * 1000);
const loginLimit = rateLimit(10, 60 * 1000);

/* ---------- admin auth ---------- */
function requireAdmin(req, res, next){
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || '');
  const token = m && m[1];
  if (!token){
    logSecurityOnce('notoken:' + req.ip + ':' + req.path, 'admin_no_token', req, `Admin endpoint hit with no credentials: ${req.path}`, 'info');
    return res.status(401).json({ error: 'Not signed in.', code: 'auth/invalid-credential' });
  }
  const row = db.prepare('SELECT createdAt FROM sessions WHERE token = ?').get(token);
  if (!row || now() - row.createdAt > SESSION_TTL_MS){
    if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    /* a dead session from a polling tab is routine; a token that never
       existed smells like a replay — logged once per token value */
    logSecurityOnce('badtok:' + token.slice(0, 12), 'admin_token_invalid', req,
      `Rejected ${row ? 'expired' : 'unknown'} admin token on ${req.path}`, 'warn');
    return res.status(401).json({ error: 'Session expired. Please sign in again.', code: 'auth/invalid-credential' });
  }
  next();
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/admin/login', loginLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (ADMIN_EMAIL && str(email, 200).toLowerCase() !== ADMIN_EMAIL.toLowerCase()){
    logSecurity('admin_login_failed', req, `Rejected admin sign-in — wrong email "${str(email, 80)}"`, 'warn');
    return res.status(401).json({ error: 'Incorrect email or password.', code: 'auth/invalid-credential' });
  }
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)){
    logSecurity('admin_login_failed', req, `Rejected admin sign-in — wrong password for "${str(email, 80)}"`, 'warn');
    return res.status(401).json({ error: 'Incorrect email or password. Please try again.', code: 'auth/invalid-credential' });
  }
  logSecurity('admin_login', req, `Admin signed in as "${str(email, 80)}"`);
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
  /* verified-phone token — issued by /api/otp/verify, bound to this number.
     Left valid until expiry so a failed save can retry (upsert is idempotent). */
  const tail = phoneTail(g.phone);
  const tok = str(g.otpToken, 100);
  const row = tok && db.prepare('SELECT * FROM otp_tokens WHERE token = ?').get(tok);
  if (!row || row.expiresAt < now() || row.phone !== tail)
    return res.status(403).json({ error: 'Please verify your phone number first.' });
  const tableGuests = Math.min(Math.max(parseInt(g.tableGuests, 10) || 0, 0), 20);
  const vals = [name, str(g.phone, 60), str(g.email, 200), str(g.relation, 120),
                str(g.city, 120), str(g.state, 120), str(g.country, 120),
                g.attending === false ? 0 : 1, tableGuests, now()];
  /* same number re-registering updates their record instead of duplicating */
  const existing = findGuestByPhone(tail);
  if (existing){
    db.prepare(`UPDATE guests SET name=?, phone=?, email=?, relation=?, city=?, state=?, country=?, attending=?, tableGuests=?, checkedInAt=? WHERE id=?`)
      .run(...vals, existing.id);
    return res.json({ id: existing.id });
  }
  const id = uid();
  db.prepare(`INSERT INTO guests (id, name, phone, email, relation, city, state, country, attending, tableGuests, checkedInAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, ...vals);
  res.json({ id });
  notifyAll('New guest checked in', `${name} just ${g.attending === false ? 'joined to explore' : 'checked in to attend'}${tableGuests ? ` — table of ${tableGuests + 1}` : ''} — pending your approval`);
});

/* ---------- phone OTP — registration & returning-guest sign-in ---------- */
const OTP_TTL_MS = 10 * 60 * 1000;
const otpSendLimit = rateLimit(6, 60 * 1000);
const otpCheckLimit = rateLimit(30, 60 * 1000);
const hashOtp = c => crypto.createHash('sha256').update(String(c)).digest('hex');

function normPhone(v){
  let d = str(v, 40).replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  const digits = d.replace(/\D/g, '');
  if (!digits) return '';
  if (d.startsWith('+')) return '+' + digits;
  /* Ghana wedding — local 0xx and bare 9-digit numbers default to +233 */
  if (digits.startsWith('0')) return '+233' + digits.slice(1);
  if (digits.length === 9) return '+233' + digits;
  /* bare 10-digit NANP — US/Canada guests often type without the +1,
     and +91xxxxx accidentally reads as an Indian number */
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}
/* compare on the last 9 digits so 0xx / +233 / other formats all match */
function phoneTail(v){ return (normPhone(v).match(/\d/g) || []).join('').slice(-9); }
function findGuestByPhone(tail){
  if (!tail) return null;
  return db.prepare('SELECT * FROM guests ORDER BY checkedInAt DESC').all()
           .find(g => phoneTail(g.phone) === tail) || null;
}

async function sendSms(to, body){
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, ARKESEL_KEY, ARKESEL_SENDER,
          BULKCLIX_KEY, BULKCLIX_SENDER_ID,
          HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, HUBTEL_SENDER,
          MNOTIFY_API_KEY, MNOTIFY_SENDER_ID } = process.env;
  const isGhana = to.startsWith('+233');
  /* Ghana carriers hard-filter Twilio's international routes — Ghana numbers
     go via local aggregators; others via Twilio first */
  const order = isGhana ? ['mnotify', 'hubtel', 'arkesel', 'bulkclix', 'twilio']
                        : ['twilio', 'arkesel', 'bulkclix', 'hubtel', 'mnotify'];
  for (const p of order){
    try {
      if (p === 'mnotify' && MNOTIFY_API_KEY){
        /* mNotify (Ghana) — key on query param, recipients without '+',
           sms_type 'otp' gets priority OTP routing */
        const r = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(MNOTIFY_API_KEY)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: [to.replace(/^\+/, '')],
            sender: MNOTIFY_SENDER_ID || 'SJWEDDING',
            message: body,
            is_schedule: false,
            sms_type: 'otp'
          })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || (j.status && String(j.status).toLowerCase() !== 'success' && String(j.status) !== '1000'))
          throw new Error('mNotify ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
        return true;
      }
      if (p === 'hubtel' && HUBTEL_CLIENT_ID && HUBTEL_CLIENT_SECRET){
        /* Hubtel smsc: Basic auth ClientId:Secret, JSON {From,To,Content}; status 0 = queued/sent */
        const r = await fetch('https://smsc.hubtel.com/v1/messages/send', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + Buffer.from(`${HUBTEL_CLIENT_ID}:${HUBTEL_CLIENT_SECRET}`).toString('base64'),
                     'Content-Type': 'application/json' },
          body: JSON.stringify({ From: HUBTEL_SENDER || 'SJWEDDING', To: to, Content: body, RegisteredDelivery: true })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || (j.status !== undefined && Number(j.status) !== 0))
          throw new Error('Hubtel ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
        return true;
      }
      if (p === 'twilio' && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM){
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
                     'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body })
        });
        if (!r.ok) throw new Error('Twilio ' + r.status + ': ' + (await r.text()).slice(0, 200));
        return true;
      }
      if (p === 'arkesel' && ARKESEL_KEY){

        const r = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
          method: 'POST',
          headers: { 'api-key': ARKESEL_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: ARKESEL_SENDER || 'SNY WEDDING', recipients: [to], message: body })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || (j.status && String(j.status) !== 'success'))
          throw new Error('Arkesel ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
        return true;
      }
      if (p === 'bulkclix' && BULKCLIX_KEY && BULKCLIX_SENDER_ID){
        /* BulkClix wants a sender_id UUID (approved sender) + local 0xx recipients */
        const local = to.startsWith('+233') ? '0' + to.slice(4) : to.replace(/^\+/, '');
        const r = await fetch('https://api.bulkclix.com/api/v1/sms-api/send', {
          method: 'POST',
          headers: { 'x-api-key': BULKCLIX_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ sender_id: BULKCLIX_SENDER_ID, message: body, recipients: [local] })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || (j.message && /invalid|error/i.test(j.message) && !/success/i.test(j.message)))
          throw new Error('BulkClix ' + r.status + ': ' + JSON.stringify(j).slice(0, 200));
        return true;
      }
    } catch (e) { console.warn(`[sms] ${p} send failed:`, e.message); }
  }
  return false;
}

/* ---------- email OTP — bridge while SMS sender approval is pending ---------- */
function emailOtpEnabled(){
  const e = process.env;
  return !!((e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) || e.BREVO_KEY || e.RESEND_KEY);
}
function maskEmail(e){
  const [u, d] = String(e || '').split('@');
  return u && d ? u[0] + '***@' + d : '';
}
let _mailer = null;
function mailer(){
  if (!_mailer){
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
    _mailer = require('nodemailer').createTransport({
      host: SMTP_HOST, port: +(SMTP_PORT || 465), secure: SMTP_SECURE !== '0',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return _mailer;
}
async function sendEmail(to, subject, text){
  const { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM,
          BREVO_KEY, BREVO_FROM, RESEND_KEY, RESEND_FROM } = process.env;
  try {
    if (SMTP_HOST && SMTP_USER && SMTP_PASS){
      /* Gmail SMTP — app password auth, delivers to any recipient */
      await mailer().sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text });
      return true;
    }
    if (BREVO_KEY){
      /* Brevo free tier: 300/day, sends to anyone once the sender address is verified */
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { email: BREVO_FROM }, to: [{ email: to }], subject, textContent: text })
      });
      if (!r.ok) throw new Error('Brevo ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return true;
    }
    if (RESEND_KEY){
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM || 'Wedding <onboarding@resend.dev>', to: [to], subject, text })
      });
      if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
      return true;
    }
  } catch (e) { console.warn('[email] send failed:', e.message); }
  return false;
}

/* voice OTP — Twilio call reads the code aloud. Voice is not subject to
   the A2P 10DLC rules that block unregistered SMS to US/international
   numbers, so this is the international channel while email is fallback */
async function sendCall(to, code){
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return false;
  const auth = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  try {
    const spoken = String(code).split('').join(', ');
    const twiml = `<Response><Say voice="alice" language="en-US">Hello from Sam and Jossy's wedding! Your entry code is: ${spoken}. I repeat: ${spoken}. Goodbye!</Say></Response>`;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
      method: 'POST',
      headers: { 'Authorization': auth,
                 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Twiml: twiml })
    });
    if (!r.ok) throw new Error('Twilio call ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const { sid } = await r.json();
    /* Twilio accepting the create request only means the call is queued —
       a bad or unreachable number still fails async. Watch the status for
       a few seconds so a dead call falls back to email instead of
       telling the guest "we're calling" forever */
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline){
      await new Promise(done => setTimeout(done, 2000));
      const s = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${sid}.json`,
        { headers: { 'Authorization': auth } });
      if (!s.ok) break;
      const { status } = await s.json();
      if (['ringing', 'in-progress', 'completed'].includes(status)) return true;
      if (['failed', 'busy', 'no-answer', 'canceled'].includes(status)){
        console.warn(`[call] ${to} → ${status}`);
        return false;
      }
    }
    return true; /* still queued/ringing past the window — treat as sent */
  } catch (e) { console.warn('[call] send failed:', e.message); return false; }
}

function checkOtpCode(phone, code){
  const tail = phoneTail(phone);
  const row = tail && db.prepare('SELECT * FROM otps WHERE phone = ?').get(tail);
  if (!row || row.expiresAt < now())
    return { ok: false, error: 'Code expired — tap RESEND for a new one.' };
  if (row.attempts >= 5){
    db.prepare('DELETE FROM otps WHERE phone = ?').run(tail);
    return { ok: false, error: 'Too many wrong tries — request a new code.' };
  }
  if (hashOtp(code) !== row.code){
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(tail);
    return { ok: false, error: 'Incorrect code — try again.' };
  }
  db.prepare('DELETE FROM otps WHERE phone = ?').run(tail);
  return { ok: true, tail };
}

app.post('/api/otp/send', otpSendLimit, async (req, res) => {
  const b = req.body || {};
  const phone = normPhone(b.phone);
  const tail = phoneTail(phone);
  if (tail.length < 9)
    return res.status(400).json({ error: 'Enter a valid phone number (include the country code if abroad).' });
  const purpose = b.purpose === 'login' ? 'login' : 'register';
  const channel = ['email', 'call'].includes(b.channel) ? b.channel : 'sms';
  const loginGuest = purpose === 'login' ? findGuestByPhone(tail) : null;
  if (purpose === 'login' && !loginGuest)
    return res.status(404).json({ error: 'No check-in found for that number — register first.' });

  /* email channel — registration uses the typed email, sign-in uses the one on file;
     the call channel also collects it so a failed call can fall back to email */
  let emailTo = '';
  if (channel === 'email' || channel === 'call'){
    emailTo = purpose === 'login'
      ? str(loginGuest?.email, 120).toLowerCase()
      : str(b.email, 120).toLowerCase();
  }
  if (channel === 'email'){
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo))
      return res.status(400).json({ error: 'No usable email address for this check-in.' });
    if (!emailOtpEnabled())
      return res.status(400).json({ error: 'Email codes are not available right now — use the text option.' });
  }

  const prev = db.prepare('SELECT sentAt, channel FROM otps WHERE phone = ?').get(tail);
  /* same-channel resend is throttled; switching channel is allowed immediately */
  if (prev && now() - prev.sentAt < 55 * 1000 && (prev.channel || 'sms') === channel)
    return res.status(429).json({ error: 'Code already sent — wait a moment and check your messages.' });

  const code = String(crypto.randomInt(100000, 999999));
  db.prepare(`INSERT INTO otps (phone, code, expiresAt, attempts, sentAt, channel) VALUES (?, ?, ?, 0, ?, ?)
              ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expiresAt=excluded.expiresAt, attempts=0, sentAt=excluded.sentAt, channel=excluded.channel`)
    .run(tail, hashOtp(code), now() + OTP_TTL_MS, now(), channel);

  const msg = `Sam & Jossy's Wedding — your entry code is ${code} (valid 10 min)`;
  /* sign-in always dials the number stored at check-in — the guest may
     type a different format, the record is the verified one */
  const sendTo = loginGuest?.phone || phone;
  let delivered = channel;
  let sent;
  if (channel === 'email'){
    sent = await sendEmail(emailTo, 'Your wedding entry code', msg + ' ❤');
  } else if (channel === 'call'){
    sent = await sendCall(sendTo, code);
    /* call couldn't connect — email the code instead when we have an address */
    if (!sent && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo) && emailOtpEnabled()){
      sent = await sendEmail(emailTo, 'Your wedding entry code', msg + ' ❤');
      delivered = 'email';
    }
  } else {
    sent = await sendSms(sendTo, msg + ' ❤');
  }
  console.log(`[otp] ${purpose}/${channel} → ${sent ? delivered : 'undelivered'} — ${sendTo}`);
  /* nothing delivered → the couple gets it by push and reads it to the guest */
  if (!sent) notifyAll('Guest entry code', `${str(b.name, 60) || phone} needs code: ${code}`);
  res.json({
    ok: true,
    delivered: sent ? delivered : 'admin',
    emailAvailable: emailOtpEnabled(),
    emailMasked: purpose === 'login' ? maskEmail(loginGuest?.email) : maskEmail(emailTo)
  });
});

app.post('/api/otp/verify', otpCheckLimit, (req, res) => {
  const r = checkOtpCode(req.body?.phone, req.body?.code);
  if (!r.ok){
    logSecurity('otp_verify_failed', req, `${r.error} — number ${str(req.body?.phone, 40)}`, /too many/i.test(r.error) ? 'warn' : 'info');
    return res.status(400).json({ error: r.error });
  }
  /* single-use token proves this number was verified — required by POST /api/guests */
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO otp_tokens (token, phone, expiresAt) VALUES (?, ?, ?)')
    .run(token, r.tail, now() + 15 * 60 * 1000);
  res.json({ ok: true, otpToken: token });
});

/* "Already checked in?" — confirm the number has a check-in before we
   burn an OTP send; first name only, nothing else leaks */
app.post('/api/guests/lookup', otpCheckLimit, (req, res) => {
  const tail = phoneTail(str(req.body?.phone, 40));
  const g = tail.length >= 9 ? findGuestByPhone(tail) : null;
  if (!g) return res.json({ exists: false });
  res.json({ exists: true, name: (g.name || '').split(/\s+/)[0] });
});

app.post('/api/guests/login', otpCheckLimit, (req, res) => {
  const r = checkOtpCode(req.body?.phone, req.body?.code);
  if (!r.ok){
    logSecurity('otp_verify_failed', req, `Sign-in ${r.error} — number ${str(req.body?.phone, 40)}`, /too many/i.test(r.error) ? 'warn' : 'info');
    return res.status(400).json({ error: r.error });
  }
  const g = findGuestByPhone(r.tail);
  if (!g) return res.status(404).json({ error: 'No check-in found for that number.' });
  res.json({ ok: true, guest: { id: g.id, name: g.name, phone: g.phone, email: g.email,
    relation: g.relation, city: g.city, state: g.state, country: g.country,
    attending: !!g.attending, tableGuests: g.tableGuests || 0 } });
});

/* public guest list — names + attendance of approved guests only;
   contact details stay behind the admin endpoints */
app.get('/api/guests', (req, res) => {
  res.json(db.prepare(`SELECT name, attending, checkedInAt FROM guests WHERE status = 'approved' ORDER BY checkedInAt DESC`).all());
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
  const att = (r.attending || '').toString();
  const attLabel = /decline|no|can't/i.test(att) ? "can't make it" : 'is attending';
  notifyAll('New RSVP', `${name} ${attLabel}${parseInt(r.guestCount, 10) > 1 ? ` — party of ${r.guestCount}` : ''}`);
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

/* security event feed for the admin Security page — geo arrives as JSON */
app.get('/api/admin/security', requireAdmin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM security_events ORDER BY createdAt DESC LIMIT 300`).all();
  res.json(rows.map(r => {
    let geo = {};
    try { geo = JSON.parse(r.geo || '{}'); } catch {}
    return { ...r, geo };
  }));
});
app.delete('/api/admin/security', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM security_events`).run();
  res.json({ ok: true });
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
/* keys that must never reach the public settings dump */
const PRIVATE_SETTINGS = new Set(['adminEmails', 'eventPushSent']);
app.get('/api/settings', (req, res) => {
  const out = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all())
    if (!PRIVATE_SETTINGS.has(row.key)) out[row.key] = row.value;
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
  'facetime', 'proposal', 'now',
  'announce-a', 'announce-b', 'admin-heart'
]);

app.post('/api/admin/settings/photo/:slot?', requireAdmin, upload.single('file'), (req, res) => {
  const slot = req.params.slot || 'couple';
  if (!PHOTO_SLOTS.has(slot)) return res.status(400).json({ error: 'Unknown photo slot.' });
  if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
  if (!/^image\//.test(req.file.mimetype)) return res.status(400).json({ error: 'Photo must be an image.' });
  const key = slot === 'couple' ? 'couplePhotoUrl' : `photo:${slot}`;
  setSettingFile(res, req.file, key);
});

const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.weba', '.flac', '.m4b']);

/* the wedding playlist — songs[] in settings; songUrl/songLabel mirror the
   first entry for backward compatibility with older clients */
const SET_SETTING = `INSERT INTO settings (key, value) VALUES (?, ?)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
function getSongs(){
  let list;
  try { list = JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('songs')?.value || '[]'); }
  catch { list = []; }
  /* migrate the old single-song setting into the playlist on first read */
  if (!list.length){
    const url = db.prepare('SELECT value FROM settings WHERE key = ?').get('songUrl')?.value;
    if (url) list = [{ url, label: db.prepare('SELECT value FROM settings WHERE key = ?').get('songLabel')?.value || 'Wedding song' }];
  }
  return list;
}
function setSongs(list){
  db.prepare(SET_SETTING).run('songs', JSON.stringify(list));
  db.prepare(SET_SETTING).run('songUrl', list[0]?.url || '');
  db.prepare(SET_SETTING).run('songLabel', list[0]?.label || '');
}

app.post('/api/admin/settings/song', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An audio file is required.' });
  /* some browsers upload .m4a/.aac as application/octet-stream — accept by extension too */
  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (!/^audio\//.test(req.file.mimetype) && !AUDIO_EXTS.has(ext))
    return res.status(400).json({ error: 'Song must be an audio file.' });
  const songs = getSongs();
  const entry = { url: `/uploads/${req.file.filename}`, label: str(req.body.label, 200) || req.file.originalname || 'Wedding song' };
  songs.push(entry);
  setSongs(songs);
  res.json({ ...entry, songs });
});

/* ---------- announcements — a glowing pop-up pushed to every guest ---------- */
app.post('/api/admin/announce', requireAdmin, (req, res) => {
  const text = str(req.body?.text, 300);
  const everyMin = Math.max(0, Math.min(1440, parseInt(req.body?.everyMin, 10) || 0));
  if (!text) return res.status(400).json({ error: 'Announcement text is required.' });
  const announcement = {
    text, everyMin, at: Date.now(),
    photoA: str(req.body?.photoA, 40) || 'sam-adult',
    photoB: str(req.body?.photoB, 40) || 'jossy-adult'
  };
  db.prepare(SET_SETTING).run('announcement', JSON.stringify(announcement));
  notifyAll('S & J — Announcement', text);
  res.json({ ok: true, announcement });
});
app.delete('/api/admin/announce', requireAdmin, (req, res) => {
  db.prepare("DELETE FROM settings WHERE key = 'announcement'").run();
  res.json({ ok: true });
});

app.delete('/api/admin/settings/song/:index', requireAdmin, (req, res) => {
  const songs = getSongs();
  const i = parseInt(req.params.index, 10);
  if (!(i >= 0 && i < songs.length)) return res.status(404).json({ error: 'No such song.' });
  const [removed] = songs.splice(i, 1);
  setSongs(songs);
  unlinkUpload(removed.url);
  res.json({ ok: true, songs });
});

/* admin picks which song leads the playlist — moves it to position 1 */
app.post('/api/admin/settings/song/:index/first', requireAdmin, (req, res) => {
  const songs = getSongs();
  const i = parseInt(req.params.index, 10);
  if (!(i >= 0 && i < songs.length)) return res.status(404).json({ error: 'No such song.' });
  const [pick] = songs.splice(i, 1);
  songs.unshift(pick);
  setSongs(songs);
  res.json({ ok: true, songs });
});

/* full playlist reorder — move a song to any position */
app.post('/api/admin/settings/song/:index/move', requireAdmin, (req, res) => {
  const songs = getSongs();
  const from = parseInt(req.params.index, 10);
  const to = parseInt(req.body?.to, 10);
  if (!(from >= 0 && from < songs.length)) return res.status(404).json({ error: 'No such song.' });
  if (!(to >= 0 && to < songs.length) || to === from) return res.json({ ok: true, songs });
  const [pick] = songs.splice(from, 1);
  songs.splice(to, 0, pick);
  setSongs(songs);
  res.json({ ok: true, songs });
});

/* ---------- admin access emails ----------
   Guests who check in with one of these emails can open the admin sign-in by
   tapping the couple's heart on Home. The list itself is never exposed. */
const DEFAULT_ADMIN_EMAILS = ['mr.lsrbi123gh@gmail.com', 'snyobeng@gmai.com', 'snyobeng@gmail.com'];
function getAdminEmails(){
  try { return JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('adminEmails')?.value || '[]'); }
  catch { return []; }
}
function setAdminEmails(list){
  db.prepare(SET_SETTING).run('adminEmails', JSON.stringify(list.map(e => str(e, 200).toLowerCase()).filter(Boolean)));
}
if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('adminEmails')) setAdminEmails(DEFAULT_ADMIN_EMAILS);

/* public: does this checked-in email get the admin sign-in? Never reveals the list */
app.post('/api/admin-email-check', publicWrite, (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  res.json({ allowed: !!email && getAdminEmails().includes(email) });
});

app.get('/api/admin/emails', requireAdmin, (req, res) => res.json({ emails: getAdminEmails() }));

app.post('/api/admin/emails', requireAdmin, (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!getAdminEmails().includes(email)) setAdminEmails([...getAdminEmails(), email]);
  res.json({ ok: true, emails: getAdminEmails() });
});

app.delete('/api/admin/emails/:email', requireAdmin, (req, res) => {
  const email = decodeURIComponent(req.params.email || '').toLowerCase();
  setAdminEmails(getAdminEmails().filter(e => e !== email));
  res.json({ ok: true, emails: getAdminEmails() });
});

/* home heart likes — every guest tap sends love; count is shared live */
app.post('/api/home-like', publicWrite, (req, res) => {
  const delta = req.body?.delta === -1 ? -1 : 1;
  const cur = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('homeLikes')?.value || '0', 10) || 0;
  const next = Math.max(0, cur + delta);
  db.prepare(SET_SETTING).run('homeLikes', String(next));
  res.json({ likes: next });
});

/* ---------- admin: text settings (wedding details, reusable template) ---------- */
const TEXT_SETTING_KEYS = new Set([
  'weddingNameA', 'weddingNameB', 'weddingFormal',
  'weddingDateISO', 'weddingDateLabel', 'weddingVenue', 'weddingHashtag',
  'weddingTagline', 'rsvpDeadline', 'storyText', 'events', 'mapUrl', 'storyItems'
]);

/* story timeline likes — a single JSON map { itemId: count } in settings;
   public endpoint, but it can only ever write this one key */
function getStoryLikes(){
  try { return JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('storyLikes')?.value || '{}'); }
  catch { return {}; }
}
app.post('/api/story-likes', (req, res) => {
  const itemId = str(req.body?.itemId, 80);
  const delta = req.body?.delta === -1 ? -1 : 1;
  if (!itemId) return res.status(400).json({ error: 'itemId is required.' });
  const likes = getStoryLikes();
  likes[itemId] = Math.max(0, (likes[itemId] || 0) + delta);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('storyLikes', JSON.stringify(likes));
  res.json({ itemId, likes: likes[itemId] });
});

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

/* guests may delete their own submissions while still pending — ids are
   unguessable UUIDs, and approved content stays admin-only */
app.delete('/api/memories/:id', publicWrite, (req, res) => {
  const row = db.prepare('SELECT status, mediaUrl FROM memories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'pending') return res.status(403).json({ error: 'Already published — only admin can remove it.' });
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  unlinkUpload(row.mediaUrl);
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

app.delete('/api/guestbook/:id', publicWrite, (req, res) => {
  const row = db.prepare('SELECT status, selfieUrl FROM guestbook WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  if (row.status !== 'pending') return res.status(403).json({ error: 'Already published — only admin can remove it.' });
  db.prepare('DELETE FROM guestbook WHERE id = ?').run(req.params.id);
  unlinkUpload(row.selfieUrl);
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

/* ---------- event-time push — "It's time!" for each programme item ----------
   Reaches guests whose app is closed; open apps show the in-app toast.
   Times are Accra time (GMT year-round). Each event is sent once. */
function eventStarts(){
  const get = k => db.prepare('SELECT value FROM settings WHERE key = ?').get(k)?.value;
  const m = (get('weddingDateISO') || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return [];
  let events = [];
  try { events = JSON.parse(get('events') || '[]'); } catch {}
  return events.map((ev, i) => {
    const t = String(ev.time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!t) return null;
    let h = +t[1] % 12;
    if (/pm/i.test(t[3] || '')) h += 12;
    if (!t[3] && +t[1] === 12) h = 12;
    return { i, name: ev.name || 'The next celebration', time: ev.time,
             at: Date.UTC(+m[1], +m[2] - 1, +m[3], h, +t[2]) };
  }).filter(Boolean);
}
function pushDueEvents(now = Date.now()){
  let sent = {};
  try { sent = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'eventPushSent'").get()?.value || '{}'); } catch {}
  let changed = false;
  for (const ev of eventStarts()){
    const key = `${ev.at}_${ev.i}`;
    if (sent[key] || now < ev.at || now - ev.at > 20 * 60000) continue;
    notifyAll("It's time! ❤", `${ev.name} begins now — ${ev.time}`);
    sent[key] = now; changed = true;
  }
  if (changed) db.prepare(SET_SETTING).run('eventPushSent', JSON.stringify(sent));
}
setInterval(pushDueEvents, 60000);

/* ---------- BulkClix sender-ID approval watcher ----------
   Polls every 15 min; the moment the pending sender flips to approved,
   the couple gets a push — guest OTPs then go out as real SMS. */
let smsWatchDone = false;
async function checkSenderApproval(){
  if (smsWatchDone) return;
  const { BULKCLIX_KEY } = process.env;
  if (!BULKCLIX_KEY) return;
  try {
    const r = await fetch('https://api.bulkclix.com/api/v1/sms-api/senderIds', {
      headers: { 'x-api-key': BULKCLIX_KEY, 'Accept': 'application/json' }
    });
    const j = await r.json().catch(() => ({}));
    const approved = (j.data || []).find(s => s.status === 'approved');
    if (approved){
      smsWatchDone = true;
      console.log(`[sms] BulkClix sender "${approved.name}" APPROVED — OTP texts are live`);
      notifyAll('SMS is live ✔', `Guest entry codes now text from "${approved.name}" — no more reading codes to guests.`);
    }
  } catch (e) { /* transient — next tick retries */ }
}
checkSenderApproval();
setInterval(checkSenderApproval, 15 * 60 * 1000);

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
