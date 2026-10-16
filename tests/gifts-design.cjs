/* Read-only live UI smoke test in an isolated Chrome profile.
   Usage: node tests/gifts-design.cjs /absolute/output/directory [--dashboard|--admin-gifts|--gift-message|--competitions|--share]
   Dashboard mode mocks admin responses: no credentials or live writes. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const out = process.argv[2];
if (!out) throw new Error('Provide an output directory');
fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(out, 'chrome-profile-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  '--user-data-dir='+profile,
  ...(process.argv.includes('--e2e')?['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']:[]),
  'about:blank'
]);
let socket;
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const active = path.join(profile, 'DevToolsActivePort');
  let port;
  for (let i=0; i<300; i++){
    if(fs.existsSync(active)){
      const candidate=fs.readFileSync(active,'utf8').split('\n')[0];
      if(/^\d+$/.test(candidate)&&Number(candidate)>0){port=candidate;break;}
    }
    if(chrome.exitCode!==null)throw new Error('Test Chrome exited before its debugging port became ready');
    await delay(100);
  }
  if(!port)throw new Error('Test Chrome debugging port did not become ready within 30 seconds');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const tab = tabs.find(t=>t.type==='page');
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let next = 0;
  const pending = new Map(), events = new Map();
  const errors = [];
  socket.addEventListener('message',e=>{
    const data = JSON.parse(e.data);
    if (data.id){
      const p = pending.get(data.id); if(!p) return;
      pending.delete(data.id); data.error ? p.reject(new Error(data.error.message)) : p.resolve(data.result);
    } else {
      if(data.method==='Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
      events.get(data.method)?.(data.params);
    }
  });
  const call = (method,params={})=>new Promise((resolve,reject)=>{
    const id=++next; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate = async expression => {
    const r = await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await call('Page.enable'); await call('Runtime.enable');
  if(process.argv.includes('--refresh')){
    await require('./refresh-browser-checks.cjs').setup({call});
  }
  if(process.argv.includes('--live-refresh')){
    await call('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('sj_guest',JSON.stringify({name:'Read-only refresh preview'}));localStorage.setItem('sj_entered','1');localStorage.setItem('sj_site_photos',JSON.stringify({couple:location.origin+'/assets/couple-home.jpg'}));`});
  }
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});
  const loaded = new Promise(resolve=>events.set('Page.loadEventFired',resolve));
   await call('Page.navigate',{url:(process.env.WEDDING_TEST_URL||'https://snybena.com/')+'#gifts'});
  await Promise.race([loaded,delay(15000)]);
  if(process.argv.includes('--refresh')){
    await require('./refresh-browser-checks.cjs').check({call,evaluate,errors,out});
    return;
  }
  if(process.argv.includes('--live-refresh')){
    await require('./refresh-browser-checks.cjs').checkLive({call,evaluate,errors,out});
    return;
  }
  /* Preview-only identity in this disposable profile; no check-in API call. */
  await evaluate('setGuest({name:"Design preview"});enterApp();switchView("gifts");Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,5000))]).then(()=>true)');
  if(process.argv.includes('--home')){
    await require('./home-reference-checks.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--navigation')){
    await require('./navigation-style-checks.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--shell')){
    await require('./shell-layout-checks.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--live-onboarding')){
    await require('./live-onboarding-readonly.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--live-broadcast')){
    await require('./live-broadcast-readonly.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--live-competition')){
    await require('./live-competition-photo.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--live-program')||process.argv.includes('--live-engagement')){
    await require('./live-program-checks.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--e2e')){
    if(!process.env.WEDDING_TEST_URL?.startsWith('http://127.0.0.1:'))throw new Error('End-to-end writes require the isolated local proxy.');
    await require('./competition-e2e-checks.cjs')({call,evaluate,errors,out});
    return;
  }
  if(process.argv.includes('--live-bridal')){
    await require('./live-bridal-train.cjs')({call,evaluate,errors,out});return;
  }
  if(process.argv.includes('--live-story-order')){
    await require('./live-story-order.cjs')({call,evaluate,errors});return;
  }
  if(process.argv.includes('--share')){
    await require('./share-browser-checks.cjs')({call,evaluate,errors,out});
    return;
  }
  if(process.argv.includes('--competitions')){
    await require('./competitions-browser-checks.cjs')({call,evaluate,errors,out});
    return;
  }
  for(let i=0;i<30;i++){
    if(await evaluate('document.querySelectorAll(".gift-fund").length>0 && !!document.getElementById("giftMoMoNumber").value')) break;
    await delay(250);
  }
  if (process.argv.includes('--dashboard') || process.argv.includes('--admin-gifts') || process.argv.includes('--gift-message')){
    await require('./admin-browser-checks.cjs')({call,evaluate,errors,out});
    return;
  }
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    const result = await evaluate(`(()=>{
      const view=document.querySelector('[data-view="gifts"]');
      const checks=[...view.querySelectorAll('.gift-fund,.gift-amount,.gift-provider,.gift-input-wrap,.gift-pay-btn')]
        .filter(e=>getComputedStyle(e).display!=='none').map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}));
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        appVisible:document.getElementById('app').getBoundingClientRect().width>0 && !gateShowing(),
        allControlsFit:checks.every(e=>e.left>=0&&e.right<=innerWidth+.5),
        fundIcons:document.querySelectorAll('.gift-fund-icon svg').length,
        providers:document.querySelectorAll('.gift-provider').length,
        readonly:document.getElementById('giftMoMoNumber').readOnly,
        adminHidden:document.getElementById('adminGiftFundsSection').classList.contains('hidden')};
    })()`);
    assert.equal(result.allControlsFit,true,'Controls overflow at '+width);
    assert.equal(result.appVisible,true,'App obscured by invitation/check-in gate');
    assert.equal(result.scrollWidth,result.width,'Horizontal overflow at '+width);
    assert.equal(result.providers,3);
    assert.equal(result.readonly,true);
    assert.equal(result.adminHidden,true);
    console.log('PASS mobile layout',JSON.stringify(result));
  }
  const behaviour = await evaluate(`(()=>{
    document.querySelector('[data-amount="500"]').click();
    document.querySelector('[data-provider="telecel"]').click();
    const ok=giftState.amount===500&&giftState.provider==='telecel';
    document.querySelector('[data-amount="200"]').click();
    document.querySelector('[data-provider="mtn"]').click();
    return {ok,hasForm:!!document.getElementById('giftForm'),hasCopy:document.querySelectorAll('[data-gift-copy]').length===2};
  })()`);
  assert.equal(behaviour.ok,true); assert.equal(behaviour.hasForm,true); assert.equal(behaviour.hasCopy,true);
  const formCheck = await evaluate(`(async()=>{
    const original=window.fetch; let payload;
    window.fetch=async(url,opts)=>{
      if(String(url)==='/api/gifts'&&opts?.method==='POST'){
        payload=JSON.parse(opts.body);
        return new Response(JSON.stringify({ok:true,id:'mock-only'}),{status:200});
      }
      return original(url,opts);
    };
    try{
      document.getElementById('giftName').value='UI test — not saved';
      document.getElementById('giftForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      for(let i=0;i<20&&!payload;i++) await new Promise(r=>setTimeout(r,50));
      await new Promise(r=>setTimeout(r,100));
      const ok=payload?.amountCents===20000&&payload?.fund===giftState.fund;
      document.getElementById('giftStatus').textContent='';
      return ok;
    }finally{window.fetch=original;}
  })()`);
  assert.equal(formCheck,true,'Confirmation form regression (request mocked, no live gift created)');
  assert.equal(errors.length,0,'Uncaught browser errors');
  /* Keep transient welcome toasts out of the design artifact only. */
  await evaluate(`(async()=>{
    document.getElementById('activityToasts')?.remove();scrollTo(0,0);
    for(let i=0;i<30&&!document.getElementById('pageLoader').classList.contains('hidden');i++)
      await new Promise(resolve=>setTimeout(resolve,50));
  })()`);
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1200,deviceScaleFactor:1,mobile:true});
  const metrics = await call('Page.getLayoutMetrics');
  const shot = await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,
    clip:{x:0,y:0,width:430,height:metrics.cssContentSize.height,scale:1}});
  const file = path.join(out,'gifts-mobile.png');
  fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
  console.log('PASS amount/provider interactions, copy controls, mocked confirmation submission and no uncaught errors');
  console.log('Screenshot:',file);
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(async()=>{
  socket?.close();
   if(chrome.exitCode===null&&chrome.signalCode===null){
     const stopped = new Promise(resolve=>chrome.once('exit',resolve));
     chrome.kill();await Promise.race([stopped,delay(5000)]);
     if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill('SIGKILL');await Promise.race([stopped,delay(5000)]);}
   }
   if(chrome.exitCode!==null||chrome.signalCode!==null)fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
});
