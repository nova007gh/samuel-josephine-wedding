'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {defaults,validate}=require(fs.existsSync(path.join(__dirname,'vendor-schema.js'))?'./vendor-schema':'../vendor-schema');
const {attachmentType}=require('./wedding-community');
module.exports=({app,db,requireAdmin,multer,uploadsDir})=>{
  const raw=()=>db.prepare("SELECT value FROM settings WHERE key='vendors'").get()?.value||'';
  const revision=s=>crypto.createHash('sha256').update(s).digest('hex');
  const content=()=>{const s=raw();return {data:s?validate(JSON.parse(s)):defaults(),revision:revision(s)};};
  function origin(req,res,next){if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open Vendors from the wedding app.'});if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw new Error();}catch{return res.status(403).json({error:'Open Vendors from the wedding app.'});}}next();}
  app.get('/api/vendors',(req,res)=>{const result=content();result.data.vendors=result.data.vendors.filter(v=>v.published);res.set('Cache-Control','no-store').json(result);});
  app.get('/api/admin/vendors',requireAdmin,(req,res)=>res.set('Cache-Control','no-store').json(content()));
  const save=db.transaction((data,expected)=>{if(expected!==revision(raw()))return false;db.prepare("INSERT INTO settings(key,value) VALUES ('vendors',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(data));return true;});
  app.patch('/api/admin/vendors',origin,requireAdmin,(req,res)=>{
    let data;try{data=validate(req.body?.data);for(const url of [data.heroUrl,...data.vendors.map(v=>v.photoUrl)].filter(Boolean)){const p=path.join(uploadsDir,path.basename(url));if(!fs.existsSync(p)||!fs.statSync(p).isFile())throw new Error('A selected photo is missing. Upload it again.');}}catch(e){return res.status(400).json({error:e.message});}
    if(!save(data,req.body?.expectedRevision))return res.status(409).json({error:'Vendors changed on another device. Your draft is kept. Reload saved content before editing again.'});res.set('Cache-Control','no-store').json(content());
  });
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:0}}).single('file');
  app.post('/api/admin/vendors/photo',origin,requireAdmin,(req,res)=>upload(req,res,error=>{
    if(error||!req.file)return res.status(400).json({error:'Choose one JPEG, PNG or WebP photo under 8 MB.'});
    const type=attachmentType(req.file.buffer);if(!type||type[2]!=='photos')return res.status(400).json({error:'Choose a JPEG, PNG or WebP photo.'});
    const filename=crypto.randomUUID()+'.'+type[0];try{fs.writeFileSync(path.join(uploadsDir,filename),req.file.buffer,{flag:'wx'});res.json({url:'/uploads/'+filename});}catch{res.status(500).json({error:'Photo could not save. Your other edits are kept.'});}
  }));
};
