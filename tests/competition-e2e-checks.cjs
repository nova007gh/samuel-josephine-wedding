const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

/* Actual HTTP API, cookies, SQLite, uploads and frontend; only request latency
   and confirmation dialogs are controlled. Never points at the live API. */
module.exports=async({call,evaluate,errors,out})=>{
  const origin=await evaluate('location.origin');
  assert.match(origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  let controllerToken;
  const request=async(p,{method='GET',body,admin=false,cookie='',status=200}={})=>{
    const response=await fetch(origin+'/api'+p,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+controllerToken}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    const data=(response.headers.get('content-type')||'').includes('json')?await response.json():await response.text();
    assert.equal(response.status,status,p+' '+JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const wait=async(expr)=>{
    for(let i=0;i<300;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,40));}
    throw new Error('End-to-end UI wait failed: '+expr);
  };
  if(process.env.WEDDING_E2E_QUICK_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./quick-onboarding-e2e.cjs')({call,evaluate,wait,request,out,errors});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_BROADCAST_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./live-broadcast-e2e.cjs')({call,evaluate,wait,request,out});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_COUNTDOWN_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./countdown-e2e-checks.cjs')({evaluate,wait,request});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_ORDER_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./story-order-e2e.cjs')({call,evaluate,wait,request,out});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_BRIDAL_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./bridal-train-e2e.cjs')({call,evaluate,wait,request,out});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_PROGRAM_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./program-e2e-checks.cjs')({call,evaluate,wait,request,out});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  if(process.env.WEDDING_E2E_ENGAGEMENT_ONLY==='1'){
    controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
    await require('./engagement-e2e-checks.cjs')({call,evaluate,wait,request,out});
    await request('/admin/logout',{method:'POST',admin:true});return;
  }
  await require('./page-actions-checks.cjs')({evaluate,wait});
  await evaluate(`switchView('adminlogin');document.getElementById('adminEmail').value='test@example.com';document.getElementById('adminPassword').value='incorrect-test-password';document.getElementById('adminLoginForm').requestSubmit()`);
  await wait(`document.getElementById('adminLoginError').textContent.includes('Incorrect')&&!document.querySelector('#adminLoginForm [type="submit"]').disabled`);
  await evaluate(`(()=>{const original=api;window.__loginReads=0;api=async(p,o)=>{if(p==='/admin/login')window.__loginReads++;return original(p,o);};document.getElementById('adminPassword').value='isolated-browser-only';const form=document.getElementById('adminLoginForm');form.requestSubmit();form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));window.__loginOriginalApi=original;})()`);
  await wait(`isAdmin()&&document.querySelector('.view:not(.hidden)').dataset.view==='admin'`);
  assert.equal(await evaluate('window.__loginReads'),1,'Admin form ignores duplicate submission');
  assert.equal(await evaluate(`document.getElementById('adminPassword').value===''&&!document.getElementById('adminLoginForm').hasAttribute('aria-busy')`),true);
  await evaluate(`api=window.__loginOriginalApi;switchView('admincompetitions');window.__e2e={}`);
  controllerToken=(await request('/admin/login',{method:'POST',body:{password:'isolated-browser-only'}})).data.token;
  const gallerySubmissions=(await request('/admin/memories',{admin:true})).data.filter(m=>m.caption==='Isolated gallery action test');
  assert.equal(gallerySubmissions.length,1,'Gallery double event writes only one actual API record');
  assert.equal(gallerySubmissions[0].status,'pending','Guest upload requires admin review');
  await require('./voice-recording-checks.cjs')({call,evaluate,wait,request});
  await evaluate(`switchView('admincompetitions')`);
  await wait(`document.querySelector('#competitionAdminBrowse [data-comp-action="create"]')!==null`);
  // A delayed real guest-list response must not allow two editor initialisations.
  await evaluate(`(()=>{const original=api;window.__e2e.originalApi=original;window.__e2e.guestReads=0;const held=new Promise(r=>window.__e2e.releaseEditor=r);
    api=async(p,o)=>{const result=await original(p,o);if(p==='/admin/guests'){window.__e2e.guestReads++;await held;}return result;};
    const button=document.querySelector('[data-comp-action="create"]');button.click();button.click();})()`);
  await wait(`window.__e2e.guestReads>0`);
  assert.equal(await evaluate('window.__e2e.guestReads'),1,'Repeated Create clicks must not start multiple editor requests');
  await evaluate(`window.__e2e.releaseEditor();api=window.__e2e.originalApi`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  await evaluate(`(async()=>{const f=document.getElementById('competitionEditor');f.elements.title.value='E2E Verified Voting';f.elements.description.value='Real API and cookies';f.elements.commentsEnabled.checked=true;
    const names=f.querySelectorAll('[data-choice-name]');names[0].value='Choice One';names[1].value='Choice Two';f.dispatchEvent(new Event('input',{bubbles:true}));
    const dt=new DataTransfer();const canvas=document.createElement('canvas');canvas.width=40;canvas.height=80;canvas.getContext('2d').fillRect(0,0,40,80);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    dt.items.add(new File([blob],'e2e.png',{type:'image/png'}));const input=f.querySelector('[data-photo-target="cover"] input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('[data-photo-target="cover"]').dataset.photoUrl.startsWith('/uploads/')&&!document.querySelector('#competitionEditor [type="submit"]').disabled`);
  await wait(`document.querySelector('[data-photo-target="cover"] img').naturalWidth>0`);
  await evaluate(`document.querySelector('#competitionEditor button[value="draft"]').click()`);
  await wait(`document.querySelector('#competitionAdminManage h2')?.textContent==='E2E Verified Voting'`);
  const verifiedId=await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="edit"]').dataset.id`);
  await request('/competitions/'+verifiedId,{status:404});
  // Hold a real list snapshot from before publish and release it afterwards.
  await evaluate(`(()=>{const original=api;window.__e2e.originalApi=original;window.__e2e.listHeld=false;const held=new Promise(r=>window.__e2e.releaseList=r);
    api=async(p,o)=>{const result=await original(p,o);if(p==='/admin/competitions'&&!window.__e2e.listHeld){window.__e2e.listHeld=true;await held;}return result;};window.__listRetry=setInterval(()=>window.dispatchEvent(new CustomEvent('wedding:view')),100);window.dispatchEvent(new CustomEvent('wedding:view'));})()`);
  await wait('window.__e2e.listHeld');
  await evaluate(`clearInterval(window.__listRetry)`);
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="publish"]').click()`);
  await wait(`document.querySelector('#competitionAdminManage .comp-badge')?.textContent==='active'`);
  await evaluate(`window.__e2e.releaseList();api=window.__e2e.originalApi`);
  await new Promise(r=>setTimeout(r,300));
  assert.equal(await evaluate(`document.querySelector('#competitionAdminManage .comp-badge').textContent`),'active','Old polling replies cannot undo a published state on screen');
  const withPhotos=(await request('/admin/competitions/'+verifiedId,{admin:true})).data.config;
  await request('/admin/competitions/'+verifiedId,{admin:true,method:'PATCH',body:{choices:withPhotos.choices.map(x=>({...x,photoUrl:withPhotos.coverUrl}))}});
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);switchView('competitions');})()`);
  await wait(`!!document.querySelector('#competitionList [data-id="${verifiedId}"]')`);
  await evaluate(`document.querySelector('#competitionList [data-id="${verifiedId}"]').click()`);
  await wait(`!!document.querySelector('#competitionDetail [data-comp-action="verify"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('#competitionDetail [name="competition-choice"]:disabled').length`),2);
  await wait(`document.querySelector('#competitionDetail .comp-photo-button--cover').dataset.photoState==='ready'`);
  await evaluate(`document.querySelector('#competitionDetail .comp-photo-button--cover img').dispatchEvent(new Event('error'))`);
  assert.equal(await evaluate(`document.querySelector('#competitionDetail .comp-photo-button--cover').textContent.includes('Tap to retry')`),true,'Failed photo has explicit recovery control');
  await evaluate(`document.querySelector('#competitionDetail .comp-photo-button--cover').click()`);
  await wait(`document.querySelector('#competitionDetail .comp-photo-button--cover').dataset.photoState==='ready'`);
  assert.equal(await evaluate(`document.querySelector('#competitionDetail .comp-photo-button--cover img').src.includes('photoRetry=')&&document.getElementById('lightbox').classList.contains('hidden')`),true,'Retry loads the photo without casting a vote or opening broken media');
  await evaluate(`document.querySelector('#competitionDetail .comp-choice [data-comp-action="photo"]').focus();document.querySelector('#competitionDetail .comp-choice [data-comp-action="photo"]').click()`);
  await wait(`!document.getElementById('lightbox').classList.contains('hidden')&&document.querySelector('#lightboxBody img')?.naturalHeight===80`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#lightboxBody img')).objectFit==='contain'&&document.querySelector('#lightboxBody img').naturalWidth===40&&document.activeElement.id==='lightboxClose'`),true,'Original portrait opens fully in fullscreen viewer even when voting is locked');
  await evaluate(`document.getElementById('lightboxClose').click()`);
  assert.equal(await evaluate(`document.activeElement.matches('.comp-choice [data-comp-action="photo"]')&&!document.querySelector('#competitionDetail [name="competition-choice"]:checked')`),true,'Viewing a photo does not select a contestant; closing restores focus');
  await evaluate(`document.querySelector('#competitionDetail [data-comp-action="verify"]').click()`);
  await wait(`gateShowing()&&document.getElementById('returnPhone')===document.activeElement`);
  assert.equal(await evaluate(`gateShowing()&&document.getElementById('returnPhone')===document.activeElement`),true,'Verification action opens and focuses the guest sign-in screen');
  await evaluate(`enterApp();switchView('competition')`);
  await evaluate(`(async()=>{const r=await guestLogin('+233240000001','123456');setGuest(r.guest);enterApp();})()`);
  await wait(`!!document.getElementById('competitionSubmit')`);
  await evaluate(`(()=>{const input=document.querySelector('[name="competition-choice"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('competitionComment').value='Verified guest blessing';document.getElementById('competitionSubmit').click();document.getElementById('competitionSubmit').dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
  await wait(`!!document.querySelector('#competitionDetail .comp-success')`);
  assert.equal((await request('/competitions/'+verifiedId)).data.results.totalVotes,1);
  assert.equal((await request('/competitions/'+verifiedId)).data.comments.length,0);
  await evaluate(`(async()=>{await adminSignIn('', 'isolated-browser-only');switchView('admincompetitions');})()`);
  await wait(`!!document.querySelector('#competitionAdminList [data-id="${verifiedId}"]')`);
  await evaluate(`document.querySelector('#competitionAdminList [data-id="${verifiedId}"]').click();document.querySelector('#competitionAdminManage [data-comp-action="voters"]').click()`);
  await wait(`document.getElementById('competitionVoters').textContent.includes('e2e-approved')`);
  await evaluate(`document.querySelector('#competitionVoters [data-comp-action="approve-comment"]').click()`);
  await wait(`document.getElementById('competitionVoters').textContent.includes('approved')&&!document.getElementById('competitionVoters').textContent.includes('pending')`);
  assert.equal((await request('/competitions/'+verifiedId)).data.comments[0].text,'Verified guest blessing');
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="edit"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.getElementById('competitionEditor').elements.requireVerified.disabled`),true);
  await evaluate(`document.getElementById('competitionEditor').elements.showResults.checked=false;document.querySelector('#competitionEditor .comp-btn--gold[type="submit"]').click()`);
  await wait(`document.getElementById('competitionEditor').classList.contains('hidden')`);
  assert.equal((await request('/competitions/'+verifiedId)).data.results,null);
  assert.equal((await request('/admin/competitions/'+verifiedId,{admin:true})).data.results.totalVotes,1);
  // Optional verification is saved through the UI and voted through real cookies.
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="browse"]').click();document.querySelector('[data-comp-action="create"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  await evaluate(`(()=>{const f=document.getElementById('competitionEditor');f.elements.title.value='E2E Browser Voting';const names=f.querySelectorAll('[data-choice-name]');names[0].value='Male';names[1].value='Female';f.elements.requireVerified.checked=false;f.elements.allowChange.checked=true;f.elements.commentsEnabled.checked=true;f.dispatchEvent(new Event('input',{bubbles:true}));f.querySelector('button[value="active"]').click();})()`);
  await wait(`document.querySelector('#competitionAdminManage h2')?.textContent==='E2E Browser Voting'`);
  const optionalId=await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="edit"]').dataset.id`);
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);await api('/guests/logout',{method:'POST'});setGuest({name:'Unverified E2E Preview'});enterApp();switchView('competitions');})()`);
  await wait(`!!document.querySelector('#competitionList [data-id="${optionalId}"]')`);
  await evaluate(`document.querySelector('#competitionList [data-id="${optionalId}"]').click()`);
  await wait(`!!document.getElementById('competitionSubmit')`);
  assert.equal(await evaluate(`document.querySelector('#competitionDetail [data-comp-action="verify"]')===null`),true);
  const browserChoice=(await request('/competitions/'+optionalId)).data.choices[0].id;
  const otherBrowser=(await request('/competitions/'+optionalId)).cookie;
  await evaluate(`(()=>{const input=document.querySelector('[name="competition-choice"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('competitionComment').value='Preserved draft';document.getElementById('competitionComment').focus();})()`);
  await request('/competitions/'+optionalId+'/vote',{method:'POST',cookie:otherBrowser,body:{choices:[browserChoice]}});
  await evaluate(`window.dispatchEvent(new CustomEvent('wedding:view'))`);
  await wait(`document.querySelector('#competitionResults .comp-totals').textContent.includes('1')`);
  assert.equal(await evaluate(`document.getElementById('competitionComment').value==='Preserved draft'&&document.activeElement.id==='competitionComment'&&!!document.querySelector('[name="competition-choice"]:checked')`),true,'Live rankings preserve comment focus and selected ballot');
  await evaluate(`document.getElementById('competitionSubmit').click()`);
  await wait(`!!document.querySelector('#competitionDetail .comp-success')`);
  assert.equal((await request('/competitions/'+optionalId)).data.results.totalVotes,2);
  assert.equal(await evaluate(`document.getElementById('competitionResults').textContent.includes('Voting Browsers')`),true);
  assert.equal((await request('/admin/competitions/'+optionalId,{admin:true})).data.config.requireVerified,false);
  await request('/admin/competitions/'+optionalId,{admin:true,method:'PATCH',body:{status:'paused'}});
  await evaluate(`document.getElementById('competitionSubmit').click()`);
  await wait(`document.querySelector('#competitionDetail .comp-badge')?.textContent==='paused'&&document.getElementById('competitionSubmit')===null`);
  await request('/admin/competitions/'+optionalId,{admin:true,method:'PATCH',body:{status:'active'}});
  await evaluate(`window.dispatchEvent(new CustomEvent('wedding:view'))`);
  await wait(`!!document.getElementById('competitionSubmit')`);
  await request('/admin/competitions/'+optionalId,{admin:true,method:'DELETE'});
  await evaluate(`document.getElementById('competitionSubmit').click()`);
  await wait(`document.querySelectorAll('#competitionDetail [name="competition-choice"]').length===0&&document.getElementById('competitionDetail').textContent.includes('not found')`);
  assert.equal(errors.length,0,'Uncaught end-to-end browser exceptions');
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:950,deviceScaleFactor:1,mobile:true});
  await evaluate(`switchView('competitions')`);
  await new Promise(r=>setTimeout(r,700));
  assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth&&!gateShowing()`),true);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'isolated-e2e-preview.png'),Buffer.from(shot.data,'base64'));
  await require('./countdown-e2e-checks.cjs')({evaluate,wait,request});
  await request('/admin/logout',{method:'POST',admin:true});
  console.log('PASS real-browser/real-API end-to-end: editor races, photo upload/render, draft/publish, stale polling, verified OTP session/vote, duplicate guard, moderation/privacy, optional cookie ballots, live selection preservation, pause feedback and deleted-game recovery (disposable database; OTP delivery not tested)');
};
