const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const timers=new Map();let timerId=0,mode='hang',status=200,sent=0,releaseBitmap;
const ctx=vm.createContext({
  console,Blob,FormData,AbortController,crypto:{randomUUID:()=> 'transport-fixture'},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},navigator:{},document:{hidden:false},window:{},
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setInterval(){},clearInterval(){},
  fetch:async(url,options)=>({ok:status===200,status,json:()=>{
    if(mode==='hang')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('body timeout')),{once:true}));
    if(mode==='bad')return Promise.reject(new SyntaxError('broken JSON'));
    return Promise.resolve(mode==='null'?null:{ok:true});
  }}),
  createImageBitmap:()=>new Promise(resolve=>{releaseBitmap=resolve;}),
  XMLHttpRequest:class{constructor(){this.upload={};}open(){}setRequestHeader(){}send(){sent++;}abort(){}},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../api-data.js'),'utf8'),ctx);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const stalled=ctx.api('/memories');
  const rejected=assert.rejects(stalled,error=>error.code==='auth/network-request-failed');
  await settle();assert.equal(timers.size,1,'Deadline remains active while JSON body is stalled');
  [...timers.values()][0]();await rejected;assert.equal(timers.size,0,'Body timeout cleans up its deadline');
  mode='bad';
  await assert.rejects(ctx.api('/memories'),error=>error.code==='api/unconfirmed-response');
  await assert.rejects(ctx.api('/rsvps',{method:'POST',body:{name:'Fixture'}}),/could not be confirmed.*Check your submissions/);
  assert.equal(timers.size,0);
  mode='null';await assert.rejects(ctx.api('/rsvps',{method:'POST',body:{name:'Fixture'}}),/could not be confirmed/);
  mode='bad';status=401;ctx.setAdminToken('fixture-only');
  await assert.rejects(ctx.api('/admin/memories',{admin:true}),error=>error.code==='auth/invalid-credential');
  assert.equal(vm.runInContext('adminToken',ctx),null,'Unreadable 401 still expires the local admin session');
  status=200;mode='ok';assert.equal((await ctx.api('/health')).ok,true);
  const blob=new Blob(['x'],{type:'image/jpeg'});Object.defineProperty(blob,'size',{value:2*1024*1024});
  const form={get:key=>key==='file'?blob:null,has:key=>key==='file'};
  const upload=ctx.api('/memories',{method:'POST',form});
  const uploadRejected=assert.rejects(upload,/Upload timed out/);
  assert.equal(ctx.window.__uploadsInFlight,1);
  [...timers.values()][0]();releaseBitmap({width:1,height:1,close(){}});await uploadRejected;
  assert.equal(sent,0,'A timed-out image preparation must never start a later upload');
  assert.equal(ctx.window.__uploadsInFlight,0);assert.equal(timers.size,0);
  console.log('PASS response-body deadline, malformed/null save confirmation, unreadable 401 cleanup and expired image-preparation guard');
})().catch(error=>{console.error(error);process.exitCode=1;});
