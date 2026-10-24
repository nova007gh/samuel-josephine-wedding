/* Competition discovery on every guest page, not only inside Games.
   Seen events are per guest/device; late arrivals see current games once. */
(() => {
  'use strict';
  let busy=false,rows=[],active=null,expiry=null,seen=new Set(),owner='';
  const eventKey=n=>n.id+':'+n.publishedAt+':'+n.status;
  const guestKey=()=>{
    const g=getGuest();return g?.id||g?.name||'';
  };
  const available=()=>!document.hidden&&!gateShowing()&&!isAdmin()&&!!guestKey()&&!window.__uploadsInFlight&&(!window.WeddingAccess||WeddingAccess.canUse());
  function syncOwner(){
    const key=guestKey();
    if(key===owner)return;
    owner=key;seen=new Set();
    try { seen=new Set(JSON.parse(localStorage.getItem('sj_competition_notices:'+key)||'[]')); } catch {}
    clearTimeout(expiry);active?.el.remove();active=null;rows=[];
  }
  function remember(key){
    seen.add(key);
    // Bound storage; recent events are sufficient for rediscovery.
    seen=new Set([...seen].slice(-500));
    try { localStorage.setItem('sj_competition_notices:'+owner,JSON.stringify([...seen])); } catch {}
  }
  function dismiss(){
    clearTimeout(expiry);
    const el=active?.el;active=null;el?.remove();
    showNext();
  }
  function showNext(){
    if(!available()||active)return;
    // Other tabs may already have shown this guest the same announcement.
    try { for(const key of JSON.parse(localStorage.getItem('sj_competition_notices:'+owner)||'[]'))seen.add(key); } catch {}
    const wrap=document.getElementById('activityToasts');if(!wrap)return;
    const n=rows.find(n=>!seen.has(eventKey(n)));if(!n)return;
    const el=document.createElement('div');
    el.className='activity-toast competition-toast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    const icon=document.createElement('span');icon.className='competition-toast-icon';icon.textContent='🎮';icon.setAttribute('aria-hidden','true');
    const copy=document.createElement('div');copy.className='competition-toast-copy';
    const heading=document.createElement('b');heading.textContent=n.status==='active'?'Wedding competition is open!':'New wedding competition!';
    const title=document.createElement('p');title.textContent=n.title;
    const sub=document.createElement('p');sub.className='competition-toast-sub';
    sub.textContent=n.status==='active'?'Join the fun and participate.':'Voting starts '+new Date(n.startAt).toLocaleString()+'.';
    const button=document.createElement('button');button.type='button';button.className='competition-toast-open';
    button.textContent=n.canVote?'Vote Now':'View Competition';button.dataset.compAction='open';button.dataset.id=n.id;
    button.addEventListener('click',()=>{clearTimeout(expiry);active=null;el.remove();});
    const close=document.createElement('button');close.type='button';close.className='competition-toast-close';close.textContent='×';close.setAttribute('aria-label','Dismiss competition notification');close.addEventListener('click',dismiss);
    copy.append(heading,title,sub,button);el.append(icon,copy,close);wrap.appendChild(el);
    active={key:eventKey(n),el};remember(active.key);
    requestAnimationFrame(()=>el.classList.add('in'));
    expiry=setTimeout(()=>{
      // Do not dismiss a toast while someone is interacting with its buttons.
      if(el.contains(document.activeElement)||el.matches(':hover'))return;
      dismiss();
    },15000);
  }
  async function poll(){
    syncOwner();
    if(!available()){
      clearTimeout(expiry);active?.el.remove();active=null;return;
    }
    if(busy)return;
    busy=true;const key=owner;
    try{
      const notices=await api('/competitions/notices');
      if(key!==guestKey()||!available())return;
      rows=Array.isArray(notices)?notices:[];
      if(active&&(!active.el.isConnected||!rows.some(n=>eventKey(n)===active.key))){clearTimeout(expiry);active.el.remove();active=null;}
      showNext();
    }catch(err){console.warn('Competition notices unavailable:',err.message);}
    finally{busy=false;}
  }
  window.addEventListener('sj:entered',poll);
  window.addEventListener('wedding:view',poll);
  document.addEventListener('visibilitychange',poll);
  onAdminAuth(poll);
  setInterval(poll,15000);
})();
