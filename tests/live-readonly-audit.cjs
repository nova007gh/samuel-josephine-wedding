/* GET-only public deployment audit. Never logs guest records or credentials. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base='https://snybena.com/';
async function get(url){const response=await fetch(new URL(url,base),{cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,'Public resource '+url);return response;}
function headers(response){
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
  assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
}
(async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8');
  const assets=vm.runInNewContext(source.slice(0,source.indexOf("self.addEventListener"))+';ASSETS');
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<assets.length){const asset=assets[cursor++],response=await get(asset);headers(response);await response.body?.cancel();}}));
  for(const route of ['api/health','api/onboarding','api/settings','api/guest-access']){
    const response=await get(route);headers(response);assert.match(response.headers.get('cache-control')||'',/no-store/);const body=await response.json();
    if(route==='api/health')assert.equal(body.ok,true);
    if(route==='api/onboarding')assert.equal(body.otpRequired,true,'Live OTP stays enabled');
    if(route==='api/guest-access'){assert.equal(body.approved,false);assert.equal(body.status,'unverified');}
    if(route==='api/settings'){
      assert.equal(Object.hasOwn(body,'adminEmails'),false);assert.equal(Object.hasOwn(body,'eventPushSent'),false);
      const photo=body.couplePhotoUrl;
      if(typeof photo==='string'&&/^\/uploads\/[\w.-]+$/.test(photo)){const media=await get(photo);headers(media);assert.match(media.headers.get('content-type')||'',/^image\//);await media.body?.cancel();}
    }
  }
  for(const route of ['api/guide','api/memories','api/guestbook','api/vendors','api/entertainment','api/live-broadcast','api/bridal-train','api/competitions','api/gifts','api/guest-arrival']){const response=await fetch(new URL(route,base),{cache:'no-store'});assert.equal(response.status,403,route);assert.equal((await response.json()).code,'guest/approval-required');}
  for(const route of ['api/gift-payments/config','api/gift-payments','api/admin/gift-payments','api/payments/speso/test/webhook','api/payments/speso/live/webhook']){const response=await fetch(new URL(route,base),{cache:'no-store'});assert.equal(response.status,410,route);assert.equal((await response.json()).code,'payments/removed');assert.match(response.headers.get('cache-control'),/no-store/);}
  assert.equal((await fetch(new URL('api/admin/arrivals',base),{cache:'no-store'})).status,401,'Entrance admin data requires admin session');
  console.log(`PASS ${assets.length} precached assets, security headers/API no-store, welcome photo MIME, health, live OTP on and unapproved feature lockdown; GET-only`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
