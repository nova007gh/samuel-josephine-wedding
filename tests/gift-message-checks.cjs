const assert = require('node:assert/strict');

/* Test the deployed form with mocked persistence; do not publish live text. */
module.exports = async ({evaluate,errors}) => {
  const result = await evaluate(`(async()=>{
    document.getElementById('admin-tab-gifts').click();
    const originalPatch=patchSettings,originalGet=getSettings;
    const form=document.getElementById('giftMessageForm');
    const intro=document.getElementById('giftIntroInput'),message=document.getElementById('giftMessageInput');
    let payload,calls=0;
    const wait=async()=>{for(let i=0;i<60&&giftMessageSaving;i++)await new Promise(r=>setTimeout(r,20));};
    try{
      patchSettings=async fields=>{calls++;payload=fields;return {ok:true,saved:2};};
      intro.value=['Thank you, friends!','Your love means everything.'].join(String.fromCharCode(10));
      message.value='Please leave your blessing <b>with love</b>.';
      form.dispatchEvent(new Event('input',{bubbles:true}));
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();
      const saved=payload.giftIntroText===intro.value&&payload.giftMessageText===message.value
        &&document.getElementById('giftIntroText').textContent===intro.value
        &&document.getElementById('giftMessageStatus').textContent.startsWith('Saved');
      const plainText=document.getElementById('giftMessageText').querySelector('b')===null
        &&document.getElementById('giftMessageText').textContent.includes('<b>with love</b>');
      message.value='';form.dispatchEvent(new Event('input',{bubbles:true}));
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();
      const optionalHidden=payload.giftMessageText===''&&document.getElementById('giftMessageText').classList.contains('hidden');
      await syncSiteSettings();
      intro.value='Unsaved draft';form.dispatchEvent(new Event('input',{bubbles:true}));
      getSettings=async()=>({...siteSettings,giftIntroText:'Updated on another device',giftMessageText:'New guest message'});
      await syncSiteSettings();
      const draftPreserved=intro.value==='Unsaved draft';
      const liveSynced=document.getElementById('giftIntroText').textContent==='Updated on another device';
      getSettings=originalGet;
      patchSettings=async()=>{throw new Error('Simulated save failure');};
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();
      const retryPreserved=intro.value==='Unsaved draft'&&!document.getElementById('giftMessageSave').disabled
        &&document.getElementById('giftMessageStatus').textContent==='Simulated save failure';
      patchSettings=async fields=>{calls++;payload=fields;return {ok:true,saved:2};};
      const before=calls;
      intro.value='';message.value='';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();
      const emptyBlocked=calls===before&&document.getElementById('giftMessageStatus').textContent==='Enter at least one message.';
      document.getElementById('giftMessageDefaults').click();
      const defaultsNotPublished=calls===before&&intro.value===GIFT_MESSAGE_DEFAULTS.giftIntroText;
      setAdminToken(null);
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait();
      const guestBlocked=calls===before&&document.getElementById('giftMessageStatus').textContent.includes('Sign in as admin');
      return {saved,plainText,optionalHidden,draftPreserved,liveSynced,retryPreserved,emptyBlocked,defaultsNotPublished,guestBlocked};
    }finally{patchSettings=originalPatch;getSettings=originalGet;}
  })()`);
  for(const [name,ok] of Object.entries(result))assert.equal(ok,true,name);
  assert.equal(errors.length,0,'Uncaught browser exceptions');
  console.log('PASS custom Gifts text, line breaks/plain text, optional paragraph, live sync, draft/retry protection, defaults and admin guard (persistence mocked)');
};
