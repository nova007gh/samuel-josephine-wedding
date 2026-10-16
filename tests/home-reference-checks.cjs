/* Public Home styling and functional smoke test. No writes or provider loads. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`setGuest({name:'Emma'});updateGuestUI();switchView('home')`);
  await evaluate(`(async()=>{for(let i=0;i<500&&document.getElementById('couplePhoto').dataset.photoReady!=='true';i++)await new Promise(r=>setTimeout(r,40));await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))]);})()`);
  assert.equal(await evaluate(`document.querySelector('.home-eyebrow').textContent`),'WELCOME, EMMA');
  assert.equal(await evaluate(`document.getElementById('couplePhoto').naturalWidth>0&&document.getElementById('couplePhoto').dataset.photoReady==='true'`),true);
  assert.equal(await evaluate(`document.querySelectorAll('#couplePhoto').length===1&&document.querySelector('.home-hero #couplePhoto')!==null`),true);
  for(const width of [320,375,430,476,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    await evaluate(`switchView('home');window.scrollTo({top:0,behavior:'instant'});new Promise(r=>setTimeout(r,350))`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Home fits '+width);
    assert.equal(await evaluate(`(()=>{const bar=document.querySelector('.tabbar').getBoundingClientRect();return Array.from(document.querySelectorAll('.tabbar .tab')).every(el=>{const r=el.getBoundingClientRect();return r.left>=bar.left-1&&r.right<=bar.right+1;});})()`),true,'All nine tabs visible');
    assert.equal(await evaluate(`(()=>{const copy=document.querySelector('.home-hero-copy').getBoundingClientRect(),names=document.querySelector('.home-names').getBoundingClientRect();return names.left>=copy.left-1&&names.right<=copy.right+1;})()`),true,'Names fit hero');
    if(width===430){await evaluate(`document.querySelector('.competition-toast-close')?.click();document.querySelectorAll('.activity-toast').forEach(el=>el.remove())`);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'home-floral.png'),Buffer.from(shot.data,'base64'));}
    await evaluate(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});new Promise(r=>setTimeout(r,150))`);
    const height=await evaluate(`document.documentElement.scrollHeight`);await evaluate(`window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});new Promise(r=>setTimeout(r,150))`);assert.equal(await evaluate(`document.documentElement.scrollHeight`),height,'Finite Home bottom');
  }
  await evaluate(`switchView('events')`);
  assert.equal(await evaluate(`[['days','eventDays'],['hours','eventHours'],['minutes','eventMinutes'],['seconds','eventSeconds']].every(([a,b])=>document.getElementById(a).textContent===document.getElementById(b).textContent)`),true,'Countdown remains shared with Events');
  await evaluate(`switchView('home');document.querySelector('[data-view="home"] [data-goto="competitions"]').click()`);assert.equal(await evaluate(`currentView`),'competitions');
  await evaluate(`switchView('home');document.querySelector('[data-view="home"] [data-goto="livebroadcast"]').click()`);assert.equal(await evaluate(`currentView`),'livebroadcast');
  await evaluate(`switchView('home');document.querySelector('.gifts-menu-button').click()`);assert.equal(await evaluate(`currentView`),'more');
  await evaluate(`document.querySelector('.app-brand').click()`);assert.equal(await evaluate(`currentView`),'home');
  assert.equal(await evaluate(`document.querySelector('#homeHeart #homeLikeCount')!==null&&document.querySelector('#musicDock #musicToggle')!==null&&document.getElementById('retryHomePhoto')!==null`),true,'Like/music/photo recovery controls retained');
  assert.equal(errors.length,0);console.log('PASS reference-style Home at five widths, real confirmed photo, personalized welcome, finite scrolling, date sync, links/menu, nine visible tabs and retained music/heart/retry controls; no writes');
};
