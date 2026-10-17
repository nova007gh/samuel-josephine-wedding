const assert=require('node:assert/strict');
/* Submission responses are mocked; never create live gifts or payments. */
module.exports=async({evaluate})=>{
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
