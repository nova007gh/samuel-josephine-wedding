/* In-house S&J Guide: questions stay on this device; only public knowledge is fetched. */
(()=>{
  'use strict';
  const K=window.WeddingGuideKnowledge;if(!K)return;
  const button=document.getElementById('sjGuideLaunch'),dialog=document.getElementById('sjGuideDialog');if(!button||!dialog)return;
  const $=id=>document.getElementById(id),allowed=new Set(['home','story','events','rsvp','gallery','voicemsg','videomsg','chat','gifts','competitions','guestbook','bridaltrain','program','engagementprogram','livebroadcast','entertainment']);
  let data=null,busy=null,lastFetch=0,alert=null,expiry=null,returnFocus=null,sending=false,fingerprint='',turns=[],generation=0;
  function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  const safeView=v=>allowed.has(v)?v:'home';
  function navigate(e,view){e.preventDefault();close();if(typeof switchView==='function')switchView(safeView(view));}
  const pageNames={home:'Home',story:'Our Story',events:'Events',rsvp:'RSVP',gallery:'Gallery',chat:'Wedding Chat',gifts:'Gifts',guestbook:'Guest Book',entertainment:'Entertainment',livebroadcast:'Live Broadcast',bridaltrain:'Bridal Train',voicemsg:'Voice Messages',videomsg:'Video Messages',engagementprogram:'Engagement Programme',program:'Reception Programme',competitions:'Games'};
  function card(row,compact=false){
    const el=element('article','sj-guide-card'+(compact?' sj-guide-card--compact':''));
    if(K.photo(row.image)){const img=element('img');img.src=row.image;img.alt='';img.loading='lazy';img.addEventListener('error',()=>img.remove(),{once:true});el.append(img);}
    const body=element('div','sj-guide-card-content');body.append(element('h3','',row.title),element('p','',row.text));
    const link=element('a','','Open '+(pageNames[row.view]||'Home')+' →');link.href='#'+safeView(row.view);link.addEventListener('click',e=>navigate(e,row.view));body.append(link);el.append(body);return el;
  }
  function renderOverview(){
    const el=$('sjGuideOverview');el.replaceChildren();el.hidden=turns.length>0;if(!data||turns.length)return;
    const wedding=data.cards.find(c=>c.id==='wedding');if(wedding)el.append(card(wedding,true));
    const upcoming=data.activities.find(a=>a.live||a.at>=Date.now());
    if(upcoming)el.append(element('p','sj-guide-next',(upcoming.live?'Host update: ':'Next on the published schedule: ')+upcoming.title+(upcoming.at?' · '+new Date(upcoming.at).toLocaleString():'')));
  }
  function renderActivities(){
    const el=$('sjGuideActivities');el.replaceChildren();if(!data)return;
    const rows=data.activities.filter(a=>a.live||a.at>=Date.now()-20*60000).slice(0,4);
    if(!rows.length)el.append(element('p','sj-guide-status','No upcoming timed reminders. You can still explore the published programme and app pages.'));
    rows.forEach(a=>el.append(card({...a,text:(a.live?'Host-marked live\n':'Scheduled · ')+a.text+(a.at?'\nYour local time: '+new Date(a.at).toLocaleString():'')},true)));
    const programme=data.cards.find(c=>c.id==='receptionProgram')||data.cards.find(c=>c.id==='engagementProgram');
    if(programme)el.append(card({...programme,text:'Explore the full published lineup, including activities not shown in this preview.'},true));
    else if(!rows.length){const source=data.cards.find(c=>c.id==='wedding');if(source)el.append(card({...source,title:'Explore the celebration',text:'Open Events for published venue and schedule information.'},true));}
  }
  function suggestions(questions){
    const el=$('sjGuideSuggestions');el.replaceChildren();
    for(const question of questions||[]){const b=element('button','',question);b.type='button';b.addEventListener('click',()=>submit(question));el.append(b);}
  }
  function renderResults(scroll=false){
    const el=$('sjGuideResults'),body=dialog.querySelector('.sj-guide-body'),top=body.scrollTop;el.replaceChildren();
    turns.forEach((turn,i)=>{
      const latest=i===turns.length-1,section=element(latest?'section':'details','sj-guide-turn'+(latest?'':' sj-guide-past'));
      section.append(element(latest?'p':'summary','sj-guide-question',turn.question),element('p','sj-guide-answer',turn.result.text));
      if(turn.result.corrections?.length)section.append(element('p','sj-guide-status','Matched spelling: '+turn.result.corrections.join(', ')));
      turn.result.cards.forEach(row=>section.append(card(row)));el.append(section);
    });
    suggestions(turns.at(-1)?.result.suggestions||[]);renderOverview();
    if(scroll)el.lastElementChild?.scrollIntoView({block:'start',behavior:'instant'});else body.scrollTop=top;
  }
  async function refresh(force=false){
    if(busy)return busy;if(data&&!force&&Date.now()-lastFetch<45000)return data;
    busy=(async()=>{try{const r=await fetch('/api/guide',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const next=await r.json();if(next.mode!=='local-knowledge-guide'||!Array.isArray(next.cards)||!Array.isArray(next.activities))throw new Error();const nextFingerprint=JSON.stringify([next.cards,next.activities]),changed=nextFingerprint!==fingerprint;data=next;fingerprint=nextFingerprint;lastFetch=Date.now();$('sjGuideStatus').textContent='Published information refreshed '+new Date().toLocaleTimeString()+'. Questions stay on this device.';if(changed){turns=turns.map(turn=>({...turn,result:K.answer(data,turn.question,turn.context)}));renderResults();renderActivities();}checkAlert();return data;}catch{$('sjGuideStatus').textContent=data?'Unable to refresh. Showing earlier information from '+new Date(lastFetch).toLocaleTimeString()+'. Check source pages for updates.':'The guide could not load. Check your connection and try again. You can still use the app pages directly.';return null;}finally{busy=null;}})();return busy;
  }
  async function submit(question){
    const q=question.trim().slice(0,400);if(!q||sending)return;
    const version=generation,send=$('sjGuideForm').querySelector('button');sending=true;send.disabled=true;send.textContent='…';
    try{await refresh();if(!data||version!==generation)return;
      const context={ids:turns.at(-1)?.result.contextIds||[]},result=K.answer(data,q,context);
      turns=[...turns,{question:q,context,result}].slice(-6);$('sjGuideQuestion').value='';$('sjGuideSchedule').open=false;renderResults(true);
    }finally{sending=false;send.disabled=false;send.textContent='Ask';}
  }
  function open(){if(dialog.open)return;returnFocus=button;dismissAlert();dialog.showModal();refresh();}
  function close(){if(dialog.open)dialog.close();}
  button.addEventListener('click',open);$('sjGuideClose').addEventListener('click',close);
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  $('sjGuideForm').addEventListener('submit',e=>{e.preventDefault();submit($('sjGuideQuestion').value);});
  document.querySelectorAll('[data-guide-question]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.guideQuestion)));
  $('sjGuideRefresh').addEventListener('click',()=>refresh(true));
  $('sjGuideClear').addEventListener('click',()=>{generation++;turns=[];$('sjGuideQuestion').value='';renderResults();$('sjGuideSchedule').open=true;dialog.querySelector('.sj-guide-body').scrollTop=0;});
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  $('sjGuideAlerts').checked=read('sj_guide_alerts',false)===true;
  $('sjGuideAlerts').addEventListener('change',()=>{write('sj_guide_alerts',$('sjGuideAlerts').checked);if(!$('sjGuideAlerts').checked)dismissAlert();else refresh(true);});
  function dismissAlert(){clearTimeout(expiry);alert?.remove();alert=null;}
  function checkAlert(){
    if(!data||!$('sjGuideAlerts').checked||document.hidden||dialog.open||alert||Date.now()-lastFetch>120000)return;
    if(typeof gateShowing==='function'&&gateShowing())return;
    if(typeof isAdmin==='function'&&isAdmin())return;
    if(window.__uploadsInFlight||document.querySelector('.activity-toast,.competition-toast'))return;
    if(document.querySelector('[data-view="voicemsg"]:not(.hidden),[data-view="videomsg"]:not(.hidden)'))return;
    const active=document.activeElement;if(active?.matches('input,textarea,[contenteditable="true"]'))return;
    const seen=read('sj_guide_seen',[]),list=Array.isArray(seen)?seen:[],now=Date.now();
    const a=data.activities.find(a=>(a.live||(a.at<=now+10*60000&&a.at>=now-20*60000))&&!list.includes(a.id+':'+a.version));if(!a)return;
    write('sj_guide_seen',[...list,a.id+':'+a.version].slice(-200));
    alert=element('aside','sj-guide-alert');alert.setAttribute('aria-label','Wedding activity reminder');
    if(K.photo(a.image)){const img=element('img');img.src=a.image;img.alt='';img.addEventListener('error',()=>img.remove(),{once:true});alert.append(img);}
    const link=element('a','',a.title);link.href='#'+safeView(a.view);link.append(element('small','',a.live?'Open the live broadcast →':(a.at>now?'Starts soon':'Scheduled now')+' · Open activity →'));link.addEventListener('click',e=>{dismissAlert();navigate(e,a.view);});
    const dismiss=element('button','','×');dismiss.type='button';dismiss.setAttribute('aria-label','Dismiss activity reminder');dismiss.addEventListener('click',dismissAlert);alert.append(link,dismiss);document.body.append(alert);expiry=setTimeout(dismissAlert,18000);
  }
  setInterval(()=>{if(!document.hidden&&(dialog.open||$('sjGuideAlerts').checked))refresh(true);},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&(dialog.open||$('sjGuideAlerts').checked))refresh(true);});
  if($('sjGuideAlerts').checked)refresh();
})();
