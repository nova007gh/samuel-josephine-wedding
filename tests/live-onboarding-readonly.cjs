const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  if(process.env.WEDDING_EXPECT_OTP==='true'){
    assert.equal(await evaluate(`(async()=>{const r=await api('/onboarding');return r.otpRequired;})()`),true);
    await evaluate(`clearGuest();document.getElementById('app').classList.add('hidden');document.body.classList.add('locked');showGate(guestLoginScreen);loadOnboarding()`);
    assert.equal(await evaluate(`document.getElementById('guestOptionalNote').classList.contains('hidden')`),true);
    assert.equal(await evaluate(`document.getElementById('guestCheckinHint').textContent.includes('No code required')`),false);
    assert.equal(await evaluate(`document.getElementById('returnGuestLink').textContent.includes('Sign in with your phone')`),true);
    for(const [width,height] of [[320,568],[375,667],[430,1100],[844,390]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
      assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);
      assert.equal(await evaluate(`(()=>{const gate=document.getElementById('guestLoginScreen');gate.scrollTop=gate.scrollHeight;const b=document.querySelector('#guestLoginForm button[type="submit"]').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;})()`),true);
    }
    assert.equal(errors.length,0);console.log('PASS live OTP mode, sign-in guidance, mobile widths and reachable submit; no SMS requests or submissions');return;
  }
  assert.equal(await evaluate(`(async()=>{const r=await api('/onboarding');return r.otpRequired;})()`),false);
  await evaluate(`clearGuest();document.getElementById('app').classList.add('hidden');document.body.classList.add('locked');showGate(guestLoginScreen);loadOnboarding()`);
  assert.equal(await evaluate(`document.getElementById('guestOptionalNote').classList.contains('hidden')`),false);
  await evaluate(`document.getElementById('guestName').value='Read-only onboarding preview';document.getElementById('guestPhone').value='0240000000'`);
  assert.equal(await evaluate(`document.getElementById('guestLoginForm').checkValidity()`),true);
  assert.equal(await evaluate(`document.getElementById('otpPane').classList.contains('hidden')`),true);
  for(const [width,height] of [[320,568],[375,667],[430,1100],[844,390]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('#guestLoginForm input,#guestLoginForm select')).every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)`),true);
    assert.equal(await evaluate(`(()=>{const gate=document.getElementById('guestLoginScreen');gate.scrollTop=gate.scrollHeight;const button=document.querySelector('#guestLoginForm button[type="submit"]').getBoundingClientRect();return button.top>=0&&button.bottom<=innerHeight;})()`),true,'Reachable submit at '+width+'x'+height);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});await evaluate(`document.getElementById('guestLoginScreen').scrollTop=0`);
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'live-quick-checkin.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`(async()=>{document.getElementById('returnGuestLink').click();for(let i=0;i<500&&!document.getElementById('guestCheckinNotice').textContent;i++)await new Promise(r=>setTimeout(r,40));})()`);
  assert.equal(await evaluate(`document.getElementById('guestLoginError').textContent`),'');
  assert.equal(await evaluate(`document.getElementById('guestCheckinNotice').getAttribute('role')==='status'&&document.getElementById('guestCheckinNotice').textContent.includes('On another device?')`),true);
  assert.equal(errors.length,0);console.log('PASS read-only live quick onboarding: OTP off, name/phone-only form, neutral device help, readable inputs, reachable submit in small portrait/landscape, no JS errors; no saves or messages sent');
};
