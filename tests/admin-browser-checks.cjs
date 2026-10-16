const assert = require('node:assert/strict');

/* The real deployed UI, with isolated mock admin responses and uploads.
   This validates layout/interaction, not authentication or server writes. */
module.exports = async ({call,evaluate,errors,out}) => {
  await evaluate(`(()=>{
    const original=window.fetch;
    window.fetch=async(url,opts)=>String(url).startsWith('/api/admin/')
      ? new Response(JSON.stringify(String(url)==='/api/admin/gift-funds'
        ? [{id:'cash',label:'Cash Gift',description:'Send in your cherished wedding gifts.',sortOrder:0,enabled:1}] : []),
        {status:200,headers:{'Content-Type':'application/json'}})
      : original(url,opts);
    setAdminToken('isolated-layout-fixture');
    switchView('admin');
  })()`);
  if (process.argv.includes('--admin-gifts')){
    await require('./admin-gifts-checks.cjs')({call,evaluate,errors,out});
    return;
  }
  if (process.argv.includes('--gift-message')){
    await require('./gift-message-checks.cjs')({evaluate,errors});
    return;
  }
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    const checks=await evaluate(`(()=>{
      return [...document.querySelectorAll('[data-admin-section]')].map(tab=>{
        tab.click();
        const active=[...document.querySelectorAll('.admin-section-panel')].filter(p=>!p.classList.contains('hidden'));
        const rect=tab.getBoundingClientRect();
        return {section:tab.dataset.adminSection,
          selected:active.length===1&&active[0].id===tab.getAttribute('aria-controls'),
          fits:rect.left>=0&&rect.right<=innerWidth+.5,
          noOverflow:document.documentElement.scrollWidth===innerWidth};
      });
    })()`);
    assert.equal(checks.length,12);
    for(const check of checks){
      assert.equal(check.selected,true,check.section+' panel selection');
      assert.equal(check.fits,true,check.section+' tab overflow at '+width);
      assert.equal(check.noOverflow,true,check.section+' page overflow at '+width);
    }
    console.log('PASS twelve dashboard categories at',width,'pixels (mock admin responses)');
  }
  const photo=await evaluate(`(async()=>{
    document.getElementById('admin-tab-gifts').click();
    document.getElementById('giftPhotoShortcut').click();
    const card=document.querySelector('[data-photo-slot="gifts-hero"]');
    const selected=document.getElementById('admin-tab-photos').getAttribute('aria-selected')==='true';
    const labelled=card.textContent.includes('Gift Page Photo')&&card.textContent.includes('UPLOAD / CHANGE PHOTO');
    const input=document.getElementById('sitePhotoInput'),click=input.click,original=uploadSitePhoto;
    const home=document.getElementById('couplePhoto').src;
    let picker=false,slotSeen,progressLabel;
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';
    try{
      input.click=()=>{picker=true;};
      uploadSitePhoto=async(file,slot,progress)=>{
        slotSeen=slot;progress(43);progressLabel=card.querySelector('button').textContent;
        progress(100);return {url:image};
      };
      card.querySelector('button').click();
      const dt=new DataTransfer();dt.items.add(new File(['test'],'mock-photo.png',{type:'image/png'}));
      input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,100));
      return {selected,labelled,picker,correctSlot:slotSeen==='gifts-hero',progress:progressLabel==='UPLOADING 43%…',
        heroUpdated:document.querySelector('.gifts-hero-photo').src===image,
        homeUnchanged:document.getElementById('couplePhoto').src===home,
        buttonRestored:document.querySelector('[data-photo-slot="gifts-hero"] button').textContent==='UPLOAD / CHANGE PHOTO'};
    }finally{input.click=click;uploadSitePhoto=original;}
  })()`);
  for(const [name,passed] of Object.entries(photo))assert.equal(passed,true,'Gift Page Photo '+name);
  console.log('PASS Gift Page Photo shortcut, picker, percentage and hero update; home unchanged (upload mocked)');
  const upload=await evaluate(`(async()=>{
    document.getElementById('admin-tab-story').click();
    const original=addCoupleMemory;
    let release,calls=0;
    const held=new Promise(resolve=>release=resolve);
    addCoupleMemory=async(file,caption,progress)=>{
      calls++;progress(37);await held;progress(100);
      return {id:'isolated-'+calls,category:'sj-gallery',kind:'gallery',status:'approved',
        type:'image/png',mediaUrl:'assets/couple-home.jpg',createdAt:Date.now()};
    };
    try{
      const dt=new DataTransfer();
      const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
      for(let i=1;i<=2;i++)dt.items.add(new File([bytes],'isolated-'+i+'.png',{type:'image/png'}));
      document.getElementById('sjFiles').files=dt.files;
      document.getElementById('sjFiles').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('sjPublish').click();
      document.getElementById('admin-tab-photos').click();
      document.getElementById('admin-tab-story').click();
      const progressPreserved=document.getElementById('sjUploadBar').value===37
        &&document.getElementById('sjUploadStatus').textContent.includes('Uploading 37%');
      document.getElementById('sjPublish').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      document.getElementById('sjClear').click();
      const duplicateBlocked=calls===1;
      const picksPreserved=sjPending.length===2;
      switchView('story');switchView('admin');
      const routePreserved=sjUploading&&sjPending.length===2&&document.getElementById('sjUploadBar').value===37;
      release();
      for(let i=0;i<100&&sjUploading;i++)await new Promise(resolve=>setTimeout(resolve,20));
      return {progressPreserved,duplicateBlocked,picksPreserved,routePreserved,
        finished:!sjUploading&&sjPending.length===0&&calls===2,
        controlsRestored:!document.getElementById('sjPick').disabled&&!document.getElementById('sjPublish').disabled};
    }finally{release();addCoupleMemory=original;}
  })()`);
  for(const [name,passed] of Object.entries(upload))assert.equal(passed,true,name);
  assert.equal(errors.length,0,'Uncaught browser exceptions');
  console.log('PASS navigation during upload, retained progress/files, duplicate-submit guard and completion (uploads mocked)');
};
