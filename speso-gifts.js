'use strict';
/* Optional Speso collection UI. Off unless the server is explicitly configured.
   Test mode is visible/usable only to authenticated admins. */
(()=>{
  const $=id=>document.getElementById(id),panel=$('spesoPaymentPanel');
  let settings={enabled:false,mode:'off'},attempt=null,busy=false,available=false,configBusy=false,pollTimer=null,activityBusy=false;
  const terminal=()=>attempt&&['completed','failed'].includes(attempt.status);
  const allowed=()=>settings.enabled&&(settings.mode==='live'||(settings.mode==='test'&&isAdmin()));
  const storageKey=()=> 'sj_speso_attempt_'+settings.mode;
  function store(){sessionStorage.setItem(storageKey(),JSON.stringify(attempt));}
  function restore(){
    attempt=null;
    try{
      const saved=JSON.parse(sessionStorage.getItem(storageKey())||'null');
      if(saved&&saved.mode===settings.mode&&/^[a-f0-9]{64}$/.test(saved.secret)&&saved.details&&
        (!saved.id||/^SJ-[a-f0-9]{32}$/.test(saved.id)))attempt=saved;
    }catch{}
  }
  function status(message){$('spesoPaymentStatus').textContent=message;}
  function render(){
    const enabled=allowed();panel.classList.toggle('hidden',!enabled);
    document.querySelector('[data-view="gifts"] .gift-momo').classList.toggle('hidden',enabled);
    $('giftConfirmWrap').classList.toggle('hidden',enabled);
    $('spesoAdminActivity').classList.toggle('hidden',!enabled||!isAdmin());
    const locked=enabled&&!!attempt;
    document.querySelectorAll('.gift-fund,.gift-amount,.gift-provider,#giftOtherAmount').forEach(el=>{el.disabled=locked;});
    for(const id of ['spesoPayerName','spesoPayerPhone','spesoPayerMessage'])$(id).disabled=locked||busy;
    $('spesoRequestPayment').disabled=busy||!available||locked;
    $('spesoCheckPayment').classList.toggle('hidden',!attempt||!!terminal());
    $('spesoCheckPayment').disabled=busy||!available;
    $('spesoNewPayment').classList.toggle('hidden',!terminal());
    $('spesoModeNotice').textContent=settings.mode==='test'?'SANDBOX · Admin test only. No real money is collected and test gifts do not appear in Recent gifts.':
      'Payments are collected into '+settings.merchant+'’s Speso wallet. The couple records only confirmed payments.';
    const details=attempt?.details;
    const amount=details?.amountCents??Math.round(giftState.amount*100);
    const provider=GIFT_PROVIDERS.find(p=>p.id===(details?.provider||giftState.provider));
    const fund=GIFT_FUNDS.find(f=>f.id===(details?.fund||giftState.fund));
    $('spesoSelection').textContent=giftCedi(amount)+' · '+(provider?.label||'MoMo')+' · '+(fund?.label||'Choose a gift option');
    if(attempt){
      $('spesoPayerName').value=details.name;$('spesoPayerPhone').value=details.phone;$('spesoPayerMessage').value=details.message||'';
    }
  }
  function showAttempt(){
    if(!attempt)return;
    const reference=attempt.id?' Reference: '+attempt.id+'.':'';
    const prefix=attempt.mode==='test'?'Sandbox: ':'';
    if(attempt.status==='completed')status(prefix+'Payment confirmed.'+(attempt.mode==='test'?' No real gift was recorded.':' Thank you for your gift!')+reference);
    else if(attempt.status==='failed')status(prefix+'Payment failed. If your wallet was debited, ask the couple to check this reference before paying again.'+reference);
    else if(attempt.status==='processing'||attempt.status==='pending')status(prefix+'Awaiting payment confirmation. Check your phone and approve only the expected amount. Do not request another payment.'+reference);
    else status(prefix+'Payment request not yet confirmed. Use Check payment status to recover this same attempt; do not start another payment.'+reference);
    render();
  }
  function saveResult(result){
    if(!result||result.mode!==settings.mode||!/^SJ-[a-f0-9]{32}$/.test(result.id)||!['initiating','unknown','pending','processing','completed','failed'].includes(result.status)||result.amountCents!==attempt.details.amountCents)throw new Error('Payment response could not be verified. Keep this attempt and check again.');
    attempt.id=result.id;attempt.status=result.status;store();showAttempt();
  }
  async function requestSameAttempt(){
    const result=await api('/gift-payments',{method:'POST',admin:settings.mode==='test',body:{...attempt.details,secret:attempt.secret}});
    saveResult(result);
  }
  async function check(){
    if(busy||!attempt||terminal()||!allowed()||!available)return;
    busy=true;render();
    try{
      if(!attempt.id)await requestSameAttempt();
      else saveResult(await api('/gift-payments/'+attempt.id+'/status',{method:'POST',admin:settings.mode==='test',body:{secret:attempt.secret}}));
      if(attempt.status==='completed'&&attempt.mode==='live')await renderGiftList();
    }catch(error){
      if(error.code==='payment/not-started'&&!attempt.id){attempt.status='failed';store();}
      status(error.message+' Keep this attempt; do not pay again.');
    }
    finally{busy=false;render();}
  }
  $('spesoPaymentForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||attempt||!allowed()||!available)return;
    const amountCents=Math.round(giftState.amount*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<settings.minAmountCents||amountCents>settings.maxAmountCents){status('Choose an amount between GHS 50 and GHS 20,000.');return;}
    if(!GIFT_FUNDS.some(f=>f.id===giftState.fund)){status('Choose an available gift option.');return;}
    const name=$('spesoPayerName').value.trim(),phone=$('spesoPayerPhone').value.trim();
    if(!name||! /^(?:0\d{9}|(?:\+?233)\d{9})$/.test(phone.replace(/[\s()-]/g,''))){status('Enter your name and a valid Ghana MoMo number.');return;}
    const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
    attempt={secret,mode:settings.mode,status:'unknown',id:null,details:{name,phone,message:$('spesoPayerMessage').value.trim(),amountCents,fund:giftState.fund,provider:giftState.provider}};
    try{store();}catch{attempt=null;status('Allow site storage before requesting payment, so this attempt can be recovered safely.');return;}
    busy=true;render();status('Requesting your MoMo prompt…');
    try{await requestSameAttempt();}catch(error){
      if(error.code==='payment/not-started'&&!attempt.id){attempt.status='failed';store();status(error.message+' No new payment prompt was sent.');}
      else status(error.message+' Use Check payment status to recover this attempt. Do not pay again.');
    }
    finally{busy=false;render();}
  });
  $('spesoCheckPayment').addEventListener('click',check);
  $('spesoNewPayment').addEventListener('click',()=>{
    if(busy||!terminal())return;
    try{sessionStorage.removeItem(storageKey());}catch{status('Could not clear the previous attempt. Reload before starting another gift.');return;}
    attempt=null;$('spesoPaymentForm').reset();status('');render();
  });
  async function refreshConfig(){
    if(configBusy)return;configBusy=true;
    try{
      const next=await api('/gift-payments/config');
      if(typeof next.enabled!=='boolean'||!['off','test','live'].includes(next.mode))throw new Error('Payment configuration unavailable.');
      const changed=next.mode!==settings.mode;settings=next;available=true;
      if(changed)restore();
      render();if(attempt)showAttempt();
      if(typeof currentView!=='undefined'&&currentView==='gifts')startPolling();
    }catch{available=false;render();if(allowed())status('Online collection is temporarily unavailable. Keep any pending attempt and try checking its status later.');}
    finally{configBusy=false;}
  }
  async function activity(){
    if(!isAdmin()||activityBusy)return;activityBusy=true;
    const host=$('spesoPaymentActivity');host.textContent='Loading payment activity…';
    try{
      const rows=await api('/admin/gift-payments',{admin:true});host.replaceChildren();
      if(!rows.length)host.textContent='No Speso payment attempts yet.';
      for(const row of rows){
        const item=document.createElement('div'),label=document.createElement('p'),button=document.createElement('button');
        label.textContent=row.name+' · '+giftCedi(row.amountCents)+' · '+row.mode+' · '+row.status+' · '+row.id;
        button.type='button';button.textContent='Check with Speso';button.disabled=row.mode!==settings.mode;
        button.addEventListener('click',async()=>{
          if(button.disabled)return;button.disabled=true;
          try{await api('/admin/gift-payments/'+row.id+'/sync',{method:'POST',admin:true,body:{}});await activity();}
          catch(error){label.textContent+=' · '+error.message;}finally{button.disabled=row.mode!==settings.mode;}
        });
        item.append(label,button);host.append(item);
      }
    }catch(error){host.textContent=error.message;}finally{activityBusy=false;}
  }
  $('spesoRefreshActivity').addEventListener('click',activity);
  function startPolling(){
    if(pollTimer)return;
    pollTimer=setInterval(()=>{if(!document.hidden&&allowed()&&attempt?.id)check();},15000);
  }
  window.addEventListener('gift:selection',render);
  window.addEventListener('wedding:view',event=>{
    clearInterval(pollTimer);pollTimer=null;
    if(event.detail?.name!=='gifts')return;
    refreshConfig();
    startPolling();
  });
  onAdminAuth(()=>{render();refreshConfig();});
  refreshConfig();
})();
