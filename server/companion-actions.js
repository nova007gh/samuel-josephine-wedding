'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const S=require(fs.existsSync(path.join(__dirname,'companion-actions-schema.js'))?'./companion-actions-schema':'../companion-actions-schema');
module.exports=({app,db,requireAdmin})=>{
  const key='companionActions',hash=s=>crypto.createHash('sha256').update(s).digest('hex');
  function source(){const raw=db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value||'';return {data:raw?S.validate(JSON.parse(raw)):S.defaults(),revision:hash(raw)};}
  function origin(req,res,next){if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open AI Actions from the wedding app.'});if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw Error();}catch{return res.status(403).json({error:'Invalid origin.'});}}next();}
  app.use((req,res,next)=>{if(/^\/api\/(?:admin\/)?companion-actions(?:\/|$)/.test(req.path))res.set('Cache-Control','no-store');next();});
  app.get('/api/admin/companion-actions',requireAdmin,(req,res)=>{try{res.json({...source(),serverNow:Date.now()});}catch{res.status(503).json({error:'Companion settings could not load. No actions were changed.'});}});
  const save=db.transaction(body=>{const current=source();if(body.expectedRevision!==current.revision)throw Object.assign(Error('AI Actions changed in another session. Reload saved settings before editing.'),{status:409});const data=S.validate(body.data);db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(data));return source();});
  app.patch('/api/admin/companion-actions',requireAdmin,origin,(req,res)=>{try{res.json({...save(req.body||{}),serverNow:Date.now()});}catch(e){res.status(e.status||400).json({error:e.message});}});
  app.get('/api/companion-actions',(req,res)=>{try{const {data,revision}=source(),now=Date.now();const {actions,...policy}=data;res.json({policy,revision,serverNow:now,actions:S.due(data,now)});}catch{res.status(503).json({error:'Scheduled companion actions are temporarily unavailable.'});}});
};
