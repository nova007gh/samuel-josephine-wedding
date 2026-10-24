const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  for(let i=0;i<100;i++){if(await evaluate(`document.getElementById('guestApprovalTitle')?.textContent==='Verify your sign-in'`))break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(await evaluate(`!WeddingAccess.canUse()&&currentView==='home'`),true,'Saved preview profile cannot bypass approval');
  assert.equal(await evaluate(`document.getElementById('homeCheckinLabel').textContent`),'Enter our wedding to check in','Unverified session shows check-in prompt, not false confirmation');
  for(const view of ['story','events','gallery','gifts','chat','vendors','competitions','bridaltrain']){await evaluate(`switchView(${JSON.stringify(view)})`);assert.equal(await evaluate('currentView'),'home');}
  await evaluate(`document.querySelector('.tab[data-tab="gallery"]').click()`);assert.equal(await evaluate('currentView'),'home');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sj-guide-launch')).display`),'none','Guide locked before approval');
  assert.equal(await evaluate(`document.querySelector('[data-view="gallery"]').inert`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab-seal')).filter.includes('255, 184, 41')`),true,'Neon golden halo follows the seal');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`(()=>{const css=getComputedStyle(document.querySelector('.tab-seal'));return css.animationName==='none'&&css.filter.includes('255, 184, 41');})()`),true,'Reduced motion retains static golden glow');
  await call('Emulation.setEmulatedMedia',{features:[]});
  for(const width of [320,375,390,430,768,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<900});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Welcome gate fits '+width);
    assert.equal(await evaluate(`(()=>{const seal=document.querySelector('.tab--center .tab-seal'),button=seal.closest('button'),css=getComputedStyle(seal);return parseFloat(css.width)>=60&&parseFloat(css.width)<=72&&getComputedStyle(button).borderWidth==='0px'&&getComputedStyle(button).backgroundColor==='rgba(0, 0, 0, 0)'&&css.animationName==='gallerySealPulse';})()`),true,'Large unboxed pulsing seal');
  }
  await evaluate(`document.querySelector('#guestApproval [data-goto="adminlogin"]').click()`);assert.equal(await evaluate('currentView'),'adminlogin','Admin sign-in remains reachable');await evaluate(`document.querySelector('.app-brand').click()`);assert.equal(await evaluate('currentView'),'home');
  assert.equal(await evaluate(`performance.getEntriesByType('resource').some(r=>r.name.includes('/otp/send'))`),false,'No OTP requests');
  await evaluate(`new Promise(resolve=>setTimeout(resolve,800))`);
  assert.equal(await evaluate(`document.getElementById('couplePhoto').decode().then(()=>true).catch(()=>false)`),true,'Configured Home photo remains available while locked');
  const shot=await call('Page.captureScreenshot',{format:'png'});try{fs.writeFileSync(path.join(out,'approval-home-live.png'),Buffer.from(shot.data,'base64'));}catch(e){if(e.code!=='ENOSPC')throw e;}
  assert.deepEqual(errors,[]);console.log('PASS live welcome-only gate, blocked deep links/taps, verification guidance, reachable admin sign-in, six widths, large unboxed neon seal and zero OTP sends; no submissions');
};
