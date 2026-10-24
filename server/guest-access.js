'use strict';
const crypto=require('node:crypto');
const homeKeys=new Set(['weddingFormal','weddingDateISO','weddingVenue','weddingHashtag','rsvpDeadline','couplePhotoUrl','photo:landing','photo:welcome','photo:attend','homeTitle','homeSubtitle','homeEyebrow','homeLikes']);
const openGet=new Set(['/api/health','/api/settings','/api/onboarding','/api/guest-access']);
const openPost=new Set(['/api/admin/login','/api/guests','/api/guest-entry','/api/guests/login','/api/guests/lookup','/api/guests/logout','/api/otp/send','/api/otp/verify']);
module.exports=({app,db,requireAdmin,guest,renewSession=()=>{}})=>{
  db.exec('CREATE TABLE IF NOT EXISTS push_access (endpoint TEXT PRIMARY KEY,scope TEXT NOT NULL)');
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  function entryGuest(req){const token=/(?:^|;\s*)sj_entry_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];return token?db.prepare('SELECT g.* FROM guest_entry_keys e JOIN guests g ON g.id=e.guestId WHERE e.tokenHash=? AND e.expiresAt>?').get(crypto.createHash('sha256').update(token).digest('hex'),Date.now()):null;}
  app.use((req,res,next)=>{
    if(!req.path.startsWith('/api/'))return next();
    if(req.method==='POST'&&/^\/api\/payments\/speso\/(test|live)\/webhook$/.test(req.path))return next(); // Provider authentication remains in the payment handler.
    if(req.path.startsWith('/api/admin/'))return next(); // Existing requireAdmin guards own these routes.
    const proceed=()=>{
      const g=guest(req)||entryGuest(req);req.weddingApproved=req.weddingAdmin||g?.status==='approved';
      if(g&&req.path==='/api/guest-access'){
        renewSession(req,res);
        const entry=/(?:^|;\s*)sj_entry_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1],ttl=400*24*3600000;
        if(entry){const key=hash(entry),r=db.prepare('SELECT expiresAt FROM guest_entry_keys WHERE tokenHash=? AND guestId=? AND expiresAt>?').get(key,g.id,Date.now());if(r&&r.expiresAt<Date.now()+ttl-24*3600000){db.prepare('UPDATE guest_entry_keys SET expiresAt=? WHERE tokenHash=?').run(Date.now()+ttl,key);res.cookie('sj_entry_session',entry,{httpOnly:true,secure:req.secure,sameSite:'strict',path:'/api',maxAge:ttl});}}
      }
      req.weddingAccess={authenticated:!!g,guest:g?{id:g.id,name:g.name}:null,guestApproved:g?.status==='approved',approved:!!req.weddingApproved,admin:!!req.weddingAdmin,status:req.weddingAdmin?'admin':g?.status==='approved'?'approved':g?'pending':'unverified'};
      if((req.method==='GET'||req.method==='HEAD')&&openGet.has(req.path)||req.method==='POST'&&openPost.has(req.path)||req.weddingApproved)return next();
      return res.status(403).set('Cache-Control','no-store').json({error:g?'Waiting for admin approval. You can view the welcome page while we review your registration.':'Verify your guest sign-in to check admin approval.',code:'guest/approval-required'});
    };
    if(req.headers.authorization)return requireAdmin(req,res,()=>{req.weddingAdmin=true;proceed();});
    proceed();
  });
  app.get('/api/guest-access',(req,res)=>res.set('Cache-Control','no-store').json(req.weddingAccess));
  function bindPush(req,endpoint){
    const admin=/^Bearer\s+(.+)$/.exec(req.headers.authorization||'')?.[1],verified=/(?:^|;\s*)sj_guest_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1],entry=/(?:^|;\s*)sj_entry_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
    const scope=req.weddingAdmin&&admin?'admin:'+hash(admin):verified?'guest:'+hash(verified):entry?'entry:'+hash(entry):'';
    if(scope)db.prepare('INSERT INTO push_access VALUES (?,?) ON CONFLICT(endpoint) DO UPDATE SET scope=excluded.scope').run(endpoint,scope);
  }
  function pushAllowed(endpoint){
    const scope=db.prepare('SELECT scope FROM push_access WHERE endpoint=?').get(endpoint)?.scope;if(!scope)return false;
    const [kind,token]=scope.split(':');if(kind==='admin')return db.prepare('SELECT token FROM sessions WHERE createdAt>?').all(Date.now()-30*24*3600000).some(row=>hash(row.token)===token);
    const table=kind==='guest'?'guest_sessions':kind==='entry'?'guest_entry_keys':null;if(!table)return false;
    return !!db.prepare(`SELECT 1 FROM ${table} s JOIN guests g ON g.id=s.guestId WHERE s.tokenHash=? AND s.expiresAt>? AND g.status='approved'`).get(token,Date.now());
  }
  return {homeKeys,bindPush,pushAllowed,resolveGuest:req=>guest(req)||entryGuest(req)};
};
