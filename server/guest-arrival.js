'use strict';
const crypto=require('node:crypto');
const {connection}=require('./admin-companion-alerts');
const sideFor=g=>connection(g.relation)||(crypto.createHash('sha256').update(g.id).digest()[0]%2?'sam':'jossy');
module.exports=({app,db,requireAdmin,publicWrite,guest})=>{
  db.exec(`CREATE TABLE IF NOT EXISTS guest_seating (guestId TEXT PRIMARY KEY,tableNumber TEXT NOT NULL,location TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS guest_arrivals (guestId TEXT PRIMARY KEY,arrivedAt INTEGER NOT NULL,method TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS guest_arrival_passes (guestId TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE);`);
  const seat=id=>db.prepare('SELECT tableNumber,location,revision FROM guest_seating WHERE guestId=?').get(id)||{tableNumber:'',location:'',revision:0};
  const arrival=id=>db.prepare('SELECT arrivedAt,method FROM guest_arrivals WHERE guestId=?').get(id)||null;
  function sameOrigin(req,res,next){
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open check-in from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw Error();}catch{return res.status(403).json({error:'Invalid request origin.'});}}
    next();
  }
  function self(req,res,next){const g=guest(req);if(!g)return res.status(401).json({error:'Verify your guest sign-in first.'});if(g.status!=='approved')return res.status(403).json({error:'Admin approval is required.',code:'guest/approval-required'});req.arrivalGuest=g;next();}
  app.use((req,res,next)=>{if(/^\/api\/(?:guest-arrival|admin\/arrivals)(?:\/|$)/.test(req.path))res.set('Cache-Control','no-store');next();});
  app.get('/api/guest-arrival',self,(req,res)=>{const g=req.arrivalGuest,a=arrival(g.id);res.json({name:g.name,side:sideFor(g),arrival:a,seating:a?seat(g.id):null});});
  const issue=db.transaction(id=>{
    let p=db.prepare('SELECT code FROM guest_arrival_passes WHERE guestId=?').get(id);
    if(!p){p={code:'SJ1-'+crypto.randomBytes(32).toString('hex')};db.prepare('INSERT INTO guest_arrival_passes VALUES (?,?)').run(id,p.code);}return p.code;
  });
  app.post('/api/guest-arrival/pass',sameOrigin,publicWrite,self,(req,res)=>res.json({code:issue(req.arrivalGuest.id),name:req.arrivalGuest.name}));
  function summary(g){return {id:g.id,name:g.name,phone:g.phone,status:g.status,attending:!!g.attending,relation:g.relation,side:sideFor(g),seating:seat(g.id),arrival:arrival(g.id)};}
  app.get('/api/admin/arrivals',requireAdmin,(req,res)=>{
    const guests=db.prepare('SELECT id,name,phone,status,attending,relation FROM guests ORDER BY name COLLATE NOCASE,id').all().map(summary);
    const approved=guests.filter(g=>g.status==='approved'),checkedIn=approved.filter(g=>g.arrival).length;
    res.json({guests,stats:{checkedIn,notYetArrived:approved.length-checkedIn,totalApproved:approved.length},countUnit:'registered approved guests; excludes unregistered party members'});
  });
  const saveSeat=db.transaction((id,body)=>{
    const old=seat(id);if(body.expectedRevision!==old.revision)throw Object.assign(Error('This table assignment changed. Reload before saving.'),{status:409});
    for(const [key,max]of [['tableNumber',60],['location',400]])if(typeof body[key]!=='string'||body[key].trim().length>max)throw Object.assign(Error('Enter a valid table number/name and location.'),{status:400});
    const tableNumber=body.tableNumber.trim(),location=body.location.trim();if(!tableNumber&&location)throw Object.assign(Error('Add a table number/name before directions.'),{status:400});
    db.prepare('INSERT INTO guest_seating VALUES (?,?,?,?) ON CONFLICT(guestId) DO UPDATE SET tableNumber=excluded.tableNumber,location=excluded.location,revision=excluded.revision').run(id,tableNumber,location,old.revision+1);return seat(id);
  });
  app.patch('/api/admin/arrivals/:id/seating',requireAdmin,sameOrigin,(req,res)=>{
    if(!db.prepare('SELECT id FROM guests WHERE id=?').get(req.params.id))return res.status(404).json({error:'Guest not found.'});
    try{res.json({seating:saveSeat(req.params.id,req.body||{})});}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Table assignment could not save.'});}
  });
  function fromCode(value){if(typeof value!=='string'||!/^SJ1-[a-f0-9]{64}$/.test(value))return null;return db.prepare('SELECT g.* FROM guest_arrival_passes p JOIN guests g ON g.id=p.guestId WHERE p.code=?').get(value);}
  app.post('/api/admin/arrivals/resolve',requireAdmin,sameOrigin,publicWrite,(req,res)=>{
    const g=fromCode(req.body?.code);if(!g)return res.status(404).json({error:'This is not a valid wedding entrance pass.'});
    if(g.status!=='approved')return res.status(403).json({error:'This guest is not approved. Review their registration first.'});res.json({guest:summary(g)});
  });
  const confirm=db.transaction(body=>{
    const qr=Object.hasOwn(body,'code'),g=qr?fromCode(body.code):typeof body.guestId==='string'?db.prepare('SELECT * FROM guests WHERE id=?').get(body.guestId):null;
    if(!g)throw Object.assign(Error('Guest or entrance pass not found.'),{status:404});
    if(g.status!=='approved')throw Object.assign(Error('Admin approval is required before entrance check-in.'),{status:403});
    const old=arrival(g.id);if(!old)db.prepare('INSERT INTO guest_arrivals VALUES (?,?,?)').run(g.id,Date.now(),qr?'qr':'manual');
    return {guest:summary(g),alreadyCheckedIn:!!old};
  });
  app.post('/api/admin/arrivals/confirm',requireAdmin,sameOrigin,publicWrite,(req,res)=>{try{res.json(confirm(req.body||{}));}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Arrival could not be confirmed. Retry safely.'});}});
};
module.exports.sideFor=sideFor;
