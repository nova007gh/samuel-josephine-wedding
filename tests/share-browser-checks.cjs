const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

/* Deployed UI controls with mock notification/install/upload/logout operations. */
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`(()=>{
    const original=api;
    api=async(p,opts={})=>{
      if(p.startsWith('/admin/')||p==='/competitions/notices')return [];
      return original(p,opts);
    };
    setGuest({id:'share-preview',name:'Share Preview'});setAdminToken(null);switchView('more');
  })()`);
  const wait=async expr=>{
    for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,30));}
    throw new Error('Timed out: '+expr);
  };
  assert.equal(await evaluate(`document.querySelectorAll('[data-view="more"] [data-goto="bridaltrain"],[data-view="more"] [data-goto="livebroadcast"],[data-view="more"] [data-goto="memories"]').length`),0,'Moved and removed shortcuts are absent from Share Moments');
  for(const target of ['memories','more']){
    await evaluate(`switchView('gallery');document.querySelector('[data-view="gallery"] [data-goto="${target}"]').click()`);
    assert.equal(await evaluate(`currentView`),target,'Gallery opens '+target);
    await evaluate(`document.querySelector('[data-view="${target}"] .back-link').click()`);
    assert.equal(await evaluate(`currentView`),'gallery','Back returns to Gallery');
  }
  for(const target of ['bridaltrain','livebroadcast']){
    await evaluate(`document.querySelector('.tabbar [data-tab="${target}"]').click()`);
    assert.equal(await evaluate(`currentView`),target,'Dedicated tab retained');
  }
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});
    await evaluate(`switchView('gallery')`);
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Gallery sharing fits '+width);
  }
  for(const admin of [false,true]){
    await evaluate(`setAdminToken(${admin?"'share-mock-admin'":'null'});switchView('more');if(isAdmin())document.getElementById('songLabel').textContent='Happy Tears '+('VeryLongUnbrokenSongFilename'.repeat(12))+'.mp3'`);
    for(const width of [320,375,430,1024]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
      const layout=await evaluate(`(()=>{
        const view=document.querySelector('[data-view="more"]');
        const visible=e=>e.getBoundingClientRect().width>0;
        return {appVisible:!gateShowing()&&visible(document.getElementById('app')),noOverflow:document.documentElement.scrollWidth===innerWidth,
          controlsFit:[...view.querySelectorAll('button')].filter(visible).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+.5;}),
          correctAdminVisibility:visible(view.querySelector('.admin-only'))===isAdmin(),songVisibility:visible(document.getElementById('songMenuItem'))===isAdmin(),
          signOutLabel:document.querySelector('#guestSignOut strong').textContent===(isAdmin()?'Sign Out Admin':'Sign Out')};
      })()`);
      for(const [name,ok]of Object.entries(layout))assert.equal(ok,true,name+' '+admin+' '+width);
      console.log('PASS Share',admin?'admin':'guest','layout',width,'pixels');
    }
  }
  const routing=await evaluate(`(()=>{
    const tabs=[...document.querySelectorAll('.tabbar .tab')];
    const checks=tabs.map(tab=>{tab.click();return {name:tab.dataset.tab,correct:document.querySelector('.view:not(.hidden)').dataset.view===tab.dataset.tab&&tab.classList.contains('active')};});
    switchView('more');
    const menu=[...document.querySelectorAll('[data-view="more"] [data-goto]')].map(button=>{
      button.click();const target=button.dataset.goto==='adminlogin'&&isAdmin()?'admin':button.dataset.goto;
      const correct=document.querySelector('.view:not(.hidden)').dataset.view===target;switchView('more');return {target,correct};
    });
    document.querySelector('.app-brand').click();const brandHome=document.querySelector('.view:not(.hidden)').dataset.view==='home';switchView('more');
    return {checks,menu,brandHome};
  })()`);
  assert.deepEqual(routing.checks.map(x=>x.name),['home','story','events','bridaltrain','gallery','livebroadcast','gifts']);assert.ok(routing.checks.every(x=>x.correct));assert.ok(routing.menu.every(x=>x.correct));assert.equal(routing.brandHome,true);
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    const routes=await evaluate(`(()=>{const checks=[...document.querySelectorAll('.tabbar .tab')].map(tab=>{tab.click();return {name:tab.dataset.tab,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};});switchView('more');return checks;})()`);
    for(const route of routes)assert.equal(route.scrollWidth,route.width,route.name+' overflow at '+width);
    console.log('PASS seven main page widths',width,'pixels');
  }
  const calendar=await evaluate(`(()=>{
    const before=window.weddingDetails;
    try{
      window.weddingDetails={weddingDateISO:'2027-01-09T10:00:00Z',weddingFormal:'Sam, Jossy; Forever'+String.fromCharCode(10)+'BEGIN:BAD',weddingVenue:'Accra, Ghana',weddingHashtag:'❤'.repeat(100),events:'[{"name":"Wedding","time":"10 AM"}]'};
      const first=buildICS(),second=buildICS();
      const encoder=new TextEncoder();
      const valid=first.includes('DTSTART:20270109T100000Z')&&first.includes('SUMMARY:Sam'+String.fromCharCode(92)+', Jossy'+String.fromCharCode(92)+'; Forever'+String.fromCharCode(92)+'nBEGIN:BAD')
        &&!first.includes(String.fromCharCode(13,10)+'BEGIN:BAD')&&first.split(String.fromCharCode(13,10)).every(line=>encoder.encode(line).length<=75);
      const stable=first.match(/UID:(.+)/)[1]===second.match(/UID:(.+)/)[1];
      window.weddingDetails.weddingDateISO='invalid';document.getElementById('addToCalendar').click();
      const invalidHandled=document.getElementById('shareActionStatus').textContent.includes('Wedding date is invalid');
      return {valid,stable,invalidHandled};
    }finally{window.weddingDetails=before;}
  })()`);
  for(const [name,ok]of Object.entries(calendar))assert.equal(ok,true,'calendar '+name);
  for(const result of ['on','denied','dismissed','unsupported','error']){
    await evaluate(`window.__originalEnableNotifications ||= enableNotifications;enableNotifications=async()=>${JSON.stringify(result)};document.getElementById('notifToggle').click()`);
    await wait(`!document.getElementById('notifToggle').disabled`);
    const label=await evaluate(`document.getElementById('notifStatus').textContent`);
    assert.ok(label.includes({on:'registered',denied:'Blocked',dismissed:'Not enabled',unsupported:'Not available',error:'Could not connect'}[result]),'notification '+result);
  }
  await evaluate(`(()=>{window.__notifCalls=0;enableNotifications=()=>{window.__notifCalls++;return new Promise(r=>window.__releaseNotif=r);};document.getElementById('notifToggle').click();document.getElementById('notifToggle').dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
  assert.equal(await evaluate('window.__notifCalls'),1,'Notification duplicate guard');
  await evaluate(`window.__releaseNotif('on');enableNotifications=window.__originalEnableNotifications`);
  await wait(`!document.getElementById('notifToggle').disabled`);
  await evaluate(`document.getElementById('installButton').click()`);
  assert.equal(await evaluate(`!document.getElementById('installHelpSheet').classList.contains('hidden')&&document.getElementById('installHelpSheet').textContent.includes('iPhone / iPad')`),true,'Install fallback');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal(await evaluate(`document.getElementById('installHelpSheet').classList.contains('hidden')&&!gateShowing()&&document.activeElement.id==='installButton'`),true,'Install Escape/focus restore');
  await evaluate(`(()=>{window.__promptCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.__promptCalls++;};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);document.getElementById('installButton').click();})()`);
  await wait(`!document.getElementById('installButton').disabled`);
  assert.equal(await evaluate(`window.__promptCalls===1&&document.getElementById('shareActionStatus').textContent.includes('cancelled')&&!document.getElementById('installButton').classList.contains('hidden')`),true,'Native install cancellation remains actionable');
  const song=await evaluate(`(async()=>{
    const oldUpload=uploadSiteSong,oldLoad=loadSong;
    const input=document.getElementById('songUpload'),oldClick=input.click;
    const status=document.getElementById('shareActionStatus');let picker=false,calls=0,release;
    const held=new Promise(r=>release=r);
    try{
      input.click=()=>{picker=true;};document.getElementById('songMenuItem').click();
      uploadSiteSong=async(file,label,onProgress)=>{calls++;onProgress(43);await held;onProgress(100);return {};};
      loadSong=async()=>{document.getElementById('songLabel').textContent='Mock Wedding Song.mp3';};
      const file=new File(['mock'],'mock.mp3',{type:'audio/mpeg'});
      const pending=saveSong(file);saveSong(file);
      const uploading=document.getElementById('songLabel').textContent==='Uploading song 43%…'&&document.getElementById('songMenuItem').disabled&&calls===1;
      release();await pending;
      const restored=!document.getElementById('songMenuItem').disabled&&document.getElementById('songLabel').textContent==='Mock Wedding Song.mp3';
      uploadSiteSong=async()=>{throw new Error('Simulated upload failure');};await saveSong(file);
      const errorHandled=status.textContent==='Simulated upload failure'&&!document.getElementById('songMenuItem').disabled;
      return {picker,uploading,restored,errorHandled};
    }finally{uploadSiteSong=oldUpload;loadSong=oldLoad;input.click=oldClick;}
  })()`);
  for(const [name,ok]of Object.entries(song))assert.equal(ok,true,'song '+name);
  await evaluate(`(async()=>{const before=window.confirm;window.confirm=()=>true;document.getElementById('guestSignOut').click();for(let i=0;i<50&&isAdmin();i++)await new Promise(r=>setTimeout(r,20));window.confirm=before;})()`);
  assert.equal(await evaluate(`!isAdmin()&&getGuest().id==='share-preview'&&document.querySelector('.view:not(.hidden)').dataset.view==='more'`),true,'Share admin sign-out preserves guest');
  await evaluate(`window.dispatchEvent(new Event('appinstalled'))`);
  assert.equal(await evaluate(`document.getElementById('installButton').classList.contains('hidden')`),true,'Hide install after installed');
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});
  await evaluate(`(async()=>{document.getElementById('shareActionStatus').textContent='';document.getElementById('activityToasts').replaceChildren();switchView('more');await new Promise(r=>setTimeout(r,700));scrollTo(0,0);})()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'share-guest-preview.png'),Buffer.from(shot.data,'base64'));
  assert.equal(errors.length,0,'Uncaught browser exceptions');
  console.log('PASS seven main routes/Gallery sharing links, calendar escaping/folding/stable event/error handling, notification states/duplicate guard, install help/native cancellation, song picker/progress/failure and admin sign-out (operations mocked)');
};
