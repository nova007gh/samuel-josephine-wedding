/* Read-only five-tab visual, nested navigation and routing regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  for(const width of [320,360,375,390,430,476,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const view of ['home','bridaltrain','livebroadcast']){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,600))`);
      const styles=await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).map(button=>{const css=getComputedStyle(button),rect=button.getBoundingClientRect(),icon=button.querySelector('svg,img').getBoundingClientRect(),label=button.querySelector('.tab-label'),text=label.getBoundingClientRect(),bar=button.closest('.tabbar').getBoundingClientRect();return {width:rect.width,height:rect.height,radius:css.borderRadius,padding:css.padding,margin:css.margin,border:css.borderWidth,font:css.fontSize,iconY:icon.top+icon.height/2,labelY:text.top+text.height/2,glow:getComputedStyle(button,'::before').animationName,visible:rect.left>=bar.left-1&&rect.right<=bar.right+1,labelFits:label.scrollWidth<=label.clientWidth+1};})`);
      assert.equal(styles.length,5);
      for(const [index,item] of styles.entries()){
        assert.ok(item.width>=44);assert.equal(item.height,index===2?64:56);
        assert.equal(item.visible,true,'Every button is visible without swiping at '+width);
        assert.equal(item.labelFits,true,'No clipped labels at '+width+' index '+index);
        for(const key of index===2?['margin','font']:['radius','padding','margin','border','font','glow'])assert.equal(item[key],styles[0][key],view+' consistent '+key+' at '+width);
        if(index===2)assert.equal(item.border,'0px','Gallery seal has no surrounding box');
        if(index!==2)assert.ok(Math.abs(item.iconY-styles[0].iconY)<1,'Neighbouring icon centres align');
        assert.ok(Math.abs(item.labelY-styles[0].labelY)<1,'Labels align, including larger Gallery '+JSON.stringify({index,label:item.labelY,base:styles[0].labelY}));
      }
      assert.equal(await evaluate(`(()=>{const size=parseFloat(getComputedStyle(document.querySelector('.tab--center .tab-seal')).width);return size>=44&&size<=56;})()`),true,'Larger unboxed pulsing seal');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--center .tab-seal')).animationName`),'gallerySealPulse');
      assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('.tabbar .tab')].map(b=>b.dataset.tab)`),['story','events','gallery','bridaltrain','gifts']);
      assert.equal(await evaluate(`(()=>{const bar=document.querySelector('.tabbar');bar.scrollLeft=999;return bar.scrollWidth<=bar.clientWidth+1&&bar.scrollLeft===0;})()`),true,'All five tabs fit without sideways scrolling');
    }
    const routes=await evaluate(`(async()=>{const result=[];for(const button of document.querySelectorAll('.tabbar .tab')){button.click();await new Promise(r=>setTimeout(r,600));const b=button.getBoundingClientRect(),bar=button.closest('.tabbar').getBoundingClientRect();result.push({name:button.dataset.tab,correct:currentView===button.dataset.tab&&button.getAttribute('aria-current')==='page',visible:b.left>=bar.left-1&&b.right<=bar.right+1,bounds:[b.left,b.right,bar.left,bar.right]});}return result;})()`);
    assert.equal(routes.every(row=>row.correct&&row.visible),true,'Every destination routes and selected tab remains visible at '+width+' '+JSON.stringify(routes));
    await evaluate(`switchView('home');new Promise(r=>setTimeout(r,600))`);
    const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:824,width,height:76,scale:1}});fs.writeFileSync(path.join(out,'navigation-'+width+'.png'),Buffer.from(shot.data,'base64'));
    const nested=await evaluate(`(()=>{const ok=[];const check=(name,parent)=>ok.push(currentView===name&&document.querySelector('.tab.active')?.dataset.tab===parent);switchView('events');document.querySelector('[data-view="events"] [data-goto="entertainment"]').click();check('entertainment','events');document.querySelector('[data-view="entertainment"] [data-goto="chat"]').click();check('chat','events');document.querySelector('[data-view="chat"] [aria-label="Back to Entertainment"]').click();check('entertainment','events');document.querySelector('[data-view="entertainment"] [aria-label="Back to Events"]').click();check('events','events');document.querySelector('[data-view="events"] [data-goto="livebroadcast"]').click();check('livebroadcast','events');document.querySelector('[data-view="livebroadcast"] .back-link[data-goto="events"]').click();check('events','events');document.querySelector('.app-brand').click();ok.push(currentView==='home'&&!document.querySelector('.tab.active'));return ok;})()`);
    assert.equal(nested.every(Boolean),true,'Nested Entertainment/Chat/Live and header Home routes work');
    console.log('PASS five tabs, centred pulsing Gallery, nested Events/Entertainment/Chat/Live routes and header Home at '+width+'px');
  }
  assert.equal(await evaluate(`(async()=>{switchView('events');document.querySelector('[data-view="events"] [data-goto="entertainment"]').click();document.querySelector('[data-view="entertainment"] [data-goto="chat"]').click();const waitBack=()=>Promise.race([new Promise(resolve=>{window.addEventListener('popstate',()=>setTimeout(()=>resolve(true),0),{once:true});history.back();}),new Promise(resolve=>setTimeout(()=>resolve(false),2000))]);if(!await waitBack()||currentView!=='entertainment')return false;if(!await waitBack()||currentView!=='events')return false;return document.querySelector('.tab.active')?.dataset.tab==='events';})()`),true,'Native Back follows Chat → Entertainment → Events');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).every(button=>getComputedStyle(button,'::before').animationName==='none')`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--center .tab-seal')).animationName`),'none');
  assert.equal(errors.length,0);console.log('PASS reduced-motion disables all tab pulses; no JS errors or live writes');
};
