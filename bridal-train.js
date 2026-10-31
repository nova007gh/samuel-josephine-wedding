/* Bridal train: public saved content and an independent, draft-safe admin editor. */
(() => {
  'use strict';
  const host=document.getElementById('bridalTrainContent'),form=document.getElementById('bridalTrainEditor'),panel=document.getElementById('admin-panel-bridal');
  const guestStatus=document.getElementById('bridalTrainLoadStatus'),status=document.getElementById('bridalTrainEditorStatus'),retry=document.getElementById('bridalTrainRetry'),picker=document.getElementById('bridalTrainPhotoInput');
  const groups={bridesmaids:document.getElementById('bridalTrainBridesmaids'),groomsmen:document.getElementById('bridalTrainGroomsmen')};
  const fields=['title','subtitle','bridesmaidsTitle','groomsmenTitle','heroPhotoUrl','footer'];
  const esc=value=>escapeHTML(String(value??''));
  const initials=name=>name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('');
  let saved=null,version=null,dirty=false,busy=false,loading=false,renderKey='',authEpoch=0,photoTarget=null,stateSerial=0;
  const editorVisible=()=>isAdmin()&&!panel.classList.contains('hidden')&&!document.querySelector('[data-view="admin"]').classList.contains('hidden');
  function wanted(){return !document.hidden&&(!document.querySelector('[data-view="bridaltrain"]').classList.contains('hidden')||editorVisible());}
  function controls(disabled){[...form.elements].forEach(el=>el.disabled=disabled);form.setAttribute('aria-busy',String(disabled));}
  function draftState(){const el=document.getElementById('bridalTrainDraftState');el.textContent=busy?'Working — please keep this page open':dirty?'Unsaved changes — save to publish':'Viewing saved content';el.classList.toggle('has-draft',dirty);}
  function markDirty(){dirty=true;draftState();}
  function headerPreview(){const el=document.getElementById('bridalTrainHeaderPreview'),url=form.elements.heroPhotoUrl.value;el.replaceChildren();if(url){const img=document.createElement('img');img.src=saved?.previews[url]||url;img.alt='Draft header photo';img.loading='lazy';el.appendChild(img);}}
  function portrait(m,previews){
    const avatar=`<span class="bt-initials" aria-hidden="true">${esc(initials(m.name))}</span>`;
    return m.photoUrl?`<button class="bt-portrait" data-bt-view="${esc(m.photoUrl)}" data-bt-caption="${esc(m.name+' — '+m.role)}" type="button" aria-label="View ${esc(m.name)} photo">${avatar}<img src="${esc(previews[m.photoUrl]||m.photoUrl)}" data-original="${esc(m.photoUrl)}" alt="" width="480" height="640" loading="lazy" decoding="async"><span class="bt-photo-note" hidden>Photo unavailable · tap to retry</span></button>`:`<div class="bt-portrait bt-portrait--empty">${avatar}<span class="bt-photo-note">Portrait coming soon</span></div>`;
  }
  function render(){
    if(!saved)return;
    const {data,previews}=saved,heroOriginal=data.heroPhotoUrl||originalSitePhoto('couple','assets/photo-placeholder.svg'),hero=data.heroPhotoUrl?(previews[data.heroPhotoUrl]||data.heroPhotoUrl):sitePhoto('couple','assets/photo-placeholder.svg');
    const key=JSON.stringify([saved,hero]);if(key===renderKey)return;renderKey=key;
    const section=group=>`<section class="bt-section" aria-labelledby="bt-heading-${group}"><h2 id="bt-heading-${group}" class="bt-heading">${esc(data[group+'Title'])} <span>(${data[group].length})</span></h2><div class="bt-grid">${data[group].map(m=>`<article class="bt-card" data-bt-person="${esc(m.id)}">${portrait(m,previews)}<div class="bt-caption"><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p><span aria-hidden="true">♥</span></div></article>`).join('')}</div>${data[group].length?'':'<p class="page-sub">Details coming soon.</p>'}</section>`;
    const title=data.title.startsWith('Our ')?`<span class="bt-our">Our</span> ${esc(data.title.slice(4))}`:esc(data.title);
    const [footerTitle,...footerLines]=data.footer.split('\n');
    host.innerHTML=`<header class="bt-hero"><button class="bt-hero-view" type="button" aria-label="View our couple photo" data-bt-view="${esc(data.heroPhotoUrl||originalSitePhoto('couple','assets/photo-placeholder.svg'))}" data-bt-caption="Samuel &amp; Josephine"><img class="bt-hero-photo" src="${esc(hero)}" alt="Samuel and Josephine" decoding="async"><span>View photo ⤢</span></button><nav class="bt-hero-bar" aria-label="Wedding navigation"><button class="bt-monogram" type="button" data-goto="home" aria-label="Wedding home">S&amp;J</button><button class="bt-menu" type="button" data-goto="more" aria-label="Open wedding menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 5h18M3 12h18M3 19h18"/></svg></button></nav><div class="bt-hero-copy"><h1>${title}</h1><span class="bt-heart" aria-hidden="true">♥</span><p>${esc(data.subtitle)}</p></div></header>${section('bridesmaids')}${section('groomsmen')}<footer class="bt-footer"><span class="bt-footer-title">${esc(footerTitle)}</span>${footerLines.length?`<span class="bt-footer-subtitle">${esc(footerLines.join('\n'))}</span>`:''}</footer><nav class="bt-group-nav" aria-label="Meet our wedding party">${['bridesmaids','groomsmen'].map(group=>`<button type="button" data-bt-jump="${group}">${esc(data[group+'Title'])} <span>${data[group].length}</span></button>`).join('')}</nav><p class="bt-view-hint">Tap an available portrait to view the full photo.</p>`;
    const heroImage=host.querySelector('.bt-hero-photo');heroImage.dataset.original=heroOriginal;
  }
  function row(m){
    return `<fieldset class="bt-edit-person" data-bt-id="${esc(m.id)}"><legend>Person</legend><div class="bt-edit-fields"><label class="field">Name<input data-bt-field="name" maxlength="100" required value="${esc(m.name)}"></label><label class="field">Role<input data-bt-field="role" maxlength="80" required value="${esc(m.role)}"></label></div><input type="hidden" data-bt-field="photoUrl" value="${esc(m.photoUrl)}"><div class="bt-edit-photo">${m.photoUrl?`<img loading="lazy" decoding="async" src="${esc(saved?.previews[m.photoUrl]||m.photoUrl)}" alt="Portrait preview">`:'<small>No portrait uploaded</small>'}</div><div class="aq-actions"><button class="aq-approve" data-bt-photo="person" type="button">UPLOAD PHOTO</button><button class="aq-reject" data-bt-action="clear-photo" type="button">CLEAR PHOTO</button><button class="aq-approve" data-bt-action="up" type="button">↑ EARLIER</button><button class="aq-approve" data-bt-action="down" type="button">↓ LATER</button><button class="aq-reject" data-bt-action="remove" type="button">REMOVE PERSON</button></div></fieldset>`;
  }
  function fill(){
    if(!isAdmin()||!saved||dirty||busy||version===saved.revision)return;
    fields.forEach(key=>form.elements.namedItem(key).value=saved.data[key]);
    Object.entries(groups).forEach(([group,el])=>el.innerHTML=saved.data[group].map(row).join(''));
    version=saved.revision;
    headerPreview();draftState();
  }
  async function load(force=false){
    if(loading)return;const epoch=authEpoch,serial=stateSerial;loading=true;host.setAttribute('aria-busy','true');
    if(!saved)guestStatus.textContent='Loading our bridal train…';
    if(!saved&&isAdmin())status.textContent='Loading bridal train editor…';
    try{
      const response=await api('/bridal-train');
      if(serial!==stateSerial)return;
      if(!response?.data||!response.revision)throw new Error('Could not load the bridal train.');
      const changed=saved&&saved.revision!==response.revision;
      saved=response;render();guestStatus.textContent='';retry.classList.add('hidden');
      if(force&&epoch===authEpoch){dirty=false;version=null;}
      if(changed&&dirty)status.textContent='Saved content changed on another device. Your draft is kept; reload before saving.';
      fill();if(!dirty&&!busy&&isAdmin())status.textContent='';
    }catch(err){guestStatus.textContent=saved?'Could not refresh. Showing the last loaded bridal train.':err.message;retry.classList.remove('hidden');if(isAdmin())status.textContent=err.message;}
    finally{loading=false;host.setAttribute('aria-busy','false');}
  }
  function collect(){
    const data=Object.fromEntries(fields.map(key=>[key,form.elements.namedItem(key).value.trim()]));
    for(const [group,el]of Object.entries(groups))data[group]=[...el.querySelectorAll('[data-bt-id]')].map(person=>({id:person.dataset.btId,...Object.fromEntries(['name','role','photoUrl'].map(key=>[key,person.querySelector(`[data-bt-field="${key}"]`).value.trim()]))}));
    return data;
  }
  form.addEventListener('input',markDirty);
  form.addEventListener('click',async e=>{
    const button=e.target.closest('[data-bt-action],[data-bt-photo]');if(!button||!isAdmin()||busy)return;
    const person=button.closest('[data-bt-id]'),action=button.dataset.btAction;
    if(!saved&&action!=='reload'){status.textContent='Load the saved bridal train first.';load();return;}
    if(button.dataset.btPhoto){photoTarget=person||'hero';picker.value='';picker.click();return;}
    if(action==='reload'){
      if(dirty&&!confirm('Discard unsaved bridal train changes and reload saved content?'))return;
      await load(true);return;
    }
    if(!saved){status.textContent='Load the saved bridal train first.';return;}
    if(action==='add'){
      const group=button.dataset.btGroup,el=groups[group];
      if(el.children.length>=50){status.textContent='Maximum 50 people per group.';return;}
      const id=crypto.randomUUID?crypto.randomUUID():'person-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
      el.insertAdjacentHTML('beforeend',row({id,name:'',role:group==='bridesmaids'?'Bridesmaid':'Groomsman',photoUrl:''}));el.lastElementChild.querySelector('input').focus();
    }else if(action==='clear-hero'){form.elements.heroPhotoUrl.value='';headerPreview();}
    else if(person){
      if(action==='remove')person.remove();
      else if(action==='up'&&person.previousElementSibling)person.parentElement.insertBefore(person,person.previousElementSibling);
      else if(action==='down'&&person.nextElementSibling)person.parentElement.insertBefore(person.nextElementSibling,person);
      else if(action==='clear-photo'){person.querySelector('[data-bt-field="photoUrl"]').value='';person.querySelector('.bt-edit-photo').innerHTML='<small>No portrait uploaded</small>';}
    }
    markDirty();
  });
  picker.addEventListener('change',async()=>{
    const file=picker.files[0],target=photoTarget,epoch=authEpoch;picker.value='';
    if(!file||!target||!isAdmin()||busy)return;
    busy=true;controls(true);draftState();status.textContent='Uploading portrait…';
    try{
      const data=new FormData();data.append('file',file,file.name);
      const result=await api('/admin/bridal-train/photo',{method:'POST',form:data,admin:true,onProgress:(p,t)=>{if(isAdmin()&&epoch===authEpoch)status.textContent=uploadTransferLabel(p,t);}});
      if(!isAdmin()||epoch!==authEpoch)return;
      if(target==='hero'){form.elements.heroPhotoUrl.value=result.url;headerPreview();}
      else if(target.isConnected){target.querySelector('[data-bt-field="photoUrl"]').value=result.url;target.querySelector('.bt-edit-photo').innerHTML=`<img loading="lazy" decoding="async" src="${esc(result.url)}" alt="Portrait preview">`;}
      markDirty();status.textContent='Photo uploaded to your draft. SAVE BRIDAL TRAIN to publish.';
    }catch(err){if(isAdmin()&&epoch===authEpoch)status.textContent=err.message+' Your other edits are kept.';}
    finally{busy=false;controls(false);photoTarget=null;draftState();}
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!isAdmin()||busy||!saved)return;
    const data=collect(),epoch=authEpoch;stateSerial++;busy=true;controls(true);draftState();status.textContent='Saving bridal train…';
    try{
      const response=await api('/admin/bridal-train',{method:'PATCH',admin:true,body:{data,expectedRevision:version}});
      if(!isAdmin()||epoch!==authEpoch)return;
      stateSerial++;saved=response;dirty=false;render();status.textContent='Bridal train saved — published for guests.';
    }catch(err){if(isAdmin()&&epoch===authEpoch)status.textContent=err.message+' Your draft is kept.';}
    finally{busy=false;controls(false);fill();draftState();}
  });
  function viewPhoto(button){
    const url=button.dataset.btView,caption=button.dataset.btCaption;if(url.includes('photo-placeholder.svg'))return;
    openLightbox(url,caption);
    const body=document.getElementById('lightboxBody'),image=body.querySelector('img'),label=document.getElementById('lightboxCaption');if(!image)return;
    label.textContent=caption+' · Loading photo…';
    image.addEventListener('load',()=>{if(image.isConnected){label.textContent=caption;body.querySelector('.bt-lightbox-retry')?.remove();}});
    image.addEventListener('error',()=>{if(!image.isConnected)return;label.textContent=caption+' · Photo could not load. Please retry.';if(body.querySelector('.bt-lightbox-retry'))return;const retryPhoto=document.createElement('button');retryPhoto.type='button';retryPhoto.className='bt-lightbox-retry';retryPhoto.textContent='Retry photo';retryPhoto.addEventListener('click',()=>{label.textContent=caption+' · Loading photo…';image.src=url+(url.includes('?')?'&':'?')+'retry='+Date.now();});body.appendChild(retryPhoto);});
    if(image.complete&&image.naturalWidth>0)label.textContent=caption;
  }
  host.addEventListener('click',e=>{const navigation=e.target.closest('.bt-hero-bar [data-goto]');if(navigation){switchView(navigation.dataset.goto);return;}const jump=e.target.closest('[data-bt-jump]');if(jump){const heading=document.getElementById('bt-heading-'+jump.dataset.btJump);heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}const button=e.target.closest('[data-bt-view]');if(button)viewPhoto(button);});
  host.addEventListener('load',e=>{const img=e.target;if(img.tagName!=='IMG')return;img.hidden=false;const note=img.parentElement.querySelector('.bt-photo-note');if(note)note.hidden=true;},true);
  host.addEventListener('error',e=>{const img=e.target;if(img.tagName!=='IMG')return;if(img.dataset.original&&img.getAttribute('src')!==img.dataset.original&&!img.src.includes('photo-placeholder.svg'))img.src=img.dataset.original;else if(img.classList.contains('bt-hero-photo')&&!img.src.includes('photo-placeholder.svg'))img.src='assets/photo-placeholder.svg';else{img.hidden=true;const note=img.parentElement.querySelector('.bt-photo-note');if(note)note.hidden=false;}},true);
  retry.addEventListener('click',()=>{renderKey='';load();});
  window.addEventListener('wedding:view',e=>{if(e.detail?.name==='bridaltrain'||(e.detail?.name==='admin'&&editorVisible()))load();});
  window.addEventListener('wedding:settings',()=>{if(saved)render();});
  new MutationObserver(()=>{if(editorVisible()){fill();load();}}).observe(panel,{attributes:true,attributeFilter:['class']});
  onAdminAuth(signedIn=>{authEpoch++;if(signedIn){if(editorVisible())load();else fill();}else{dirty=false;version=null;photoTarget=null;form.reset();headerPreview();Object.values(groups).forEach(el=>el.innerHTML='');status.textContent='';draftState();}});
  window.addEventListener('beforeunload',e=>{if(isAdmin()&&(dirty||busy)){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(wanted())load();});
  window.addEventListener('online',()=>{if(wanted())load();});
  setInterval(()=>{if(wanted()&&!busy&&!window.__uploadsInFlight)load();},15000);
  if(wanted())load();
})();
