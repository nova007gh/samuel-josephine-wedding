const assert=require('node:assert/strict');
module.exports=async({call,evaluate,errors})=>{
  const result=await evaluate(`(async()=>{const rows=await api('/memories');latestMemories=rows;switchView('story');document.querySelector('[data-story-tab="sjgallery"]').click();renderSjStoryPanel();const expected=sortedStoryGallery(rows.filter(m=>m.status==='approved'&&m.category==='sj-gallery'&&m.mediaUrl));return {expected:expected.map(m=>m.caption||'—'),actual:[...document.querySelectorAll('#sjStoryGrid .mem-cap')].map(el=>el.textContent),adminButtons:document.querySelectorAll('#sjStoryGrid [data-sj-move]').length};})()`);
  assert.deepEqual(result.actual,result.expected);assert.equal(result.adminButtons,0);
  const previews=await evaluate(`(async()=>{const rows=await api('/memories');return [...document.querySelectorAll('#sjStoryGrid img')].every(img=>{const row=rows.find(m=>m.mediaUrl===img.dataset.fullSrc);return !!row&&img.getAttribute('src')===(row.thumbnailUrl||row.mediaUrl);});})()`);
  assert.equal(previews,true,'Photo cards use available previews while retaining original full-screen source');
  for(const width of [320,375,430,1024]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true);}
  assert.equal(await evaluate(`(async()=>{const response=await fetch('/api/admin/gallery/order',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[],expected:[]})});return response.status;})()`),401);
  assert.equal(errors.length,0);
  console.log('PASS read-only live Our Story album matches persisted order, guest controls hidden, mobile widths and unauthenticated reorder rejected; no live changes');
};
