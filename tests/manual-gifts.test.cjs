const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {retiredPayments}=require('../server/manual-gifts');
for(const url of ['/api/gift-payments','/api/gift-payments/config','/api/gift-payments/id/check','/api/payments/speso/test/webhook','/api/payments/speso/live/webhook','/api/admin/gift-payments']){
  let status,body;const res={status(n){status=n;return this;},set(){return this;},json(b){body=b;return this;}};
  retiredPayments({path:url},res,()=>assert.fail('Retired endpoint reached next handler'));assert.equal(status,410);assert.equal(body.manualOnly,true);
}
let next=false;retiredPayments({path:'/api/gifts'},{},()=>next=true);assert.equal(next,true);
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),server=fs.readFileSync(path.join(root,'server/server.js'),'utf8'),sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
assert.ok(!html.includes('speso'));assert.ok(!server.includes('speso'));assert.ok(!sw.includes('speso'));
assert.ok(html.includes('Report a gift already sent'));assert.ok(server.includes("guest:guestAccess.resolveGuest"));
console.log('PASS all retired payment routes fail closed, manual gift route remains, and no active provider code/UI/cache entry');
