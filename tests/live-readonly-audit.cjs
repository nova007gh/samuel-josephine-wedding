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
  for(const route of ['api/health','api/onboarding','api/settings','api/guide','api/gift-payments/config']){
    const response=await get(route);headers(response);assert.match(response.headers.get('cache-control')||'',/no-store/);const body=await response.json();
    if(route==='api/health')assert.equal(body.ok,true);
    if(route==='api/onboarding')assert.equal(body.otpRequired,true,'Live OTP stays enabled');
    if(route==='api/gift-payments/config')assert.equal(body.mode,'test','No live payment activation');
    if(route==='api/settings'){
      assert.equal(Object.hasOwn(body,'adminEmails'),false);assert.equal(Object.hasOwn(body,'eventPushSent'),false);
      const photo=body.couplePhotoUrl;
      if(typeof photo==='string'&&/^\/uploads\/[\w.-]+$/.test(photo)){const media=await get(photo);headers(media);assert.match(media.headers.get('content-type')||'',/^image\//);await media.body?.cancel();}
    }
  }
  console.log(`PASS ${assets.length} precached public assets, security headers/API no-store, current uploaded image MIME, health, live OTP on, Speso TEST and private-setting exclusions; GET-only`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
