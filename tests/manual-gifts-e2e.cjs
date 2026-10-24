const assert=require('node:assert/strict');
module.exports=async({call,evaluate,wait,request,errors})=>{
  for(const p of ['/gift-payments/config','/gift-payments','/admin/gift-payments','/payments/speso/test/webhook','/payments/speso/live/webhook']){
    const r=await request(p,{method:'POST',body:{},status:410});assert.equal(r.data.manualOnly,true);
  }
  await request('/gifts',{method:'POST',body:{name:'Unapproved',fund:'cash',amountCents:5000},status:403});
  const funds=(await request('/gift-funds',{admin:true})).data;assert.deepEqual(funds.map(x=>x.id),['cash']);
  await evaluate(`switchView('gifts');refreshGiftView()`);await wait(`document.querySelectorAll('.gift-fund').length===1&&document.getElementById('giftMoMoNumber').value!==''`);
  assert.equal(await evaluate(`!document.getElementById('spesoPaymentPanel')&&![...document.scripts].some(x=>x.src.includes('speso'))`),true);
  const body={name:'Disposable manual gift',fund:'cash',amountCents:7550,provider:'mtn',requestKey:require('node:crypto').randomUUID(),message:'Not verified'};
  const post=b=>request('/gifts',{method:'POST',admin:true,body:b});
  const rows=await Promise.all([post(body),post(body)]);assert.equal(rows[0].data.id,rows[1].data.id);assert.equal(rows[0].data.paymentVerified,false);
  await request('/gifts',{method:'POST',admin:true,body:{...body,amountCents:9000},status:409});
  await request('/gifts',{method:'POST',admin:true,body:{...body,fund:'house'},status:400});
  await request('/gifts',{method:'POST',admin:true,body:{...body,amountCents:5000.1},status:400});
  const wall=(await request('/gifts',{admin:true})).data;assert.equal(wall.filter(x=>x.name===body.name).length,1);assert.equal(wall.find(x=>x.name===body.name).paymentVerified,false);assert.ok(wall.every(x=>!('phone'in x)&&!('email'in x)&&!('txnRef'in x)));
  await evaluate(`document.getElementById('giftName').value='Browser manual report';document.getElementById('giftForm').requestSubmit()`);await wait(`document.getElementById('giftStatus').textContent.includes('not a verified payment')`);
  for(const width of [320,375,430,768,1024]){await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,'No horizontal overflow '+width);}
  assert.deepEqual(errors,[]);console.log('PASS manual-only gifts: retired routes, approval, cash-only, concurrent retry deduplication, conflicts, validation, privacy, actual browser report and five widths; disposable data only');
};
