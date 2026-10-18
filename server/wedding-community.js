'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const categories=['band','singer','dj','mc','violinist','other'];
const reactions=['❤️','😍','👏','👍','🔥','🙏'];
function text(value,max,label,required=false){
  if(typeof value!=='string'||value.length>max)throw new Error(`${label}: maximum ${max} characters.`);
  const out=value.trim();if(required&&!out)throw new Error(`Enter ${label.toLowerCase()}.`);return out;
}
function https(value){
  const s=text(value,2000,'Link');if(!s)return '';
  const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname.endsWith('.localhost')||u.hostname==='localhost'||/^[\d.]+$/.test(u.hostname)||u.hostname.includes(':'))throw new Error('Use a public HTTPS viewing or social link.');
  return u.href;
}
function validateEntertainment(value,uploadsDir){
  if(!value||!Array.isArray(value.acts)||value.acts.length>30)throw new Error('Add up to 30 entertainment acts.');
  const ids=new Set();return {acts:value.acts.map(r=>{
    if(!r||typeof r.id!=='string'||!/^[\w-]{1,80}$/.test(r.id)||ids.has(r.id))throw new Error('Each act needs a unique ID.');ids.add(r.id);
    if(!categories.includes(r.category))throw new Error('Choose a performer category.');
    const photo=text(r.photoUrl||'',200,'Photo');
    if(photo&&(!/^\/uploads\/[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i.test(photo)||!fs.existsSync(path.join(uploadsDir,path.basename(photo)))))throw new Error('Upload a performer photo first.');
    const startsAt=r.startsAt===null?null:r.startsAt;
    if(startsAt!==null&&(!Number.isSafeInteger(startsAt)||startsAt<Date.UTC(2020,0,1)||startsAt>Date.UTC(2100,0,1)))throw new Error('Choose a valid performance date.');
    return {id:r.id,name:text(r.name,120,'Performer name',true),category:r.category,description:text(r.description||'',600,'Description'),photoUrl:photo,startsAt,duration:text(r.duration||'',80,'Duration'),instagram:https(r.instagram||''),youtube:https(r.youtube||''),facebook:https(r.facebook||'')};
  })};
}
// Derive extensions from the bytes, not from an untrusted filename/MIME.
function attachmentType(b){
  if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return ['jpg','image/jpeg','photos'];
  if(b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return ['png','image/png','photos'];
  if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return ['webp','image/webp','photos'];
  if(b.length>12&&b.toString('ascii',4,8)==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V ','qt  '].includes(b.toString('ascii',8,12)))return ['mp4','video/mp4','videos'];
  if(b.subarray(0,4).equals(Buffer.from('1a45dfa3','hex')))return ['webm','video/webm','videos'];
  if(b.toString('ascii',0,5)==='%PDF-')return ['pdf','application/pdf','files'];
  if(b.toString('ascii',0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224))return ['mp3','audio/mpeg','files'];
  if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WAVE')return ['wav','audio/wav','files'];
  return null;
}
module.exports=({app,db,requireAdmin,publicWrite,multer,uploadsDir,guest})=>{
  db.exec(`
    CREATE TABLE IF NOT EXISTS wedding_chat (id TEXT PRIMARY KEY,actorId TEXT NOT NULL,name TEXT NOT NULL,host INTEGER NOT NULL DEFAULT 0,text TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,attachmentId TEXT,createdAt INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS wedding_chat_feed ON wedding_chat(status,createdAt);
    CREATE TABLE IF NOT EXISTS wedding_chat_reactions (messageId TEXT NOT NULL,actorId TEXT NOT NULL,emoji TEXT NOT NULL,PRIMARY KEY(messageId,actorId,emoji));
    CREATE TABLE IF NOT EXISTS wedding_chat_presence (actorId TEXT PRIMARY KEY,seenAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wedding_chat_uploads (id TEXT PRIMARY KEY,actorId TEXT NOT NULL,url TEXT NOT NULL,mime TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,size INTEGER NOT NULL,createdAt INTEGER NOT NULL);
  `);
  function origin(req,res,next){
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open this feature from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw new Error();}catch{return res.status(403).json({error:'Open this feature from the wedding app.'});}}next();
  }
  function actor(req,res,next){
    if(req.headers.authorization)return requireAdmin(req,res,()=>{req.communityActor={id:'hosts',name:'Sam & Jossy',host:true};next();});
    const g=guest(req);if(!g)return res.status(401).json({error:'Verify your guest sign-in to use Wedding Chat.',code:'chat/verification-required'});
    req.communityActor={id:g.id,name:g.name,host:false};next();
  }
  function fail(res,error){return res.status(400).json({error:error.message});}
  function present(row,who){
    const counts=db.prepare('SELECT emoji,COUNT(*) count FROM wedding_chat_reactions WHERE messageId=? GROUP BY emoji').all(row.id);
    const mine=db.prepare('SELECT emoji FROM wedding_chat_reactions WHERE messageId=? AND actorId=?').all(row.id,who.id).map(x=>x.emoji);
    const file=row.attachmentId?db.prepare('SELECT url,mime,kind,name,size FROM wedding_chat_uploads WHERE id=?').get(row.attachmentId):null;
    return {id:row.id,name:row.name,host:!!row.host,text:row.text,kind:row.kind,status:row.status,pinned:!!row.pinned,createdAt:row.createdAt,own:row.actorId===who.id,attachment:file||null,reactions:counts.map(r=>({...r,mine:mine.includes(r.emoji)}))};
  }
  app.get('/api/chat',actor,(req,res)=>{
    const who=req.communityActor,rows=who.host?db.prepare('SELECT * FROM wedding_chat ORDER BY pinned DESC,createdAt DESC LIMIT 150').all():db.prepare("SELECT * FROM wedding_chat WHERE status='approved' OR actorId=? ORDER BY pinned DESC,createdAt DESC LIMIT 150").all(who.id);
    res.set('Cache-Control','no-store').json({messages:rows.map(r=>present(r,who)),host:who.host,moderation:'approval',activeGuests:db.prepare("SELECT COUNT(*) n FROM wedding_chat_presence WHERE seenAt>? AND actorId!='hosts'").get(Date.now()-45000).n});
  });
  app.post('/api/chat/presence',origin,publicWrite,actor,(req,res)=>{
    db.prepare('DELETE FROM wedding_chat_presence WHERE seenAt<?').run(Date.now()-45000);
    db.prepare('INSERT INTO wedding_chat_presence VALUES (?,?) ON CONFLICT(actorId) DO UPDATE SET seenAt=excluded.seenAt').run(req.communityActor.id,Date.now());res.json({ok:true});
  });
  const create=db.transaction((body,who)=>{
    const id=body.id;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('Refresh the page before sending.');
    const message=text(body.text,2000,'Message'),kind=body.kind==='announcement'&&who.host?'announcement':'chat';
    const old=db.prepare('SELECT * FROM wedding_chat WHERE id=?').get(id);
    if(old){if(old.actorId!==who.id)throw new Error('This message ID is already in use.');if(old.text!==message||old.kind!==kind||old.attachmentId!==(body.attachmentId||null))throw new Error('This send was already saved with different content. Refresh chat before sending a new message.');return old;}
    const recent=db.prepare('SELECT COUNT(*) n FROM wedding_chat WHERE actorId=? AND createdAt>?').get(who.id,Date.now()-60000).n;
    if(recent>=12)throw new Error('Please wait a minute before sending more messages.');
    let upload=null;
    if(body.attachmentId){upload=db.prepare('SELECT * FROM wedding_chat_uploads WHERE id=? AND actorId=?').get(body.attachmentId,who.id);if(!upload)throw new Error('Upload this attachment again.');}
    if(!message&&!upload)throw new Error('Write a message or choose an attachment.');
    db.prepare('INSERT INTO wedding_chat VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,who.id,who.name,who.host?1:0,message,kind,who.host?'approved':'pending',0,upload?.id||null,Date.now());
    return db.prepare('SELECT * FROM wedding_chat WHERE id=?').get(id);
  });
  app.post('/api/chat/messages',origin,publicWrite,actor,(req,res)=>{try{res.json(present(create(req.body||{},req.communityActor),req.communityActor));}catch(e){fail(res,e);}});
  app.put('/api/chat/messages/:id/reaction',origin,publicWrite,actor,(req,res)=>{
    const row=db.prepare("SELECT * FROM wedding_chat WHERE id=? AND status='approved'").get(req.params.id),b=req.body||{};
    if(!row)return res.status(404).json({error:'Message is not available.'});
    if(!reactions.includes(b.emoji)||typeof b.active!=='boolean')return res.status(400).json({error:'Choose a supported reaction.'});
    if(b.active)db.prepare('INSERT OR IGNORE INTO wedding_chat_reactions VALUES (?,?,?)').run(row.id,req.communityActor.id,b.emoji);
    else db.prepare('DELETE FROM wedding_chat_reactions WHERE messageId=? AND actorId=? AND emoji=?').run(row.id,req.communityActor.id,b.emoji);
    res.json(present(row,req.communityActor));
  });
  app.patch('/api/admin/chat/:id',origin,requireAdmin,(req,res)=>{
    const row=db.prepare('SELECT * FROM wedding_chat WHERE id=?').get(req.params.id);if(!row)return res.status(404).json({error:'Message not found.'});
    const b=req.body||{};if(b.status!==undefined&&!['approved','pending','hidden'].includes(b.status))return res.status(400).json({error:'Invalid message status.'});
    if(b.pinned!==undefined&&typeof b.pinned!=='boolean')return res.status(400).json({error:'Invalid pin setting.'});
    db.prepare('UPDATE wedding_chat SET status=?,pinned=? WHERE id=?').run(b.status||row.status,b.pinned===undefined?row.pinned:b.pinned?1:0,row.id);res.json({ok:true});
  });
  const remove=db.transaction(id=>{db.prepare('DELETE FROM wedding_chat_reactions WHERE messageId=?').run(id);db.prepare('DELETE FROM wedding_chat WHERE id=?').run(id);});
  app.delete('/api/chat/messages/:id',origin,publicWrite,actor,(req,res)=>{
    const row=db.prepare('SELECT * FROM wedding_chat WHERE id=?').get(req.params.id);if(!row)return res.json({ok:true});
    if(!req.communityActor.host&&row.actorId!==req.communityActor.id)return res.status(403).json({error:'You can only remove your own messages.'});remove(row.id);res.json({ok:true});
  });
  const receive=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1,fields:0}}).single('file');
  function upload(req,res,photoOnly){
    receive(req,res,error=>{
      if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:'Choose one file up to 25 MB.'});
      if(!req.file)return res.status(400).json({error:'Choose a file.'});
      const type=attachmentType(req.file.buffer);if(!type||(photoOnly&&type[2]!=='photos'))return res.status(400).json({error:photoOnly?'Choose a JPEG, PNG or WebP photo.':'Use JPEG, PNG, WebP, MP4, WebM, PDF, MP3 or WAV.'});
      const who=req.communityActor||{id:'hosts'},cutoff=Date.now()-3600000;
      const usage=db.prepare('SELECT COUNT(*) n,COALESCE(SUM(size),0) bytes FROM wedding_chat_uploads WHERE actorId=? AND createdAt>?').get(who.id,cutoff);
      if(usage.n>=30||usage.bytes+req.file.size>150*1024*1024)return res.status(429).json({error:'Upload limit reached. Please try again later.'});
      const id=crypto.randomUUID(),url='/uploads/'+id+'.'+type[0],name=path.basename(req.file.originalname).replace(/[\x00-\x1f\x7f]/g,'').slice(0,160)||'Attachment';
      const file=path.join(uploadsDir,path.basename(url));
      try{fs.writeFileSync(file,req.file.buffer,{flag:'wx'});db.prepare('INSERT INTO wedding_chat_uploads VALUES (?,?,?,?,?,?,?,?)').run(id,who.id,url,type[1],type[2],name,req.file.size,Date.now());res.json({id,url,mime:type[1],kind:type[2],name,size:req.file.size});}
      catch{if(fs.existsSync(file))fs.unlinkSync(file);res.status(500).json({error:'Upload could not save. Please try again.'});}
    });
  }
  app.post('/api/chat/uploads',origin,publicWrite,actor,(req,res)=>upload(req,res,false));
  app.post('/api/admin/entertainment/photo',origin,requireAdmin,(req,res)=>upload(req,res,true));
  const raw=()=>db.prepare("SELECT value FROM settings WHERE key='entertainment'").get()?.value||'';
  const revision=value=>crypto.createHash('sha256').update(value).digest('hex');
  const entertainment=()=>{const stored=raw();return {data:stored?JSON.parse(stored):{acts:[]},revision:revision(stored)};};
  app.get('/api/entertainment',(req,res)=>res.set('Cache-Control','no-store').json(entertainment()));
  const save=db.transaction((data,expected)=>{if(expected!==revision(raw()))return false;db.prepare("INSERT INTO settings(key,value) VALUES ('entertainment',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(data));return true;});
  app.patch('/api/admin/entertainment',origin,requireAdmin,(req,res)=>{
    let data;try{data=validateEntertainment(req.body?.data,uploadsDir);}catch(e){return fail(res,e);}
    if(!save(data,req.body?.expectedRevision))return res.status(409).json({error:'Entertainment changed on another device. Your draft is kept. Reload saved content before editing again.'});res.json(entertainment());
  });
};
Object.assign(module.exports,{validateEntertainment,attachmentType,categories,reactions});
