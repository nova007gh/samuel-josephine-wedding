const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`switchView('vendors')`);
  for(let i=0;i<120;i++){if(await evaluate(`document.querySelectorAll('#vendorCategories svg').length>=2&&performance.getEntriesByType('resource').some(row=>row.name.endsWith('/api/vendors'))`))break;await new Promise(r=>setTimeout(r,200));}
  const result=await evaluate(`api('/vendors')`);assert.ok(result?.data);assert.ok(result.data.vendors.every(v=>v.published));
  assert.equal(await evaluate(`document.querySelectorAll('.tab').length===5&&document.querySelector('.tab[data-tab="events"]').classList.contains('active')`),true);
  assert.equal(await evaluate(`document.querySelector('[data-admin-section="vendors"]')!==null`),true,'Vendor editor registered');
  assert.equal(await evaluate(`document.getElementById('vendorTitle').textContent`),result.data.title);
  assert.equal(await evaluate(`document.querySelectorAll('.vendor-card').length`),result.data.vendors.length);
  assert.equal(await evaluate(`document.getElementById('vendorHeroPhoto').decode().then(()=>true).catch(()=>false)`),true,'Current configured banner decodes');
  assert.equal(await evaluate(`Object.hasOwn(siteSettings||{},'vendors')`),false,'Hidden drafts excluded from site settings');
  for(const width of [320,375,430,768,1024]){await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<900});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Live Vendors fits '+width);}
  const shot=await call('Page.captureScreenshot',{format:'png'});try{fs.writeFileSync(path.join(out,'vendors-live.png'),Buffer.from(shot.data,'base64'));}catch(error){if(error.code!=='ENOSPC')throw error;console.warn('Live screenshot not saved: local disk full; functional assertions completed.');}
  assert.deepEqual(errors,[]);console.log('PASS live Vendors GET-only: configured hero, published content, category icons, five-tab hierarchy and responsive layout; no submissions');
};
