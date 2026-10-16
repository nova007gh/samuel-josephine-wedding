const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`switchView('events');document.querySelector('[data-view="events"] [data-goto="livebroadcast"]').click()`);
  for(let i=0;i<100;i++){if(await evaluate(`!!document.querySelector('#liveBroadcastContent h1')`))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate(`document.getElementById('liveBroadcastLoadStatus').textContent`),'');
  assert.equal(await evaluate(`document.querySelectorAll('.tabbar [data-tab]').length`),7);
  assert.equal(await evaluate(`document.querySelectorAll('#liveBroadcastContent iframe').length`),0);
  const realPhoto=await evaluate(`document.querySelector('#liveBroadcastContent .showcase-hero-photo').getAttribute('src')`);assert.match(realPhoto,/^\/uploads\//);
  await evaluate(`Promise.all([...document.querySelectorAll('#liveBroadcastContent img')].map(img=>img.decode().catch(()=>{})))`);
  assert.equal(await evaluate(`document.querySelector('#liveBroadcastContent .showcase-hero-photo').naturalWidth>0`),true);
  for(const width of [320,375,430,1024]){await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<600});assert.equal(await evaluate('document.documentElement.scrollWidth===innerWidth'),true,'Live broadcast layout at '+width);}
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'live-broadcast-real-photo.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);console.log('PASS read-only live broadcast: Events link, seven tabs, real configured image decoded, no eager provider iframe, responsive 320/375/430/1024 and no JS exceptions');
};
