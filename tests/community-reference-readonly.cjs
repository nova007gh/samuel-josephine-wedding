/* Candidate CSS/HTML, GET-only live content; chat data mocked empty, no writes. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`window.__referenceApi=api;api=async(p,o)=>{if(p==='/chat/presence')return {ok:true};if(p==='/chat')return {messages:[],activeGuests:0,host:false};return window.__referenceApi(p,o);};switchView('entertainment')`);
  for(let i=0;i<200;i++){if(await evaluate(`document.querySelector('[data-community-photo]').getAttribute('src')?.startsWith('/uploads/')&&document.getElementById('entertainmentActs').children.length>0`))break;await new Promise(r=>setTimeout(r,75));}
  assert.equal(await evaluate(`document.querySelector('[data-community-photo]').getAttribute('src').startsWith('/uploads/')`),true,'Use the configured wedding photo, not the reference people');
  for(const width of [320,360,375,390,430,476,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const view of ['chat','entertainment']){
      await evaluate(`switchView('${view}');new Promise(r=>setTimeout(r,650))`);
      await evaluate(`Promise.all([...document.querySelectorAll('[data-view="${view}"] [data-community-photo]')].map(img=>img.decode().catch(()=>{})))`);
      assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,view+' fits '+width);
      assert.equal(await evaluate(`document.querySelector('[data-view="${view}"] .community-hero').getBoundingClientRect().top-document.getElementById('app').getBoundingClientRect().top<2`),true,'No old header gap');
      assert.equal(await evaluate(`document.querySelector('[data-view="${view}"] [data-community-photo]').naturalWidth>0`),true,'Real photo decoded');
      assert.equal(await evaluate(`document.querySelectorAll('[data-view="${view}"] .community-filters button>.community-icon').length`),7,'Icon category tabs');
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-view="${view}"] .community-filters button')).every(b=>b.scrollWidth<=b.clientWidth+1)`),true,'Category labels fit');
      if(view==='chat'){
        assert.equal(await evaluate(`(()=>{const composer=document.getElementById('chatComposer').getBoundingClientRect(),bar=document.querySelector('.tabbar').getBoundingClientRect();return composer.bottom<=bar.top+1&&composer.top>0&&document.querySelector('.chat-compose-row').scrollWidth<=document.querySelector('.chat-compose-row').clientWidth+1;})()`),true,'Composer visible above bottom navigation');
      }
      if(width===430){await evaluate(`document.querySelectorAll('.competition-toast-close').forEach(b=>b.click());document.querySelectorAll('.activity-toast').forEach(el=>el.remove())`);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,view+'-reference-real-photo.png'),Buffer.from(shot.data,'base64'));}
    }
    console.log('PASS reference community pages/real photo, icon tabs, viewport composer and no overflow at '+width+'px');
  }
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[430,932],[495,770],[495,400],[844,390],[1024,768]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
    await evaluate(`switchView('chat');new Promise(r=>setTimeout(r,650))`);
    const layout=await evaluate(`(()=>{const box=id=>document.getElementById(id).getBoundingClientRect(),feed=box('chatMessages'),composer=box('chatComposer'),bar=document.querySelector('.tabbar').getBoundingClientRect(),hero=document.querySelector('.community-hero--chat').getBoundingClientRect(),photo=document.querySelector('.community-hero--chat>img').getBoundingClientRect();return {fits:document.documentElement.scrollWidth===innerWidth,header:hero.height,photoWidth:photo.width,feed:feed.height,nonOverlap:feed.bottom<=composer.top+1&&composer.bottom<=bar.top+1,composerVisible:composer.top>0&&composer.bottom<=innerHeight,iconsSmall:[...document.querySelectorAll('#chatFilters .community-icon,.chat-compose-row .community-icon')].every(el=>el.getBoundingClientRect().width<=18.1)};})()`);
    assert.equal(layout.fits,true,'Chat fits '+width+'x'+height);assert.equal(layout.nonOverlap,true,'Feed/composer/navigation do not overlap');assert.equal(layout.composerVisible,true,'Composer remains visible');assert.equal(layout.iconsSmall,true,'Compact glyphs with retained button targets');
    assert.ok(layout.header<=(height<=600?78:126),'Compact header');assert.ok(layout.feed>=60,'Usable conversation space '+JSON.stringify({width,height,...layout}));
    if(width===495&&height===770){assert.ok(layout.feed>=350,'At least 350px of conversation on the reported screen');assert.ok(layout.photoWidth>=190,'Larger landscape couple photo');await evaluate(`document.querySelectorAll('.competition-toast-close').forEach(b=>b.click());document.querySelectorAll('.activity-toast').forEach(el=>el.remove())`);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'chat-compact-495x770.png'),Buffer.from(shot.data,'base64'));}
    console.log('PASS compact Chat '+width+'x'+height+': header '+layout.header+'px, feed '+Math.round(layout.feed)+'px, visible composer');
  }
  assert.deepEqual(errors,[]);console.log('PASS read-only style preview: no chat, booking, OTP or payment writes; empty chat response mocked locally.');
};
