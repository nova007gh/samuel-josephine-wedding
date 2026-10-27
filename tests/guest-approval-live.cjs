const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  for(let i=0;i<100;i++){if(await evaluate(`document.getElementById('guestApprovalTitle')?.textContent==='Verify your sign-in'`))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(await evaluate(`!WeddingAccess.canUse()&&currentView==='home'`),true,'Saved preview profile cannot bypass approval');
  assert.equal(await evaluate(`document.getElementById('homeCheckinLabel').textContent`),'Enter Our Wedding to Check In','Unverified session shows check-in prompt, not false confirmation');
  assert.equal(await evaluate(`document.getElementById('guestArrivalCard').hidden&&document.getElementById('guestArrivalQR').hidden&&document.getElementById('arrivalGuestList').textContent===''`),true,'No private pass, table or entrance guest list before approved sign-in');
  assert.equal(await evaluate(`document.querySelector('[data-view="home"] #guestArrivalCard')===null&&document.getElementById('guestPassStorage').hidden`),true,'Entrance pass is not on Home');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('homeLikeCount')).display==='none'&&document.getElementById('arrivalAdminCounts').hidden&&document.getElementById('arrivalStats').textContent===''&&document.querySelector('#arrivalCheckinDialog #arrivalStats')===null`),true,'Public Home/dialog contain no count badge or arrival totals');
  assert.equal(await evaluate(`document.getElementById('guestDetailsList').textContent===''&&document.getElementById('guestDetailsIdentity').textContent===''&&document.getElementById('guestDetailsActivities').textContent===''`),true,'Private admin dossier is empty before admin sign-in');
  for(const p of ['/api/admin/guest-details','/api/admin/guest-details/not-a-guest'])assert.equal(await evaluate(`fetch(${JSON.stringify(p)}).then(r=>r.status===401&&r.headers.get('cache-control').includes('no-store'))`),true,'Live guest-details route requires admin and is not cached');
  assert.equal(await evaluate(`fetch('/api/admin/companion-actions').then(r=>r.status===401&&r.headers.get('cache-control').includes('no-store'))`),true,'AI Actions plan is admin-only/no-store');
  assert.equal(await evaluate(`fetch('/api/companion-actions').then(r=>r.status===403&&r.headers.get('cache-control').includes('no-store'))`),true,'Unverified guests cannot read scheduled announcements');
  assert.equal(await evaluate(`document.getElementById('aiActionsRows').textContent===''&&document.getElementById('aiActionsPreviewHost').textContent===''&&document.querySelector('.companion-action-toast')===null`),true,'No private plan/preview or scheduled notice before approval');
  assert.equal(await evaluate(`document.querySelector('[data-view="home"] #roleProfilesOpen')===null&&document.getElementById('roleProfilesOpen').closest('#guestLoginScreen')!==null`),true,'Team login is on the login screen, not Home');
  for(const [p,status]of [['/api/admin/tables-food',401],['/api/food-menu',403]])assert.equal(await evaluate(`fetch(${JSON.stringify(p)}).then(r=>r.status===${status}&&r.headers.get('cache-control').includes('no-store'))`),true,'Tables/Food privacy guard '+p);
  assert.equal(await evaluate(`document.getElementById('tablesFoodTables').textContent===''&&document.getElementById('tablesFoodGuest').textContent===''&&document.getElementById('foodMenuSections').textContent===''`),true,'No private table/contact list or unpublished menu before approval');
  for(const view of ['story','events','gallery','gifts','chat','vendors','competitions','bridaltrain','foodmenu']){await evaluate(`switchView(${JSON.stringify(view)})`);assert.equal(await evaluate('currentView'),'home');}
  await evaluate(`document.querySelector('.tab[data-tab="gallery"]').click()`);assert.equal(await evaluate('currentView'),'home');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sj-guide-launch')).display`),'none','Guide locked before approval');
  assert.equal(await evaluate(`document.querySelector('[data-view="gallery"]').inert`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab-seal')).filter.includes('255, 184, 41')`),true,'Neon golden halo follows the seal');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`(()=>{const css=getComputedStyle(document.querySelector('.tab-seal'));return css.animationName==='none'&&css.filter.includes('255, 184, 41');})()`),true,'Reduced motion retains static golden glow');
  await call('Emulation.setEmulatedMedia',{features:[]});
  await evaluate(`document.getElementById('enterFromHome').click();document.getElementById('arrivalCheckinPass').click()`);
  assert.equal(await evaluate(`document.getElementById('arrivalCheckinDialog').open&&document.getElementById('arrivalCheckinStatus').textContent.includes('Sign in or register first')&&document.getElementById('arrivalCheckinPassHost').hidden&&document.getElementById('arrivalCheckinScannerHost').hidden&&document.getElementById('arrivalVideo').srcObject===null`),true,'Public check-in choices do not open camera or expose QR/admin data');
  for(const width of [320,375,390,430,768,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<900});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Welcome gate fits '+width);
    assert.equal(await evaluate(`(()=>{const d=document.getElementById('arrivalCheckinDialog'),r=d.getBoundingClientRect();return d.scrollWidth<=d.clientWidth+1&&r.left>=0&&r.right<=innerWidth+1&&r.height<=innerHeight;})()`),true,'Check-in choices fit '+width);
    assert.equal(await evaluate(`(()=>{const seal=document.querySelector('.tab--center .tab-seal'),button=seal.closest('button'),css=getComputedStyle(seal);return parseFloat(css.width)>=60&&parseFloat(css.width)<=72&&getComputedStyle(button).borderWidth==='0px'&&getComputedStyle(button).backgroundColor==='rgba(0, 0, 0, 0)'&&css.animationName==='gallerySealPulse';})()`),true,'Large unboxed pulsing seal');
    assert.equal(await evaluate(`[...document.querySelectorAll('.tabbar .tab')].every(b=>{const s=getComputedStyle(b);return s.borderWidth==='0px'&&s.borderRadius==='0px'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundImage==='none'&&s.boxShadow==='none'&&getComputedStyle(b,'::before').display==='none';})`),true,'Every menu icon is unboxed at '+width);
  }
  await evaluate(`document.getElementById('arrivalCheckinClose').click()`);
  await evaluate(`document.querySelector('#guestApproval [data-goto="adminlogin"]').click()`);assert.equal(await evaluate('currentView'),'adminlogin','Admin sign-in remains reachable');await evaluate(`document.querySelector('.app-brand').click()`);assert.equal(await evaluate('currentView'),'home');
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/otp/send'))`),false,'No OTP requests');
  await evaluate(`new Promise(resolve=>setTimeout(resolve,800))`);
  assert.equal(await evaluate(`document.getElementById('couplePhoto').decode().then(()=>true).catch(()=>false)`),true,'Configured Home photo remains available while locked');
  await evaluate(`WeddingAccess.refresh()`);for(let i=0;i<100;i++){if(await evaluate(`document.getElementById('guestApprovalTitle').textContent==='Verify your sign-in'`))break;await new Promise(r=>setTimeout(r,100));}assert.equal(await evaluate(`document.getElementById('guestApprovalTitle').textContent`),'Verify your sign-in','Live approval feed recovers and remains available after navigation');
  const shot=await call('Page.captureScreenshot',{format:'png'});try{fs.writeFileSync(path.join(out,'approval-home-live.png'),Buffer.from(shot.data,'base64'));}catch(e){if(e.code!=='ENOSPC')throw e;}
  await evaluate(`document.getElementById('roleProfilesOpen').click()`);assert.equal(await evaluate(`document.getElementById('roleProfileDialog').open&&document.getElementById('roleProfileRows').textContent===''&&!document.getElementById('roleProfileSignin').hidden`),true,'Unverified role entry shows guidance, never private profile data');
  await evaluate(`document.getElementById('roleProfileKind').value='bridesmaid';document.getElementById('roleProfileKind').dispatchEvent(new Event('change'))`);assert.equal(await evaluate(`document.getElementById('roleProfileRows').textContent===''&&!WeddingAccess.canUse()`),true,'Role selection grants no privileges');
  await evaluate(`document.getElementById('roleProfileClose').click()`);
  assert.deepEqual(errors,[]);console.log('PASS live welcome-only gate, blocked deep links/taps, verification guidance, reachable admin sign-in, six widths, role-entry guidance/no self-granted access, large unboxed neon seal and zero OTP sends; no submissions');
};
