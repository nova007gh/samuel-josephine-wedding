const assert=require('node:assert/strict');
module.exports=async({call,evaluate,wait,request})=>{
  await evaluate(`(async()=>{await adminSignIn('', 'isolated-browser-only');switchView('admin');document.querySelector('[data-admin-section="story"]').click();window.__orderRecords=[];for(let i=0;i<3;i++){const file=new File(['test'+i],i===1?'clip.mp4':'photo.png',{type:i===1?'video/mp4':'image/png'});window.__orderRecords.push(await addCoupleMemory(file,'Order test '+i));}adminMemories=await api('/admin/memories',{admin:true});renderSjAdminGrid();})()`);
  await wait(`window.__orderRecords?.length===3&&document.querySelectorAll('#sjGrid [data-sj-id]').length===3`);
  const before=await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery')).map(m=>m.id)`);
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Order controls fit '+width);
  }
  const move=async(id,action)=>{
    await evaluate(`document.querySelector('#sjGrid [data-sj-id="${id}"] [data-sj-move="${action}"]').click()`);
    await wait(`!sjOrderBusy&&document.getElementById('sjOrderStatus').textContent.includes('Order saved')`);
  };
  await move(before[2],'first');
  assert.deepEqual(await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery')).map(m=>m.id)`),[before[2],before[0],before[1]]);
  await move(before[2],'down');await move(before[2],'up');await move(before[2],'last');
  assert.deepEqual(await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery')).map(m=>m.id)`),before);
  const stored=(await request('/memories')).data.filter(m=>m.category==='sj-gallery').sort((a,b)=>a.sjOrder-b.sjOrder);
  assert.deepEqual(stored.map(m=>m.id),before);
  await request('/admin/gallery/order',{method:'PATCH',body:{ids:before,expected:before},status:401});
  await request('/admin/gallery/order',{admin:true,method:'PATCH',body:{ids:[before[0],before[0],before[2]],expected:before},status:400});
  await request('/admin/gallery/order',{admin:true,method:'PATCH',body:{ids:before,expected:before.slice().reverse()},status:409});
  await evaluate(`window.__orderSave=saveStoryGalleryOrder;saveStoryGalleryOrder=async()=>{throw new Error('Synthetic order failure');};document.querySelector('#sjGrid [data-sj-move="last"]').click()`);
  await wait(`!sjOrderBusy&&document.getElementById('sjOrderStatus').textContent.includes('Synthetic order failure')`);
  assert.deepEqual(await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery')).map(m=>m.id)`),before,'Failed save leaves saved order intact');
  await evaluate(`saveStoryGalleryOrder=window.__orderSave;window.__orderCount=0;saveStoryGalleryOrder=async(...args)=>{window.__orderCount++;await new Promise(r=>setTimeout(r,200));return window.__orderSave(...args);};const b=document.querySelector('#sjGrid [data-sj-move="last"]');b.click();b.click()`);
  await wait(`!sjOrderBusy&&document.getElementById('sjOrderStatus').textContent.includes('Order saved')`);
  assert.equal(await evaluate(`window.__orderCount`),1,'Duplicate move taps send only one save');
  await evaluate(`saveStoryGalleryOrder=window.__orderSave;latestMemories=adminMemories.filter(m=>m.status==='approved');renderSjStoryPanel();window.__orderGuest=[...document.querySelectorAll('#sjStoryGrid .mem-cap')].map(el=>el.textContent);`);
  const expectedCaps=await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery')).map(m=>m.caption)`);
  assert.deepEqual(await evaluate(`window.__orderGuest`),expectedCaps,'Guest album uses the saved order across photos/videos');
  await evaluate(`(async()=>{window.__newStoryRecord=await addCoupleMemory(new File(['new'],'new.png',{type:'image/png'}),'Newest upload');adminMemories=await api('/admin/memories',{admin:true});renderSjAdminGrid();})()`);
  await wait(`document.querySelectorAll('#sjGrid [data-sj-id]').length===4`);
  assert.equal(await evaluate(`sortedStoryGallery(adminMemories.filter(m=>m.category==='sj-gallery'))[0].id===window.__newStoryRecord.id`),true,'New upload appears first without losing prior custom order');
  await evaluate(`(async()=>{await api('/admin/logout',{method:'POST',admin:true});setAdminToken(null);})()`);
  await wait(`!isAdmin()`);
  assert.equal(await evaluate(`document.querySelectorAll('#sjGrid [data-sj-move]').length`),0);
  console.log('PASS real album order: all four moves, mixed photo/video, public order, mobile controls, auth, duplicate/stale/invalid guards, failed-save retry and sign-out cleanup (disposable database)');
};
