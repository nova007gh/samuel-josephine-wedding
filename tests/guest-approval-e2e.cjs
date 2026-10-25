const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,wait,request,out,errors,token})=>{
  const origin=await evaluate('location.origin');
  const reads=['/memories','/guestbook','/guests','/gifts','/gift-funds','/momo-settings','/competitions','/competitions/session','/competitions/notices','/guide','/vendors','/entertainment','/chat','/live-broadcast','/bridal-train','/push/vapid','/gift-payments/config'];
  const writes=['/memories','/guestbook','/rsvps','/gifts','/home-like','/story-likes','/chat/messages','/chat/uploads','/chat/presence','/memories/mine','/guestbook/mine','/push/subscribe','/gift-payments','/gift-payments/unknown/status'];
  async function denied(cookie=''){for(const p of reads)assert.equal((await request(p,{cookie,status:p.startsWith('/gift-payments')?410:403})).data.code,p.startsWith('/gift-payments')?'payments/removed':'guest/approval-required',p);for(const p of writes)assert.equal((await request(p,{cookie,method:'POST',body:{status:'approved',guestId:'e2e-approved'},status:p.startsWith('/gift-payments')?410:403})).data.code,p.startsWith('/gift-payments')?'payments/removed':'guest/approval-required',p);}
  await denied();assert.equal((await request('/guest-access')).data.status,'unverified');
  const settings=(await request('/settings')).data;for(const key of ['events','storyItems','songs','entertainment','liveBroadcast','bridalTrain','vendors'])assert.equal(Object.hasOwn(settings,key),false,'Only Home settings before approval');
  await evaluate(`setGuest({id:'e2e-approved',name:'Forged approved profile',status:'approved'});enterApp();switchView('gifts');WeddingAccess.refresh()`);await wait(`document.getElementById('guestApprovalTitle').textContent==='Verify your sign-in'`);
  assert.equal(await evaluate(`currentView==='home'&&!WeddingAccess.canUse()`),true,'Locally forged approval cannot unlock routes');
  assert.equal(await evaluate(`document.getElementById('homeCheckinLabel').textContent`),'Enter our wedding to check in','Saved profile alone cannot claim confirmed check-in');
  await evaluate(`document.getElementById('enterFromHome').click()`);
  await wait(`document.getElementById('arrivalCheckinDialog').open`);assert.equal(await evaluate(`document.getElementById('arrivalCheckinScannerHost').hidden&&document.getElementById('arrivalCheckinPassHost').hidden`),true,'Unauthenticated check-in offers sign-in, not private scanner data');
  await evaluate(`document.getElementById('arrivalCheckinPass').click()`);assert.equal(await evaluate(`document.getElementById('arrivalCheckinStatus').textContent.includes('Sign in or register first')`),true);await evaluate(`document.getElementById('arrivalCheckinSignin').click()`);
  await wait(`!document.getElementById('guestLoginScreen').classList.contains('hidden')`);
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/otp/send'))`),false,'Opening check-in does not send OTP');
  await evaluate(`enterApp()`);
  await evaluate(`(async()=>{const verified=await api('/otp/verify',{method:'POST',body:{phone:'+233240000004',code:'123456'}});const saved=await api('/guests',{method:'POST',body:{name:'New approval fixture',phone:'+233240000004',otpToken:verified.otpToken,status:'approved',attending:true}});setGuest({id:saved.id,name:'New approval fixture',status:'approved'});window.__approvalGuest=saved.id;await WeddingAccess.refresh();})()`);
  await wait(`document.getElementById('guestApprovalTitle').textContent==='Waiting for admin approval'`);
  assert.equal(await evaluate(`document.getElementById('homeCheckinLabel').textContent`),'Thanks for coming. You are checked in');
  assert.equal(await evaluate(`!document.getElementById('enterFromHome').disabled&&!document.getElementById('homeCheckinArrow').hidden`),true,'Saved pending registration can reopen the safe check-in choices, not register twice');
  await evaluate(`document.getElementById('enterFromHome').click();document.getElementById('arrivalCheckinPass').click()`);assert.equal(await evaluate(`document.getElementById('arrivalCheckinStatus').textContent.includes('Waiting for admin approval')&&document.getElementById('arrivalCheckinPassHost').hidden&&document.getElementById('guestArrivalQR').hidden`),true,'Pending guests cannot show a pass');await evaluate(`document.getElementById('arrivalCheckinClose').click()`);
  const guestId=await evaluate(`window.__approvalGuest`),cookies=(await call('Network.getCookies',{urls:[origin+'/api/guest-access']})).cookies,cookie=cookies.filter(c=>c.name==='sj_guest_session').map(c=>c.name+'='+c.value).join('; ');assert.ok(cookie);
  if(process.env.WEDDING_E2E_CHECKIN_ONLY==='1'){
    await evaluate(`WeddingAccess.refresh()`);await wait(`WeddingAccess.isCheckedIn()`);
    assert.equal(await evaluate(`document.getElementById('homeCheckinLabel').textContent`),'Thanks for coming. You are checked in');
    await evaluate(`api('/guests/logout',{method:'POST'})`);await evaluate(`WeddingAccess.refresh()`);
    await wait(`!WeddingAccess.isCheckedIn()&&document.getElementById('homeCheckinLabel').textContent==='Enter our wedding to check in'`);
    assert.equal(await evaluate(`document.getElementById('enterFromHome').disabled`),false);
    assert.deepEqual(errors,[]);console.log('PASS check-in prompt/entry, no automatic OTP send, confirmed pending registration thank-you, duplicate check-in disabled, refresh persistence and sign-out reset');return;
  }
  assert.equal((await request('/guest-access',{cookie})).data.status,'pending');await denied(cookie);
  const game=(await request('/admin/competitions',{method:'POST',admin:true,status:201,body:{title:'Approval-only fixture game',status:'active',guestIds:[],choices:[{name:'Choice A'},{name:'Choice B'}],showResults:true,commentsEnabled:true}})).data;
  await request('/competitions/'+game.id+'/vote',{method:'POST',cookie,body:{choices:[game.choices[0].id]},status:403});
  assert.equal((await request('/admin/guests',{admin:true})).data.find(g=>g.id===guestId).status,'pending','New registration cannot self-approve');
  const callback=await fetch(origin+'/api/payments/speso/test/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(callback.status,410);assert.equal((await callback.json()).code,'payments/removed','Provider callbacks cannot settle payments after retirement');
  for(const view of ['story','events','gallery','gifts','bridaltrain','chat','vendors','competitions','more']){await evaluate(`switchView(${JSON.stringify(view)})`);assert.equal(await evaluate('currentView'),'home',view+' locked');}
  assert.equal(await evaluate(`document.querySelector('[data-view="gallery"]').inert`),true);
  await evaluate(`document.querySelector('.tab[data-tab="gallery"]').click()`);assert.equal(await evaluate('currentView'),'home');
  for(const width of [320,375,430,844,1024]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<900});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Waiting Home fits '+width);}
  const pending=await call('Page.captureScreenshot',{format:'png'});try{fs.writeFileSync(path.join(out,'waiting-approval.png'),Buffer.from(pending.data,'base64'));}catch(e){if(e.code!=='ENOSPC')throw e;}
  await request('/admin/guests/'+guestId,{method:'PATCH',admin:true,body:{status:'approved'}});await evaluate(`WeddingAccess.refresh()`);await wait('WeddingAccess.canUse()');
  assert.equal(await evaluate(`document.getElementById('guestApproval').hidden&&!document.querySelector('[data-view="gallery"]').inert`),true,'Approval unlocks without re-login');
  for(const p of reads.filter(p=>p!=='/push/vapid'))await request(p,{cookie,status:p.startsWith('/gift-payments')?410:200});
  for(let i=0;i<2;i++){const vote=(await request('/competitions/'+game.id+'/vote',{method:'POST',cookie,body:{choices:[game.choices[0].id],comment:'Approved participant comment'}})).data;assert.deepEqual(vote.myChoices,[game.choices[0].id]);assert.equal(vote.results.uniqueVoters,1,'Vote retry does not double count');}
  await require('./navigation-style-checks.cjs')({call,evaluate,errors,out});
  await evaluate(`switchView('vendors')`);await wait(`currentView==='vendors'&&document.getElementById('vendorStatus').textContent===''`);
  await evaluate(`switchView('chat');document.getElementById('chatRetry').click()`);await wait(`document.getElementById('chatVerify').classList.contains('hidden')`);
  await evaluate(`document.getElementById('chatText').value='Approved guest chat fixture';document.getElementById('chatComposer').requestSubmit()`);await wait(`document.getElementById('chatStatus').textContent.includes('awaiting host approval')`);
  await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=80;c.height=50;const b=await new Promise(r=>c.toBlob(r,'image/png'));const fd=new FormData();fd.append('file',b,'approved.png');window.__approvedUpload=await api('/memories',{method:'POST',form:fd});})()`);assert.ok(await evaluate('window.__approvedUpload.id'),'Approved photo upload saves');
  const uploadId=await evaluate('window.__approvedUpload.id');await request('/admin/memories/'+uploadId,{method:'PATCH',admin:true,body:{status:'approved'}});assert.ok((await request('/memories',{cookie})).data.some(row=>row.id===uploadId),'Moderated photo appears in approved gallery');
  const message=(await request('/guestbook',{method:'POST',cookie,body:{name:'New approval fixture',message:'Approved guest fixture message'}})).data;assert.equal(message.status,'pending');await request('/admin/guestbook/'+message.id,{method:'PATCH',admin:true,body:{status:'approved'}});await request('/guestbook/'+message.id+'/like',{method:'POST',cookie,body:{delta:1}});assert.equal((await request('/guestbook',{cookie})).data.find(row=>row.id===message.id).likes,1);
  await request('/rsvps',{method:'POST',cookie,body:{name:'New approval fixture',attending:'yes'}});
  await request('/gifts',{method:'POST',cookie,body:{name:'New approval fixture',fund:'cash',amountCents:5000}});
  await evaluate(`window.__accessRealApi=api;api=(p,o)=>p==='/guest-access'?Promise.reject(new Error('Synthetic offline')):window.__accessRealApi(p,o);WeddingAccess.refresh()`);await wait(`document.getElementById('guestApprovalTitle').textContent==='Approval check unavailable'`);assert.equal(await evaluate('currentView'),'home');
  await evaluate(`api=window.__accessRealApi;WeddingAccess.refresh()`);await wait('WeddingAccess.canUse()');
  await request('/admin/guests/'+guestId,{method:'PATCH',admin:true,body:{status:'pending'}});await request('/memories',{cookie,status:403});await evaluate(`WeddingAccess.refresh()`);await wait(`!WeddingAccess.canUse()&&currentView==='home'`);assert.equal(await evaluate(`document.getElementById('guestApprovalTitle').textContent`),'Waiting for admin approval');
  await evaluate(`document.querySelector('#guestApproval [data-goto="adminlogin"]').click();document.getElementById('adminEmail').value='admin@example.test';document.getElementById('adminPassword').value='isolated-browser-only';document.getElementById('adminLoginForm').requestSubmit()`);await wait(`WeddingAccess.canUse()&&currentView==='admin'`);assert.equal(await evaluate('currentView'),'admin','Real admin login works from a pending account');
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);await WeddingAccess.refresh();})()`);await wait(`!WeddingAccess.canUse()&&currentView==='home'`);
  await request('/admin/guests/'+guestId,{method:'PATCH',admin:true,body:{status:'approved'}});await evaluate(`WeddingAccess.refresh()`);await wait('WeddingAccess.canUse()');
  await evaluate(`window.__lateAccessApi=api;window.__holdAccessOnce=true;window.__heldAccess=new Promise(resolve=>window.__releaseAccess=resolve);api=async(p,o)=>{const result=await window.__lateAccessApi(p,o);if(p==='/guest-access'&&window.__holdAccessOnce){window.__holdAccessOnce=false;window.__accessHeld=true;await window.__heldAccess;}return result;};void WeddingAccess.refresh()`);await wait('window.__accessHeld===true');
  await evaluate(`(async()=>{await api('/guests/logout',{method:'POST'});window.__releaseAccess();})()`);await wait(`document.getElementById('guestApprovalTitle').textContent==='Verify your sign-in'`);assert.equal(await evaluate('WeddingAccess.canUse()'),false,'Late approval response cannot unlock after logout');await evaluate(`api=window.__lateAccessApi`);
  await request('/memories',{cookie,status:403});
  await request('/guest-access',{cookie:'sj_guest_session='+'a'.repeat(64)}).then(r=>assert.equal(r.data.status,'unverified'));
  assert.deepEqual(errors,[]);console.log('PASS new registration pending, forged local approval rejected, anonymous/pending API lockdown, settings minimisation, admin approval/unlock/revocation, offline fail-closed, approved Chat/photo/RSVP/gift flows, retired callback boundary, admin access and larger unboxed seal across seven widths');
};
