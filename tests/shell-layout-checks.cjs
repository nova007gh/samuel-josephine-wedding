/* Public guest pages only; no saves, submissions, providers or microphone use. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  const diagnostic=process.env.WEDDING_SHELL_AUDIT==='1';
  const widthFilter=process.env.WEDDING_SHELL_WIDTH;
  assert.ok(!widthFilter||[320,375,430,768,1024].includes(Number(widthFilter)),'Choose a supported shell test width');
  const views=['home','story','events','gallery','memories','gifts','more','bridaltrain','livebroadcast','guestbook','rsvp','voicemsg','videomsg','competitions','program','engagementprogram','adminlogin'];
  const results=[];
  await evaluate(`document.querySelector('.competition-toast-close')?.click();document.querySelectorAll('.activity-toast').forEach(el=>el.remove())`);
  for(const width of diagnostic?[375]:widthFilter?[Number(widthFilter)]:[320,375,430,768,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const view of views){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,250))`);
      const samples=[];
      for(let i=0;i<4;i++)samples.push(await evaluate(`(async()=>{window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});await new Promise(r=>setTimeout(r,120));return {height:document.documentElement.scrollHeight,y:scrollY,width:document.documentElement.scrollWidth};})()`));
      const last=samples.at(-1);results.push({width,view,samples});
      if(!diagnostic){assert.equal(last.width,width,view+' page width at '+width);assert.ok(Math.abs(last.height-samples.at(-2).height)<=2,view+' reaches a finite bottom at '+width);}
      if(diagnostic)console.log(width,view,JSON.stringify(samples));
    }
    if(!diagnostic){
      const navigation=await evaluate(`(async()=>{const checks=[];for(const tab of document.querySelectorAll('.tabbar .tab')){tab.click();await new Promise(r=>setTimeout(r,600));const b=tab.getBoundingClientRect(),bar=tab.closest('.tabbar'),n=bar.getBoundingClientRect();checks.push({name:tab.dataset.tab,active:tab.getAttribute('aria-current')==='page'&&currentView===tab.dataset.tab,visible:b.left>=n.left-1&&b.right<=n.right+1,touch:b.width>=24&&b.height>=44,rect:[b.left,b.right,n.left,n.right],scroll:bar.scrollLeft});}return checks;})()`);
      assert.equal(navigation.length,9);assert.ok(navigation.every(x=>x.active&&x.visible&&x.touch),'All tabs visible on selection, active and tappable at '+width+' '+JSON.stringify(navigation));
      assert.equal(await evaluate(`document.querySelectorAll('.tabbar .tab')[4].dataset.tab`),'gallery');
      console.log('PASS guest/sign-in pages reach finite bottoms and all nine tabs route/fit at '+width+'px');
    }
  }
  if(!diagnostic){
    await call('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:true});
    for(const view of ['bridaltrain','livebroadcast']){
      await evaluate(`switchView(${JSON.stringify(view)});new Promise(r=>setTimeout(r,600))`);
      const start=await evaluate(`(()=>{window.scrollTo({top:150,behavior:'instant'});window.__scrollCalls=[];window.__savedScrollTo=window.scrollTo;window.__savedScrollIntoView=Element.prototype.scrollIntoView;window.scrollTo=function(...args){window.__scrollCalls.push('window');return window.__savedScrollTo.apply(this,args);};Element.prototype.scrollIntoView=function(...args){window.__scrollCalls.push('element');return window.__savedScrollIntoView.apply(this,args);};return {y:scrollY,height:document.documentElement.scrollHeight};})()`);
      // Cross a real 15-second metadata/settings polling interval without input.
      await evaluate(`new Promise(r=>setTimeout(r,16500))`);
      const after=await evaluate(`(()=>{const result={y:scrollY,height:document.documentElement.scrollHeight,calls:window.__scrollCalls};window.scrollTo=window.__savedScrollTo;Element.prototype.scrollIntoView=window.__savedScrollIntoView;return result;})()`);
      assert.deepEqual(after.calls,[],view+' polling must not issue scroll commands');
      assert.ok(Math.abs(after.height-start.height)<=2&&Math.abs(after.y-start.y)<=2,view+' stable height/position across polling '+JSON.stringify({start,after}));
      const retained=await evaluate(`(()=>{const y=scrollY;document.querySelector('.tab.active').click();return Math.abs(y-scrollY)<1;})()`);assert.equal(retained,true,'Tapping active tab does not jump');
      console.log('PASS '+view+' stays still across a real refresh cycle and repeated active-tab tap');
    }
    await evaluate(`document.querySelector('.lb-menu').click()`);assert.equal(await evaluate(`currentView`),'more','Dynamic broadcast menu routes');
    await evaluate(`switchView('livebroadcast');document.querySelector('.lb-monogram').click()`);assert.equal(await evaluate(`currentView`),'home');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--showcase'),'::before').animationName`),'showcaseGoldGlow');
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.tab--showcase'),'::before').animationName`),'none');
    await call('Emulation.setEmulatedMedia',{features:[]});
    for(const view of ['home','bridaltrain','livebroadcast']){
      await evaluate(`switchView(${JSON.stringify(view)});window.scrollTo({top:0,behavior:'instant'});new Promise(r=>setTimeout(r,500))`);
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,'polished-'+view+'.png'),Buffer.from(shot.data,'base64'));
    }
    console.log('PASS gold pulse, reduced-motion support, hero navigation and no passive scrolling');
  }
  fs.writeFileSync(path.join(out,'shell-layout.json'),JSON.stringify(results,null,2));
  assert.equal(errors.length,0,'No uncaught JS errors');
};
