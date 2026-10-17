'use strict';
/* Speso Collections: https://docs.speso.co/api/collections
   Credentials never leave the server. Sandbox orders never enter the gift wall. */
const crypto=require('node:crypto');
const API='https://business.speso.co/api/v1';
const NETWORKS=Object.freeze({mtn:'MTN',telecel:'VOD',airteltigo:'ATL'});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const secretPattern=/^[a-f0-9]{64}$/;
const text=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
function phone(value){
  let digits=String(value||'').replace(/[\s()+-]/g,'');
  if(/^0\d{9}$/.test(digits))digits='233'+digits.slice(1);
  return /^233\d{9}$/.test(digits)?digits:'';
}
function config(env){
  const mode=env.SPESO_MODE||'off',prefix=mode==='test'?'SPESO_TEST_':'SPESO_LIVE_';
  const key=env[prefix+'API_KEY']||'',secret=env[prefix+'WEBHOOK_SECRET']||'';
  const merchant=text(env.SPESO_MERCHANT_NAME,120);
  const enabled=['test','live'].includes(mode)&&key.startsWith('sk_'+mode+'_')&&secret.startsWith('whsec_')&&
    (mode!=='live'||(env.SPESO_LIVE_CONFIRMED==='true'&&!!merchant));
  return {mode:enabled?mode:'off',enabled,key,secret,merchant};
}
function verifySignature(header,raw,secret,now=Date.now()){
  if(typeof header!=='string'||!Buffer.isBuffer(raw)||!secret)return false;
  const match=/^t=(\d{10}),v1=([a-f0-9]{64})$/.exec(header);
  if(!match||Math.abs(now/1000-Number(match[1]))>300)return false;
  const expected=crypto.createHmac('sha256',secret).update(match[1]+'.').update(raw).digest();
  return crypto.timingSafeEqual(expected,Buffer.from(match[2],'hex'));
}
function validate(body){
  const name=text(body?.name,120),mobile=phone(body?.phone),fund=text(body?.fund,40),provider=body?.provider;
  const amountCents=body?.amountCents;
  if(!secretPattern.test(body?.secret||''))throw new Error('Refresh the payment form and try again.');
  if(!name)throw new Error('Enter your name.');
  if(!mobile)throw new Error('Enter the Ghana MoMo number that should receive the payment prompt.');
  if(!Object.hasOwn(NETWORKS,provider))throw new Error('Choose a supported MoMo provider.');
  if(!Number.isSafeInteger(amountCents)||amountCents<5000||amountCents>2000000)throw new Error('Choose an amount between GHS 50 and GHS 20,000.');
  return {name,mobile,fund,provider,amountCents,message:text(body.message,500)};
}
module.exports=({app,db,requireAdmin,publicWrite,paymentLimit=publicWrite,notifyAll,env=process.env,fetchImpl=global.fetch})=>{
  db.exec(`CREATE TABLE IF NOT EXISTS gift_payments (
    id TEXT PRIMARY KEY, mode TEXT NOT NULL, tokenHash TEXT NOT NULL,
    fingerprint TEXT NOT NULL, name TEXT NOT NULL, mobile TEXT NOT NULL,
    fund TEXT NOT NULL, provider TEXT NOT NULL, amountCents INTEGER NOT NULL,
    message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'initiating',
    spesoReference TEXT, giftId TEXT UNIQUE, createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL, checkedAt INTEGER NOT NULL DEFAULT 0,
    UNIQUE(mode,tokenHash)
  ); CREATE INDEX IF NOT EXISTS gift_payments_created ON gift_payments(createdAt);`);
  const get=id=>typeof id==='string'&&/^SJ-[a-f0-9]{32}$/.test(id)?db.prepare('SELECT * FROM gift_payments WHERE id=?').get(id):undefined;
  const view=row=>({id:row.id,mode:row.mode,status:row.status,amountCents:row.amountCents,createdAt:row.createdAt});
  const inflight=new Map();
  const gate=(req,res,next)=>{
    const c=config(env);
    if(!c.enabled)return res.status(503).json({error:'Online collection is not available. No payment was requested.'});
    if(c.mode==='test')return requireAdmin(req,res,next);
    next();
  };
  async function provider(path,options={}){
    const c=config(env);if(!c.enabled)throw new Error('Payments unavailable');
    const response=await fetchImpl(API+path,{...options,headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});
    const data=await response.json();
    if(!response.ok||data?.success!==true)throw new Error('Provider request not confirmed');
    return data;
  }
  const apply=db.transaction((id,data)=>{
    const row=get(id);if(!row)throw new Error('Unknown payment');
    // Never use browser redirects or the callback's status as proof of payment.
    const amount=Number(data.amount),cents=Math.round(amount*100);
    if(data.order_id!==row.id||data.currency!=='GHS'||!Number.isFinite(amount)||
      Math.abs(amount*100-cents)>.00001||cents!==row.amountCents||phone(data.mobile)!==row.mobile||
      data.network!==NETWORKS[row.provider]||typeof data.speso_reference!=='string'||!data.speso_reference||data.speso_reference.length>120||
      (row.spesoReference&&row.spesoReference!==data.speso_reference))throw new Error('Provider payment details mismatch');
    const status=data.status;
    if(!['pending','processing','completed','failed'].includes(status))throw new Error('Unknown provider status');
    if(row.status==='completed')return false; // Delayed failures cannot undo a settled gift.
    const giftId=status==='completed'&&row.mode==='live'?'speso-'+row.id:null;
    if(giftId)db.prepare(`INSERT INTO gifts (id,name,phone,email,fund,amountCents,provider,txnRef,message,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(giftId,row.name,'+'+row.mobile,'',row.fund,row.amountCents,row.provider,data.speso_reference,row.message,Date.now());
    db.prepare('UPDATE gift_payments SET status=?,spesoReference=?,giftId=?,updatedAt=? WHERE id=?')
      .run(status,data.speso_reference,giftId,Date.now(),id);
    return !!giftId;
  });
  async function sync(row,force=false){
    if(row.mode!==config(env).mode)throw new Error('Payment environment unavailable');
    if(row.status==='completed')return row;
    if(inflight.has(row.id))return inflight.get(row.id);
    if(!force&&Date.now()-row.checkedAt<10000)return row;
    const task=(async()=>{
      db.prepare('UPDATE gift_payments SET checkedAt=? WHERE id=?').run(Date.now(),row.id);
      const data=await provider('/collections/'+encodeURIComponent(row.id));
      const added=apply(row.id,data);
      if(added){try{Promise.resolve(notifyAll('Gift payment confirmed',`${row.name} paid GHS ${(row.amountCents/100).toFixed(2)} through Speso.`)).catch(()=>{});}catch{}}
      return get(row.id);
    })();
    inflight.set(row.id,task);try{return await task;}finally{inflight.delete(row.id);}
  }
  app.get('/api/gift-payments/config',(req,res)=>{
    const c=config(env);res.set('Cache-Control','no-store').json({enabled:c.enabled,mode:c.mode,merchant:c.merchant||'',minAmountCents:5000,maxAmountCents:2000000});
  });
  app.post('/api/gift-payments',paymentLimit,gate,async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open payments from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))return res.status(403).json({error:'Open payments from the wedding app.'});}catch{return res.status(403).json({error:'Invalid origin.'});}}
    let input;try{input=validate(req.body);}catch(error){return res.status(400).json({error:error.message,code:'payment/not-started'});}
    const c=config(env),tokenHash=hash(req.body.secret),fingerprint=hash(JSON.stringify(input));
    const existing=db.prepare('SELECT * FROM gift_payments WHERE mode=? AND tokenHash=?').get(c.mode,tokenHash);
    if(existing){
      if(existing.fingerprint!==fingerprint)return res.status(409).json({error:'This payment attempt already exists with different details. Check its status before starting another.'});
      return res.json(view(existing)); // Never send another phone prompt for a retry.
    }
    const fund=db.prepare('SELECT id FROM gift_funds WHERE id=? AND enabled=1').get(input.fund);
    if(!fund)return res.status(400).json({error:'Choose an available gift option.',code:'payment/not-started'});
    const previous=db.prepare('SELECT status,createdAt FROM gift_payments WHERE mode=? AND mobile=? ORDER BY createdAt DESC LIMIT 1').get(c.mode,input.mobile);
    if(previous&&(!['completed','failed'].includes(previous.status)||Date.now()-previous.createdAt<60000))
      return res.status(409).json({error:'A payment request already exists for this number. Check the original attempt or ask the couple to check payment activity before requesting another prompt.',code:'payment/not-started'});
    let callback;
    try{
      const origin=new URL(env.SPESO_PUBLIC_ORIGIN||'https://snybena.com');
      if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error();
      callback=origin.origin+'/api/payments/speso/'+c.mode+'/webhook';
    }catch{return res.status(503).json({error:'Payment callback configuration is unavailable.',code:'payment/not-started'});}
    const id='SJ-'+crypto.randomBytes(16).toString('hex'),now=Date.now();
    db.prepare(`INSERT INTO gift_payments (id,mode,tokenHash,fingerprint,name,mobile,fund,provider,amountCents,message,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,c.mode,tokenHash,fingerprint,input.name,input.mobile,input.fund,input.provider,input.amountCents,input.message,now,now);
    try{
      const data=await provider('/collections',{method:'POST',body:JSON.stringify({order_id:id,mobile:input.mobile,network:NETWORKS[input.provider],amount:input.amountCents/100,description:'Sam and Jossy wedding gift',callback_url:callback})});
      if(data.order_id!==id||typeof data.speso_reference!=='string'||!data.speso_reference||data.speso_reference.length>120)throw new Error('Unconfirmed reference');
      // Initiation is not settlement, even if it responds with "completed".
      db.prepare(`UPDATE gift_payments SET status='processing',spesoReference=?,updatedAt=? WHERE id=? AND status='initiating'`)
        .run(data.speso_reference,Date.now(),id);
    }catch{
      // The provider may have accepted the prompt before the connection failed.
      // Keep this order and recover it by GET, never automatically re-POST it.
      db.prepare(`UPDATE gift_payments SET status='unknown',updatedAt=? WHERE id=? AND status='initiating'`).run(Date.now(),id);
    }
    res.json(view(get(id)));
  });
  app.post('/api/gift-payments/:id/status',publicWrite,gate,async(req,res)=>{
    res.set('Cache-Control','no-store');const row=get(req.params.id);
    if(!row||row.mode!==config(env).mode||!secretPattern.test(req.body?.secret||'')||hash(req.body.secret)!==row.tokenHash)
      return res.status(404).json({error:'Payment attempt not found on this device.'});
    try{res.json(view(await sync(row)));}catch{res.status(503).json({error:'Payment status could not be confirmed. Do not pay again; check this attempt later.'});}
  });
  app.post('/api/payments/speso/:mode/webhook',async(req,res)=>{
    const c=config(env);
    if(!c.enabled||req.params.mode!==c.mode||!verifySignature(req.get('X-Speso-Signature'),req.rawBody,c.secret))return res.status(401).json({error:'Invalid callback signature.'});
    const row=get(req.body?.order_id);
    if(!row||row.mode!==c.mode)return res.status(404).json({error:'Unknown order.'});
    try{await sync(row,true);res.json({ok:true});}catch{res.status(503).json({error:'Payment reconciliation unavailable. Retry later.'});}
  });
  app.get('/api/admin/gift-payments',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store').json(db.prepare('SELECT id,mode,name,fund,provider,amountCents,status,createdAt,updatedAt FROM gift_payments ORDER BY createdAt DESC LIMIT 100').all());
  });
  app.post('/api/admin/gift-payments/:id/sync',requireAdmin,async(req,res)=>{
    const row=get(req.params.id);if(!row)return res.status(404).json({error:'Unknown order.'});
    try{res.json(view(await sync(row)));}catch{res.status(503).json({error:'Payment reconciliation unavailable.'});}
  });
  return {isVerifiedGift:id=>!!db.prepare("SELECT 1 FROM gift_payments WHERE giftId=? AND mode='live' AND status='completed'").get(id)};
};
module.exports.verifySignature=verifySignature;
module.exports.validate=validate;
module.exports.config=config;
module.exports.phone=phone;
