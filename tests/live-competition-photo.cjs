/* Read-only actual Best Dresses inspection. No votes, OTPs or admin writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  const wait=async(expr)=>{for(let i=0;i<300;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,60));}throw new Error('Live competition wait failed: '+expr);};
  const game=await evaluate(`(async()=>{const rows=await api('/competitions');return rows.find(x=>x.title==='Best Dresses');})()`);
  assert.ok(game,'Best Dresses exists');
  await evaluate(`switchView('competitions')`);
  await wait(`!!document.querySelector('#competitionList [data-comp-action="open"][data-id="${game.id}"]')`);
  await evaluate(`document.querySelector('#competitionList [data-comp-action="open"][data-id="${game.id}"]').click()`);
  await wait(`document.querySelector('#competitionDetail .comp-photo-button--cover')?.dataset.photoState==='ready'`);
  assert.equal(await evaluate(`document.querySelector('#competitionDetail .comp-cover').naturalWidth>0&&document.querySelector('#competitionDetail .comp-cover').src===new URL(${JSON.stringify(game.coverUrl)},location.href).href`),true,'Actual cover loads from current saved URL');
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#competitionDetail .comp-cover')).objectFit==='contain'&&document.documentElement.scrollWidth===innerWidth`),true,'Uncropped cover fits at '+width);
  }
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:950,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('#competitionDetail .comp-photo-button--cover').click()`);
  await wait(`!document.getElementById('lightbox').classList.contains('hidden')&&document.querySelector('#lightboxBody img')?.naturalWidth>0`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#lightboxBody img')).objectFit==='contain'&&document.querySelector('#lightboxBody img').getBoundingClientRect().width<=innerWidth&&document.querySelector('#lightboxBody img').getBoundingClientRect().height<=innerHeight`),true,'Full-screen actual image is not cropped');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'best-dresses-full-photo.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`document.getElementById('lightboxClose').click()`);
  if(game.requireVerified){
    await evaluate(`document.querySelector('#competitionDetail [data-comp-action="verify"]').click()`);
    assert.equal(await evaluate(`gateShowing()&&document.activeElement.id==='returnPhone'`),true,'Verification button works');
    await evaluate(`enterApp();switchView('competition')`);
  }
  assert.equal(errors.length,0,'No uncaught live screen exceptions');
  console.log('PASS read-only actual Best Dresses cover loading, uncropped mobile/desktop fit, full-screen photo/Close and verification navigation; no votes or settings changed');
};
