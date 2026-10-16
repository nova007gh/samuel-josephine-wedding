/* Read-only nine-tab visual and routing regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  for(const width of [320,375,430,476,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const view of ['home','bridaltrain','livebroadcast']){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,600))`);
      const styles=await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).map(button=>{const css=getComputedStyle(button),rect=button.getBoundingClientRect(),icon=button.querySelector('svg,img').getBoundingClientRect(),text=Array.from(button.childNodes).find(n=>n.nodeType===3&&n.textContent.trim()),range=document.createRange();range.selectNode(text);return {width:rect.width,height:rect.height,radius:css.borderRadius,padding:css.padding,margin:css.margin,border:css.borderWidth,font:css.fontSize,iconY:icon.top+icon.height/2,labelY:range.getBoundingClientRect().top,glow:getComputedStyle(button,'::before').animationName};})`);
      assert.equal(styles.length,9);
      for(const [index,item] of styles.entries()){
        assert.ok(item.width>=(index===4?64:44));assert.equal(item.height,index===4?84:64);
        for(const key of index===4?['margin','border','font','glow']:['radius','padding','margin','border','font','glow'])assert.equal(item[key],styles[0][key],view+' consistent '+key+' at '+width);
        if(index!==4)assert.ok(Math.abs(item.iconY-styles[0].iconY)<1,'Neighbouring icon centres align');
        assert.ok(Math.abs(item.labelY-styles[0].labelY)<1,'Labels align, including larger Gallery');
      }
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--center .tab-seal')).width`),'52px');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--center .tab-seal')).animationName`),'gallerySealPulse');
      assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.tabbar .tab')[4].dataset.tab`),'gallery');
    }
    const routes=await evaluate(`(async()=>{const result=[];for(const button of document.querySelectorAll('.tabbar .tab')){button.click();await new Promise(r=>setTimeout(r,600));const b=button.getBoundingClientRect(),bar=button.closest('.tabbar').getBoundingClientRect();result.push({name:button.dataset.tab,correct:currentView===button.dataset.tab&&button.getAttribute('aria-current')==='page',visible:b.left>=bar.left-1&&b.right<=bar.right+1,bounds:[b.left,b.right,bar.left,bar.right]});}return result;})()`);
    assert.equal(routes.every(row=>row.correct&&row.visible),true,'Every destination routes and selected tab remains visible at '+width+' '+JSON.stringify(routes));
    await evaluate(`switchView('home');new Promise(r=>setTimeout(r,600))`);
    const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:804,width,height:96,scale:1}});fs.writeFileSync(path.join(out,'navigation-'+width+'.png'),Buffer.from(shot.data,'base64'));
    console.log('PASS larger pulsing Gallery, aligned neighbouring tabs/labels, glow and nine routes at '+width+'px');
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).every(button=>getComputedStyle(button,'::before').animationName==='none')`),true);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--center .tab-seal')).animationName`),'none');
  assert.equal(errors.length,0);console.log('PASS reduced-motion disables all tab pulses; no JS errors or live writes');
};
