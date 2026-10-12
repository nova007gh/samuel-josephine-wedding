const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const handlers={},removed=[],puts=[],stored=new Map();
let offline=false,claimed=false,precache;
const cache={addAll:async requests=>{precache=requests;},put:async(req,res)=>puts.push([req,res]),match:async(req)=>stored.get(typeof req==='string'?req:new URL(req.url).pathname)};
const context=vm.createContext({
  Request:class extends Request{constructor(input,options){super(new URL(input,'https://wedding.test/'),options);}},Response,URL,
  self:{location:{origin:'https://wedding.test'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:()=>{},clients:{claim:async()=>{claimed=true;}}},
  caches:{open:async()=>cache,keys:async()=>['sj-wedding-old','unrelated-app'],delete:async key=>removed.push(key),match:async()=>undefined},
  fetch:async()=>{if(offline)throw new Error('Offline');return new Response('fresh');}
});
vm.runInContext(fs.readFileSync(require.resolve('../service-worker.js'),'utf8'),context);
async function lifecycle(name){let completion;handlers[name]({waitUntil:p=>completion=p});await completion;}
async function request(url,mode){let response;const pending=[];handlers.fetch({request:{method:'GET',url:'https://wedding.test'+url,mode},respondWith:p=>response=p,waitUntil:p=>pending.push(p)});const result=await response;await Promise.all(pending);return result;}
(async()=>{
  await lifecycle('install');assert.ok(precache.every(r=>r.cache==='reload'));assert.ok(!precache.some(r=>r.url.endsWith('couple-home.jpg')));
  await lifecycle('activate');assert.deepEqual(removed,['sj-wedding-old']);assert.equal(claimed,true);
  assert.equal(await request('/api/settings'),undefined);assert.equal(await request('/uploads/current.jpg'),undefined);
  assert.equal(await (await request('/app.js?v=999')).text(),'fresh');assert.equal(puts.length,1);
  offline=true;stored.set('./index.html',new Response('<html>offline app</html>'));
  assert.equal((await request('/missing.js')).status,503,'No HTML fallback for missing JS');
  assert.equal((await request('/missing.css')).status,503,'No HTML fallback for missing CSS');
  assert.equal(await (await request('/','navigate')).text(),'<html>offline app</html>');
  stored.set('/app.js',new Response('cached current script'));
  assert.equal(await (await request('/app.js?v=999')).text(),'cached current script');
  console.log('PASS worker fresh precache, scoped old-cache cleanup, upload/API bypass, network-first code, correct offline HTML/code fallbacks and cache-write lifetime');
})().catch(err=>{console.error(err);process.exitCode=1;});
