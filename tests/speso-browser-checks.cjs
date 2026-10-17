const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports.setup=async({call})=>{
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const original=window.fetch;
    const state=window.__spesoMock={mode:sessionStorage.getItem('__speso_mock_mode')||'off',requests:0,prompts:0,loseResponse:true,completed:false,failBefore:false,orders:JSON.parse(sessionStorage.getItem('__speso_mock_orders')||'{}')};
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    window.fetch=async(url,options={})=>{
      const route=String(url);
      if(route==='/api/gift-funds')return response([{id:'cash',label:'Cash Gift',description:'Fixture fund'}]);
      if(route==='/api/momo-settings')return response({number:'+233240000099',accountName:'Fixture merchant'});
      if(route==='/api/gifts'&&(!options.method||options.method==='GET'))return response([]);
      if(route==='/api/gift-payments/config'){sessionStorage.setItem('__speso_mock_mode',state.mode);return response({enabled:state.mode!=='off',mode:state.mode,merchant:'Fixture merchant',minAmountCents:5000,maxAmountCents:2000000});}
      if(route.startsWith('/api/gift-payments')){
        if(route==='/api/gift-payments'){
          state.requests++;const body=JSON.parse(options.body);state.lastBody=body;
          if(state.failBefore){state.failBefore=false;return response({error:'Gift option no longer available',code:'payment/not-started'},400);}
          let result=state.orders[body.secret];
          if(!result){state.prompts++;result={id:'SJ-'+crypto.randomUUID().replaceAll('-',''),mode:state.mode,status:'processing',amountCents:body.amountCents};state.orders[body.secret]=result;sessionStorage.setItem('__speso_mock_orders',JSON.stringify(state.orders));}
          await new Promise(r=>setTimeout(r,150));
          if(state.loseResponse){state.loseResponse=false;throw new Error('Synthetic lost response');}
          return response(result);
        }
        if(route.endsWith('/status')){
          state.statusRequests=(state.statusRequests||0)+1;
          const body=JSON.parse(options.body),result=state.orders[body.secret];
          if(!result)return response({error:'Unknown mock order'},404);
          return response({...result,status:state.completed?'completed':'processing'});
        }
        throw new Error('Unexpected payment route blocked by mock');
      }
      if(route.startsWith('/api/admin/gift-payments'))return response([]);
      return original(url,options);
    };
  })();`});
};
module.exports.check=async({call,evaluate,errors,out})=>{
  const wait=async expression=>{for(let i=0;i<300;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,50));}throw new Error('Speso UI wait: '+expression);};
  await wait(`document.querySelectorAll('.gift-fund').length>0`);
  assert.equal(await evaluate(`document.getElementById('spesoPaymentPanel').classList.contains('hidden')`),true,'Off retains existing gift flow');
  await evaluate(`window.__spesoMock.mode='test';window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await evaluate(`new Promise(r=>setTimeout(r,200))`);
  assert.equal(await evaluate(`document.getElementById('spesoPaymentPanel').classList.contains('hidden')`),true,'Sandbox hidden from guests');
  await evaluate(`document.getElementById('spesoPaymentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  assert.equal(await evaluate(`window.__spesoMock.requests`),0,'Guests cannot trigger sandbox requests');
  await evaluate(`window.__spesoMock.mode='live';window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await wait(`!document.getElementById('spesoPaymentPanel').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.querySelector('.gift-momo').classList.contains('hidden')&&document.getElementById('giftConfirmWrap').classList.contains('hidden')`),true,'Do not offer manual transfer during online checkout');
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});
    assert.equal(await evaluate(`document.documentElement.scrollWidth===innerWidth`),true,'Speso form fits '+width);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('#spesoPaymentForm input,#spesoPaymentForm textarea')).every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)`),true);
  }
  await evaluate(`document.querySelector('[data-amount="other"]').click();document.getElementById('giftOtherAmount').value='75.50';document.getElementById('giftOtherAmount').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-provider="telecel"]').click();document.getElementById('spesoPayerName').value='Mock payer';document.getElementById('spesoPayerPhone').value='0240000001';document.getElementById('spesoPayerMessage').value='Mock gift';document.getElementById('spesoPaymentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.getElementById('spesoPaymentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));`);
  await wait(`!document.getElementById('spesoCheckPayment').disabled`);
  assert.deepEqual(await evaluate(`({requests:window.__spesoMock.requests,prompts:window.__spesoMock.prompts,cents:window.__spesoMock.lastBody.amountCents,provider:window.__spesoMock.lastBody.provider,locked:document.getElementById('spesoPayerPhone').disabled})`),{requests:1,prompts:1,cents:7550,provider:'telecel',locked:true});
  assert.equal(await evaluate(`document.getElementById('spesoPaymentStatus').textContent.includes('Do not pay again')`),true);
  await evaluate(`document.getElementById('spesoCheckPayment').click()`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('Awaiting payment')&&!document.getElementById('spesoCheckPayment').disabled`);
  assert.deepEqual(await evaluate(`({requests:window.__spesoMock.requests,prompts:window.__spesoMock.prompts})`),{requests:2,prompts:1},'Lost response recovers same prompt');
  await call('Page.reload');await new Promise(r=>setTimeout(r,1000));await wait(`document.readyState==='complete'&&typeof setGuest==='function'&&typeof switchView==='function'&&!!window.__spesoMock`);
  await evaluate(`setGuest({name:'Mock payer'});enterApp();window.__spesoMock.mode='live';switchView('gifts');window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('Awaiting payment')`);
  assert.equal(await evaluate(`document.getElementById('spesoPayerPhone').value`),'0240000001','Pending donor restored after reload');
  await evaluate(`window.__spesoMock.completed=true;document.getElementById('spesoCheckPayment').click()`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('Payment confirmed')`);
  assert.equal(await evaluate(`window.__spesoMock.requests`),0,'Reload/status checks do not initiate another collection');
  await evaluate(`document.getElementById('spesoNewPayment').click();window.__spesoMock.failBefore=true;document.getElementById('spesoPayerName').value='Mock payer';document.getElementById('spesoPayerPhone').value='0240000002';document.getElementById('spesoPaymentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('No new payment prompt')`);
  assert.equal(await evaluate(`document.getElementById('spesoNewPayment').classList.contains('hidden')`),false,'Definitive no-prompt rejection can restart');
  assert.equal(await evaluate(`window.__spesoMock.prompts`),0);
  // Mock the admin predicate only; never authenticate against the live API.
  await evaluate(`document.getElementById('spesoNewPayment').click();window.__spesoOriginalAdmin=isAdmin;isAdmin=()=>true;window.__spesoMock.mode='test';window.__spesoMock.loseResponse=false;window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await wait(`document.getElementById('spesoModeNotice').textContent.includes('SANDBOX')&&!document.getElementById('spesoPaymentPanel').classList.contains('hidden')`);
  await evaluate(`document.getElementById('spesoPayerName').value='Sandbox admin';document.getElementById('spesoPayerPhone').value='0240000003';document.getElementById('spesoPaymentForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('Sandbox: Awaiting')&&!document.getElementById('spesoCheckPayment').disabled`);
  await evaluate(`document.getElementById('spesoCheckPayment').click()`);
  await wait(`document.getElementById('spesoPaymentStatus').textContent.includes('No real gift was recorded')`);
  await evaluate(`document.getElementById('spesoRefreshActivity').click()`);
  await wait(`document.getElementById('spesoPaymentActivity').textContent.includes('No Speso payment attempts')`);
  await evaluate(`isAdmin=window.__spesoOriginalAdmin;window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await wait(`document.getElementById('spesoPaymentPanel').classList.contains('hidden')`);
  await evaluate(`isAdmin=()=>true;window.dispatchEvent(new CustomEvent('wedding:view',{detail:{name:'gifts'}}))`);
  await wait(`!document.getElementById('spesoPaymentPanel').classList.contains('hidden')`);
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:950,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.getElementById('spesoPaymentPanel').scrollIntoView({behavior:'instant',block:'start'});new Promise(r=>setTimeout(r,100))`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'speso-checkout.png'),Buffer.from(shot.data,'base64'));
  assert.equal(errors.length,0);console.log('PASS mocked Speso browser: off/manual fallback, guest sandbox guard, responsive accessible form, pesewas, one prompt for duplicate/lost responses, reload recovery, authoritative status UI and definitive rejection recovery. No real payment calls.');
};
