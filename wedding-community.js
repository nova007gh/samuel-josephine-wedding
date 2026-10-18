/* Wedding Chat and confirmed entertainment. No seeded people or bookings. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),esc=v=>escapeHTML(String(v??''));
  const labels={all:'All Acts',band:'Live Band',singer:'Singers',dj:'DJ',mc:'MC',violinist:'Violinist',other:'Other'};
  const emojis=['❤️','😍','👏','👍','🔥','🙏'];
  const uuid=()=>crypto.randomUUID();
  const visible=name=>currentView===name&&!document.hidden;
  const adminEditor=()=>isAdmin()&&currentView==='admin'&&!$('admin-panel-entertainment').classList.contains('hidden');
  const options=extra=>({...extra,admin:isAdmin()});
  const date=ms=>ms===null?'Time to be announced':new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZoneName:undefined}).format(ms);
  const localDate=ms=>{if(ms===null)return '';const d=new Date(ms),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  let epoch=0,chatVersion=0,chatLoading=false,chatRefreshPending=false,sending=false,uploading=false,chatFilter='all',messages=[],chatKey='',attachment=null,pending=null;
  let entertainment=null,entVersion=0,entFilter='all',entLoading=false,entReloadPending=false,entDirty=false,entBusy=false,editorRevision=null,entKey='';
  function photos(){const src=sitePhoto('couple','assets/photo-placeholder.svg');document.querySelectorAll('[data-community-photo]').forEach(img=>{if(img.getAttribute('src')!==src)img.src=src;});}
  document.querySelectorAll('[data-community-photo]').forEach(img=>img.addEventListener('error',()=>{if(!img.src.endsWith('/assets/photo-placeholder.svg'))img.src='assets/photo-placeholder.svg';}));
  const draftKey=()=>`sj_chat_draft_${isAdmin()?'hosts':getGuest()?.id||'guest'}`;
  function storeDraft(){try{localStorage.setItem(draftKey(),JSON.stringify({text:$('chatText').value,announcement:$('chatAnnouncement').checked,attachment,pending}));}catch{}}
  function loadDraft(){attachment=null;pending=null;$('chatText').value='';$('chatAnnouncement').checked=false;try{const d=JSON.parse(localStorage.getItem(draftKey())||'null');if(d){$('chatText').value=typeof d.text==='string'?d.text.slice(0,2000):'';$('chatAnnouncement').checked=d.announcement===true;attachment=d.attachment||null;pending=d.pending||null;}}catch{}showAttachment();}
  function showAttachment(){$('chatAttachment').textContent=attachment?`Attached: ${attachment.name} (${Math.ceil(attachment.size/1024)} KB)` :'';$('chatClearAttachment').classList.toggle('hidden',!attachment);}
  function chatControls(){const locked=sending||uploading;[...$('chatComposer').elements].forEach(el=>el.disabled=locked);$('chatComposer').setAttribute('aria-busy',String(locked));$('chatSend').textContent=sending?'Sending…':uploading?'Uploading…':'Send ➤';}
  function fileMarkup(file){
    if(!file)return '';
    const url=esc(file.url),name=esc(file.name);
    if(file.kind==='photos')return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${name}" loading="lazy"></a>`;
    if(file.kind==='videos')return `<video src="${url}" controls playsinline preload="none" aria-label="${name}"></video>`;
    if(file.mime.startsWith('audio/'))return `<audio src="${url}" controls preload="none" aria-label="${name}"></audio>`;
    return `<a class="chat-file" href="${url}" target="_blank" rel="noopener noreferrer" download>📄 ${name} · ${Math.ceil(file.size/1024)} KB</a>`;
  }
  function renderChat(force=false){
    const items=messages.filter(m=>chatFilter==='all'||chatFilter==='announcements'&&m.kind==='announcement'||chatFilter==='reactions'&&m.reactions.length||m.attachment?.kind===chatFilter).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.createdAt-b.createdAt);
    const key=JSON.stringify([items,isAdmin(),chatFilter]);if(!force&&key===chatKey)return;chatKey=key;
    const list=$('chatMessages'),nearEnd=list.scrollHeight-list.scrollTop-list.clientHeight<80,scroll=list.scrollTop;
    const template=document.createElement('template');
    template.innerHTML=items.map(m=>{
      const badge=m.host?'Hosts':'Guest',initials=m.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('');
      return `<article class="chat-card${m.own?' is-own':''}${m.pinned?' is-pinned':''}" data-chat-id="${esc(m.id)}"><div class="chat-who"><span class="chat-avatar" aria-hidden="true">${esc(initials)}</span><strong>${esc(m.name)}</strong><span class="chat-badge">${badge}</span><time datetime="${new Date(m.createdAt).toISOString()}">${esc(new Date(m.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))}</time>${m.pinned?'<span aria-label="Pinned">📌</span>':''}</div><div class="chat-bubble">${fileMarkup(m.attachment)}${m.kind==='announcement'?'<strong class="chat-badge">Announcement</strong>':''}<p>${esc(m.text)}</p></div>${m.status!=='approved'?`<p class="chat-pending">${m.status==='pending'?'Awaiting host approval — not yet visible to everyone.':'Hidden by the hosts.'}</p>`:''}${m.status==='approved'?`<div class="chat-reactions" aria-label="Message reactions">${emojis.map(emoji=>{const r=m.reactions.find(x=>x.emoji===emoji);return `<button type="button" data-chat-react="${emoji}" aria-pressed="${!!r?.mine}" aria-label="React ${emoji}, ${r?.count||0} reactions">${emoji} ${r?.count||0}</button>`;}).join('')}</div>`:''}${isAdmin()?`<div class="chat-moderation">${m.status!=='approved'?'<button type="button" data-chat-action="approve">Approve</button>':'<button type="button" data-chat-action="hide">Hide</button>'}<button type="button" data-chat-action="pin">${m.pinned?'Unpin':'Pin'}</button><button type="button" data-chat-action="delete">Remove</button></div>`:m.own?'<div class="chat-moderation"><button type="button" data-chat-action="delete">Remove my message</button></div>':''}</article>`;
    }).join('')||'<p class="community-empty">No messages in this category yet. Share a little love to get the conversation started.</p>';
    // New messages must not replace an unchanged playing video/audio card.
    const old=new Map([...list.querySelectorAll(':scope > [data-chat-id]')].map(n=>[n.dataset.chatId,n])),keep=new Set();
    [...template.content.children].forEach((fresh,index)=>{
      const id=fresh.dataset.chatId,signature=JSON.stringify(items[index]),prior=old.get(id);
      const node=prior&&prior._communityKey===signature?prior:fresh;node._communityKey=signature;keep.add(node);
      if(list.children[index]!==node)list.insertBefore(node,list.children[index]||null);
    });
    [...list.children].forEach(node=>{if(!keep.has(node)){node.querySelectorAll('video,audio').forEach(media=>media.pause());node.remove();}});
    if(nearEnd||force)list.scrollTop=list.scrollHeight;else list.scrollTop=scroll;
  }
  async function loadChat(){
    if(sending||uploading)return;if(chatLoading){chatRefreshPending=true;return;}chatLoading=true;const auth=epoch,version=chatVersion;
    try{
      if(visible('chat'))await api('/chat/presence',options({method:'POST',body:{}}));
      const result=await api('/chat',options());if(auth!==epoch||version!==chatVersion)return;
      messages=result.messages;$('chatPresence').textContent=`${result.activeGuests} verified guest${result.activeGuests===1?'':'s'} active in chat · last 45 seconds`;
      $('chatVerify').classList.add('hidden');$('chatAnnouncementLabel').classList.toggle('hidden',!result.host);renderChat();
      if($('chatStatus').dataset.error==='true'){$('chatStatus').textContent='';delete $('chatStatus').dataset.error;}
    }catch(err){if(auth!==epoch)return;$('chatStatus').textContent=err.message;$('chatStatus').dataset.error='true';$('chatVerify').classList.toggle('hidden',err.code!=='chat/verification-required');}
    finally{chatLoading=false;if(chatRefreshPending){chatRefreshPending=false;if(visible('chat'))loadChat();}}
  }
  $('chatFilters').addEventListener('click',e=>{
    const button=e.target.closest('[data-chat-filter]');if(!button)return;chatFilter=button.dataset.chatFilter;
    $('chatFilters').querySelectorAll('button').forEach(b=>{const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    $('chatMessages').classList.toggle('hidden',chatFilter==='polls');$('chatPolls').classList.toggle('hidden',chatFilter!=='polls');renderChat();
  });
  $('chatRetry').addEventListener('click',loadChat);
  $('chatVerify').addEventListener('click',()=>{storeDraft();$('app').classList.add('hidden');document.body.classList.add('locked');showGate(guestLoginScreen);showPane('return');$('returnPhone')?.focus();});
  $('chatText').addEventListener('input',storeDraft);$('chatAnnouncement').addEventListener('change',storeDraft);
  $('chatClearAttachment').addEventListener('click',()=>{attachment=null;showAttachment();storeDraft();});
  $('chatFile').addEventListener('change',async()=>{
    const file=$('chatFile').files[0];$('chatFile').value='';if(!file||sending||uploading)return;
    if(file.size>25*1024*1024){$('chatStatus').textContent='Choose a file up to 25 MB.';return;}
    const auth=epoch;uploading=true;chatControls();$('chatStatus').textContent='Uploading attachment…';
    try{const fd=new FormData();fd.append('file',file);const result=await api('/chat/uploads',options({method:'POST',form:fd,onProgress:p=>{if(auth===epoch)$('chatStatus').textContent=`Uploading attachment… ${p}%`;}}));if(auth!==epoch)return;attachment=result;showAttachment();storeDraft();$('chatStatus').textContent='Attachment ready. Add a message, then send.';}
    catch(err){if(auth===epoch)$('chatStatus').textContent=err.message+' Your message is kept.';}
    finally{uploading=false;chatControls();}
  });
  $('chatComposer').addEventListener('submit',async e=>{
    e.preventDefault();if(sending||uploading)return;
    const value={text:$('chatText').value.trim(),attachmentId:attachment?.id||null,kind:isAdmin()&&$('chatAnnouncement').checked?'announcement':'chat'};
    if(!value.text&&!value.attachmentId){$('chatStatus').textContent='Write a message or attach a file first.';return;}
    if(pending&&JSON.stringify(pending.value)!==JSON.stringify(value)){
      await loadChat();if(messages.some(m=>m.id===pending.id)){pending=null;storeDraft();}else{if(confirm('Your previous send could not be confirmed. Restore that draft so you can retry it safely?')){$('chatText').value=pending.value.text;$('chatAnnouncement').checked=pending.value.kind==='announcement';attachment=pending.attachment||null;showAttachment();storeDraft();}$('chatStatus').textContent='Previous send is unconfirmed. Retry the restored draft before sending different content.';return;}
    }
    pending=pending||{id:uuid(),value,attachment};storeDraft();const auth=epoch;chatVersion++;sending=true;chatControls();$('chatStatus').textContent='Sending…';
    try{const result=await api('/chat/messages',options({method:'POST',body:{id:pending.id,...pending.value}}));if(auth!==epoch)return;pending=null;attachment=null;$('chatText').value='';$('chatAnnouncement').checked=false;showAttachment();storeDraft();messages=messages.filter(m=>m.id!==result.id).concat(result);renderChat(true);$('chatStatus').textContent=result.status==='pending'?'Message saved — awaiting host approval.':'Message published.';}
    catch(err){if(auth===epoch)$('chatStatus').textContent=err.message+' Your draft is kept. Retry sends the same message, not a duplicate.';}
    finally{sending=false;chatControls();}
  });
  const actionLocks=new Set();
  $('chatMessages').addEventListener('click',async e=>{
    const button=e.target.closest('[data-chat-react],[data-chat-action]'),card=button?.closest('[data-chat-id]');if(!card||actionLocks.has(card.dataset.chatId))return;
    const id=card.dataset.chatId,m=messages.find(x=>x.id===id),auth=epoch;chatVersion++;actionLocks.add(id);button.disabled=true;
    try{
      if(button.dataset.chatReact){const emoji=button.dataset.chatReact,result=await api(`/chat/messages/${encodeURIComponent(id)}/reaction`,options({method:'PUT',body:{emoji,active:!m.reactions.find(r=>r.emoji===emoji)?.mine}}));if(auth!==epoch)return;messages=messages.map(row=>row.id===id?result:row);actionLocks.delete(id);renderChat();}
      else{const action=button.dataset.chatAction;if(action==='delete'){if(!confirm('Remove this chat message?'))return;await api(`/chat/messages/${encodeURIComponent(id)}`,options({method:'DELETE'}));}else await api('/admin/chat/'+encodeURIComponent(id),{method:'PATCH',admin:true,body:action==='pin'?{pinned:!m.pinned}:{status:action==='approve'?'approved':'hidden'}});actionLocks.delete(id);if(auth===epoch)await loadChat();}
    }catch(err){if(auth===epoch)$('chatStatus').textContent=err.message;}finally{actionLocks.delete(id);button.disabled=false;}
  });
  function renderEntertainment(){
    if(!entertainment)return;const acts=entertainment.data.acts.filter(a=>entFilter==='all'||a.category===entFilter);
    const key=JSON.stringify([entertainment.revision,entFilter]);if(key===entKey)return;entKey=key;
    $('entertainmentActs').innerHTML=acts.map(a=>`<article class="entertainment-card"><img src="${esc(a.photoUrl||'assets/photo-placeholder.svg')}" alt="${a.photoUrl?esc(a.name):'Performer photo to be announced'}" loading="lazy"><div><h2>${esc(a.name)}</h2><span class="entertainment-category">${esc(labels[a.category])}</span><p>${esc(a.description)}</p><div class="entertainment-socials">${['instagram','youtube','facebook'].filter(k=>a[k]).map(k=>`<a href="${esc(a[k])}" target="_blank" rel="noopener noreferrer" aria-label="${esc(a.name)} on ${k}">${k[0].toUpperCase()+k.slice(1)} ↗</a>`).join('')}</div></div></article>`).join('')||`<p class="community-empty">${entertainment.data.acts.length?'No confirmed acts in this category yet.':'Our entertainment lineup is being arranged. Confirmed performers and times will appear here.'}</p>`;
    const scheduled=entertainment.data.acts.filter(a=>a.startsAt!==null).sort((a,b)=>a.startsAt-b.startsAt);
    $('entertainmentSchedule').innerHTML=scheduled.map(a=>`<div class="entertainment-time"><strong>${esc(date(a.startsAt))}</strong>${esc(a.name)}${a.duration?' · '+esc(a.duration):''}</div>`).join('')||'<p class="community-note">Performance times will be announced once confirmed.</p>';
  }
  $('entertainmentFilters').innerHTML=Object.entries(labels).map(([key,label])=>`<button type="button" class="chip${key==='all'?' active':''}" data-ent-filter="${key}" aria-pressed="${key==='all'}">${label}</button>`).join('');
  $('entertainmentFilters').addEventListener('click',e=>{const b=e.target.closest('[data-ent-filter]');if(!b)return;entFilter=b.dataset.entFilter;$('entertainmentFilters').querySelectorAll('button').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});renderEntertainment();});
  function rowMarkup(a){
    return `<fieldset class="entertainment-edit-row" data-ent-id="${esc(a.id)}"><legend>Confirmed act</legend><div class="settings-fields"><label class="field">Performer name<input data-ent-field="name" value="${esc(a.name)}" maxlength="120" required></label><label class="field">Category<select data-ent-field="category">${Object.entries(labels).filter(([k])=>k!=='all').map(([k,l])=>`<option value="${k}"${a.category===k?' selected':''}>${l}</option>`).join('')}</select></label><label class="field">Description<textarea data-ent-field="description" maxlength="600">${esc(a.description)}</textarea></label><label class="field">Start (optional, local time)<input data-ent-field="startsAt" type="datetime-local" value="${localDate(a.startsAt)}"></label><label class="field">Duration (optional)<input data-ent-field="duration" maxlength="80" value="${esc(a.duration)}"></label>${['instagram','youtube','facebook'].map(k=>`<label class="field">${k[0].toUpperCase()+k.slice(1)} link (optional)<input data-ent-field="${k}" type="url" maxlength="2000" value="${esc(a[k])}"></label>`).join('')}</div><input type="hidden" data-ent-field="photoUrl" value="${esc(a.photoUrl)}"><div class="ent-photo-preview">${a.photoUrl?`<img src="${esc(a.photoUrl)}" alt="Performer draft photo">`:''}</div><label class="community-attach">Upload photo<input data-ent-photo type="file" accept="image/jpeg,image/png,image/webp"></label><div class="entertainment-edit-actions"><button type="button" data-ent-action="up">↑ Earlier</button><button type="button" data-ent-action="down">↓ Later</button><button type="button" data-ent-action="clear-photo">Clear photo</button><button type="button" data-ent-action="remove">Remove act</button></div></fieldset>`;
  }
  function editorControls(){[...$('entertainmentEditor').elements].forEach(el=>el.disabled=entBusy);$('entertainmentEditor').setAttribute('aria-busy',String(entBusy));}
  function fillEditor(){if(!isAdmin()||!entertainment||entDirty||entBusy||editorRevision===entertainment.revision)return;$('entertainmentRows').innerHTML=entertainment.data.acts.map(rowMarkup).join('');editorRevision=entertainment.revision;}
  function dirty(){entDirty=true;$('entertainmentEditorStatus').textContent='Unsaved changes — save to publish.';}
  async function loadEntertainment(force=false){
    if(entBusy)return;if(entLoading){if(force)entReloadPending=true;return;}entLoading=true;const auth=epoch,version=entVersion;
    try{const result=await api('/entertainment');if(auth!==epoch||version!==entVersion)return;entertainment=result;if(force){entDirty=false;editorRevision=null;}renderEntertainment();fillEditor();$('entertainmentStatus').textContent='';if(entDirty&&editorRevision!==result.revision)$('entertainmentEditorStatus').textContent='Saved content changed. Your draft is kept; reload before saving.';}
    catch(err){$('entertainmentStatus').textContent=entertainment?'Could not refresh. Showing the last loaded lineup.':err.message;if(adminEditor())$('entertainmentEditorStatus').textContent=err.message;}
    finally{entLoading=false;if(entReloadPending){entReloadPending=false;if(isAdmin())loadEntertainment(true);}}
  }
  $('entertainmentRetry').addEventListener('click',()=>loadEntertainment());
  $('entertainmentEditor').addEventListener('input',dirty);
  $('entertainmentAdd').addEventListener('click',()=>{if(entBusy||!entertainment||!isAdmin())return;if($('entertainmentRows').children.length>=30){$('entertainmentEditorStatus').textContent='Maximum 30 acts.';return;}$('entertainmentRows').insertAdjacentHTML('beforeend',rowMarkup({id:uuid(),name:'',category:'band',description:'',startsAt:null,duration:'',photoUrl:'',instagram:'',youtube:'',facebook:''}));dirty();});
  $('entertainmentReload').addEventListener('click',()=>{if(entBusy||entDirty&&!confirm('Discard unsaved entertainment changes and reload saved content?'))return;loadEntertainment(true);});
  $('entertainmentRows').addEventListener('click',e=>{
    const b=e.target.closest('[data-ent-action]'),row=b?.closest('[data-ent-id]');if(!row||entBusy||!isAdmin())return;
    const action=b.dataset.entAction;if(action==='remove')row.remove();else if(action==='up'&&row.previousElementSibling)row.parentNode.insertBefore(row,row.previousElementSibling);else if(action==='down'&&row.nextElementSibling)row.parentNode.insertBefore(row.nextElementSibling,row);else if(action==='clear-photo'){row.querySelector('[data-ent-field="photoUrl"]').value='';row.querySelector('.ent-photo-preview').replaceChildren();}dirty();
  });
  $('entertainmentRows').addEventListener('change',async e=>{
    if(!e.target.matches('[data-ent-photo]'))return;const input=e.target,file=input.files[0],row=input.closest('[data-ent-id]');input.value='';if(!file||entBusy||!isAdmin())return;
    const auth=epoch;entBusy=true;editorControls();$('entertainmentEditorStatus').textContent='Uploading photo…';
    try{const fd=new FormData();fd.append('file',file);const result=await api('/admin/entertainment/photo',{method:'POST',form:fd,admin:true});if(auth!==epoch)return;row.querySelector('[data-ent-field="photoUrl"]').value=result.url;row.querySelector('.ent-photo-preview').innerHTML=`<img src="${esc(result.url)}" alt="Performer draft photo">`;dirty();}
    catch(err){if(auth===epoch)$('entertainmentEditorStatus').textContent=err.message+' Other edits are kept.';}finally{entBusy=false;editorControls();}
  });
  $('entertainmentEditor').addEventListener('submit',async e=>{
    e.preventDefault();if(entBusy||!isAdmin()||!entertainment)return;
    const data={acts:[...$('entertainmentRows').children].map(row=>({id:row.dataset.entId,...Object.fromEntries([...row.querySelectorAll('[data-ent-field]')].map(el=>[el.dataset.entField,el.dataset.entField==='startsAt'?(el.value?new Date(el.value).getTime():null):el.value.trim()]))}))};
    const auth=epoch;entVersion++;entBusy=true;editorControls();$('entertainmentEditorStatus').textContent='Saving…';
    try{const result=await api('/admin/entertainment',{method:'PATCH',admin:true,body:{data,expectedRevision:editorRevision}});if(auth!==epoch)return;entertainment=result;entDirty=false;editorRevision=result.revision;renderEntertainment();$('entertainmentEditorStatus').textContent='Entertainment saved — published for guests.';}
    catch(err){if(auth===epoch)$('entertainmentEditorStatus').textContent=err.message+' Your draft is kept.';}finally{entBusy=false;editorControls();}
  });
  onAdminAuth(()=>{epoch++;messages=[];chatKey='';$('chatMessages').replaceChildren();$('chatAnnouncementLabel').classList.toggle('hidden',!isAdmin());entDirty=false;editorRevision=null;$('entertainmentRows').replaceChildren();$('entertainmentEditorStatus').textContent='';loadDraft();if(visible('chat'))loadChat();if(adminEditor())loadEntertainment();});
  window.addEventListener('sj:entered',()=>{loadDraft();if(visible('chat'))loadChat();});
  window.addEventListener('wedding:view',()=>{photos();if(visible('chat'))loadChat();if(visible('entertainment')||adminEditor())loadEntertainment();});
  window.addEventListener('wedding:settings',photos);
  new MutationObserver(()=>{if(adminEditor()){fillEditor();loadEntertainment();}}).observe($('admin-panel-entertainment'),{attributes:true,attributeFilter:['class']});
  setInterval(()=>{if(window.__uploadsInFlight)return;if(visible('chat'))loadChat();if(visible('entertainment')||adminEditor())loadEntertainment();},15000);
  document.addEventListener('visibilitychange',()=>{if(visible('chat'))loadChat();if(visible('entertainment'))loadEntertainment();});
  window.addEventListener('online',()=>{if(visible('chat'))loadChat();if(visible('entertainment'))loadEntertainment();});
  window.addEventListener('beforeunload',e=>{if(entDirty||entBusy||sending||uploading){e.preventDefault();e.returnValue='';}});
  photos();loadDraft();
})();
