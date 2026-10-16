const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  const expected=await evaluate(`(async()=>{const response=await api('/bridal-train');return {title:response.data.title,names:[...response.data.bridesmaids,...response.data.groomsmen].map(m=>m.name)};})()`);
  await evaluate(`switchView('story');document.querySelector('[data-view="story"] [data-goto="bridaltrain"]').click()`);
  for(let i=0;i<300;i++){if(await evaluate(`!!document.querySelector('#bridalTrainContent .bt-hero')`))break;await new Promise(r=>setTimeout(r,40));}
  assert.equal(await evaluate(`document.querySelector('#bridalTrainContent h1')?.textContent`),expected.title);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#bridalTrainContent .bt-caption h3')].map(el=>el.textContent)`),expected.names);
  await evaluate(`document.querySelector('[data-bt-jump="groomsmen"]').click()`);
  assert.equal(await evaluate(`document.activeElement.id`),'bt-heading-groomsmen');
  assert.equal(await evaluate(`document.querySelectorAll('.bt-group-nav button').length`),2);
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Live bridal page fits '+width);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.app-header')).display`),'none','Photo hero replaces separate header');
    assert.equal(await evaluate(`(()=>{const cards=[...document.querySelectorAll('.bt-section:first-of-type .bt-card')];return cards.filter(c=>Math.abs(c.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<1).length;})()`),5,'Five portraits across at '+width);
  }
  assert.equal(await evaluate(`(async()=>{const r=await fetch('/api/admin/bridal-train',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'});return r.status;})()`),process.env.WEDDING_TEST_URL?.startsWith('http://127.0.0.1:')?405:401);
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});
  for(let i=0;i<150;i++){if(await evaluate(`document.querySelector('.bt-hero-photo')?.complete&&document.querySelector('.bt-hero-photo')?.naturalWidth>0`))break;await new Promise(r=>setTimeout(r,40));}
  assert.equal(await evaluate(`document.querySelector('.bt-hero-photo')?.naturalWidth>0`),true,'Live bridal hero loads');
  await evaluate(`Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,5000))])`);
  await evaluate(`document.querySelector('.competition-toast-close')?.click();document.querySelectorAll('.activity-toast').forEach(el=>el.remove());window.scrollTo({top:0,behavior:'instant'})`);
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'live-bridal-train-mobile.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('[data-view="bridaltrain"] .back-link').click()`);
  assert.equal(await evaluate(`currentView`),'story');assert.equal(errors.length,0);
  console.log('PASS read-only live Bridal Train names/counts, current couple hero, mobile widths, Back navigation and admin guard; no live saves/uploads');
};
