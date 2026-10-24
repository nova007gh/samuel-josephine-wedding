'use strict';
const crypto=require('node:crypto');
module.exports=({app,db,publicWrite,normPhone,notifyAll,resolveGuest=()=>null})=>{
  const sessionTTL=400*24*3600000;
  const profile=g=>({id:g.id,name:g.name,phone:g.phone,email:g.email,relation:g.relation,city:g.city,state:g.state,country:g.country,attending:!!g.attending,tableGuests:g.tableGuests||0,checkinMethod:'quick'});
  const otpRequired=()=>process.env.GUEST_OTP_REQUIRED!=='false';
  db.exec('CREATE TABLE IF NOT EXISTS guest_entry_keys (tokenHash TEXT PRIMARY KEY, guestId TEXT NOT NULL, expiresAt INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS guest_entry_keys_guest ON guest_entry_keys(guestId)');
  const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  app.get('/api/onboarding',(req,res)=>res.set('Cache-Control','no-store').json({otpRequired:otpRequired()}));
  const create=db.transaction((body,key)=>{
    const prior=db.prepare('SELECT * FROM guest_entry_keys WHERE tokenHash=?').get(hash(key));
    if(prior){
      if(prior.expiresAt<Date.now())throw Object.assign(new Error('This check-in attempt expired. Start a new check-in.'),{status:410});
      const guest=db.prepare('SELECT * FROM guests WHERE id=?').get(prior.guestId);
      if(!guest)throw Object.assign(new Error('This check-in is no longer available. Start again.'),{status:410});
      return {guest,created:false};
    }
    const id=crypto.randomUUID(),attending=body.attending!==false,extra=attending?Math.min(20,Math.max(0,parseInt(body.tableGuests,10)||0)):0;
    // Never look up or update an existing person by their unverified phone.
    db.prepare('INSERT INTO guests (id,name,phone,email,relation,city,state,country,attending,tableGuests,checkedInAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,text(body.name,120),normPhone(body.phone),text(body.email,200),text(body.relation,120),text(body.city,120),text(body.state,120),text(body.country,120),attending?1:0,extra,Date.now());
    db.prepare('INSERT INTO guest_entry_keys VALUES (?,?,?)').run(hash(key),id,Date.now()+sessionTTL);
    return {guest:db.prepare('SELECT * FROM guests WHERE id=?').get(id),created:true};
  });
  app.post('/api/guest-entry',publicWrite,(req,res)=>{
    res.set('Cache-Control','no-store');
    if(otpRequired())return res.status(409).json({error:'Phone verification is enabled. Refresh the page to continue.'});
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open check-in from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))return res.status(403).json({error:'Open check-in from the wedding app.'});}catch{return res.status(403).json({error:'Invalid origin.'});}}
    const signedIn=resolveGuest(req);if(signedIn)return res.json({ok:true,guest:profile(signedIn)});
    const b=req.body||{},key=b.entryKey;
    if(typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))return res.status(400).json({error:'Refresh the page and try checking in again.'});
    if(!text(b.name,120))return res.status(400).json({error:'Please enter your name.'});
    if(!/^\+\d{9,15}$/.test(normPhone(b.phone)))return res.status(400).json({error:'Enter a valid phone number, including the country code.'});
    if(b.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(b.email,200)))return res.status(400).json({error:'Enter a valid email address or leave it blank.'});
    if(b.attending!==undefined&&typeof b.attending!=='boolean')return res.status(400).json({error:'Choose whether you are attending.'});
    try{
      const {guest:g,created}=create(b,key);
      // Approval cookie is not a verified-phone/competition identity.
      res.cookie('sj_entry_session',key,{httpOnly:true,secure:req.secure,sameSite:'strict',path:'/api',maxAge:sessionTTL});
      res.json({ok:true,guest:profile(g)});
      if(created)notifyAll('New guest checked in',`${g.name} joined ${g.attending?'to attend':'to explore'} — quick check-in, pending approval`);
    }catch(err){res.status(err.status||500).json({error:err.status?err.message:'Check-in could not save. Please try again.',...(err.status===410?{code:'ENTRY_EXPIRED'}:{})});}
  });
  return {otpRequired};
};
