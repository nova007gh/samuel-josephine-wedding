const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
exports.setup=async({call})=>{
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.setItem('sj_guest',JSON.stringify({name:'Refresh preview'}));localStorage.setItem('sj_entered','1');
    localStorage.setItem('sj_site_photos',JSON.stringify({couple:location.origin+'/assets/couple-home.jpg','admin-heart':location.origin+'/assets/couple-home.jpg'}));
    window.__settingsHeld=new Promise(r=>window.__releaseSettings=r);window.__settingsRequests=0;window.__oldPhotoPaints=[];
    const originalFetch=window.fetch;
    window.fetch=async(input,options)=>{
      if(String(input).includes('/api/settings')){
        window.__settingsRequests++;await window.__settingsHeld;
        if(localStorage.getItem('sj_refresh_offline')==='1')throw new TypeError('Offline test');
        return new Response(JSON.stringify({couplePhotoUrl:'/assets/seal-logo.png?current=1','photo:admin-heart':'/assets/seal-logo.png?current=1'}),{headers:{'Content-Type':'application/json'}});
      }
      return originalFetch(input,options);
    };
    const inspect=()=>{document.querySelectorAll('img').forEach(img=>{if(img.src.includes('couple-home.jpg')&&getComputedStyle(img).opacity!=='0'&&img.getBoundingClientRect().height)window.__oldPhotoPaints.push(img.src);});requestAnimationFrame(inspect);};requestAnimationFrame(inspect);
  `});
};
exports.check=async({call,evaluate,errors,out})=>{
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const wait=async(expression)=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await delay(40);}throw new Error('Refresh wait failed: '+expression);};
  await wait(`window.__settingsRequests>0&&typeof switchView==='function'`);
  await evaluate(`switchView('home')`);
  await delay(350);
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('couplePhoto')).opacity`),'0','No couple photo paints before settings');
  assert.equal(await evaluate(`document.getElementById('couplePhoto').src.includes('photo-placeholder.svg')`),true,'Old stored photo map is not assigned');
  assert.equal(await evaluate(`window.__oldPhotoPaints.length`),0);
  await evaluate(`window.__releaseSettings()`);
  await wait(`document.getElementById('couplePhoto').dataset.photoReady==='true'&&document.getElementById('couplePhoto').naturalWidth>0`);
  assert.equal(await evaluate(`document.getElementById('couplePhoto').src.endsWith('seal-logo.png?current=1')`),true,'Fresh settings determine displayed photo');
  await evaluate(`flashPageLoader()`);await delay(220);await evaluate(`flashPageLoader()`);await delay(200);
  assert.equal(await evaluate(`!document.getElementById('pageLoader').classList.contains('hidden')`),true,'Previous loader hide timer cannot interrupt new transition');
  await delay(260);
  assert.equal(await evaluate(`document.getElementById('pageLoader').classList.contains('hidden')`),true);
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate(`switchView('events')`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-view="events"]')).animationName==='none'&&document.getElementById('pageLoader').classList.contains('hidden')`),true,'Reduced motion disables transition effects');
  await evaluate(`localStorage.setItem('sj_refresh_offline','1')`);
  await call('Page.reload',{ignoreCache:true});
  await wait(`window.__settingsRequests>0&&typeof switchView==='function'`);
  await evaluate(`window.__releaseSettings();switchView('home')`);await delay(450);
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('couplePhoto')).opacity==='0'&&window.__oldPhotoPaints.length===0`),true,'Failed settings do not reveal stale or bundled photo');
  await evaluate(`localStorage.removeItem('sj_refresh_offline');syncSiteSettings()`);
  await wait(`document.getElementById('couplePhoto').dataset.photoReady==='true'`);
  await delay(250);
  assert.equal(await evaluate(`window.__oldPhotoPaints.length`),0);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'refresh-current-photo.png'),Buffer.from(shot.data,'base64'));
  assert.equal(errors.length,0,'No uncaught refresh errors');
  console.log('PASS delayed fresh settings, stale photo-map rejection, loaded-image reveal, rapid loader transitions, reduced motion, refresh/offline neutral state and photo recovery (settings mocked; no live writes)');
};
exports.checkLive=async({call,evaluate,errors,out})=>{
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  for(let pass=0;pass<2;pass++){
    if(pass){await call('Page.reload',{ignoreCache:true});await delay(700);}
    let ready=false;
    for(let i=0;i<250;i++){
      if(await evaluate(`typeof photosConfirmed!=='undefined'&&photosConfirmed&&document.getElementById('couplePhoto')?.dataset.photoReady==='true'&&document.getElementById('couplePhoto').naturalWidth>0`)){ready=true;break;}
      await delay(60);
    }
    assert.equal(ready,true,'Current live Home photo loads on initial visit/reload');
    await evaluate(`switchView('home')`);
    assert.equal(await evaluate(`(async()=>{const fresh=await getSettings();const expected=new URL(fresh.couplePhotoUrl||'assets/photo-placeholder.svg',location.href).href;return document.getElementById('couplePhoto').currentSrc===expected;})()`),true,'Displayed photo matches live settings');
    assert.equal(await evaluate(`!document.querySelector('img[src="assets/couple-home.jpg"]')&&!localStorage.getItem('sj_site_photos')`),true,'No bundled couple startup image or legacy photo map');
  }
  await delay(500);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'live-refresh-home.png'),Buffer.from(shot.data,'base64'));
  assert.equal(errors.length,0,'No uncaught live refresh exceptions');
  console.log('PASS read-only live initial visit/reload, current Home photo matches server settings, legacy photo map retired and no bundled couple startup source');
};
