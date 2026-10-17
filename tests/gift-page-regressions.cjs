const assert=require('node:assert/strict');
/* Submission responses are mocked; never create live gifts or payments. */
module.exports=async({evaluate})=>{
  const refresh=await evaluate(`(async()=>{
    await refreshGiftView();
    const original=window.fetch,rows=GIFT_FUNDS.map(f=>({...f})),selected=giftState.fund;
    const name=document.getElementById('giftName'),draft=name.value;let reads=0;
    const momo={number:document.getElementById('giftMoMoNumber').value,accountName:document.getElementById('giftMoMoName').value};
    window.fetch=async(url,options)=>{
      if(String(url)==='/api/gift-funds'){reads++;await new Promise(r=>setTimeout(r,50));return new Response(JSON.stringify(rows));}
      if(String(url)==='/api/momo-settings')return new Response(JSON.stringify(momo));
      if(String(url)==='/api/gifts'&&(!options?.method||options.method==='GET'))return new Response('[]');
      return original(url,options);
    };
    try{
      GIFT_FUNDS=[];giftState.fund='';renderGiftOptions();flashGiftStatus('No gift options are currently available.');name.value='Retained draft';
      await Promise.all([refreshGiftView(),refreshGiftView()]);
      return {reads,recovered:GIFT_FUNDS.length===rows.length&&!!giftState.fund,noteCleared:!document.getElementById('giftPaymentNote').textContent.includes('No gift options'),draftKept:name.value==='Retained draft'};
    }finally{window.fetch=original;name.value=draft;giftState.fund=selected;renderGiftOptions();await renderGiftList();}
  })()`);
  assert.deepEqual(refresh,{reads:1,recovered:true,noteCleared:true,draftKept:true});
  assert.equal(await evaluate(`(async()=>{const img=document.querySelector('.gift-provider-logo--mtn img');if(!img)return false;for(let i=0;i<100&&!img.complete;i++)await new Promise(r=>setTimeout(r,50));return img.naturalWidth>0&&img.getAttribute('src')==='assets/mtn-logo.svg';})()`),true,'Bundled MTN logo loads');
  const result=await evaluate(`(async()=>{
    document.querySelector('[data-amount="other"]').click();
    const amount=document.getElementById('giftOtherAmount');amount.value='75.50';amount.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('[data-provider="telecel"]').click();
    const retained=giftState.amount===75.5&&amount.value==='75.50';
    const original=window.fetch;let requests=0,payload,release;
    const held=new Promise(r=>release=r);
    window.fetch=async(url,options)=>{if(String(url)==='/api/gifts'&&options?.method==='POST'){requests++;payload=JSON.parse(options.body);await held;return new Response(JSON.stringify({error:'Mock offline failure'}),{status:503,headers:{'Content-Type':'application/json'}});}return original(url,options);};
    try{
      const form=document.getElementById('giftForm'),name=document.getElementById('giftName');name.value='Read-only regression';
      const submit=()=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));submit();submit();
      for(let i=0;i<100&&!requests;i++)await new Promise(r=>setTimeout(r,20));
      const busy=document.getElementById('giftSubmit').disabled;release();
      for(let i=0;i<200&&document.getElementById('giftSubmit').disabled;i++)await new Promise(r=>setTimeout(r,20));
      const failureRetained=name.value==='Read-only regression'&&giftState.amount===75.5&&!document.getElementById('giftSubmit').disabled;
      name.value='';document.getElementById('giftStatus').textContent='';
      document.querySelector('[data-amount="200"]').click();document.querySelector('[data-amount="other"]').click();
      const freshOther=amount.value===''&&giftState.amount===0;
      document.querySelector('[data-amount="200"]').click();document.querySelector('[data-provider="mtn"]').click();
      return {retained,requests,busy,cents:payload?.amountCents,failureRetained,freshOther,labels:['giftName','giftPhone','giftMessage','giftTxn'].every(id=>document.querySelector('label[for="'+id+'"]'))};
    }finally{release();window.fetch=original;}
  })()`);
  assert.deepEqual(result,{retained:true,requests:1,busy:true,cents:7550,failureRetained:true,freshOther:true,labels:true});
  console.log('PASS bundled MTN logo, custom pesewas/provider retention, fresh Other value, duplicate-submit guard, failed-save recovery and field labels (mock writes only)');
};
