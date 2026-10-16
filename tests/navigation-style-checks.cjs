/* Read-only nine-tab visual and routing regression. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  for(const width of [320,375,430,476,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const view of ['home','bridaltrain','livebroadcast']){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,600))`);
      const styles=await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).map(button=>{const css=getComputedStyle(button),rect=button.getBoundingClientRect(),icon=button.querySelector('svg,img').getBoundingClientRect(),text=Array.from(button.childNodes).find(n=>n.nodeType===3&&n.textContent.trim()),range=document.createRange();range.selectNode(text);return {width:rect.width,height:rect.height,radius:css.borderRadius,padding:css.padding,margin:css.margin,border:css.borderWidth,font:css.fontSize,iconY:icon.top+icon.height/2,labelY:range.getBoundingClientRect().top,glow:getComputedStyle(button,'::before').animationName};})`);
      assert.equal(styles.length,9);
      for(const item of styles){assert.ok(item.width>=44);assert.equal(item.height,64);for(const key of ['radius','padding','margin','border','font','glow'])assert.equal(item[key],styles[0][key],view+' uniform '+key+' at '+width);assert.ok(Math.abs(item.iconY-styles[0].iconY)<1,'Icon centres align');assert.ok(Math.abs(item.labelY-styles[0].labelY)<1,'Labels align');}
      assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);
      assert.equal(await evaluate(`document.querySelectorAll('.tabbar .tab')[4].dataset.tab`),'gallery');
    }
    const routes=await evaluate(`(async()=>{const result=[];for(const button of document.querySelectorAll('.tabbar .tab')){button.click();await new Promise(r=>setTimeout(r,600));const b=button.getBoundingClientRect(),bar=button.closest('.tabbar').getBoundingClientRect();result.push({name:button.dataset.tab,correct:currentView===button.dataset.tab&&button.getAttribute('aria-current')==='page',visible:b.left>=bar.left-1&&b.right<=bar.right+1,bounds:[b.left,b.right,bar.left,bar.right]});}return result;})()`);
    assert.equal(routes.every(row=>row.correct&&row.visible),true,'Every destination routes and selected tab remains visible at '+width+' '+JSON.stringify(routes));
    await evaluate(`switchView('home');new Promise(r=>setTimeout(r,600))`);
    const shot=await call('Page.captureScreenshot',{format:'png',clip:{x:0,y:820,width,height:80,scale:1}});fs.writeFileSync(path.join(out,'navigation-'+width+'.png'),Buffer.from(shot.data,'base64'));
    console.log('PASS uniform nine-tab size, spacing, icon/label alignment, glow and routing at '+width+'px');
  }
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.tabbar .tab')).every(button=>getComputedStyle(button,'::before').animationName==='none')`),true);
  assert.equal(errors.length,0);console.log('PASS reduced-motion disables all tab pulses; no JS errors or live writes');
};
