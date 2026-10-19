/* Authenticated in-app host alerts. Separate from the public/local guide. */
(()=>{
  'use strict';
  if(typeof onAdminAuth!=='function'||typeof api!=='function')return;
  const control=document.getElementById('sjAdminCompanionAlerts'),settings=document.getElementById('sjGuideAdminControls');if(!control||!settings)return;
  const status=document.createElement('p');status.id='sjAdminCompanionStatus';status.className='sj-guide-status';settings.append(status);
  let epoch=0,running=null,started=false,seen=new Set(),queue=[],toast=null,expiry=null,cooldown=0,lastInput=Date.now();
  try{control.checked=localStorage.getItem('sj_admin_companion_alerts')!=='off';}catch{}
  const signedIn=()=>typeof isAdmin==='function'&&isAdmin();
  const label=side=>side==='jossy'?'Jossy':'Sam';
  function clearToast(){clearTimeout(expiry);toast?.remove();toast=null;}
  function reset(){epoch++;running=null;started=false;seen.clear();queue=[];clearToast();settings.hidden=!signedIn();status.textContent=signedIn()?(control.checked?'Checking recent activity while this tab is visible…':'Admin companion alerts are muted on this device.'):'';}
  function ready(){return signedIn()&&control.checked&&!document.hidden&&!document.body.classList.contains('locked')&&!document.getElementById('app')?.classList.contains('hidden');}
  function idle(){
    return ready()&&!window.__uploadsInFlight&&!document.querySelector('dialog[open],.activity-toast,.competition-toast,.sj-guide-alert,.sheet:not(.hidden),.lightbox:not(.hidden)')&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')&&Date.now()-lastInput>1500;
  }
  function describe(row){
    const verbs={checkin:'has a new saved guest entry',chat:'sent a Wedding Chat message',vote:'submitted a competition vote',upload:'has a new media submission',guestbook:'has a new guest-book submission',rsvp:'has a new RSVP submission',gift:'has a recorded gift submission'};
    const intro=row.match==='unique-name'?'A submission under '+row.name+'’s name':row.name;
    const body=row.match==='unique-name'?{upload:'contains new media',guestbook:'contains a guest-book message',rsvp:'contains an RSVP',gift:'contains a gift record'}[row.kind]:verbs[row.kind];
    return intro+' '+(body||'has new activity')+(row.status==='pending'?' · awaiting review.':'.');
  }
  function enqueue(side,rows,welcome=false){
    if(!rows.length&&!welcome)return;
    const pending=queue.find(item=>item.side===side);
    if(!welcome&&pending&&!pending.welcome)rows=[...new Map([...pending.rows,...rows].map(row=>[row.id,row])).values()].slice(-150);
    const text=welcome?`${label(side)} here — ${rows.length?rows.length+' recent activities are linked to my side in the last 24 hours.':'I’ll watch for new activity from guests with a saved connection to me.'}`
      :`${label(side)} here — ${rows.length===1?describe(rows[0]):rows.length+' new activities are linked to my side. Open the dashboard to review them.'}`;
    queue=queue.filter(item=>item.side!==side);queue.push({side,text,rows,welcome});queue=queue.slice(-4);
  }
  function displayAdminCompanion(){
    if(toast||!queue.length||Date.now()<cooldown||!idle())return;
    const item=queue.shift(),el=document.createElement('aside');el.className='sj-guide-alert sj-admin-companion-alert'+(item.side==='jossy'?' sj-admin-companion-alert--left':'');el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    const image=document.createElement('img');image.src=item.side==='jossy'?'assets/guide-launcher-jossy.png':'assets/guide-launcher.png';image.alt='';
    const body=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('p'),note=document.createElement('small');name.textContent=label(item.side)+' · Admin only';text.textContent=item.text;
    note.textContent=item.rows.some(row=>row.match==='unique-name')?'Saved connection · unique name match, not verified ownership.':'Based on saved guest connections · not a live attendance claim.';
    const open=document.createElement('button');open.type='button';open.className='sj-admin-companion-open';open.textContent='Review activity';open.addEventListener('click',()=>{
      if(!signedIn()){reset();return;}clearToast();const row=!item.welcome&&item.rows.length===1?item.rows[0]:null;
      const view=row&&['admin','adminmedia','admincompetitions','chat'].includes(row.view)?row.view:'admin';switchView(view);
      if(view==='admin'){const section=row?.section||'overview';document.querySelector(`[data-admin-section="${['guests','content','gifts','overview'].includes(section)?section:'overview'}"]`)?.click();}
    });
    const close=document.createElement('button');close.type='button';close.className='sj-admin-companion-close';close.textContent='×';close.setAttribute('aria-label','Dismiss '+label(item.side)+' admin alert');close.addEventListener('click',clearToast);
    body.append(name,text,note,open);el.append(image,body,close);toast=el;document.body.append(el);cooldown=Date.now()+10000;expiry=setTimeout(clearToast,14000);
  }
  async function pollAdminCompanions(){
    if(!ready()||running||window.__uploadsInFlight)return;
    const run={epoch};running=run;
    try{
      const result=await api('/admin/companion-alerts',{admin:true});
      if(run.epoch!==epoch||!ready()||!Array.isArray(result?.events))return;
      status.textContent='Last checked '+new Date().toLocaleTimeString()+'. Alerts run only while this tab is visible.';
      const rows=result.events.filter(row=>row&&['sam','jossy'].includes(row.side)&&typeof row.id==='string'&&typeof row.name==='string'),fresh=rows.filter(row=>!seen.has(row.id));
      if(!started){for(const side of ['jossy','sam'])enqueue(side,rows.filter(row=>row.side===side),true);started=true;}
      else for(const side of ['jossy','sam'])enqueue(side,fresh.filter(row=>row.side===side));
      rows.forEach(row=>seen.add(row.id));if(seen.size>600)seen=new Set([...seen].slice(-450));displayAdminCompanion();
    }catch{if(run.epoch===epoch&&ready())status.textContent='Admin alerts could not refresh. They will retry while this tab is visible.';}
    finally{if(running===run)running=null;}
  }
  control.addEventListener('change',()=>{try{localStorage.setItem('sj_admin_companion_alerts',control.checked?'on':'off');}catch{}reset();if(control.checked)pollAdminCompanions();});
  document.addEventListener('pointerdown',()=>{lastInput=Date.now();},{passive:true});document.addEventListener('keydown',()=>{lastInput=Date.now();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearToast();else pollAdminCompanions();});
  onAdminAuth(()=>{reset();if(signedIn())pollAdminCompanions();});setInterval(pollAdminCompanions,15000);setInterval(displayAdminCompanion,2000);
})();
