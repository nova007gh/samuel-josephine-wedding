/* Visible-page signals contain only an allowlisted page. Private dashboard is memory-only. */
(()=>{
  'use strict';const S=window.GuestActivitySchema,$=id=>document.getElementById(id),panel=$('admin-panel-guestactivity');if(!S||!panel)return;
  let generation=0,beatRun=null,lastBeat=-Infinity,beatTimer=null,adminRun=0,adminBusy=false,adminQueued=false,page=0,selected='',suspended=false;
  const clock=()=>performance.now(),visible=()=>!suspended&&isAdmin()&&!document.hidden&&currentView==='admin'&&!panel.classList.contains('hidden');
  const guestReady=()=>!suspended&&!isAdmin()&&!document.hidden&&!gateShowing()&&!window.__uploadsInFlight&&window.WeddingAccess?.canUse()&&window.WeddingAccess.isGuestApproved()&&window.WeddingAccess.isCheckedIn()&&Object.hasOwn(S.pages,currentView);
  async function report(){
    if(!guestReady())return;if(beatRun)return;const delay=S.minBeatMs-(clock()-lastBeat);if(delay>0){clearTimeout(beatTimer);beatTimer=setTimeout(report,delay);return;}
    const run={generation,page:currentView};beatRun=run;lastBeat=clock();
    try{await api('/guest-activity/presence',{method:'POST',body:{page:run.page}});}catch{/* No guest-facing prompts or retries that interrupt the wedding. */}
    finally{if(beatRun===run)beatRun=null;if(run.generation===generation){lastBeat=clock();if(guestReady()&&currentView!==run.page)report();}}
  }
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
  const time=value=>value?new Date(value).toLocaleString():'No signal yet';
  function clearAdmin(){adminRun++;adminBusy=false;adminQueued=false;page=0;selected='';for(const id of ['guestActivityCounts','guestActivityGuests','guestActivityEvents'])$(id).replaceChildren();for(const id of ['guestActivityStatus','guestActivityNotice'])$(id).textContent='';$('guestActivitySearch').value='';$('guestActivityFilter').value='all';for(const id of ['guestActivityPrevious','guestActivityNext','guestActivityReset'])$(id).hidden=true;}
  function render(d){
    $('guestActivityCounts').replaceChildren();for(const [label,value]of [['Recently active',d.counts.recent],['Reported in 24 hours',d.counts.seenToday],['Registered guests',d.counts.registered]]){const card=node('div');card.append(node('strong',value),node('span',label));$('guestActivityCounts').append(card);}
    $('guestActivityGuests').replaceChildren();for(const g of d.guests){const row=node('article');row.className='guest-site-row';const title=node('div'),badge=node('span',g.recent?'Recently active':g.lastSeen?'Not recently seen':'No live signal');badge.className='guest-site-badge'+(g.recent?' is-recent':'');title.append(node('strong',g.name),badge);row.append(title,node('p',(g.pageLabel?(g.recent?'Last reported page: ':'Last known page: ')+g.pageLabel:'No identified visible-page report')+' · '+g.status),node('small','Last signal: '+time(g.lastSeen)),node('small',g.lastAction?g.lastAction.label+' · '+time(g.lastAction.at):'No timestamped account-linked action found'));
      const open=node('button','View saved activity');open.type='button';open.dataset.activityGuest=g.id;open.onclick=()=>{selected=g.id;page=0;load();};row.append(open);$('guestActivityGuests').append(row);}
    if(!d.guests.length)$('guestActivityGuests').append(node('p','No guests match these filters.'));
    $('guestActivityEvents').replaceChildren();for(const e of d.events){const row=node('article');row.className='guest-site-event';row.append(node('strong',e.name),node('span',e.label),node('small',time(e.at)+(e.status?' · '+e.status:'')));$('guestActivityEvents').append(row);}if(!d.events.length)$('guestActivityEvents').append(node('p','No verified, timestamped saved actions in this window. Older or unlinked records remain in Detailed Guest List.'));
    $('guestActivityNotice').textContent=d.notice+' Gift reports are not payment verification. Presence reports expire after seven days; no page-history trail is stored.';$('guestActivityStatus').textContent=`${d.total} matching guests · updated ${time(d.asOf)} · refreshes every 15 seconds while this panel is visible.`;$('guestActivityPrevious').hidden=page===0;$('guestActivityNext').hidden=!d.hasMore;$('guestActivityReset').hidden=!selected;
  }
  const query=()=>'/admin/guest-activity?q='+encodeURIComponent($('guestActivitySearch').value.trim())+'&filter='+encodeURIComponent($('guestActivityFilter').value)+'&page='+page+'&guestId='+encodeURIComponent(selected);
  async function load(){if(!visible())return;if(adminBusy){adminQueued=true;return;}adminBusy=true;const run=++adminRun,epoch=generation,url=query();
    try{const d=await api(url,{admin:true});if(run!==adminRun||epoch!==generation||!visible())return;if(url!==query()){adminQueued=true;return;}render(d);}
    catch(e){if(run===adminRun&&epoch===generation&&visible()){$('guestActivityStatus').textContent='Activity could not refresh: '+e.message;$('guestActivityCounts').replaceChildren();$('guestActivityGuests').replaceChildren();$('guestActivityEvents').replaceChildren();}}
    finally{if(run===adminRun){adminBusy=false;if(adminQueued&&visible()){adminQueued=false;load();}}}
  }
  $('guestActivityFilters').onsubmit=e=>{e.preventDefault();page=0;selected='';load();};$('guestActivityFilter').onchange=()=>{page=0;selected='';load();};$('guestActivityPrevious').onclick=()=>{page=Math.max(0,page-1);load();};$('guestActivityNext').onclick=()=>{page++;load();};$('guestActivityReset').onclick=()=>{selected='';page=0;load();};$('guestActivityShortcut').onclick=()=>{if(isAdmin())document.querySelector('[data-admin-section="guestactivity"]').click();};
  $('admin-tab-guestactivity').addEventListener('click',()=>requestAnimationFrame(()=>{if(visible()){panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}));
  function reset(){generation++;beatRun=null;lastBeat=-Infinity;clearTimeout(beatTimer);clearAdmin();if(visible())load();else report();}
  function sync(){if(visible())load();else clearAdmin();report();}
  new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
  onAdminAuth(reset);for(const event of ['wedding:guest-session','wedding:access'])window.addEventListener(event,reset);window.addEventListener('wedding:view',sync);window.addEventListener('online',()=>{report();load();});
  document.addEventListener('visibilitychange',()=>{clearTimeout(beatTimer);if(document.hidden)clearAdmin();else sync();});window.addEventListener('pagehide',()=>{suspended=true;reset();});window.addEventListener('pageshow',()=>{suspended=false;sync();});
  window.WeddingGuestActivity={report,refresh:load};setInterval(report,30000);setInterval(load,15000);report();
})();
