/* Disposable preview only: no authentication or production writes. */
const assert=require('node:assert/strict');
module.exports=async({call,evaluate})=>{
  async function begin(view='home'){
    await evaluate(`document.getElementById('sjGuideDialog').close();document.getElementById('sjGuideSuggestionsEnabled').checked=false;document.getElementById('sjGuideSuggestionsEnabled').dispatchEvent(new Event('change'));document.body.classList.add('locked');new Promise(r=>setTimeout(r,30))`);
    await evaluate(`switchView(${JSON.stringify(view)});document.querySelectorAll('.activity-toast,.competition-toast').forEach(el=>el.remove());document.activeElement?.blur();document.body.classList.remove('locked');new Promise(r=>setTimeout(r,350))`);
    await evaluate(`window.__clockOffset+=301000;window.__guideIntervals[0]();new Promise(r=>setTimeout(r,80))`);
  }
  const count=()=>evaluate(`document.querySelectorAll('.sj-guide-meeting').length`);
  await begin();
  assert.equal(await count(),2,'Lifecycle fixture starts centre travel');
  await evaluate(`new Promise(r=>setTimeout(r,2600))`);
  const point=await evaluate(`(()=>{const b=document.getElementById('sjGuideLaunch');b.getAnimations().forEach(a=>a.pause());const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  assert.equal(await evaluate(`document.getElementById('sjGuideDialog').open`),true,'Real pointer click during travel opens the guide, without losing the target');
  assert.equal(await count(),0,'Click removes travel and red hearts');
  await evaluate(`document.getElementById('sjGuideClose').click();document.getElementById('sjGuideLaunchJossy').focus();document.getElementById('sjGuideDialog').dispatchEvent(new Event('close'))`);
  assert.equal(await evaluate(`document.activeElement.id`),'sjGuideLaunchJossy','Delayed close does not steal a newer focus choice');
  await evaluate(`document.getElementById('sjGuideLaunchJossy').click();document.getElementById('sjGuideDialog').dispatchEvent(new Event('close'))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-heart').length`),8,'Delayed close does not erase a reopened guide heart burst');
  await begin();
  await evaluate(`switchView('events');new Promise(r=>setTimeout(r,100))`);
  assert.equal(await count(),0,'Programmatic/native routing cancels centre travel');
  await begin();
  await evaluate(`document.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:100}));new Promise(r=>setTimeout(r,30))`);
  assert.equal(await count(),0,'Scrolling cancels centre travel');
  await begin();
  await evaluate(`window.__uploadsInFlight=1;new Promise(r=>setTimeout(r,350))`);
  assert.equal(await count(),0,'Upload beginning mid-flight cancels travel');
  await evaluate(`window.__uploadsInFlight=0`);
  await begin();
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`new Promise(resolve=>{let tries=0;const check=()=>{if(!document.querySelector('.sj-guide-meeting')||++tries>=60)resolve();else setTimeout(check,50);};check();})`);
  assert.equal(await count(),0,'Changing reduced motion mid-flight cancels travel');
  await call('Emulation.setEmulatedMedia',{features:[]});
  await begin('livebroadcast');
  assert.equal(await count(),0,'Embedded livestream view is never obscured by centre choreography');
  await begin();
  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));new Promise(r=>setTimeout(r,50))`);
  assert.equal(await count(),0,'Backgrounding cancels travel and hearts');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('sjGuideLaunch')).animationPlayState`),'paused','Edge float pauses in background');
  await evaluate(`delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));document.body.classList.add('locked');new Promise(r=>setTimeout(r,50))`);
  assert.equal(await count(),0,'Gate cleanup leaves no travel animations');
  await evaluate(`document.body.classList.remove('locked');new Promise(r=>setTimeout(r,50))`);
  console.log('PASS in-flight real click, routing, scrolling, uploads, live-player protection, hidden-page and reduced-motion lifecycle');
};
