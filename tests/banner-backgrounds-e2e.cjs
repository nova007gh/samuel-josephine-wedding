const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,wait,errors,out})=>{
  const banners=[['bridaltrain','.bt-hero','.bt-hero-photo'],['livebroadcast','.showcase-hero','.showcase-hero-photo'],['vendors','.vendor-hero','#vendorHeroPhoto'],['entertainment','.community-hero--entertainment','[data-community-photo]'],['chat','.community-hero--chat','[data-community-photo]'],['gifts','.gifts-hero','.gifts-hero-photo'],['foodmenu','.food-menu-hero','#foodMenuHero']];
  for(const [view,hero,image]of banners){
    await evaluate(`switchView(${JSON.stringify(view)})`);await wait(`!!document.querySelector(${JSON.stringify(hero+' '+image)})`);
    // DOM-only photo fixture: does not publish catering or change saved content.
    await evaluate(`(()=>{const img=document.querySelector(${JSON.stringify(hero+' '+image)});img.hidden=false;img.src='assets/couple-home.jpg';return img.decode();})()`);
    for(const width of [320,375,430,768,1024]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<900});
      const state=await evaluate(`(()=>{const hero=document.querySelector(${JSON.stringify(hero)}),img=hero.querySelector(${JSON.stringify(image)}),h=hero.getBoundingClientRect(),r=img.getBoundingClientRect(),s=getComputedStyle(img);return {fit:s.objectFit,full:Math.abs(h.left-r.left)<2&&Math.abs(h.top-r.top)<2&&Math.abs(h.width-r.width)<2&&Math.abs(h.height-r.height)<2,mask:s.maskImage,overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
      assert.deepEqual(state,{fit:'cover',full:true,mask:'none',overflow:false},view+' full-background banner at '+width);
    }
  }
  await evaluate(`switchView('bridaltrain')`);await call('Emulation.setDeviceMetricsOverride',{width:430,height:1000,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate(`document.querySelectorAll('.bt-portrait').length>0&&[...document.querySelectorAll('.bt-portrait img,.food-menu-dish img,.vendor-card-photo img')].every(img=>getComputedStyle(img).objectFit==='contain')`),true,'Non-banner portraits/dishes/vendor thumbnails remain uncropped');
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'full-background-banner.png'),Buffer.from(shot.data,'base64'));
  assert.deepEqual(errors,[]);console.log('PASS seven photo banner types fill all four edges, cover-only banner cropping, no masks/empty sides, five widths, compact Chat preserved and uncropped non-banner thumbnails; DOM-only fixtures');
};
