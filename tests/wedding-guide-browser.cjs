/* Disposable fixtures only. All production API access is GET-only through preview. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{build}=require('../wedding-guide-knowledge');
exports.setup=async({call})=>{
  const settings=await(await fetch('https://snybena.com/api/settings')).json();
  const image=require('../wedding-guide-knowledge').photo(settings.couplePhotoUrl);assert.ok(image,'Use a real published wedding photo');
  const fixture=build({weddingFormal:'SAMUEL & JOSEPHINE',weddingVenue:'Guide test venue',couplePhotoUrl:image,storyText:'<img src=x onerror="window.__guideXss=1">',events:'[]',entertainment:'{"acts":[]}' });
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__guideImage=${JSON.stringify(image)};window.__guideFetches=[];window.__guideFail=false;const nativeFetch=window.fetch;window.fetch=function(url,options){if(String(url)==='/api/guide'){window.__guideFetches.push({url:String(url),options});return window.__guideFail?Promise.reject(new Error('offline')):Promise.resolve(new Response(JSON.stringify(window.__guideFixture||${JSON.stringify(fixture)}),{status:200,headers:{'Content-Type':'application/json'}}));}return nativeFetch.apply(this,arguments);};`});
};
exports.check=async({call,evaluate,errors,out})=>{
  for(const [width,height] of [[320,568],[375,667],[390,844],[495,770],[844,390],[1024,768]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
    await evaluate(`document.getElementById('sjGuideLaunch').click();new Promise(r=>setTimeout(r,300))`);
    assert.equal(await evaluate(`(()=>{const d=document.getElementById('sjGuideDialog'),r=d.getBoundingClientRect(),f=document.getElementById('sjGuideForm').getBoundingClientRect();return d.open&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&f.bottom<=r.bottom&&d.scrollWidth<=d.clientWidth;})()`),true,'Guide fits '+width+'x'+height);
    await evaluate(`document.getElementById('sjGuideQuestion').value='Where is the wedding?';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
    assert.match(await evaluate(`document.getElementById('sjGuideResults').textContent`),/Guide test venue/);
    assert.equal(await evaluate(`Promise.race([document.querySelector('#sjGuideResults img').decode().then(()=>true).catch(()=>false),new Promise(r=>setTimeout(()=>r(false),15000))])`),true,'Real source photo decodes');
    if(width===495){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-495x770.png'),Buffer.from(shot.data,'base64'));}
    await evaluate(`document.getElementById('sjGuideClose').click();new Promise(r=>setTimeout(r,50))`);
    assert.equal(await evaluate(`document.activeElement.id`),'sjGuideLaunch','Focus returns to launcher');
  }
  await evaluate(`document.getElementById('sjGuideLaunch').click();document.getElementById('sjGuideQuestion').value='story';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,80))`);
  assert.equal(await evaluate(`!!window.__guideXss||!!document.querySelector('#sjGuideResults img[src="x"]')`),false,'Published text cannot execute markup');
  await evaluate(`document.getElementById('sjGuideQuestion').value='private guest list';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.getElementById('sjGuideResults').textContent`),/cannot access/);
  await evaluate(`document.getElementById('sjGuideQuestion').value='join Chat';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
  await evaluate(`document.querySelector('#sjGuideResults a[href="#chat"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-view="chat"]').classList.contains('hidden')`),false,'Source link opens actual page');
  assert.equal(await evaluate(`window.__guideFetches.every(r=>r.url==='/api/guide'&&!r.options.body)`),true,'Questions never sent to server');
  await evaluate(`document.getElementById('sjGuideLaunch').click();window.__guideFail=true;document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.getElementById('sjGuideStatus').textContent`),/Unable to refresh/);
  await evaluate(`window.__guideFail=false;window.__guideFixture={mode:'local-knowledge-guide',cards:[],activities:[{id:'test',version:'one',title:'Fixture activity',text:'Fixture only',view:'events',image:window.__guideImage,at:Date.now()+60000}]};document.getElementById('sjGuideAlerts').checked=true;document.getElementById('sjGuideAlerts').dispatchEvent(new Event('change'));new Promise(r=>setTimeout(r,50))`);
  await evaluate(`document.getElementById('sjGuideClose').click();document.querySelectorAll('.activity-toast,.competition-toast').forEach(el=>el.remove());document.activeElement.blur();document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-alert').length`),1,'Opted-in timed reminder');
  assert.equal(await evaluate(`document.querySelector('.sj-guide-alert img').decode().then(()=>true).catch(()=>false)`),true,'Reminder photo decodes');
  await evaluate(`document.querySelector('.sj-guide-alert button').click();document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-alert').length`),0,'Reminder does not repeat');
  await evaluate(`document.getElementById('sjGuideAlerts').checked=false;document.getElementById('sjGuideAlerts').dispatchEvent(new Event('change'))`);
  assert.deepEqual(errors,[]);console.log('PASS local guide responsive dialog, source routing, focus, escaped content, private/unknown handling, local-only questions, stale-state warning, opt-in reminders and deduplication');
};
exports.live=async({call,evaluate,errors,out})=>{
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.getElementById('sjGuideLaunch').click();document.getElementById('sjGuideQuestion').value='Where is the wedding?';document.getElementById('sjGuideForm').requestSubmit()`);
  for(let i=0;i<200;i++){if(await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]')!==null`))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]')!==null`),true,'Real endpoint produces wedding source');
  assert.equal(await evaluate(`document.querySelector('#sjGuideResults img').decode().then(()=>true).catch(()=>false)`),true,'Live published photo decodes');
  assert.match(await evaluate(`document.getElementById('sjGuideStatus').textContent`),/Published information refreshed/);
  assert.equal(await evaluate(`document.getElementById('sjGuideAlerts').checked`),false,'Reminders stay opt-in');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-live-390x844.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-view="events"]').classList.contains('hidden')`),false,'Live source navigation works');
  assert.deepEqual(errors,[]);console.log('PASS deployed guide: real public knowledge, decoded wedding photo, responsive dialog, reminders off by default and working source link; no submissions');
};
