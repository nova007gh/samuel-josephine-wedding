const assert=require('node:assert/strict'),install=require('../server/guest-access');
let guard,route;const scopes=new Map(),sessions=new Set(),approved=new Set();
const db={exec(){},prepare(sql){return {get(key){if(sql.includes('SELECT scope'))return scopes.has(key)?{scope:scopes.get(key)}:undefined;if(sql.includes('SELECT 1 FROM'))return sessions.has(key)&&approved.has(key)?{ok:1}:undefined;return undefined;},all(){return [];},run(endpoint,scope){scopes.set(endpoint,scope);}};}};
const api=install({app:{use(fn){guard=fn;},get(p,fn){route=fn;}},db,guest:req=>req.guest,requireAdmin(req,res,next){if(req.headers.authorization==='Bearer valid')next();else res.status(401).json({code:'auth/invalid-credential'});}});
function check(path,method='GET',guest=null,authorization){const req={path,method,headers:authorization?{authorization}:{},guest};let passed=false;const res={statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(body){this.body=body;return this;}};guard(req,res,()=>passed=true);return {req,res,passed};}
for(const path of ['/api/health','/api/onboarding','/api/settings','/api/guest-access'])assert.equal(check(path).passed,true);
for(const path of ['/api/guests','/api/guests/login','/api/guests/logout','/api/otp/send','/api/otp/verify'])assert.equal(check(path,'POST').passed,true);
for(const path of ['/api/memories','/api/chat','/api/vendors','/api/guide','/api/gifts','/api/competitions','/api/push/subscribe','/api/future-feature'])for(const method of ['GET','POST','PATCH','DELETE']){
  for(const guest of [null,{id:'g',status:'pending'},{id:'g',status:'rejected'},{id:'g',status:'APPROVED'}]){const r=check(path,method,guest);assert.equal(r.passed,false);assert.equal(r.res.statusCode,403);assert.equal(r.res.body.code,'guest/approval-required');}
  assert.equal(check(path,method,{id:'g',status:'approved'}).passed,true);assert.equal(check(path,method,null,'Bearer valid').passed,true);assert.equal(check(path,method,null,'Bearer forged').res.statusCode,401);
}
for(const mode of ['test','live'])assert.equal(check('/api/payments/speso/'+mode+'/webhook','POST').passed,false);
assert.equal(check('/api/payments/speso/test/webhook','GET').passed,false);
assert.equal(check('/api/payments/speso/test/webhook/extra','POST').passed,false);
assert.equal(api.homeKeys.has('couplePhotoUrl'),true);for(const key of ['vendors','storyItems','events','songs','adminEmails','liveBroadcast'])assert.equal(api.homeKeys.has(key),false);
const response=check('/api/guest-access','GET',{id:'g',status:'approved'}).req.weddingAccess;assert.equal(response.guestApproved,true);assert.equal(Object.hasOwn(response,'id'),false);
assert.equal(api.pushAllowed('old-unbound-subscription'),false,'Old anonymous subscriptions cannot receive restricted updates');
const crypto=require('node:crypto'),raw='a'.repeat(64),hash=crypto.createHash('sha256').update(raw).digest('hex');
api.bindPush({headers:{cookie:'sj_guest_session='+raw}},'device');sessions.add(hash);assert.equal(api.pushAllowed('device'),false);approved.add(hash);assert.equal(api.pushAllowed('device'),true);approved.delete(hash);assert.equal(api.pushAllowed('device'),false);approved.add(hash);sessions.delete(hash);assert.equal(api.pushAllowed('device'),false,'Expired/logged-out sessions stop push');
console.log('PASS fail-closed route/method matrix, future-route coverage, forged/expired identity, minimal Home settings, callback boundary and approval-bound push delivery');
