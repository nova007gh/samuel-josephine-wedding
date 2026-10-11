const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/* Render the deployed admin Gifts UI with mock fund responses, never writes. */
module.exports = async ({call,evaluate,errors,out}) => {
  await evaluate(`(async()=>{
    switchView('gifts');renderAdminGiftFunds();renderMomoSettingsAdmin();
    for(let i=0;i<40&&(!document.querySelector('.gf-row')||!document.getElementById('momoNumberInput'));i++)
      await new Promise(resolve=>setTimeout(resolve,100));
  })()`);
  for(const width of [320,375,430,656,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:true});
    const result=await evaluate(`(()=>{
      const funds=document.getElementById('adminGiftFundsSection'),momo=document.getElementById('momoSettingsSection');
      const heading=funds.querySelector('h2').getBoundingClientRect();
      const desc=funds.querySelector('.page-sub').getBoundingClientRect();
      const add=document.getElementById('addGiftFundBtn').getBoundingClientRect();
      const info=document.querySelector('.gf-info').getBoundingClientRect();
      const fields=[...document.querySelectorAll('#momoSettingsEditor input')].map(e=>e.getBoundingClientRect());
      const boxes=[funds,momo,...document.querySelectorAll('.gf-actions button,#momoSettingsEditor input')]
        .map(e=>e.getBoundingClientRect());
      return {width:innerWidth,noOverflow:document.documentElement.scrollWidth===innerWidth,
        stacked:getComputedStyle(funds).display==='grid'&&getComputedStyle(momo).display==='grid',
        headerOrder:desc.top>=heading.bottom-1&&add.top>=desc.bottom-1,
        normalButton:add.height>=40&&add.height<=64,
        readableFund:info.width>=100,
        fullFields:fields.length===2&&fields.every(r=>r.width>=momo.clientWidth*.7),
        controlsFit:boxes.every(r=>r.left>=0&&r.right<=innerWidth+.5),
        emptyEditorHidden:getComputedStyle(document.getElementById('giftFundEditor')).display==='none'};
    })()`);
    for(const [name,ok] of Object.entries(result))if(name!=='width')assert.equal(ok,true,name+' at '+width);
    console.log('PASS stacked admin Gifts layout',width,'pixels');
  }
  const editor=await evaluate(`(async()=>{
    document.getElementById('addGiftFundBtn').click();
    const opened=!!document.querySelector('[data-gf-save]');
    document.querySelector('[data-gf-cancel]').click();
    const cleared=document.getElementById('giftFundEditor').childElementCount===0;
    document.querySelector('.gf-edit').click();
    for(let i=0;i<30&&!document.querySelector('[data-gf-field="id"]');i++)await new Promise(resolve=>setTimeout(resolve,50));
    const editOpened=document.querySelector('[data-gf-field="id"]').value==='cash';
    document.querySelector('[data-gf-cancel]').click();
    document.getElementById('adminGiftFundsSection').classList.add('hidden');
    const explicitHidden=getComputedStyle(document.getElementById('adminGiftFundsSection')).display==='none';
    document.getElementById('adminGiftFundsSection').classList.remove('hidden');
    setAdminToken(null);
    const guestHidden=['adminGiftFundsSection','momoSettingsSection'].every(id=>getComputedStyle(document.getElementById(id)).display==='none');
    setAdminToken('isolated-layout-fixture');
    return {opened,cleared,editOpened,explicitHidden,guestHidden};
  })()`);
  for(const [name,ok] of Object.entries(editor))assert.equal(ok,true,name);
  assert.equal(errors.length,0,'Uncaught browser exceptions');
  console.log('PASS fund editor/cancel, edit controls and guest hiding (no live writes)');
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});
  const saveVisible=await evaluate(`(()=>{
    scrollTo(0,document.documentElement.scrollHeight);
    return document.getElementById('saveMomoSettings').getBoundingClientRect().bottom
      <= document.querySelector('.tabbar').getBoundingClientRect().top;
  })()`);
  assert.equal(saveVisible,true,'Save button must be reachable above the bottom navigation');
  await evaluate(`(async()=>{
    document.getElementById('activityToasts')?.remove();
    for(let i=0;i<30&&!document.getElementById('pageLoader').classList.contains('hidden');i++)
      await new Promise(resolve=>setTimeout(resolve,50));
    scrollTo(0,document.documentElement.scrollHeight);
  })()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});
  const file=path.join(out,'admin-gifts-layout-preview.png');
  fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
  console.log('Layout preview (mock fund data):',file);
};
