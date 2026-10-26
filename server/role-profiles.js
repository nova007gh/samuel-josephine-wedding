'use strict';
/* Ownership is assigned only by an admin, never from submitted names/phones/roles. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vendors=require(fs.existsSync(path.join(__dirname,'vendor-schema.js'))?'./vendor-schema':'../vendor-schema');
const bridal=require('./bridal-train'),{attachmentType}=require('./wedding-community');
module.exports=({app,db,requireAdmin,guest,multer,uploadsDir,publicWrite})=>{
  db.exec(`CREATE TABLE IF NOT EXISTS role_profile_owners (kind TEXT NOT NULL,profileId TEXT NOT NULL,guestId TEXT NOT NULL,PRIMARY KEY(kind,profileId));`);
  const kinds=['vendor','bridesmaid','groomsman'],hash=s=>crypto.createHash('sha256').update(s).digest('hex');
  function source(kind){
    if(!kinds.includes(kind))throw Error('Choose Vendor, Bridesmaid or Groomsman.');
    const key=kind==='vendor'?'vendors':'bridalTrain',raw=db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value||'';
    const data=raw?JSON.parse(raw):kind==='vendor'?vendors.defaults():structuredClone(bridal.defaults);
    return {key,raw,data,rows:kind==='vendor'?data.vendors:kind==='bridesmaid'?data.bridesmaids:data.groomsmen};
  }
  function origin(req,res,next){if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open profiles from the wedding app.'});if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw Error();}catch{return res.status(403).json({error:'Open profiles from the wedding app.'});}}next();}
  function self(req,res,next){const g=guest(req);if(!g||g.status!=='approved')return res.status(403).json({error:'Sign in with your own approved wedding account. Ask admin to assign your profile.'});req.profileGuest=g;next();}
  const owners=()=>db.prepare('SELECT kind,profileId,guestId FROM role_profile_owners').all();
  function ownProfiles(id){return owners().filter(o=>o.guestId===id).flatMap(o=>{const s=source(o.kind),p=s.rows.find(p=>p.id===o.profileId);return p?[{kind:o.kind,profile:p,revision:hash(s.raw)}]:[];});}
  app.get('/api/role-profiles',self,(req,res)=>res.set('Cache-Control','no-store').json({profiles:ownProfiles(req.profileGuest.id)}));
  app.get('/api/admin/role-profiles',requireAdmin,(req,res)=>{
    const links=owners();res.set('Cache-Control','no-store').json({profiles:kinds.flatMap(kind=>source(kind).rows.map(p=>({kind,id:p.id,name:p.name,guestId:links.find(o=>o.kind===kind&&o.profileId===p.id)?.guestId||''}))),guests:db.prepare('SELECT id,name,phone,status FROM guests ORDER BY name').all()});
  });
  app.patch('/api/admin/role-profiles/:kind/:id',origin,requireAdmin,(req,res)=>{
    const {kind,id}=req.params;let s;try{s=source(kind);}catch(e){return res.status(400).json({error:e.message});}
    if(!s.rows.some(p=>p.id===id))return res.status(404).json({error:'Profile no longer exists.'});
    const guestId=req.body?.guestId;if(typeof guestId!=='string')return res.status(400).json({error:'Choose a registered account or remove access.'});
    if(guestId&&!db.prepare('SELECT id FROM guests WHERE id=?').get(guestId))return res.status(400).json({error:'Choose an existing registered account.'});
    if(guestId)db.prepare('INSERT INTO role_profile_owners VALUES (?,?,?) ON CONFLICT(kind,profileId) DO UPDATE SET guestId=excluded.guestId').run(kind,id,guestId);
    else db.prepare('DELETE FROM role_profile_owners WHERE kind=? AND profileId=?').run(kind,id);
    res.json({ok:true});
  });
  const update=db.transaction((g,kind,id,body)=>{
    const s=source(kind),p=s.rows.find(p=>p.id===id);
    if(!p||!db.prepare('SELECT 1 FROM role_profile_owners WHERE kind=? AND profileId=? AND guestId=?').get(kind,id,g.id))return {status:403,error:'This profile is not assigned to your account.'};
    if(body?.expectedRevision!==hash(s.raw))return {status:409,error:'Profiles changed on another device. Your draft is kept. Reload saved profiles before trying again.'};
    const fields=kind==='vendor'?['name','badge','description','phone','whatsapp','photoUrl']:['name','photoUrl'];
    if(!body?.profile||typeof body.profile!=='object'||Array.isArray(body.profile)||Object.keys(body.profile).some(k=>!fields.includes(k)))return {status:400,error:'Only your profile details can be edited. Admin manages roles, categories and publication.'};
    Object.assign(p,body.profile);
    let data;try{data=kind==='vendor'?vendors.validate(s.data):bridal.validate(s.data);if(p.photoUrl&&!fs.statSync(path.join(uploadsDir,path.basename(p.photoUrl))).isFile())throw Error('Photo missing. Upload it again.');}catch(e){return {status:400,error:e.message};}
    db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(s.key,JSON.stringify(data));
    return {status:200,profiles:ownProfiles(g.id)};
  });
  app.patch('/api/role-profiles/:kind/:id',origin,self,publicWrite,(req,res)=>{
    if(!kinds.includes(req.params.kind))return res.status(400).json({error:'Unknown profile role.'});
    const r=update(req.profileGuest,req.params.kind,req.params.id,req.body);res.status(r.status).set('Cache-Control','no-store').json(r.error?{error:r.error}:{profiles:r.profiles});
  });
  function owns(req,res,next){const {kind,id}=req.params;if(!kinds.includes(kind)||!source(kind).rows.some(p=>p.id===id)||!db.prepare('SELECT 1 FROM role_profile_owners WHERE kind=? AND profileId=? AND guestId=?').get(kind,id,req.profileGuest.id))return res.status(403).json({error:'This profile is not assigned to your account.'});next();}
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0}}).single('file');
  app.post('/api/role-profiles/:kind/:id/photo',origin,self,owns,publicWrite,(req,res)=>upload(req,res,error=>{
    if(error||!req.file)return res.status(400).json({error:'Choose one JPEG, PNG or WebP under 8 MB.'});
    const type=attachmentType(req.file.buffer);if(!type||type[2]!=='photos')return res.status(400).json({error:'Choose a JPEG, PNG or WebP photo.'});
    const name=crypto.randomUUID()+'.'+type[0];try{fs.writeFileSync(path.join(uploadsDir,name),req.file.buffer,{flag:'wx'});res.json({url:'/uploads/'+name});}catch{res.status(500).json({error:'Photo could not save. Your draft is kept.'});}
  }));
};
/* Called inside existing admin save transactions; deleted profiles lose ownership. */
module.exports.prune=(db,kind,ids)=>{for(const r of db.prepare('SELECT profileId FROM role_profile_owners WHERE kind=?').all(kind))if(!ids.includes(r.profileId))db.prepare('DELETE FROM role_profile_owners WHERE kind=? AND profileId=?').run(kind,r.profileId);};
