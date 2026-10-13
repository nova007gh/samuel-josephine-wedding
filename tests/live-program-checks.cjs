const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`switchView('events');document.querySelector('[data-view="events"] [data-goto="program"]').click()`);
  let loaded=false;
  for(let i=0;i<200;i++){if(await evaluate(`document.querySelectorAll('#receptionProgram .program-lineup li').length>0`)){loaded=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(loaded,true,'Live reception program loads');
  const settings=await evaluate(`getSettings()`);
  const expected=settings.receptionProgram?JSON.parse(settings.receptionProgram):null;
  assert.equal(await evaluate(`document.querySelectorAll('#receptionProgram .program-lineup li').length`),expected?.items.length||12);
  assert.equal(await evaluate(`document.querySelector('#receptionProgram h1').textContent`),expected?.title||'Reception Program');
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Live program fits '+width);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:true});
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'live-reception-program.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('[data-view="program"] .back-link').click()`);
  assert.equal(await evaluate(`document.querySelector('.view:not(.hidden)').dataset.view`),'events');
  assert.equal(errors.length,0);
  console.log('PASS read-only live reception program content, Events/Back navigation and mobile/desktop widths; no live saves');
};
