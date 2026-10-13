const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({call,evaluate,wait,request,out})=>{
  const before=(await request('/settings')).data;
  await evaluate(`switchView('events');document.querySelector('[data-view="events"] [data-goto="engagementprogram"]').click()`);
  await wait(`document.querySelectorAll('#engagementProgram .program-lineup li').length===12`);
  assert.equal(await evaluate(`document.querySelector('#engagementProgram h1').textContent`),'Traditional Wedding Ceremony');
  assert.equal(await evaluate(`document.querySelectorAll('#engagementProgram .program-untimed').length`),2,'Untimed speeches and closing remain untimed');
  assert.equal(await evaluate(`document.getElementById('engagementProgram').textContent.includes('OMANHENE OSEADEEYO KWESI AKUFFO III')&&document.getElementById('engagementProgram').textContent.includes('NII KOJO ABABIO I')`),true);
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Engagement fits '+width);
  }
  await evaluate(`document.querySelector('[data-view="engagementprogram"] .back-link').click()`);
  assert.equal(await evaluate(`document.querySelector('.view:not(.hidden)').dataset.view`),'events');
  await evaluate(`(async()=>{await adminSignIn('', 'isolated-browser-only');switchView('admin');document.querySelector('[data-admin-section="program"]').click();document.getElementById('programEditor').elements.title.value='Keep reception draft';document.getElementById('programEditor').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-program-editor="engagement"]').click();})()`);
  await wait(`document.querySelectorAll('#engagementItemsEditor .program-edit-row').length===12&&!document.getElementById('engagementEditor').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.querySelectorAll('#engagementItemsEditor [data-program-field="time"][required]').length`),0);
  await call('Emulation.setDeviceMetricsOverride',{width:320,height:1000,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Engagement editor fits small mobile');
  await evaluate(`(()=>{const f=document.getElementById('engagementEditor');f.elements.title.value='Edited Engagement';f.dispatchEvent(new Event('input',{bubbles:true}));f.querySelector('[data-program-action="add"]').click();const row=document.querySelector('#engagementItemsEditor .program-edit-row:last-child');row.querySelector('[data-program-field="title"]').value='Family greeting';row.querySelector('[data-program-field="details"]').value='Untimed activity';f.requestSubmit();})()`);
  await wait(`document.getElementById('engagementEditorStatus').textContent.includes('Program saved')`);
  const settings=(await request('/settings')).data,program=JSON.parse(settings.engagementProgram);
  assert.equal(program.items.length,13);assert.equal(program.items[12].time,'');assert.equal(settings.receptionProgram,before.receptionProgram);assert.equal(settings.events,before.events);
  await evaluate(`document.querySelector('[data-program-editor="reception"]').click()`);
  assert.equal(await evaluate(`document.getElementById('programEditor').elements.title.value`),'Keep reception draft','Switching programs preserves independent drafts');
  const validReception={...program,title:'Must not overwrite',items:[{time:'2 PM',title:'Reception',details:''}]};
  await request('/admin/settings',{method:'PATCH',admin:true,body:{receptionProgram:JSON.stringify(validReception),engagementProgram:'{bad'},status:400});
  assert.equal((await request('/settings')).data.receptionProgram,before.receptionProgram,'Bad engagement patch cannot partially overwrite reception');
  await request('/admin/settings',{method:'PATCH',body:{engagementProgram:JSON.stringify(program)},status:401});
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);switchView('events');document.querySelector('[data-view="events"] [data-goto="engagementprogram"]').click();})()`);
  assert.equal(await evaluate(`document.querySelector('#engagementProgram h1').textContent==='Edited Engagement'&&document.querySelectorAll('#engagementItemsEditor .program-edit-row').length===0&&document.querySelector('#receptionProgram h1').textContent==='Reception Program'`),true);
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true});
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'engagement-program-mobile.png'),Buffer.from(shot.data,'base64'));
  console.log('PASS engagement supplied lineup/untimed speeches, guest navigation/mobile fit, independent admin drafts/save, auth/validation and preserved reception/event settings (disposable database)');
};
