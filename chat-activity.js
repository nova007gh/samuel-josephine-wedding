/* Read-only room discovery. No snippets, names, private app events or presence writes. */
(()=>{
  'use strict';
  let epoch=0,running=null,actor='',baseline=null,pendingUntil=0,active=null,expiry=null;
  const clock=()=>performance.now();
  const authorised=()=>window.WeddingAccess?.canUse()&&!gateShowing()&&!document.getElementById('app')?.classList.contains('hidden');
  const safe=()=>authorised()&&!document.hidden&&currentView!=='chat'&&!currentView.startsWith('admin')&&!window.__uploadsInFlight&&!window.__weddingBroadcastPlaying&&!document.querySelector('dialog[open],.sheet:not(.hidden),.lightbox:not(.hidden),.activity-toast,.sj-guide-alert,.sj-guide-meeting')&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')&&![...document.querySelectorAll('.view:not(.hidden) audio,.view:not(.hidden) video')].some(m=>!m.paused);
  function dismiss(){clearTimeout(expiry);active?.remove();active=null;}
  function reset(){epoch++;running=null;actor='';baseline=null;pendingUntil=0;dismiss();}
  function display(){
    if(active){if(!safe())dismiss();return;}
    if(!pendingUntil||clock()>pendingUntil){pendingUntil=0;return;}if(!safe())return;
    pendingUntil=0;
    const el=document.createElement('aside');el.className='chat-activity-float';el.setAttribute('aria-label','New Wedding Chat activity');
    const open=document.createElement('button');open.type='button';open.className='chat-activity-open';open.setAttribute('aria-label','New chat activity. Open Wedding Chat');
    open.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11a9 8 0 0 1-9 8H7l-5 3 1.5-7A8 8 0 0 1 3 11a9 8 0 0 1 18 0Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/></svg><span class="chat-activity-dot" aria-hidden="true"></span><span>New chat</span>';
    open.addEventListener('click',()=>{const allowed=authorised();pendingUntil=0;dismiss();if(allowed)switchView('chat');});
    const close=document.createElement('button');close.type='button';close.className='chat-activity-close';close.textContent='×';close.setAttribute('aria-label','Dismiss chat activity');close.addEventListener('click',()=>{pendingUntil=0;dismiss();});
    const announcement=document.createElement('span');announcement.className='chat-activity-sr';announcement.setAttribute('role','status');announcement.textContent='New activity in Wedding Chat. Open the chat room to join in.';
    el.append(open,close,announcement);active=el;document.body.append(el);expiry=setTimeout(dismiss,10000);
  }
  async function poll(){
    if(!authorised()||document.hidden){if(!authorised())reset();return;}if(running||window.__uploadsInFlight)return;
    const run={epoch};running=run;
    try{
      const result=await api('/chat/activity',{admin:isAdmin()});if(run.epoch!==epoch||!authorised()||document.hidden)return;
      if(typeof result?.actor!=='string'||!Array.isArray(result.items)||result.items.length>150)throw Error('Invalid chat activity');
      const next=new Map();let fresh=false;
      for(const row of result.items){if(typeof row?.id!=='string'||next.has(row.id)||typeof row.own!=='boolean'||typeof row.pinned!=='boolean'||!['approved','pending'].includes(row.status)||row.status==='pending'&&!isAdmin()||!Number.isSafeInteger(row.reactions)||row.reactions<0)throw Error('Invalid chat activity');next.set(row.id,{own:row.own,pinned:row.pinned,status:row.status,reactions:row.reactions});}
      if(actor===result.actor&&baseline)for(const [id,row]of next){const old=baseline.get(id);if((!old&&!row.own)||(old&&(row.reactions>old.reactions||row.pinned&&!old.pinned||row.status==='approved'&&old.status!=='approved'&&!row.own)))fresh=true;}
      actor=result.actor;baseline=next;
      if(currentView==='chat'){pendingUntil=0;dismiss();return;}
      // Coalesce bursts; never extend an already visible icon beyond ten seconds.
      if(fresh&&!active)pendingUntil=clock()+60000;display();
    }catch{if(run.epoch===epoch){pendingUntil=0;dismiss();}}
    finally{if(running===run)running=null;}
  }
  window.WeddingChatActivity={refresh:poll,ready:()=>baseline!==null};
  for(const event of ['wedding:guest-session','wedding:access'])window.addEventListener(event,()=>{reset();poll();});
  onAdminAuth(()=>{reset();poll();});
  window.addEventListener('wedding:view',()=>{if(currentView==='chat'){pendingUntil=0;dismiss();}display();poll();});
  document.addEventListener('visibilitychange',()=>{pendingUntil=0;dismiss();if(!document.hidden)poll();});
  window.addEventListener('online',poll);window.addEventListener('pagehide',reset);
  setInterval(poll,15000);setInterval(display,250);poll();
})();
