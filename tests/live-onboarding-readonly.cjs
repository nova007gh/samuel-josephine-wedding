const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  assert.equal(await evaluate(`(async()=>{const r=await api('/onboarding');return r.otpRequired;})()`),false);
  await evaluate(`clearGuest();document.getElementById('app').classList.add('hidden');document.body.classList.add('locked');showGate(guestLoginScreen);loadOnboarding()`);
  assert.equal(await evaluate(`document.getElementById('guestOptionalNote').classList.contains('hidden')`),false);
  await evaluate(`document.getElementById('guestName').value='Read-only onboarding preview';document.getElementById('guestPhone').value='0240000000'`);
  assert.equal(await evaluate(`document.getElementById('guestLoginForm').checkValidity()`),true);
  assert.equal(await evaluate(`document.getElementById('otpPane').classList.contains('hidden')`),true);
  for(const width of [320,375,430]){await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);}
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'live-quick-checkin.png'),Buffer.from(shot.data,'base64'));
  assert.equal(errors.length,0);console.log('PASS read-only live quick onboarding: OTP-off config, name/phone-only valid form, optional details, hidden OTP, mobile layouts and no JS errors; no saves or messages sent');
};
