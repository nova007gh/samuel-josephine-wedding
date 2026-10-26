/* Fail-closed approval state; never trust local guest IDs, names or status. */
(()=>{
  'use strict';
  let status='checking',busy=false,queued=false,generation=0,lastAdminToken,guestApproved=false,checkedIn=false;
  const canUse=()=>status==='approved'||status==='admin';
  const openGet=new Set(['/health','/settings','/onboarding','/guest-access']);
  const openPost=new Set(['/admin/login','/guests','/guest-entry','/guests/login','/guests/lookup','/guests/logout','/otp/send','/otp/verify']);
  function requestAllowed(path,method){return canUse()||!!adminToken||path.startsWith('/admin/')||(['GET','HEAD'].includes(method)?openGet.has(path):method==='POST'&&openPost.has(path));}
  function render(){
    const checkin=document.getElementById('enterFromHome'),label=document.getElementById('homeCheckinLabel'),arrow=document.getElementById('homeCheckinArrow');
    const checkinCopy='Enter Our Wedding to Check In';if(label&&label.textContent!==checkinCopy)label.textContent=checkinCopy;
    if(checkin)checkin.disabled=false;
    if(arrow)arrow.hidden=false;
    const locked=!canUse(),adminUI=typeof isAdmin==='function'&&isAdmin();document.body.classList.toggle('access-limited',locked);
    const panel=document.getElementById('guestApproval');if(!panel)return;panel.hidden=!locked;
    const copy={checking:['Checking your approval…','Your welcome page is ready. We’re securely checking your guest sign-in.'],pending:['Waiting for admin approval','Thank you for registering! Enjoy the welcome page while Sam & Jossy review your registration. All other features will unlock here automatically after approval.'],unverified:['Verify your sign-in','Your saved profile alone cannot unlock the app. Verify your sign-in so we can securely check your admin approval.'],offline:['Approval check unavailable','We couldn’t confirm your access. The welcome page remains available; reconnect and check again to unlock approved features.']};
    const [title,text]=copy[status]||copy.pending,heading=document.getElementById('guestApprovalTitle'),description=document.getElementById('guestApprovalText');if(heading.textContent!==title)heading.textContent=title;if(description.textContent!==text)description.textContent=text;document.getElementById('guestApprovalVerify').hidden=status!=='unverified';
    document.querySelectorAll('.view').forEach(view=>{view.inert=locked&&!['home','adminlogin'].includes(view.dataset.view)&&!(adminUI&&typeof ADMIN_VIEWS!=='undefined'&&ADMIN_VIEWS.has(view.dataset.view));});
    document.querySelectorAll('.tabbar .tab').forEach(button=>{if(locked)button.setAttribute('aria-disabled','true');else button.removeAttribute('aria-disabled');});
    if(locked){
      document.querySelectorAll('audio,video').forEach(media=>media.pause());
      document.querySelectorAll('dialog[open]:not(#arrivalCheckinDialog):not(#roleProfileDialog)').forEach(dialog=>dialog.close());
      document.querySelectorAll('.activity-toast,.competition-toast,.sj-guide-alert').forEach(el=>el.remove());
      if(!adminUI&&typeof currentView!=='undefined'&&!['home','adminlogin'].includes(currentView))switchView('home');
    }
  }
  async function bindExistingPush(){
    if(!canUse()||!('Notification' in window)||Notification.permission!=='granted'||!navigator.serviceWorker)return;
    const run=generation;try{const reg=await navigator.serviceWorker.getRegistration(),sub=await reg?.pushManager?.getSubscription();if(sub&&run===generation&&canUse())await api('/push/subscribe',{method:'POST',body:sub.toJSON()});}catch{/* Keep existing device permission unchanged; no new prompt or subscription. */}
  }
  function set(value){const was=canUse(),changed=status!==value;status=value;render();if(changed)window.dispatchEvent(new Event('wedding:session-state'));if(changed&&canUse())bindExistingPush();if(was!==canUse()){window.dispatchEvent(new Event('wedding:access'));if(typeof syncSiteSettings==='function')syncSiteSettings();}}
  function lock(){generation++;guestApproved=false;set('pending');}
  async function refresh(){
    if(document.hidden)return;if(busy){queued=true;return;}busy=true;const run=generation;
    try{const result=await api('/guest-access');if(run!==generation)return;if(!result||typeof result.approved!=='boolean')throw new Error('Invalid approval response');const beforeStatus=status,beforeIdentity=checkedIn+':'+guestApproved;checkedIn=result.authenticated===true;guestApproved=result.guestApproved===true;
      if(checkedIn&&result.guest?.id&&typeof result.guest.name==='string'){const previous=getGuest(),resume=!hasEntered()&&gateShowing();setGuest(previous?.id===result.guest.id?{...previous,name:result.guest.name}:{id:result.guest.id,name:result.guest.name});if(resume)enterApp();}
      set(result.admin?'admin':result.approved?'approved':result.authenticated?'pending':'unverified');if(beforeStatus===status&&beforeIdentity!==checkedIn+':'+guestApproved)window.dispatchEvent(new Event('wedding:session-state'));}
    catch{if(run===generation){guestApproved=false;set('offline');}}finally{busy=false;if(queued){queued=false;queueMicrotask(refresh);}}
  }
  window.WeddingAccess={canUse,requestAllowed,refresh,lock,isCheckedIn:()=>checkedIn,isGuestApproved:()=>guestApproved};document.body.classList.add('access-limited');
  function blocked(event){
    if(canUse()||!event.target.closest?.('#app'))return;
    const view=event.target.closest('.view');if(typeof isAdmin==='function'&&isAdmin()&&view&&typeof ADMIN_VIEWS!=='undefined'&&ADMIN_VIEWS.has(view.dataset.view))return;
    if(event.target.closest('[data-view="adminlogin"],#guestApproval,#guestSignOut,#enterFromHome,#roleProfilesOpen,[data-goto="adminlogin"],.app-brand'))return;
    if(!event.target.closest('button,a,input,select,textarea,[role="button"],[data-goto],[data-tab]'))return;
    event.preventDefault();event.stopImmediatePropagation();document.getElementById('guestApproval')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  document.addEventListener('click',blocked,true);document.addEventListener('submit',e=>{const view=e.target.closest('.view');if(!canUse()&&e.target.closest('#app')&&!e.target.closest('[data-view="adminlogin"]')&&!(typeof isAdmin==='function'&&isAdmin()&&view&&typeof ADMIN_VIEWS!=='undefined'&&ADMIN_VIEWS.has(view.dataset.view))){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('play',e=>{if(!canUse()&&e.target instanceof HTMLMediaElement)e.target.pause();},true);
  window.addEventListener('load',()=>{
    if(location.hash==='#adminlogin'){enterApp();switchView('adminlogin');}
    document.getElementById('guestApprovalRefresh').addEventListener('click',refresh);
    document.getElementById('guestApprovalVerify').addEventListener('click',async()=>{requireCheckIn();showGate(guestLoginScreen);try{const config=await loadOnboarding();showPane(config.otpRequired?'return':'form');}catch{showPane('return');}});
    document.getElementById('guestApprovalSignOut').addEventListener('click',()=>document.getElementById('guestSignOut').click());
    onAdminAuth(()=>{if(lastAdminToken===adminToken)return;lastAdminToken=adminToken;generation++;if(!adminToken)set(guestApproved?'approved':'checking');else if(!canUse())set('checking');refresh();});render();refresh();
  });
  window.addEventListener('wedding:guest-session',()=>{generation++;guestApproved=false;checkedIn=false;set('checking');refresh();});window.addEventListener('sj:entered',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('online',refresh);setInterval(refresh,15000);
})();
