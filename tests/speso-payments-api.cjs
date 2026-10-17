/* Standalone disposable SQLite + HTTP tests. Provider calls are entirely mocked.
   node tests/speso-payments-api.cjs /opt/wedding-api /path/to/speso-payments.js */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const modules=process.argv[2],express=require(path.join(modules,'node_modules/express')),Database=require(path.join(modules,'node_modules/better-sqlite3'));
const install=require(process.argv[3]);
const dir=fs.mkdtempSync('/root/wedding-speso-test-'),db=new Database(path.join(dir,'test.db'));
db.exec(`CREATE TABLE gifts(id TEXT PRIMARY KEY,name TEXT,phone TEXT,email TEXT,fund TEXT,amountCents INTEGER,provider TEXT,txnRef TEXT,message TEXT,createdAt INTEGER);
CREATE TABLE gift_funds(id TEXT PRIMARY KEY,label TEXT,enabled INTEGER);
INSERT INTO gift_funds VALUES('cash','Cash Gift',1);INSERT INTO gift_funds VALUES('disabled','Disabled',0);
INSERT INTO gifts VALUES('retained','Existing guest','','','cash',5000,'','','Keep me',1);`);
const original=db.prepare('SELECT * FROM gifts').all();
const env={SPESO_MODE:'off',SPESO_TEST_API_KEY:'sk_test_fixture',SPESO_TEST_WEBHOOK_SECRET:'whsec_test_fixture'};
const orders=new Map(),calls=[],notices=[];let timeoutNext=false,server,base;
const requireAdmin=(req,res,next)=>req.get('Authorization')==='Bearer isolated-admin'?next():res.status(401).json({error:'Unauthorized'});
async function fakeFetch(url,options){
  calls.push({url,method:options.method||'GET'});assert.ok(url.startsWith('https://business.speso.co/api/v1/collections'));
  assert.equal(options.headers.Authorization,'Bearer '+(env.SPESO_MODE==='test'?env.SPESO_TEST_API_KEY:env.SPESO_LIVE_API_KEY));
  assert.equal(options.redirect,'error');assert.ok(options.signal);
  if(options.method==='POST'){
    const b=JSON.parse(options.body);assert.ok(b.callback_url.endsWith('/'+env.SPESO_MODE+'/webhook'));
    orders.set(b.order_id,{success:true,order_id:b.order_id,speso_reference:'ACL-'+b.order_id,status:'processing',amount:b.amount,currency:'GHS',mobile:b.mobile,network:b.network});
    if(timeoutNext){timeoutNext=false;throw new Error('Synthetic timeout after provider accepted');}
    return {ok:true,json:async()=>orders.get(b.order_id)};
  }
  const row=orders.get(decodeURIComponent(url.split('/').at(-1)));
  return {ok:!!row,json:async()=>row||{success:false}};
}
async function start(){
  const app=express();app.use(express.json({verify:(req,res,raw)=>{req.rawBody=Buffer.from(raw);}}));
  install({app,db,requireAdmin,publicWrite:(req,res,next)=>next(),notifyAll:(...args)=>notices.push(args),env,fetchImpl:fakeFetch});
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
}
async function request(route,{body,admin=false,status=200,headers={}}={}){
  const raw=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
  const r=await fetch(base+route,{method:raw===undefined?'GET':'POST',headers:{...(raw?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer isolated-admin'}:{}),...headers},body:raw});
  const j=await r.json();assert.equal(r.status,status,route+' '+JSON.stringify(j));return j;
}
function signed(body,secret=env.SPESO_MODE==='test'?env.SPESO_TEST_WEBHOOK_SECRET:env.SPESO_LIVE_WEBHOOK_SECRET,time=Math.floor(Date.now()/1000)){
  const raw=JSON.stringify(body);return {body:raw,headers:{'X-Speso-Signature':'t='+time+',v1='+crypto.createHmac('sha256',secret).update(time+'.'+raw).digest('hex')}};
}
const input=(digit='a',extra={})=>({secret:digit.repeat(64),name:'Sandbox guest',phone:'0240000001',fund:'cash',provider:'mtn',amountCents:7550,message:'Test only',...extra});
const countPosts=()=>calls.filter(c=>c.method==='POST').length;
async function callback(order,status=200,changes={}){return request('/api/payments/speso/'+env.SPESO_MODE+'/webhook',{...signed({order_id:order.id,status:'completed',...changes}),status});}
(async()=>{try{
  await start();assert.equal((await request('/api/gift-payments/config')).mode,'off');
  await request('/api/gift-payments',{body:input(),status:503});assert.equal(countPosts(),0);
  env.SPESO_MODE='test';assert.equal((await request('/api/gift-payments/config')).mode,'test');
  await request('/api/gift-payments',{body:input(),status:401});
  await request('/api/gift-payments',{body:input(),admin:true,status:403,headers:{Origin:'https://untrusted.example'}});
  await request('/api/gift-payments',{body:input('a',{amountCents:49}),admin:true,status:400});
  await request('/api/gift-payments',{body:input('a',{fund:'disabled'}),admin:true,status:400});
  const [one,two]=await Promise.all([request('/api/gift-payments',{body:input(),admin:true}),request('/api/gift-payments',{body:input(),admin:true})]);
  assert.equal(one.id,two.id);assert.equal(countPosts(),1);assert.equal(one.status,'processing');
  assert.equal(JSON.stringify(one).includes('233240000001'),false);assert.equal(JSON.stringify(one).includes(input().secret),false);
  await request('/api/gift-payments',{body:input('a',{amountCents:10000}),admin:true,status:409});
  await request('/api/gift-payments',{body:input('b'),admin:true,status:409});assert.equal(countPosts(),1);
  await request('/api/gift-payments/'+one.id+'/status',{body:{secret:'b'.repeat(64)},admin:true,status:404});
  await request('/api/gift-payments/'+one.id+'/status',{body:{secret:input().secret},status:401});
  await request('/api/payments/speso/test/webhook',{body:{order_id:one.id},status:401});
  await request('/api/payments/speso/test/webhook',{...signed({order_id:one.id},'wrong'),status:401});
  await request('/api/payments/speso/test/webhook',{...signed({order_id:one.id},env.SPESO_TEST_WEBHOOK_SECRET,Math.floor(Date.now()/1000)-301),status:401});
  const tampered=signed({order_id:one.id});await request('/api/payments/speso/test/webhook',{...tampered,body:tampered.body+' ',status:401});
  await request('/api/payments/speso/live/webhook',{...signed({order_id:one.id}),status:401});
  await request('/api/payments/speso/test/webhook',{...signed({}),status:404});
  await callback(one);assert.equal(db.prepare('SELECT status FROM gift_payments WHERE id=?').get(one.id).status,'processing','Forged completed callback must be rechecked with provider');
  orders.get(one.id).status='completed';await callback(one);await callback(one);
  assert.equal(db.prepare('SELECT status FROM gift_payments WHERE id=?').get(one.id).status,'completed');
  assert.deepEqual(db.prepare('SELECT * FROM gifts').all(),original);assert.equal(notices.length,0,'Sandbox never adds gifts or notifications');
  const stored=db.prepare('SELECT * FROM gift_payments WHERE id=?').get(one.id);assert.equal(stored.tokenHash,crypto.createHash('sha256').update(input().secret).digest('hex'));
  assert.equal(JSON.stringify(stored).includes(input().secret),false);
  env.SPESO_MODE='live';env.SPESO_LIVE_API_KEY='sk_live_fixture';env.SPESO_LIVE_WEBHOOK_SECRET='whsec_live_fixture';
  assert.equal((await request('/api/gift-payments/config')).enabled,false);
  env.SPESO_LIVE_CONFIRMED='true';env.SPESO_MERCHANT_NAME='Isolated test merchant';
  const live=await request('/api/gift-payments',{body:input('c')});
  const record=orders.get(live.id);record.status='completed';
  for(const [key,bad] of [['amount',75.51],['amount',75.501],['currency','USD'],['mobile','233240000002'],['network','VOD'],['order_id','wrong'],['speso_reference','wrong'],['status','unrecognized']]){
    const saved=record[key];record[key]=bad;await callback(live,503);record[key]=saved;
    assert.equal(db.prepare('SELECT COUNT(*) n FROM gifts').get().n,1,'Mismatch must not create a gift');
  }
  await Promise.all([callback(live),callback(live)]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gifts').get().n,2);assert.equal(notices.length,1);
  const gift=db.prepare("SELECT * FROM gifts WHERE id<>'retained'").get();assert.equal(gift.amountCents,7550);assert.equal(gift.phone,'+233240000001');
  record.status='failed';await callback(live);assert.equal(db.prepare('SELECT COUNT(*) n FROM gifts').get().n,2);assert.equal(db.prepare('SELECT status FROM gift_payments WHERE id=?').get(live.id).status,'completed');
  timeoutNext=true;const timeoutInput=input('d',{phone:'0240000002'}),unknown=await request('/api/gift-payments',{body:timeoutInput});assert.equal(unknown.status,'unknown');
  const before=countPosts();const retried=await request('/api/gift-payments',{body:timeoutInput});assert.equal(retried.id,unknown.id);assert.equal(countPosts(),before);
  orders.get(unknown.id).status='completed';
  const recovered=await request('/api/gift-payments/'+unknown.id+'/status',{body:{secret:timeoutInput.secret}});assert.equal(recovered.status,'completed');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM gifts').get().n,3);
  await request('/api/admin/gift-payments',{status:401});
  const admin=await request('/api/admin/gift-payments',{admin:true});assert.equal(admin.length,3);assert.ok(admin.every(row=>!row.tokenHash&&!row.mobile));
  await new Promise(r=>server.close(r));await start();
  const afterRestart=await request('/api/gift-payments',{body:timeoutInput});assert.equal(afterRestart.id,unknown.id);assert.equal(countPosts(),before);
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(db.prepare('SELECT * FROM gifts WHERE id=?').get('retained'),original[0]);
  console.log('PASS disposable Speso API: off/test/admin/live gates, validation, one prompt for concurrent retries, phone lock, secret ownership/hash, signed raw callbacks, replay/tamper/environment rejection, authoritative amount/currency/network/mobile/reference checks, sandbox isolation, exactly-once gifts, timeout/restart recovery and retained existing records. No real provider requests.');
}finally{if(server?.listening)await new Promise(r=>server.close(r));db.close();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
