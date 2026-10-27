const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,wait,request,out,errors,token})=>{
  assert.equal(await evaluate('window.__kissTickMs'),250);
  await wait(`window.WeddingCompanionActions?.ready()`);
  const advance=ms=>evaluate(`(async()=>{window.__kissOffset+=${ms};await window.WeddingCompanionActions?.refresh();window.__kissTick();await new Promise(r=>setTimeout(r,80));})()`);
  const count=()=>evaluate(`document.querySelectorAll('.sj-guide-meeting').length`);
  await evaluate(`switchView('home');document.getElementById('sjGuideSuggestionsEnabled').checked=false;document.activeElement?.blur();document.querySelectorAll('.activity-toast,.competition-toast').forEach(n=>n.remove());`);
  await advance(5000);assert.equal(await count(),2,'First meeting due five seconds after app load');
  assert.equal(await evaluate(`document.querySelectorAll('.sj-companion-love .sj-guide-heart').length`),15,'Larger burst has fifteen hearts');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sj-companion-love .sj-guide-heart')).animationDuration`),'5s, 1s','Five-second burst, one-second neon pulse');
  assert.equal(await evaluate(`document.getElementById('sjGuideLaunch').getAnimations().find(a=>a.effect.getTiming().duration===5000)!==undefined`),true);
  await evaluate(`new Promise(r=>setTimeout(r,2000))`);fs.writeFileSync(path.join(out,'neon-kiss.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`new Promise(r=>setTimeout(r,3150))`);assert.equal(await count(),0,'Effect removed at five seconds');assert.equal(await evaluate(`document.querySelector('.sj-companion-love')===null`),true);
  await advance(280000);assert.equal(await count(),0,'No early repeat');await advance(20000);assert.equal(await count(),2,'Repeat after five minutes');
  await evaluate(`document.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:10}))`);assert.equal(await count(),0,'Scroll cancels effect');
  await advance(300000);assert.equal(await count(),2);await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(`document.querySelectorAll('.sj-guide-meeting').length===0`);assert.equal(await count(),0);await advance(300000);assert.equal(await count(),0,'Reduced motion suppresses new effects');await call('Emulation.setEmulatedMedia',{features:[]});await wait(`!matchMedia('(prefers-reduced-motion: reduce)').matches`);
  await evaluate(`document.getElementById('roleProfilesOpen').click()`);await advance(300000);assert.equal(await count(),0,'Profile dialog suppresses effect');await wait(`document.getElementById('roleProfileStatus').textContent.includes('Admin: open Profile Access')`);await evaluate(`document.getElementById('roleProfileClose').click()`);
  await advance(2000);assert.equal(await count(),2);await evaluate(`window.__uploadsInFlight=1;new Promise(r=>setTimeout(r,300))`);assert.equal(await count(),0,'Upload cancels effect');await evaluate(`window.__uploadsInFlight=0`);
  // Four appearances so far; navigation/lock toggles must not reset the visit cap.
  for(let i=0;i<11;i++){await advance(300000);assert.equal(await count(),2,'Scheduled repeat '+i);await evaluate(`window.dispatchEvent(new Event('resize'));document.body.classList.add('locked');new Promise(r=>setTimeout(r,20))`);await evaluate(`document.body.classList.remove('locked');new Promise(r=>setTimeout(r,20))`);}
  await advance(300000);assert.equal(await count(),0,'Fifteen appearance cap survives gate toggles');
  await evaluate(`switchView('gallery')`);await wait(`document.querySelectorAll('.cat-thumb img').length>0`);
  assert.equal(await evaluate(`Promise.all([...document.querySelectorAll('.cat-thumb img')].map(img=>{img.loading='eager';return img.decode().then(()=>true).catch(()=>false);})).then(values=>values.every(Boolean))`),true,'Every album-cover image decodes');
  for(const width of [320,375,430,768,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<900});
    for(const view of ['gallery','story','livebroadcast','bridaltrain']){await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,250))`);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,view+' fits '+width);}
  }
  await evaluate(`switchView('livebroadcast')`);await wait(`document.querySelector('#liveBroadcastContent .showcase-hero-photo')!==null`);
  assert.equal(await evaluate(`[...document.querySelectorAll('#liveBroadcastContent .showcase-hero-photo,#liveBroadcastContent .lb-poster,.cat-thumb img,.sj-thumb img,.bt-portrait img')].every(img=>getComputedStyle(img).objectFit==='contain')`),true,'Photos use full-frame containment');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#liveBroadcastContent .showcase-hero-photo')).position`),'relative','Hero is not cropped behind title');
  await evaluate(`Promise.all([...document.querySelectorAll('#liveBroadcastContent img')].map(img=>{img.src='assets/couple-home.jpg';return img.decode();}))`);
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});await evaluate(`window.scrollTo(0,0)`);fs.writeFileSync(path.join(out,'broadcast-full-frame.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`switchView('gallery');window.scrollTo(0,0);new Promise(r=>setTimeout(r,700))`);fs.writeFileSync(path.join(out,'gallery-full-frame.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.equal((await request('/role-profiles',{admin:false,cookie:(await call('Network.getCookies',{urls:[await evaluate('location.origin')+'/api/role-profiles']})).cookies.filter(c=>c.name==='sj_guest_session').map(c=>c.name+'='+c.value).join('; ')})).data.profiles.length,0,'Visual work never creates profile assignments');
  assert.deepEqual(errors,[]);console.log('PASS first five-second kiss, five-minute repeats/15 cap, fifteen neon hearts/one-second pulses/five-second cleanup, reduced-motion/dialog/upload/scroll safety, full-frame gallery/broadcast/bridal photos and five widths; no profile grants');
};
