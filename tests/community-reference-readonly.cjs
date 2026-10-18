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
  assert.deepEqual(errors,[]);console.log('PASS read-only style preview: no chat, booking, OTP or payment writes; empty chat response mocked locally.');
};
