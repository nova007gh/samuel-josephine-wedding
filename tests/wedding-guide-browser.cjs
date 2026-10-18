/* Disposable fixtures only. All production API access is GET-only through preview. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{build}=require('../wedding-guide-knowledge');
exports.setup=async({call})=>{
  const settings=await(await fetch('https://snybena.com/api/settings')).json();
  const image=require('../wedding-guide-knowledge').photo(settings.couplePhotoUrl);assert.ok(image,'Use a real published wedding photo');
  const fixture=build({weddingFormal:'SAMUEL & JOSEPHINE',weddingDateISO:'2030-01-09T07:00',weddingVenue:'Guide test venue',couplePhotoUrl:image,storyText:'<img src=x onerror="window.__guideXss=1">',events:'[{"name":"Traditional Wedding","time":"07:00 AM - 11:00 AM"},{"name":"Reception","time":"2:00 PM – 08:15 PM"}]',receptionProgram:JSON.stringify({title:'Reception programme',dateLabel:'JANUARY 9, 2030',items:[{time:'5:45 PM',title:'Dinner is served',details:'Fixture dinner'},{time:'7:45 PM',title:'Cake cutting and first dance',details:'Fixture dance'}]}),entertainment:'{"acts":[]}' });
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__guideImage=${JSON.stringify(image)};window.__guideFetches=[];window.__guideFail=false;const nativeFetch=window.fetch;window.fetch=function(url,options){if(String(url)==='/api/guide'){window.__guideFetches.push({url:String(url),options});return window.__guideFail?Promise.reject(new Error('offline')):Promise.resolve(new Response(JSON.stringify(window.__guideFixture||${JSON.stringify(fixture)}),{status:200,headers:{'Content-Type':'application/json'}}));}return nativeFetch.apply(this,arguments);};`});
};
exports.check=async({call,evaluate,errors,out})=>{
  for(const [width,height] of [[320,568],[375,667],[390,844],[495,770],[844,390],[1024,768]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
    for(const view of ['home','chat']){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,200))`);
      for(const id of ['sjGuideLaunch','sjGuideLaunchJossy']){
        const launcher=await evaluate(`(()=>{const b=document.getElementById('${id}'),r=b.getBoundingClientRect(),app=document.getElementById('app').getBoundingClientRect(),bar=document.querySelector('.tabbar').getBoundingClientRect(),composer=document.getElementById('chatComposer').getBoundingClientRect();return {fits:r.left>=app.left-1&&r.right<=app.right+1&&r.top>=0&&r.bottom<=bar.top,edge:b.classList.contains('sj-guide-launch--left')?r.left-app.left:app.right-r.right,width:r.width,height:r.height,clear:r.bottom<=composer.top,clickable:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('.sj-guide-launch')===b};})()`);
        assert.equal(launcher.fits,true,'Illustration launcher fits '+id+' '+view+' '+width);assert.ok(Math.abs(launcher.edge)<=2,'Launcher hugs its app edge');assert.ok(launcher.width>=44&&launcher.width<=64&&launcher.height<=104,'Compact accessible target');assert.equal(launcher.clickable,true,'Illustration is tappable');if(view==='chat')assert.equal(launcher.clear,true,'Illustration stays above Chat composer');
        assert.equal(await evaluate(`document.querySelector('#${id} img').decode().then(()=>true).catch(()=>false)`),true,'Supplied illustration decodes');
      }
      if((width===495&&view==='home')||(width===375&&view==='chat')){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-launcher-'+view+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
    }
    await evaluate(`document.getElementById('sjGuideLaunchJossy').click();new Promise(r=>setTimeout(r,100))`);
    assert.equal(await evaluate(`document.querySelectorAll('dialog[open]').length===1&&document.getElementById('sjGuideDialog').open`),true,'Jossy opens the same single guide dialog');
    await evaluate(`document.getElementById('sjGuideClose').click();new Promise(r=>setTimeout(r,50))`);
    assert.equal(await evaluate(`document.activeElement.id`),'sjGuideLaunchJossy','Focus returns to Jossy when used');
    await evaluate(`document.getElementById('sjGuideLaunch').click();new Promise(r=>setTimeout(r,300))`);
    await evaluate(`document.getElementById('sjGuideClear').click()`);
    assert.equal(await evaluate(`(()=>{const d=document.getElementById('sjGuideDialog'),r=d.getBoundingClientRect(),f=document.getElementById('sjGuideForm').getBoundingClientRect();return d.open&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&f.bottom<=r.bottom&&d.scrollWidth<=d.clientWidth;})()`),true,'Guide fits '+width+'x'+height);
    assert.match(await evaluate(`document.getElementById('sjGuideOverview').textContent`),/Guide test venue/,'Useful overview before a question');
    assert.match(await evaluate(`document.getElementById('sjGuideActivities').textContent`),/Traditional Wedding/,'Time ranges produce activity cards');
    if(width===495){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-welcome-495x770.png'),Buffer.from(shot.data,'base64'));}
    await evaluate(`document.getElementById('sjGuideQuestion').value='Where is the wedding?';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
    assert.match(await evaluate(`document.getElementById('sjGuideResults').textContent`),/Guide test venue/);
    assert.equal(await evaluate(`Promise.race([document.querySelector('#sjGuideResults .sj-guide-turn:last-child img').decode().then(()=>true).catch(()=>false),new Promise(r=>setTimeout(()=>r(false),15000))])`),true,'Real source photo decodes');
    if(width===495){const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-495x770.png'),Buffer.from(shot.data,'base64'));}
    await evaluate(`document.getElementById('sjGuideClose').click();new Promise(r=>setTimeout(r,50))`);
    assert.equal(await evaluate(`document.activeElement.id`),'sjGuideLaunch','Focus returns to launcher');
  }
  await evaluate(`document.getElementById('sjGuideLaunch').click();document.getElementById('sjGuideQuestion').value='When is dinner?';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/5:45 PM/);
  await evaluate(`[...document.querySelectorAll('#sjGuideSuggestions button')].find(b=>b.textContent==='What time is it?').click();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/Dinner is served/,'Follow-up keeps activity context');
  await evaluate(`document.getElementById('sjGuideClose').click();new Promise(r=>setTimeout(r,50))`);
  await evaluate(`document.getElementById('sjGuideLaunchJossy').focus()`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  assert.equal(await evaluate(`document.getElementById('sjGuideDialog').open`),true,'Jossy opens via keyboard');
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/Dinner is served/,'Both icons share the existing conversation');
  const turns=await evaluate(`document.querySelectorAll('.sj-guide-turn').length`);
  await evaluate(`document.getElementById('sjGuideQuestion').value='unsubmitted draft';document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-turn').length`),turns,'Refresh does not send drafts or duplicate answers');
  assert.equal(await evaluate(`document.getElementById('sjGuideQuestion').value`),'unsubmitted draft');
  await evaluate(`document.getElementById('sjGuideLaunch').click();document.getElementById('sjGuideQuestion').value='story';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,80))`);
  assert.equal(await evaluate(`!!window.__guideXss||!!document.querySelector('#sjGuideResults img[src="x"]')`),false,'Published text cannot execute markup');
  await evaluate(`document.getElementById('sjGuideQuestion').value='private guest list';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/cannot access/);
  await evaluate(`document.getElementById('sjGuideQuestion').value='join Chat';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,50))`);
  assert.ok(await evaluate(`document.querySelectorAll('.sj-guide-turn').length<=6`),'Recent conversation is bounded');
  await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child a[href="#chat"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-view="chat"]').classList.contains('hidden')`),false,'Source link opens actual page');
  assert.equal(await evaluate(`window.__guideFetches.every(r=>r.url==='/api/guide'&&!r.options.body)`),true,'Questions never sent to server');
  assert.equal(await evaluate(`Object.values(localStorage).some(v=>/When is dinner\?|unsubmitted draft|private guest list/.test(v))`),false,'Questions/drafts are not persisted');
  await evaluate(`document.getElementById('sjGuideClear').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-turn').length`),0,'New conversation clears page-memory history');
  await evaluate(`document.getElementById('sjGuideLaunch').click();window.__guideFail=true;document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.match(await evaluate(`document.getElementById('sjGuideStatus').textContent`),/Unable to refresh/);
  await evaluate(`window.__guideFail=false;window.__guideFixture={mode:'local-knowledge-guide',cards:[],activities:[{id:'test',version:'one',title:'Fixture activity',text:'Fixture only',view:'events',image:window.__guideImage,at:Date.now()+60000}]};document.getElementById('sjGuideAlerts').checked=true;document.getElementById('sjGuideAlerts').dispatchEvent(new Event('change'));new Promise(r=>setTimeout(r,50))`);
  await evaluate(`document.getElementById('sjGuideClose').click();document.querySelectorAll('.activity-toast,.competition-toast').forEach(el=>el.remove());document.activeElement.blur();document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-alert').length`),1,'Opted-in timed reminder');
  assert.equal(await evaluate(`document.querySelector('.sj-guide-alert img').decode().then(()=>true).catch(()=>false)`),true,'Reminder photo decodes');
  await evaluate(`document.querySelector('.sj-guide-alert button').click();document.getElementById('sjGuideRefresh').click();new Promise(r=>setTimeout(r,50))`);
  assert.equal(await evaluate(`document.querySelectorAll('.sj-guide-alert').length`),0,'Reminder does not repeat');
  await evaluate(`document.getElementById('sjGuideAlerts').checked=false;document.getElementById('sjGuideAlerts').dispatchEvent(new Event('change'))`);
  assert.deepEqual(errors,[]);console.log('PASS Sam/right and Jossy/left icons, composer clearance, keyboard/focus, shared conversation/dialog, responsive guide, private local questions, real source links and opt-in reminders');
};
exports.live=async({call,evaluate,errors,out})=>{
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate(`Promise.all([...document.querySelectorAll('.sj-guide-launch img')].map(img=>img.decode().then(()=>true).catch(()=>false))).then(ok=>ok.length===2&&ok.every(Boolean))`),true,'Both live illustrations decode');
  await evaluate(`document.getElementById('sjGuideLaunchJossy').click();document.getElementById('sjGuideQuestion').value='Where is the wedding?';document.getElementById('sjGuideForm').requestSubmit()`);
  for(let i=0;i<200;i++){if(await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]')!==null`))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]')!==null`),true,'Real endpoint produces wedding source');
  assert.equal(await evaluate(`document.querySelector('#sjGuideResults img').decode().then(()=>true).catch(()=>false)`),true,'Live published photo decodes');
  assert.match(await evaluate(`document.getElementById('sjGuideStatus').textContent`),/Published information refreshed/);
  assert.equal(await evaluate(`document.getElementById('sjGuideAlerts').checked`),false,'Reminders stay opt-in');
  assert.match(await evaluate(`document.getElementById('sjGuideActivities').textContent`),/Traditional Wedding/,'Published time ranges populate real activity cards');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'guide-live-390x844.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('#sjGuideResults a[href="#events"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-view="events"]').classList.contains('hidden')`),false,'Live source navigation works');
  await evaluate(`document.getElementById('sjGuideLaunch').click();document.getElementById('sjGuideQuestion').value='When is dinner?';document.getElementById('sjGuideForm').requestSubmit();new Promise(r=>setTimeout(r,100))`);
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/DINNER IS SERVED/);
  await evaluate(`[...document.querySelectorAll('#sjGuideSuggestions button')].find(b=>b.textContent==='What time is it?').click();new Promise(r=>setTimeout(r,100))`);
  assert.match(await evaluate(`document.querySelector('#sjGuideResults .sj-guide-turn:last-child').textContent`),/5:45 PM/);
  assert.deepEqual(errors,[]);console.log('PASS deployed guide: real overview and scheduled cards, decoded wedding photo, source navigation, dinner answer and contextual follow-up; no submissions');
};
