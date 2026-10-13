const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({call,evaluate,wait,request,out})=>{
  const before=(await request('/settings')).data;
  await evaluate(`switchView('events');document.querySelector('[data-view="events"] [data-goto="program"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.view:not(.hidden)').dataset.view==='program'&&document.querySelectorAll('#receptionProgram .program-lineup li').length===12`),true,'Events opens the supplied twelve-activity program');
  assert.equal(await evaluate(`[...document.querySelectorAll('#receptionProgram time')].filter(el=>el.textContent==='5:45 PM').length`),2,'Dinner and band share the supplied time');
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Program guest fits '+width);
  }
  await evaluate(`document.querySelector('[data-view="program"] .back-link').click()`);
  assert.equal(await evaluate(`document.querySelector('.view:not(.hidden)').dataset.view`),'events');
  await evaluate(`(async()=>{await adminSignIn('', 'isolated-browser-only');switchView('admin');document.querySelector('[data-admin-section="program"]').click();})()`);
  await wait(`document.querySelectorAll('#programItemsEditor .program-edit-row').length===12`);
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Program editor fits '+width);
  }
  await evaluate(`(()=>{const form=document.getElementById('programEditor');form.elements.title.value='Edited Reception';form.dispatchEvent(new Event('input',{bubbles:true}));form.querySelector('[data-program-action="add"]').click();const row=document.querySelector('#programItemsEditor .program-edit-row:last-child');row.querySelector('[data-program-field="time"]').value='9:00 PM';row.querySelector('[data-program-field="title"]').value='Family photographs';row.querySelector('[data-program-field="details"]').value='Everyone is welcome';row.querySelector('[data-program-action="up"]').click();})()`);
  await evaluate(`window.dispatchEvent(new CustomEvent('wedding:settings',{detail:{receptionProgram:undefined}}))`);
  await evaluate(`(()=>{const f=document.getElementById('programEditor');f.querySelector('[data-program-action="add"]').click();document.querySelector('#programItemsEditor .program-edit-row:last-child [data-program-action="remove"]').click();})()`);
  assert.equal(await evaluate(`document.querySelectorAll('#programItemsEditor .program-edit-row').length`),13,'Removing an activity preserves the others');
  assert.equal(await evaluate(`document.getElementById('programEditor').elements.title.value`),'Edited Reception','Polling does not overwrite a dirty editor');
  await evaluate(`(()=>{const original=patchSettings;window.__programPatch=original;patchSettings=async()=>{throw new Error('Synthetic save failure');};document.getElementById('programEditor').requestSubmit();})()`);
  await wait(`document.getElementById('programEditorStatus').textContent.includes('Synthetic save failure')`);
  assert.equal(await evaluate(`document.getElementById('programEditor').elements.title.value`),'Edited Reception');
  await evaluate(`patchSettings=window.__programPatch;document.getElementById('programEditor').requestSubmit()`);
  await wait(`document.getElementById('programEditorStatus').textContent.includes('Program saved')`);
  const saved=(await request('/settings')).data,program=JSON.parse(saved.receptionProgram);
  assert.equal(program.title,'Edited Reception');assert.equal(program.items.length,13);assert.equal(program.items[11].title,'Family photographs');assert.equal(saved.events,before.events);
  await request('/admin/settings',{admin:true,method:'PATCH',body:{receptionProgram:'{bad'},status:400});
  await request('/admin/settings',{method:'PATCH',body:{receptionProgram:JSON.stringify(program)},status:401});
  await evaluate(`document.getElementById('programEditor').elements.title.value='Unsaved draft';document.getElementById('programEditor').dispatchEvent(new Event('input',{bubbles:true}))`);
  const remote={...program,title:'Remote edit'};
  await request('/admin/settings',{admin:true,method:'PATCH',body:{receptionProgram:JSON.stringify(remote)}});
  await evaluate(`window.dispatchEvent(new CustomEvent('wedding:settings',{detail:{receptionProgram:${JSON.stringify(JSON.stringify(remote))}}}))`);
  assert.equal(await evaluate(`document.getElementById('programEditor').elements.title.value`),'Unsaved draft','Remote changes do not overwrite the draft');
  await evaluate(`document.getElementById('programEditor').requestSubmit()`);
  await wait(`document.getElementById('programEditorStatus').textContent.includes('changed on the server')`);
  assert.equal(JSON.parse((await request('/settings')).data.receptionProgram).title,'Remote edit','Conflicting draft cannot overwrite newer saved content');
  await evaluate(`window.__programConfirm=confirm;window.confirm=()=>true;document.querySelector('#programEditor [data-program-action="reload"]').click()`);
  await wait(`document.getElementById('programEditor').elements.title.value==='Remote edit'`);
  await evaluate(`window.confirm=window.__programConfirm`);
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);switchView('events');document.querySelector('[data-view="events"] [data-goto="program"]').click();})()`);
  assert.equal(await evaluate(`document.querySelector('#receptionProgram h1').textContent==='Remote edit'&&document.querySelectorAll('#programItemsEditor .program-edit-row').length===0`),true,'Guests see saved changes while admin draft clears on sign-out');
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:950,deviceScaleFactor:1,mobile:true});
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'reception-program-mobile.png'),Buffer.from(shot.data,'base64'));
  console.log('PASS actual guest program/Back, supplied lineup/repeated times, mobile editor, add/order, draft/retry, persistent admin save, auth/validation and preserved event schedule (disposable database)');
};
