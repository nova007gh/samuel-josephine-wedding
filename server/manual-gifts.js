'use strict';
const crypto=require('node:crypto');
function retiredPayments(req,res,next){
  if(/^\/api\/(?:gift-payments|payments|admin\/gift-payments)(?:\/|$)/.test(req.path))return res.status(410).set('Cache-Control','no-store').json({error:'Automatic payments have been removed. Send cash gifts directly to the couple’s published MoMo number. No payment was requested or verified.',code:'payments/removed',manualOnly:true});
  next();
}
module.exports=({app,db,publicWrite,notifyAll,guest})=>{
  db.exec('CREATE TABLE IF NOT EXISTS manual_gift_receipts (owner TEXT NOT NULL,requestKey TEXT NOT NULL,fingerprint TEXT NOT NULL,giftId TEXT NOT NULL,PRIMARY KEY(owner,requestKey))');
  const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
  const historical=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_payments'").get();
  const previouslyVerified=historical?db.prepare("SELECT 1 FROM gift_payments WHERE giftId=? AND mode='live' AND status='completed'"):null;
  app.get('/api/gifts',(req,res)=>{const rows=db.prepare('SELECT id,name,fund,amountCents,message,createdAt FROM gifts ORDER BY createdAt DESC LIMIT 40').all();res.json(rows.map(({id,...row})=>({...row,paymentVerified:!!previouslyVerified?.get(id)})));});
  const save=db.transaction((owner,key,data)=>{
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    if(key){const old=db.prepare('SELECT fingerprint,giftId FROM manual_gift_receipts WHERE owner=? AND requestKey=?').get(owner,key);if(old){if(old.fingerprint!==fingerprint)throw Object.assign(Error('This report attempt has different details. Reload or start a new report.'),{status:409});return {id:old.giftId,created:false};}}
    if(!db.prepare("SELECT id FROM gift_funds WHERE id='cash' AND enabled=1").get())throw Object.assign(Error('Cash gift reports are currently unavailable. You can still use the published MoMo details to send directly.'),{status:409});
    const id=crypto.randomUUID();db.prepare('INSERT INTO gifts (id,name,phone,email,fund,amountCents,provider,txnRef,message,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,data.name,data.phone,data.email,'cash',data.amountCents,data.provider,data.txnRef,data.message,Date.now());
    if(key)db.prepare('INSERT INTO manual_gift_receipts VALUES (?,?,?,?)').run(owner,key,fingerprint,id);return {id,created:true};
  });
  app.post('/api/gifts',publicWrite,(req,res)=>{
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open gift reports from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw Error();}catch{return res.status(403).json({error:'Invalid request origin.'});}}
    const b=req.body||{},name=text(b.name,120);if(!name)return res.status(400).json({error:'Please enter your name.'});
    if(b.fund!=='cash')return res.status(400).json({error:'Only direct cash gifts to the couple’s MoMo number are available.'});
    const amountCents=b.amountCents!=null&&b.amountCents!==''?Number(b.amountCents):Math.round(Number(b.amount)*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<5000||amountCents>2000000)return res.status(400).json({error:'Choose a report amount between GHS 50 and GHS 20,000.'});
    const key=b.requestKey;if(key!==undefined&&(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key)))return res.status(400).json({error:'Refresh the gift form before reporting.'});
    const data={name,phone:text(b.phone,40),email:text(b.email,200),amountCents,provider:['mtn','telecel','airteltigo'].includes(b.provider)?b.provider:'',txnRef:text(b.txnRef,80),message:text(b.message,500)};
    const owner=guest(req)?.id||'admin';
    try{const result=save(owner,key,data);res.json({ok:true,id:result.id,paymentVerified:false,reportOnly:true});if(result.created){try{notifyAll('Cash gift reported',`${name} reported GHS ${(amountCents/100).toFixed(2)} — verify receipt in your MoMo account. This is not proof of payment.`);}catch{console.warn('[gifts] Report saved; notification unavailable.');}}}
    catch(error){res.status(error.status||500).json({error:error.status?error.message:'Could not confirm the report. Retry safely using the same attempt.'});}
  });
};
module.exports.retiredPayments=retiredPayments;
