const assert=require('node:assert/strict');
module.exports=async({evaluate,wait})=>{
  const view=()=>evaluate(`document.querySelector('.view:not(.hidden)').dataset.view`);
  await evaluate(`switchView('home');document.querySelector('[data-view="home"] [data-goto="competitions"]').click()`);
  assert.equal(await view(),'competitions');
  await evaluate(`document.querySelector('[data-view="competitions"] [data-goto="more"]').click()`);
  assert.equal(await view(),'more');
  for(const target of ['competitions','guestbook']){
    await evaluate(`switchView('more');document.querySelector('[data-view="more"] [data-goto="${target}"]').click()`);
    assert.equal(await view(),target);
    await evaluate(`document.querySelector('[data-view="${target}"] .back-link,[data-view="${target}"] .comp-back').click()`);
    assert.equal(await view(),'more');
  }
  for(const target of ['memories','more']){
    await evaluate(`switchView('gallery');document.querySelector('[data-view="gallery"] [data-goto="${target}"]').click()`);
    assert.equal(await view(),target);
    await evaluate(`document.querySelector('[data-view="${target}"] .back-link').click()`);
    assert.equal(await view(),'gallery');
  }
  for(const tab of ['timeline','sjgallery','journey','met']){
    await evaluate(`switchView('story');document.querySelector('[data-story-tab="${tab}"]').click()`);
    assert.equal(await evaluate(`!document.querySelector('[data-story-panel="${tab}"]').classList.contains('hidden')`),true);
  }
  await evaluate(`switchView('events');window.__mapOpen=null;window.__originalOpen=window.open;window.open=(...args)=>{window.__mapOpen=args;};document.getElementById('viewMap').click();window.open=window.__originalOpen`);
  assert.equal(await evaluate(`window.__mapOpen[0].startsWith('https://')&&window.__mapOpen[1]==='_blank'&&window.__mapOpen[2]==='noopener'`),true);
  await evaluate(`window.__originalWeddingDate=weddingDateMs;window.setWeddingDate(new Date(Date.now()+90061000).toISOString())`);
  assert.equal(await evaluate(`['Days','Hours','Minutes','Seconds'].every((part,i)=>document.getElementById('event'+part).textContent===document.getElementById(['days','hours','minutes','seconds'][i]).textContent)&&document.getElementById('eventDays').textContent==='1'`),true,'Home and Events share the same countdown');
  await evaluate(`window.setWeddingDate(new Date(Date.now()-1000).toISOString())`);
  assert.equal(await evaluate(`document.getElementById('eventDays').textContent==='0'&&document.getElementById('eventSeconds').textContent==='00'`),true,'Past dates clamp to zero');
  await evaluate(`window.setWeddingDate('invalid');window.setWeddingDate(new Date(window.__originalWeddingDate).toISOString());switchView('memories');document.getElementById('shareTypeVoice').click()`);
  assert.equal(await view(),'voicemsg');
  await evaluate(`document.querySelector('[data-view="voicemsg"] .back-link').click()`);
  assert.equal(await view(),'memories');
  await evaluate(`document.querySelector('[data-view="memories"] [data-goto="gallery"]').click()`);
  assert.equal(await view(),'gallery');
  await wait(`!!document.querySelector('#galleryCats [data-album="childhood"]')`);
  await evaluate(`document.querySelector('#galleryCats [data-album="childhood"]').click()`);
  assert.equal(await evaluate(`!document.getElementById('galleryDetail').classList.contains('hidden')&&document.getElementById('galleryDetailTitle').textContent.includes('Childhood')`),true);
  await evaluate(`document.getElementById('galleryBack').click()`);
  assert.equal(await evaluate(`!document.getElementById('galleryCats').classList.contains('hidden')`),true);
  for(const kind of ['photos','videos','selfies','voice','messages','all']){
    await evaluate(`document.querySelector('#galleryChips [data-kind="${kind}"]').click()`);
    assert.equal(await evaluate(`document.querySelector('#galleryChips [data-kind="${kind}"]').classList.contains('active')`),true);
  }
  await evaluate(`document.getElementById('shareUploadBtn').click()`);
  assert.equal(await evaluate(`!document.getElementById('uploadPanel').classList.contains('hidden')&&!!document.getElementById('memoryFiles')`),true);
  await evaluate(`(async()=>{window.__galleryOriginal=addMemory;window.__gallerySubmissions=0;const held=new Promise(r=>window.__galleryRelease=r);addMemory=async record=>{window.__gallerySubmissions++;await held;return window.__galleryOriginal(record);};const canvas=document.createElement('canvas');canvas.width=canvas.height=16;canvas.getContext('2d').fillRect(0,0,16,16);const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'guest-e2e.png',{type:'image/png'}));const input=document.getElementById('memoryFiles');document.getElementById('memoryCaption').value='Isolated gallery action test';input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate(`window.__gallerySubmissions===1&&document.getElementById('memoryCaption').disabled&&document.getElementById('memoryCategory').disabled`),true,'Gallery guards duplicate upload and protects caption/category');
  await evaluate(`window.__galleryRelease()`);
  await wait(`document.getElementById('uploadStatus').textContent.includes('1 memory saved')&&!document.getElementById('memoryFiles').disabled`);
  await evaluate(`addMemory=window.__galleryOriginal`);
  assert.equal(await evaluate(`['shareTypePhoto','shareTypeVideo','shareTypeSelfie','shareTypeAudio'].every(id=>{const input=document.getElementById(id);return input.type==='file'&&!!input.closest('label.menu-item');})`),true);
  await wait(`!settingsSyncBusy`);
  await evaluate(`(()=>{window.__settingsOriginal=getSettings;window.__settingsReads=0;const held=new Promise(r=>window.__settingsRelease=r);getSettings=async()=>{window.__settingsReads++;const data=await window.__settingsOriginal();await held;return data;};syncSiteSettings();syncSiteSettings();})()`);
  await wait(`window.__settingsReads===1`);
  assert.equal(await evaluate(`settingsSyncBusy&&window.__settingsReads===1`),true,'Settings polling does not overlap');
  await evaluate(`window.__settingsRelease();getSettings=window.__settingsOriginal`);
  await wait(`!settingsSyncBusy`);
  await evaluate(`(async()=>{const original=getSettings;window.__settingsReads=0;getSettings=async()=>{window.__settingsReads++;return original();};window.__uploadsInFlight=1;await syncSiteSettings();window.__uploadsInFlight=0;getSettings=original;})()`);
  assert.equal(await evaluate(`window.__settingsReads`),0,'Settings polling pauses during uploads');
  await evaluate(`(()=>{switchView('story');const video=document.createElement('video');video.id='playbackNavigationProbe';Object.defineProperty(video,'paused',{value:false});video.pause=()=>{window.__mediaPaused=true;};document.querySelector('[data-view="story"]').append(video);window.__mediaPaused=false;switchView('events');video.remove();})()`);
  assert.equal(await evaluate(`window.__mediaPaused`),true,'Navigation pauses hidden guest media');
  console.log('PASS Home/Share competition links, Back actions, four Story tabs, View Map action, shared Home/Events countdown, voice/shared-gallery routes and upload picker wiring');
};
