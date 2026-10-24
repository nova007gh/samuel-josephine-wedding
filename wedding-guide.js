/* In-house S&J Guide: questions stay on this device; only public knowledge is fetched. */
(()=>{
  'use strict';
  const K=window.WeddingGuideKnowledge;if(!K)return;
  const button=document.getElementById('sjGuideLaunch'),dialog=document.getElementById('sjGuideDialog');if(!button||!dialog)return;
  const $=id=>document.getElementById(id),allowed=new Set(['home','story','events','rsvp','gallery','voicemsg','videomsg','chat','gifts','competitions','guestbook','bridaltrain','program','engagementprogram','livebroadcast','entertainment']);
  let data=null,busy=null,lastFetch=0,alert=null,expiry=null,returnFocus=null,sending=false,fingerprint='',turns=[],generation=0;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),wavePeriod=10*60000,suggestionPeriod=8*60000,waveTimers=new Map();
  let waveEpoch=Date.now(),introWave=0,sessionVisible=false,nextMeetingAt=Date.now()+3*60000,meetingCount=0,meeting=null;
  let lastWaveSlot=0,lastInteraction=Date.now(),nextSuggestionAt=Date.now()+suggestionPeriod,suggestionCount=0,suggestion=null,suggestionExpiry=null,burst=null,burstExpiry=null;
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
  function open(launcher=button){if(dialog.open)return;stopMeeting();lastInteraction=Date.now();returnFocus=launcher;returnFocus.focus({preventScroll:true});dismissAlert();dismissSuggestion();dialog.show();heartBurst(launcher);refresh();}
  function close(){if(dialog.open)dialog.close();}
  document.querySelectorAll('.sj-guide-launch[aria-controls="sjGuideDialog"]').forEach(launcher=>launcher.addEventListener('click',()=>open(launcher)));$('sjGuideClose').addEventListener('click',close);
  dialog.addEventListener('close',()=>{
    // A queued close event must not steal a newer focus choice or clear the
    // hearts from a dialog that has already been reopened.
    if(dialog.open)return;clearBurst();
    const active=document.activeElement;
    if(returnFocus?.isConnected&&(active===document.body||active===dialog||dialog.contains(active)))returnFocus.focus({preventScroll:true});
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}});
  $('sjGuideForm').addEventListener('submit',e=>{e.preventDefault();submit($('sjGuideQuestion').value);});
  document.querySelectorAll('[data-guide-question]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.guideQuestion)));
  $('sjGuideRefresh').addEventListener('click',()=>refresh(true));
  $('sjGuideClear').addEventListener('click',()=>{generation++;turns=[];$('sjGuideQuestion').value='';renderResults();$('sjGuideSchedule').open=true;dialog.querySelector('.sj-guide-body').scrollTop=0;});
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  $('sjGuideSuggestionsEnabled').checked=read('sj_guide_suggestions',true)!==false;
  $('sjGuideSuggestionsEnabled').addEventListener('change',()=>{write('sj_guide_suggestions',$('sjGuideSuggestionsEnabled').checked);nextSuggestionAt=Date.now()+suggestionPeriod;if(!$('sjGuideSuggestionsEnabled').checked)dismissSuggestion();});
  $('sjGuideAlerts').checked=read('sj_guide_alerts',false)===true;
  $('sjGuideAlerts').addEventListener('change',()=>{write('sj_guide_alerts',$('sjGuideAlerts').checked);if(!$('sjGuideAlerts').checked)dismissAlert();else refresh(true);});
  function dismissAlert(){clearTimeout(expiry);alert?.remove();alert=null;}
  function guestsIdle(){
    if(document.hidden||dialog.open||window.__uploadsInFlight||document.body.classList.contains('locked')||$('app')?.classList.contains('hidden')||window.WeddingAccess&&!WeddingAccess.canUse())return false;
    if(typeof gateShowing==='function'&&gateShowing())return false;
    if(typeof isAdmin==='function'&&isAdmin())return false;
    if(document.querySelector('.activity-toast,.competition-toast,dialog[open],.sheet:not(.hidden),.lightbox:not(.hidden)'))return false;
    if(document.querySelector('[data-view="voicemsg"]:not(.hidden),[data-view="videomsg"]:not(.hidden)'))return false;
    if(document.activeElement?.matches('input,textarea,[contenteditable="true"]'))return false;
    if([...document.querySelectorAll('.view:not(.hidden) video,.view:not(.hidden) audio')].some(media=>!media.paused))return false;
    return true;
  }
  function clearWaves(){for(const [launcher,timer] of waveTimers){clearTimeout(timer);launcher.classList.remove('sj-guide-waving');}waveTimers.clear();}
  function clearBurst(){clearTimeout(burstExpiry);burst?.remove();burst=null;}
  function heartBurst(launcher){
    clearBurst();if(reducedMotion.matches)return;
    burst=element('div','sj-guide-burst');burst.setAttribute('aria-hidden','true');
    const x=launcher.classList.contains('sj-guide-launch--left')?60:dialog.clientWidth-60,y=Math.max(90,Math.min(dialog.clientHeight-80,launcher.getBoundingClientRect().top-dialog.getBoundingClientRect().top));
    for(let i=0;i<8;i++){
      const heart=element('span','sj-guide-heart','♥');heart.style.setProperty('--heart-x',x+'px');heart.style.setProperty('--heart-y',y+'px');heart.style.setProperty('--heart-dx',((i-3.5)*11)+'px');heart.style.setProperty('--heart-dy',(-50-(i%3)*24)+'px');heart.style.setProperty('--heart-delay',(i%3)*45+'ms');heart.style.setProperty('--heart-turn',((i-3.5)*9)+'deg');burst.append(heart);
    }
    dialog.append(burst);burstExpiry=setTimeout(clearBurst,1450);
  }
  function dismissSuggestion(){clearTimeout(suggestionExpiry);suggestion?.remove();suggestion=null;}
  function chooseSuggestion(now){
    if(!data)return null;
    const next=data.activities.find(a=>a.live||a.at>=now),programme=data.cards.find(c=>c.id==='receptionProgram')||data.cards.find(c=>c.id==='engagementProgram');
    const choices=[programme&&{...programme,title:'Explore the celebration programme'},data.cards.find(c=>c.id==='gallery'),next&&{...next,title:'Explore: '+next.title},data.cards.find(c=>c.id==='guestbook')].filter(Boolean);
    return choices.length?choices[suggestionCount%choices.length]:null;
  }
  async function maybeSuggest(now){
    if(now<nextSuggestionAt||suggestionCount>=3||!$('sjGuideSuggestionsEnabled').checked||suggestion||alert||meeting||!guestsIdle()||Date.now()-lastInteraction<15000)return;
    if(document.querySelector('[data-view="chat"]:not(.hidden)'))return;
    nextSuggestionAt=now+suggestionPeriod;await refresh();
    if(!data||Date.now()-lastFetch>120000||!$('sjGuideSuggestionsEnabled').checked||suggestion||alert||meeting||!guestsIdle()||Date.now()-lastInteraction<15000||document.querySelector('[data-view="chat"]:not(.hidden)'))return;
    const row=chooseSuggestion(Date.now());if(!row)return;
    const jossy=suggestionCount%2===0; suggestionCount++;
    suggestion=element('aside','sj-guide-alert sj-companion-suggestion'+(jossy?' sj-companion-suggestion--left':''));suggestion.setAttribute('aria-label',(jossy?'Jossy':'Sam')+' activity suggestion');
    if(K.photo(row.image)){const img=element('img');img.src=row.image;img.alt='';img.addEventListener('error',()=>img.remove(),{once:true});suggestion.append(img);}
    const link=element('a');link.href='#'+safeView(row.view);link.append(element('strong','',(jossy?'Jossy':'Sam')+' suggests'),document.createTextNode(row.title),element('small','','Published details · Open '+(pageNames[row.view]||'Home')+' →'));link.addEventListener('click',e=>{dismissSuggestion();navigate(e,row.view);});
    const dismiss=element('button','','×');dismiss.type='button';dismiss.setAttribute('aria-label','Dismiss companion suggestion');dismiss.addEventListener('click',dismissSuggestion);suggestion.append(link,dismiss);document.body.append(suggestion);suggestionExpiry=setTimeout(dismissSuggestion,14000);
  }
  function wave(launcher){
    if(reducedMotion.matches||!guestsIdle()||suggestion||alert||meeting||Date.now()-lastInteraction<15000)return;
    launcher.classList.add('sj-guide-waving');waveTimers.set(launcher,setTimeout(()=>{launcher.classList.remove('sj-guide-waving');waveTimers.delete(launcher);},2400));
  }
  function stopMeeting(){
    if(!meeting)return;
    const current=meeting;meeting=null;current.animations.forEach(animation=>animation.cancel());current.timers.forEach(clearTimeout);clearInterval(current.guard);current.hearts?.remove();
    document.querySelectorAll('.sj-guide-meeting').forEach(launcher=>launcher.classList.remove('sj-guide-meeting'));
  }
  function meetingAllowed(){return !reducedMotion.matches&&guestsIdle()&&!suggestion&&!alert&&!document.querySelector('[data-view="chat"]:not(.hidden),[data-view="gifts"]:not(.hidden),[data-view="livebroadcast"]:not(.hidden)');}
  function startMeeting(){
    if(meeting||!meetingAllowed()||typeof button.animate!=='function')return;
    clearWaves();meetingCount++;nextMeetingAt=Date.now()+8*60000;
    const app=$('app').getBoundingClientRect(),bar=document.querySelector('.tabbar').getBoundingClientRect(),center=(app.left+app.right)/2;
    const y=Math.max(90,Math.min(innerHeight*.46,bar.top-130));
    const current={animations:[],timers:[],guard:null,hearts:null};meeting=current;
    for(const [id,side] of [['sjGuideLaunchJossy',-1],['sjGuideLaunch',1]]){
      const launcher=$(id),from=getComputedStyle(launcher).transform;launcher.classList.add('sj-guide-meeting');const r=launcher.getBoundingClientRect(),dx=center+side*21-(r.left+r.width/2),dy=y-(r.top+r.height/2);
      const together=`translate(${dx}px,${dy}px)`,kiss=`${together} rotate(${-side*11}deg)`;
      current.animations.push(launcher.animate([{transform:from,offset:0},{transform:together,offset:.32},{transform:kiss,offset:.43},{transform:kiss,offset:.57},{transform:together,offset:.68},{transform:'translate(0,0)',offset:1}],{duration:7200,easing:'ease-in-out'}));
    }
    current.timers.push(setTimeout(()=>{
      if(meeting!==current||!meetingAllowed()){stopMeeting();return;}
      const hearts=element('div','sj-companion-love');hearts.setAttribute('aria-hidden','true');hearts.style.left=app.left+'px';hearts.style.width=app.width+'px';
      for(let i=0;i<14;i++){
        const heart=element('span','sj-guide-heart','♥'),angle=(i/14)*Math.PI*2;
        heart.style.setProperty('--heart-x',(center-app.left)+'px');heart.style.setProperty('--heart-y',(y-22)+'px');heart.style.setProperty('--heart-dx',(Math.cos(angle)*(38+i%3*15))+'px');heart.style.setProperty('--heart-dy',(-45+Math.sin(angle)*55)+'px');heart.style.setProperty('--heart-delay',(i%4*70)+'ms');heart.style.setProperty('--heart-turn',((i-7)*8)+'deg');hearts.append(heart);
      }
      current.hearts=hearts;document.body.append(hearts);
    },3100));
    current.timers.push(setTimeout(stopMeeting,7350));
    current.guard=setInterval(()=>{if(!meetingAllowed())stopMeeting();},250);
  }
  function tickCompanions(){
    syncSession();if(!sessionVisible)return;
    const now=Date.now(),elapsed=now-waveEpoch,slot=Math.floor(elapsed/wavePeriod);
    const intro=Math.min(2,Math.floor(elapsed/60000));
    if(intro>introWave){introWave=intro;wave($(intro===1?'sjGuideLaunchJossy':'sjGuideLaunch'));}
    else if(slot>lastWaveSlot){lastWaveSlot=slot;wave($(slot%2?'sjGuideLaunchJossy':'sjGuideLaunch'));}
    if(now>=nextMeetingAt&&meetingCount<3&&now-lastInteraction>=15000&&meetingAllowed())startMeeting();
    if(!document.hidden)maybeSuggest(now);
  }
  function syncSession(){
    const visible=!document.body.classList.contains('locked')&&!$('app')?.classList.contains('hidden');
    if(visible&&!sessionVisible){waveEpoch=Date.now();introWave=0;lastWaveSlot=0;nextMeetingAt=Date.now()+3*60000;meetingCount=0;}
    sessionVisible=visible;document.body.classList.toggle('sj-companions-floating',visible);
    if(!visible){stopMeeting();clearWaves();dismissSuggestion();}
  }
  function syncMotion(){document.body.classList.toggle('sj-companions-paused',document.hidden);if(document.hidden||reducedMotion.matches){clearWaves();clearBurst();stopMeeting();}if(document.hidden)dismissSuggestion();}
  function interact(event){
    lastInteraction=Date.now();
    const launcher=event?.target?.closest?.('.sj-guide-launch[aria-controls="sjGuideDialog"]');
    // Open before cancelling travel: moving a pointer target between down/up
    // otherwise loses the native click. Keyboard activation keeps its focus.
    if(meeting&&launcher&&event.type==='pointerdown'&&event.isPrimary!==false&&event.button===0){event.preventDefault();open(launcher);return;}
    stopMeeting();
  }
  document.addEventListener('pointerdown',interact);
  document.addEventListener('keydown',interact,{passive:true});
  document.addEventListener('wheel',interact,{passive:true});
  document.addEventListener('scroll',interact,{passive:true,capture:true});
  window.addEventListener('popstate',interact);window.addEventListener('hashchange',interact);
  document.addEventListener('focusin',()=>{if(!guestsIdle())stopMeeting();});
  window.addEventListener('resize',stopMeeting);window.addEventListener('orientationchange',stopMeeting);
  const sessionObserver=new MutationObserver(syncSession);sessionObserver.observe(document.body,{attributes:true,attributeFilter:['class']});sessionObserver.observe($('app'),{attributes:true,attributeFilter:['class']});syncSession();
  window.addEventListener('wedding:view',()=>{interact();if(!guestsIdle())dismissSuggestion();});
  reducedMotion.addEventListener('change',syncMotion);syncMotion();setInterval(tickCompanions,15000);
  function checkAlert(){
    if(!data||!$('sjGuideAlerts').checked||document.hidden||dialog.open||alert||suggestion||meeting||Date.now()-lastFetch>120000||window.WeddingAccess&&!WeddingAccess.canUse())return;
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
  document.addEventListener('visibilitychange',()=>{syncMotion();tickCompanions();if(!document.hidden&&(dialog.open||$('sjGuideAlerts').checked))refresh(true);});
  if($('sjGuideAlerts').checked)refresh();
})();
