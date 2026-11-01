/* Read-only room discovery. No snippets, names, private app events or presence writes. */
(()=>{
  'use strict';
  let epoch=0,running=null,actor='',baseline=null,pendingUntil=0,active=null,highlighted=false,expiry=null;
  const clock=()=>performance.now();
  const authorised=()=>window.WeddingAccess?.canUse()&&!gateShowing()&&!document.getElementById('app')?.classList.contains('hidden');
  const available=()=>authorised()&&!document.hidden&&currentView!=='chat'&&!currentView.startsWith('admin')&&!document.querySelector('dialog[open],.sheet:not(.hidden),.lightbox:not(.hidden)');
  const safe=()=>available()&&!window.__uploadsInFlight&&!window.__weddingBroadcastPlaying&&!document.querySelector('.activity-toast,.sj-guide-alert,.sj-guide-meeting')&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')&&![...document.querySelectorAll('.view:not(.hidden) audio,.view:not(.hidden) video')].some(m=>!m.paused);
  function endHighlight(){clearTimeout(expiry);highlighted=false;if(active){active.el.className='chat-activity-float';active.open.setAttribute('aria-label','Open Wedding Chat');active.label.textContent='Chat';active.close.hidden=true;active.announcement.textContent='';}}
  function removeIcon(){endHighlight();active?.el.remove();active=null;}
  function reset(){epoch++;running=null;actor='';baseline=null;pendingUntil=0;removeIcon();}
  function ensureIcon(){
    if(active)return;
    const el=document.createElement('aside');el.className='chat-activity-float';el.setAttribute('aria-label','Wedding Chat shortcut');
    const open=document.createElement('button');open.type='button';open.className='chat-activity-open';open.setAttribute('aria-label','Open Wedding Chat');
    open.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11a9 8 0 0 1-9 8H7l-5 3 1.5-7A8 8 0 0 1 3 11a9 8 0 0 1 18 0Z"/><path d="M7 11h.01M12 11h.01M17 11h.01"/></svg><span class="chat-activity-dot" aria-hidden="true"></span>';
    const label=document.createElement('span');label.textContent='Chat';open.append(label);
    open.addEventListener('click',()=>{const allowed=authorised();pendingUntil=0;removeIcon();if(allowed)switchView('chat');});
    const close=document.createElement('button');close.type='button';close.className='chat-activity-close';close.textContent='×';close.hidden=true;close.setAttribute('aria-label','Dismiss chat highlight');close.addEventListener('click',()=>{pendingUntil=0;endHighlight();});
    const announcement=document.createElement('span');announcement.className='chat-activity-sr';announcement.setAttribute('role','status');
    el.append(open,close,announcement);active={el,open,label,close,announcement};document.body.append(el);
  }
  function display(){
    if(!available()){removeIcon();return;}ensureIcon();
    if(highlighted&&!safe())endHighlight();
    if(!pendingUntil||clock()>pendingUntil){pendingUntil=0;return;}if(!safe()||highlighted)return;
    pendingUntil=0;highlighted=true;active.el.className='chat-activity-float is-active';active.open.setAttribute('aria-label','New chat activity. Open Wedding Chat');active.label.textContent='New chat';active.close.hidden=false;active.announcement.textContent='New activity in Wedding Chat. Open the chat room to join in.';expiry=setTimeout(endHighlight,10000);
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
      if(currentView==='chat'){pendingUntil=0;removeIcon();return;}
      // Coalesce bursts; never extend a highlight beyond ten seconds.
      if(fresh&&!highlighted)pendingUntil=clock()+60000;display();
    }catch{if(run.epoch===epoch){pendingUntil=0;endHighlight();display();}}
    finally{if(running===run)running=null;}
  }
  window.WeddingChatActivity={refresh:poll,ready:()=>baseline!==null};
  for(const event of ['wedding:guest-session','wedding:access'])window.addEventListener(event,()=>{reset();display();poll();});
  onAdminAuth(()=>{reset();display();poll();});
  window.addEventListener('wedding:view',()=>{if(currentView==='chat')pendingUntil=0;display();poll();});
  document.addEventListener('visibilitychange',()=>{pendingUntil=0;endHighlight();display();if(!document.hidden)poll();});
  window.addEventListener('online',poll);window.addEventListener('pagehide',reset);
  setInterval(poll,15000);setInterval(display,250);display();poll();
})();
