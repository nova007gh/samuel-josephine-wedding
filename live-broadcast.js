/* On-demand broadcast page. Providers load only after an explicit Play click. */
(() => {
  'use strict';
  const host=document.getElementById('liveBroadcastContent'),form=document.getElementById('liveBroadcastEditor'),panel=document.getElementById('admin-panel-broadcast');
  const loadStatus=document.getElementById('liveBroadcastLoadStatus'),status=document.getElementById('liveBroadcastEditorStatus'),actionStatus=document.getElementById('liveBroadcastActionStatus'),retry=document.getElementById('liveBroadcastRetry'),picker=document.getElementById('liveBroadcastPhotoInput');
  const lists={schedule:document.getElementById('liveBroadcastScheduleEditor'),replays:document.getElementById('liveBroadcastReplayEditor')};
  const fields=['title','subtitle','intro','status','streamUrl','startsAt','heroPhotoUrl','posterUrl'],esc=v=>escapeHTML(String(v??''));
  let saved=null,version=null,dirty=false,busy=false,loading=false,serial=0,epoch=0,key='',expanded=false,offset=0,photoTarget=null,activeUrl='',activeLabel='',activeMain=false,resumeMusic=false,actionBusy=false,playerSerial=0;
  const uid=()=>crypto.randomUUID?crypto.randomUUID():'entry-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const now=()=>Date.now()+offset;
  const editorVisible=()=>isAdmin()&&!panel.classList.contains('hidden')&&!document.querySelector('[data-view="admin"]').classList.contains('hidden');
  const wanted=()=>!document.hidden&&(!document.querySelector('[data-view="livebroadcast"]').classList.contains('hidden')||editorVisible());
  const dateLabel=ms=>ms===null?'Time to be announced':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(ms)+' ('+new Intl.DateTimeFormat(undefined,{timeZoneName:'short'}).formatToParts(ms).find(p=>p.type==='timeZoneName').value+')';
  const localDate=ms=>{if(ms===null)return '';const d=new Date(ms),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const parseDate=v=>v?new Date(v).getTime():null;
  const icon=kind=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind===0?'<circle cx="11" cy="20" r="8"/><circle cx="22" cy="20" r="8"/><path d="m15 5 3-3 3 3-3 5zM18 10v4"/>':kind===1?'<path d="m7 3 9 3-3 11c-2 5-10 2-9-3zM12 20l-3 9M5 28l8 2M24 3l-8 3 3 11c2 5 10 2 9-3zM21 20l3 9M20 30l8-2M5 12l9 3M18 15l9-3"/>':'<path d="M25 12c0 7-9 17-9 17S7 19 7 12a9 9 0 0 1 18 0z"/><circle cx="16" cy="12" r="3.5"/>'}</svg>`;
  const directVideo=url=>/\.(mp4|webm)$/i.test(new URL(url).pathname);
  const picture=url=>saved?.previews[url]||url;
  const couple=()=>sitePhoto('couple','assets/photo-placeholder.svg');
  function controls(on){[...form.elements].forEach(el=>el.disabled=on);form.setAttribute('aria-busy',String(on));}
  function draftState(){const el=document.getElementById('liveBroadcastDraftState');el.textContent=busy?'Working — please keep this page open':dirty?'Unsaved changes — save to publish':'Viewing saved content';el.classList.toggle('has-draft',dirty);}
  function markDirty(){dirty=true;draftState();}
  function canCalendar(){return saved&&(saved.data.startsAt!==null||saved.data.schedule.some(row=>row.startsAt!==null));}
  function stopPlayer(resume=true){
    if(!activeUrl)return;
    playerSerial++;
    const video=host.querySelector('#lbPlayerSlot video');if(video){video.pause();video.removeAttribute('src');video.load();}
    const slot=host.querySelector('#lbPlayerSlot');if(slot){slot.replaceChildren();slot.classList.add('hidden');}
    activeUrl='';activeLabel='';activeMain=false;window.__weddingBroadcastPlaying=false;
    if(resume&&resumeMusic&&!document.hidden&&typeof tryStartSong==='function')tryStartSong();resumeMusic=false;
    key='';
  }
  function tick(){
    if(!saved||document.hidden||document.querySelector('[data-view="livebroadcast"]').classList.contains('hidden'))return;
    const data=saved.data,scheduled=data.status==='scheduled'&&data.startsAt!==null,remaining=scheduled?Math.max(0,data.startsAt-now()):0;
    const note=host.querySelector('#lbCountdownNote'),clock=host.querySelector('#lbCountdownClock');
    if(note)note.textContent=data.status==='live'?'We are live — join us':data.status==='ended'?'Broadcast ended — find available replays below':scheduled?(remaining?'Going live in':'Scheduled start reached — waiting for the host'):'Broadcast details coming soon';
    clock?.classList.toggle('hidden',!scheduled);
    const seconds=Math.floor(remaining/1000),values={days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),mins:Math.floor(seconds%3600/60),secs:seconds%60};
    for(const [unit,value]of Object.entries(values)){const el=host.querySelector(`[data-lb-clock="${unit}"]`),text=String(value).padStart(2,'0');if(el&&el.textContent!==text)el.textContent=text;}
    const badge=host.querySelector('#lbStateBadge');if(badge){badge.textContent=data.status==='live'?'◉ LIVE':data.status==='scheduled'?'SCHEDULED':data.status==='ended'?'ENDED':'COMING SOON';badge.classList.toggle('lb-is-live',data.status==='live');}
    for(const row of data.schedule){const el=host.querySelector(`[data-lb-schedule-state="${row.id}"]`);if(el)el.textContent=row.startsAt===null?'TO BE ANNOUNCED':row.startsAt>now()?'UPCOMING':row.endsAt!==null&&row.endsAt<=now()?'TIME PASSED':row.endsAt!==null?'SCHEDULED WINDOW':'START TIME PASSED';}
  }
  function renderReplays(){
    if(!saved)return;const list=host.querySelector('#lbReplays');if(!list)return;
    const data=saved.data,poster=picture(data.posterUrl)||picture(data.heroPhotoUrl)||couple();
    list.innerHTML=data.replays.slice(0,expanded?30:3).map(row=>`<a class="lb-replay" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer" data-lb-play="${esc(row.url)}" data-lb-label="${esc(row.title)}"><div><img src="${esc(picture(row.posterUrl)||poster)}" alt="${esc(row.title)} poster" loading="lazy" decoding="async">${row.duration?`<span>${esc(row.duration)}</span>`:''}</div><h3>${esc(row.title)}</h3>${row.startsAt!==null?`<p>${esc(dateLabel(row.startsAt))}</p>`:''}</a>`).join('')||'<p class="page-sub">No past broadcasts yet. Replays will appear here when added.</p>';
    const button=host.querySelector('[data-lb-action="view-all"]');button?.classList.toggle('hidden',data.replays.length<=3);button?.setAttribute('aria-expanded',String(expanded));if(button)button.textContent=expanded?'Show Less':'View All';
  }
  function render(){
    if(!saved)return;
    const data=saved.data,hero=picture(data.heroPhotoUrl)||couple(),poster=picture(data.posterUrl)||hero;
    const next=JSON.stringify([saved.revision,saved.previews,hero,poster,siteSettings.weddingFormal]);if(next===key)return;
    if(activeUrl){const allowed=[data.streamUrl,...data.schedule.map(r=>r.url),...data.replays.map(r=>r.url)];if(!allowed.includes(activeUrl)||(activeMain&&['unconfigured','ended'].includes(data.status)))stopPlayer();}
    key=next;
    const enabled=!!data.streamUrl&&data.status!=='unconfigured',title=data.title.startsWith('Our ')?`<span class="showcase-our">Our</span> ${esc(data.title.slice(4))}`:esc(data.title);
    const play=enabled?`<a class="lb-play" href="${esc(data.streamUrl)}" target="_blank" rel="noopener noreferrer" data-lb-play="${esc(data.streamUrl)}" data-lb-main="true" data-lb-label="${esc(data.title)}" aria-label="Play or open the broadcast">▶</a>`:'<span class="lb-play lb-play--disabled" aria-hidden="true">▶</span>';
    const markup=`<header class="showcase-hero"><img class="showcase-hero-photo" src="${esc(hero)}" alt="Samuel and Josephine" decoding="async"><div><h1>${title}</h1><p>${esc(data.subtitle)}</p><span class="showcase-heart" aria-hidden="true">♥</span></div></header>
      <nav class="lb-page-nav" aria-label="Broadcast sections"><button type="button" data-lb-jump="schedule">Schedule</button><button type="button" data-lb-jump="replays">Replays <span>${data.replays.length}</span></button><button type="button" data-lb-action="refresh">Refresh details ↻</button></nav>
      <section class="lb-countdown floral-band" aria-label="Broadcast countdown"><div><p id="lbCountdownNote"></p>${data.startsAt!==null?`<time datetime="${new Date(data.startsAt).toISOString()}">${esc(dateLabel(data.startsAt))}</time>`:''}</div><div id="lbCountdownClock" class="lb-clock">${['days','hours','mins','secs'].map(unit=>`<div><b data-lb-clock="${unit}">00</b><span>${unit}</span></div>`).join('')}</div></section>
      <section class="lb-player" aria-label="Broadcast player"><img class="lb-poster" src="${esc(poster)}" alt="Broadcast poster" loading="lazy" decoding="async"><span id="lbStateBadge" class="lb-state"></span><div id="lbPlayerSlot" class="lb-player-slot hidden"></div>${play}<div class="lb-player-caption"><span>${esc(siteSettings.weddingFormal||'Samuel & Josephine')}</span><small>OUR WEDDING BROADCAST</small></div><div class="lb-player-tools hidden"><button data-lb-action="fullscreen" type="button" aria-label="Make player full screen">⛶</button><button data-lb-action="stop" type="button">Close player</button></div></section>
      <section class="lb-playback hidden" aria-label="Playback help"><strong id="lbPlayingTitle"></strong><p id="lbPlaybackStatus" role="status" aria-live="polite"></p><div><button data-lb-action="retry-player" type="button">Retry player</button><a id="lbProviderLink" target="_blank" rel="noopener noreferrer">Open with provider ↗</a></div></section>
      <section class="lb-intro"><h2>Join Us Live</h2><p>${esc(data.intro)}</p>${enabled?`<a class="lb-join" href="${esc(data.streamUrl)}" target="_blank" rel="noopener noreferrer">◉ &nbsp; ${data.status==='ended'?'OPEN BROADCAST':'JOIN LIVE BROADCAST'} &nbsp; ❯</a>`:'<button class="lb-join" type="button" disabled>BROADCAST DETAILS COMING SOON</button>'}<p class="lb-provider-note">${enabled?'Tap Play to open the player, or use the provider link. Provider availability and embedding permissions may vary.':'The host will add the real link and dates here. No stream is playing yet.'}</p></section>
      <section class="lb-schedule-panel" id="lbScheduleSection" tabindex="-1"><div class="lb-section-title"><h2>▣ Live Broadcast Schedule</h2><button class="lb-text-button" data-lb-action="calendar" type="button" ${canCalendar()?'':'disabled'}>Add to Calendar</button></div><div class="lb-schedule-grid">${data.schedule.map((row,i)=>`<article><span class="lb-schedule-icon" aria-hidden="true">${icon(i%3)}</span><h3>${esc(row.title)}</h3><p>${esc(dateLabel(row.startsAt))}</p>${row.endsAt!==null?`<p class="lb-end-time">Until ${esc(dateLabel(row.endsAt))}</p>`:''}<span class="lb-schedule-state" data-lb-schedule-state="${esc(row.id)}"></span>${row.url?`<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer" data-lb-play="${esc(row.url)}" data-lb-label="${esc(row.title)}">Open broadcast ↗</a>`:''}</article>`).join('')||'<p>Schedule details coming soon.</p>'}</div></section>
      <section class="lb-replay-panel" id="lbReplaySection" tabindex="-1"><div class="lb-section-title"><h2>▷ Past Broadcasts</h2><button class="lb-text-button hidden" data-lb-action="view-all" type="button" aria-expanded="false">View All</button></div><div id="lbReplays" class="lb-replays"></div></section>
      <div class="lb-bottom-actions"><button data-lb-action="reminder" type="button" ${canCalendar()?'':'disabled'}><span aria-hidden="true">♧</span><span><strong>SET A REMINDER</strong><small>${canCalendar()?'Download a calendar reminder for the confirmed dates.':'Available when dates are announced.'}</small></span></button><button data-lb-action="share" type="button"><span aria-hidden="true">↗</span><span><strong>SHARE THE LIVE LINK</strong><small>Invite family and friends to the broadcast page.</small></span></button></div>`;
    if(activeUrl){
      // Keep the existing iframe/video in place: moving an iframe reloads it.
      const template=document.createElement('template');template.innerHTML=markup;
      for(const node of [...template.content.children]){if(node.matches('.lb-player,.lb-playback'))continue;const old=host.querySelector(':scope > .'+node.classList[0]);if(old)old.replaceWith(node);}
    }else host.innerHTML=markup;
    host.querySelector('[data-lb-action="reminder"]>span:first-child').innerHTML='<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M14 4a2 2 0 0 1 4 0v1c5 1 7 5 7 11 0 3 1 5 3 7v2H4v-2c2-2 3-4 3-7 0-6 2-10 7-11zM12 27h8a4 4 0 0 1-8 0"/></svg>';
    renderReplays();tick();
  }
  function openPlayer(url,label,isMain){
    const embed=saved.embeds[url],direct=directVideo(url);if(!embed&&!direct)return false;
    const music=document.getElementById('backgroundMusic'),shouldResume=activeUrl?resumeMusic:!!music&&!music.paused;stopPlayer(false);resumeMusic=shouldResume;window.__weddingBroadcastPlaying=true;music?.pause();document.getElementById('musicToggle')?.classList.remove('is-on');activeUrl=url;activeLabel=label;activeMain=isMain;
    const slot=host.querySelector('#lbPlayerSlot');slot.classList.remove('hidden');
    host.querySelector('.lb-playback').classList.remove('hidden');host.querySelector('#lbPlayingTitle').textContent=label;
    const attempt=++playerSerial,feedback=message=>{if(activeUrl===url&&attempt===playerSerial)host.querySelector('#lbPlaybackStatus').textContent=message;};
    host.querySelector('#lbProviderLink').href=url;
    feedback(direct?'Loading video…':'Opening the provider’s player. If it is unavailable here, use Open with provider.');
    if(direct){
      const video=document.createElement('video');video.src=url;video.controls=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-label',label);
      video.addEventListener('playing',()=>feedback('Playing '+label));
      video.addEventListener('waiting',()=>feedback('Buffering — waiting for your connection…'));
      video.addEventListener('error',()=>feedback('This video could not play. Retry, or open it with the provider.'));
      video.addEventListener('ended',()=>{if(activeUrl===url&&attempt===playerSerial){stopPlayer();render();}},{once:true});slot.appendChild(video);
      video.play().catch(()=>{if(video.error)feedback('This video could not play. Retry, or open it with the provider.');else feedback('Tap the video Play control to start.');});
    }
    else{const frame=document.createElement('iframe');frame.src=embed;frame.title=label;frame.allow='autoplay; fullscreen; picture-in-picture; encrypted-media';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');slot.appendChild(frame);}
    host.querySelector('.lb-play')?.classList.add('hidden');host.querySelector('.lb-player-caption')?.classList.add('hidden');host.querySelector('.lb-player-tools')?.classList.remove('hidden');
    host.querySelector('.lb-player').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return true;
  }
  function rowMarkup(row,type){
    return `<fieldset class="lb-edit-row" data-lb-id="${esc(row.id)}"><legend>${type==='schedule'?'Schedule item':'Replay'}</legend><div class="settings-fields"><label class="field">Title<input data-lb-field="title" maxlength="120" required value="${esc(row.title)}"></label><label class="field">${type==='schedule'?'Start':'Recorded on'} (optional)<input data-lb-field="startsAt" type="datetime-local" value="${localDate(row.startsAt)}"></label>${type==='schedule'?`<label class="field">End (optional)<input data-lb-field="endsAt" type="datetime-local" value="${localDate(row.endsAt)}"></label>`:`<label class="field">Duration label (optional)<input data-lb-field="duration" maxlength="20" value="${esc(row.duration)}"></label>`}<label class="field">${type==='schedule'?'Broadcast URL (optional)':'Replay URL'}<input data-lb-field="url" type="url" maxlength="2000" ${type==='replays'?'required':''} value="${esc(row.url)}"></label></div>${type==='replays'?`<input data-lb-field="posterUrl" type="hidden" value="${esc(row.posterUrl)}"><div class="lb-edit-preview">${row.posterUrl?`<img src="${esc(picture(row.posterUrl))}" alt="Replay poster" loading="lazy" decoding="async">`:''}</div><div class="aq-actions"><button class="aq-approve" data-lb-photo="replay" type="button">UPLOAD POSTER</button><button class="aq-reject" data-lb-action="clear-photo" type="button">CLEAR POSTER</button></div>`:''}<div class="aq-actions"><button class="aq-approve" data-lb-action="up" type="button">↑ EARLIER</button><button class="aq-approve" data-lb-action="down" type="button">↓ LATER</button><button class="aq-reject" data-lb-action="remove" type="button">REMOVE</button></div></fieldset>`;
  }
  function showEditorPhoto(field){const el=document.getElementById(field==='heroPhotoUrl'?'lbHeroPreview':'lbPosterPreview'),url=form.elements.namedItem(field).value;el.innerHTML=url?`<img src="${esc(picture(url))}" alt="Photo preview" loading="lazy" decoding="async">`:'';}
  function fill(){if(!isAdmin()||!saved||dirty||busy||version===saved.revision)return;fields.forEach(field=>form.elements.namedItem(field).value=field==='startsAt'?localDate(saved.data[field]):saved.data[field]);for(const [type,list]of Object.entries(lists))list.innerHTML=saved.data[type].map(row=>rowMarkup(row,type)).join('');version=saved.revision;showEditorPhoto('heroPhotoUrl');showEditorPhoto('posterUrl');draftState();}
  async function load(force=false){
    if(loading)return;const generation=serial,auth=epoch,started=Date.now();loading=true;host.setAttribute('aria-busy','true');if(!saved){loadStatus.textContent='Loading broadcast details…';if(isAdmin())status.textContent='Loading broadcast editor…';}
    try{const response=await api('/live-broadcast');if(generation!==serial)return;if(!response.data||!response.revision)throw new Error('Broadcast details could not load.');offset=response.serverNow+(Date.now()-started)/2-Date.now();const changed=saved&&saved.revision!==response.revision;saved=response;render();loadStatus.textContent='';retry.classList.add('hidden');if(force&&auth===epoch){dirty=false;version=null;}if(changed&&dirty)status.textContent='Saved broadcast details changed. Your draft is kept; reload before saving.';fill();}
    catch(err){loadStatus.textContent=saved?'Could not refresh. Showing the last loaded broadcast details.':err.message;retry.classList.remove('hidden');if(isAdmin())status.textContent=err.message;}
    finally{loading=false;host.setAttribute('aria-busy','false');}
  }
  function collect(){const data=Object.fromEntries(fields.map(field=>[field,field==='startsAt'?parseDate(form.elements.namedItem(field).value):form.elements.namedItem(field).value.trim()]));for(const [type,list]of Object.entries(lists))data[type]=[...list.querySelectorAll('[data-lb-id]')].map(row=>({id:row.dataset.lbId,...Object.fromEntries([...row.querySelectorAll('[data-lb-field]')].map(input=>[input.dataset.lbField,['startsAt','endsAt'].includes(input.dataset.lbField)?parseDate(input.value):input.value.trim()]))}));return data;}
  form.addEventListener('input',markDirty);
  form.addEventListener('click',async e=>{
    const button=e.target.closest('[data-lb-action],[data-lb-photo]');if(!button||!isAdmin()||busy)return;const action=button.dataset.lbAction,row=button.closest('[data-lb-id]');
    if(!saved&&action!=='reload'){load();return;}
    if(button.dataset.lbPhoto){photoTarget=row||button.dataset.lbPhoto;picker.value='';picker.click();return;}
    if(action==='reload'){if(dirty&&!confirm('Discard unsaved broadcast changes and reload saved content?'))return;await load(true);return;}
    if(action==='add-schedule'||action==='add-replay'){const type=action==='add-schedule'?'schedule':'replays',list=lists[type];if(list.children.length>=(type==='schedule'?12:30)){status.textContent='This list has reached its maximum size.';return;}list.insertAdjacentHTML('beforeend',rowMarkup({id:uid(),title:'',startsAt:null,endsAt:null,url:'',duration:'',posterUrl:''},type));list.lastElementChild.querySelector('input').focus();}
    else if(action==='clear-photo'){if(row){row.querySelector('[data-lb-field="posterUrl"]').value='';row.querySelector('.lb-edit-preview').innerHTML='';}else{form.elements.namedItem(button.dataset.lbTarget).value='';showEditorPhoto(button.dataset.lbTarget);}}
    else if(row){if(action==='remove')row.remove();else if(action==='up'&&row.previousElementSibling)row.parentElement.insertBefore(row,row.previousElementSibling);else if(action==='down'&&row.nextElementSibling)row.parentElement.insertBefore(row.nextElementSibling,row);}
    markDirty();
  });
  picker.addEventListener('change',async()=>{
    const file=picker.files[0],target=photoTarget,auth=epoch;picker.value='';if(!file||!target||!isAdmin()||busy)return;busy=true;controls(true);draftState();status.textContent='Uploading photo…';
    try{const data=new FormData();data.append('file',file,file.name);const response=await api('/admin/live-broadcast/photo',{method:'POST',form:data,admin:true,onProgress:(p,t)=>{if(isAdmin()&&auth===epoch)status.textContent=uploadTransferLabel(p,t);}});if(!isAdmin()||auth!==epoch)return;if(typeof target==='string'){form.elements.namedItem(target).value=response.url;showEditorPhoto(target);}else if(target.isConnected){target.querySelector('[data-lb-field="posterUrl"]').value=response.url;target.querySelector('.lb-edit-preview').innerHTML=`<img src="${esc(response.url)}" alt="Replay poster" loading="lazy" decoding="async">`;}markDirty();status.textContent='Photo uploaded to your draft. Save broadcast to publish.';}
    catch(err){if(isAdmin()&&auth===epoch)status.textContent=err.message+' Other edits are kept.';}finally{busy=false;controls(false);photoTarget=null;draftState();}
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!isAdmin()||busy||!saved)return;const data=collect(),auth=epoch;serial++;busy=true;controls(true);draftState();status.textContent='Saving broadcast…';
    try{const response=await api('/admin/live-broadcast',{method:'PATCH',body:{data,expectedRevision:version},admin:true});if(!isAdmin()||auth!==epoch)return;serial++;saved=response;offset=response.serverNow-Date.now();dirty=false;render();status.textContent='Broadcast saved — published for guests.';}
    catch(err){if(isAdmin()&&auth===epoch)status.textContent=err.message+' Your draft is kept.';}finally{busy=false;controls(false);fill();draftState();}
  });
  function downloadCalendar(reminder){const content=buildBroadcastCalendar(saved.data,{reminder,hostname:location.hostname}),url=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=reminder?'wedding-broadcast-reminder.ics':'wedding-broadcast.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);actionStatus.textContent='Calendar file downloaded. Import it into your calendar'+(reminder?' to set a 15-minute reminder.':'.');}
  async function share(){const url=new URL(location.origin+'/');url.searchParams.set('live','1');if(navigator.share){try{await navigator.share({title:saved.data.title,text:'Join Samuel & Josephine’s wedding broadcast',url:url.href});return;}catch(err){if(err.name==='AbortError')return;}}try{if(!navigator.clipboard)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(url.href);actionStatus.textContent='Broadcast page link copied.';}catch{const input=document.getElementById('liveBroadcastShareLink');input.value=url.href;input.classList.remove('hidden');input.select();actionStatus.textContent='Copy the broadcast page link below to share it.';}}
  host.addEventListener('click',async e=>{
    const jump=e.target.closest('[data-lb-jump]');if(jump){const section=host.querySelector(jump.dataset.lbJump==='schedule'?'#lbScheduleSection':'#lbReplaySection');section.focus({preventScroll:true});section.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
    const play=e.target.closest('[data-lb-play]');if(play&&!e.metaKey&&!e.ctrlKey){if(saved.embeds[play.dataset.lbPlay]||directVideo(play.dataset.lbPlay)){e.preventDefault();openPlayer(play.dataset.lbPlay,play.dataset.lbLabel,play.dataset.lbMain==='true');return;}}
    if(e.target.closest('a[target="_blank"]')){stopPlayer(false);document.getElementById('backgroundMusic')?.pause();document.getElementById('musicToggle')?.classList.remove('is-on');render();return;}
    const button=e.target.closest('[data-lb-action]');if(!button||!saved)return;const action=button.dataset.lbAction;
    if(action==='refresh'){if(!loading){loadStatus.textContent='Refreshing broadcast details…';key='';load();}return;}
    if(action==='retry-player'){if(activeUrl)openPlayer(activeUrl,activeLabel,activeMain);return;}
    if(action==='stop'){stopPlayer();render();return;}
    if(action==='fullscreen'){try{const player=host.querySelector('.lb-player'),video=player.querySelector('video');if(player.requestFullscreen)await player.requestFullscreen();else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();else throw new Error('Fullscreen unavailable');}catch{actionStatus.textContent='Use the video provider’s full-screen control, or open the broadcast link.';}return;}
    if(action==='view-all'){expanded=!expanded;renderReplays();return;}
    if(actionBusy)return;actionBusy=true;try{if(action==='calendar'||action==='reminder')downloadCalendar(action==='reminder');else if(action==='share')await share();}catch(err){actionStatus.textContent=err.message;}finally{setTimeout(()=>{actionBusy=false;},300);}
  });
  host.addEventListener('error',e=>{const img=e.target;if(img.tagName!=='IMG'||img.src.includes('photo-placeholder.svg'))return;const original=Object.entries(saved?.previews||{}).find(([,preview])=>new URL(preview,location.href).href===img.src)?.[0]||(img.src===new URL(couple(),location.href).href?originalSitePhoto('couple','assets/photo-placeholder.svg'):'');img.src=original&&new URL(original,location.href).href!==img.src?original:'assets/photo-placeholder.svg';},true);
  retry.addEventListener('click',()=>{key='';load();});
  window.addEventListener('wedding:view',e=>{if(e.detail?.name==='livebroadcast')load();else if(e.detail?.name){stopPlayer();if(e.detail.name==='admin'&&editorVisible()){fill();load();}}});
  window.addEventListener('wedding:settings',()=>{if(saved)render();});
  document.getElementById('musicToggle')?.addEventListener('click',()=>{if(activeUrl){stopPlayer(false);render();}},true);
  new MutationObserver(()=>{if(editorVisible()){fill();load();}}).observe(panel,{attributes:true,attributeFilter:['class']});
  onAdminAuth(signedIn=>{epoch++;if(signedIn){fill();if(editorVisible())load();}else{dirty=false;version=null;photoTarget=null;form.reset();showEditorPhoto('heroPhotoUrl');showEditorPhoto('posterUrl');Object.values(lists).forEach(list=>list.innerHTML='');status.textContent='';draftState();}});
  window.addEventListener('beforeunload',e=>{if(isAdmin()&&(dirty||busy)){e.preventDefault();e.returnValue='';}});
  window.addEventListener('offline',()=>{if(wanted())loadStatus.textContent='You are offline. Loaded details remain visible; video playback needs a connection.';});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayer(false);else if(wanted()){render();load();}});
  window.addEventListener('online',()=>{if(wanted())load();});
  setInterval(()=>{if(wanted()&&!busy&&!window.__uploadsInFlight)load();},15000);setInterval(tick,1000);
  function sharedEntry(){if(new URL(location.href).searchParams.get('live')!=='1'||gateShowing()||(!isAdmin()&&!getGuest()?.name))return;const clean=new URL(location.href);clean.searchParams.delete('live');history.replaceState(history.state,'',clean);switchView('livebroadcast');}
  window.addEventListener('sj:entered',()=>setTimeout(sharedEntry,0));setTimeout(sharedEntry,0);
  if(wanted())load();
})();
