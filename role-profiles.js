/* Existing verified sign-in, admin-assigned ownership, own-profile edits only. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),dialog=$('roleProfileDialog'),panel=$('admin-panel-profiles');
  let generation=0,busy=false,dirty=false,loading=false,returnTo=null,adminGeneration=0,adminBusy=false,selectedKind='vendor',ownership='',resumeLogin=false;
  const ready=()=>window.WeddingAccess?.isGuestApproved()&&WeddingAccess.isCheckedIn();
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const title={vendor:'Vendor',bridesmaid:'Bridesmaid',groomsman:'Groomsman'};
  function controls(){dialog.querySelectorAll('form :is(input,textarea,button)').forEach(e=>e.disabled=busy);$('roleProfileReload').disabled=busy;$('roleProfileKind').disabled=busy;}
  function reset(){generation++;busy=false;dirty=false;loading=false;$('roleProfileRows').replaceChildren();$('roleProfileStatus').textContent='';controls();}
  function render(profiles){
    ownership=JSON.stringify(profiles.map(r=>r.kind+':'+r.profile.id).sort());
    $('roleProfileRows').replaceChildren();dirty=false;
    const rows=profiles.filter(r=>r.kind===$('roleProfileKind').value);
    $('roleProfileStatus').textContent=rows.length?'Edit your profile below, then save. Photos and contact details on published cards are visible to approved guests.':'No profile of this role is assigned to your account. Your sign-in is working; an admin must finish the profile link. Admin: open Profile Access, find the correct '+title[$('roleProfileKind').value]+' profile, select this guest’s registered account and Save access. Then choose Reload my saved profiles here. Selecting a role alone never grants access.';
    for(const r of rows){
      const f=node('form');f.className='aq-card';f.dataset.profileId=r.profile.id;f.append(node('h3',title[r.kind]+' · '+r.profile.name));
      const fields=r.kind==='vendor'?[['name','Name',120],['badge','Business / card label',60],['description','Description',600],['phone','Public phone (+country code)',20],['whatsapp','Public WhatsApp (+country code)',20]]:[['name','Name',100]];
      for(const [key,label,max]of fields){const l=node('label',label),input=node(key==='description'?'textarea':'input');l.className='field';input.name=key;input.value=r.profile[key];input.maxLength=max;input.required=key==='name';l.append(input);f.append(l);}
      let photoUrl=r.profile.photoUrl;
      const preview=node('div');if(photoUrl){const img=node('img');img.src=photoUrl;img.alt='Your saved profile photo';img.width=100;preview.append(img);}f.append(preview);
      const label=node('label','Profile photo (JPEG, PNG, WebP, up to 8 MB)'),file=node('input');label.className='field';file.type='file';file.accept='image/jpeg,image/png,image/webp';label.append(file);f.append(label);
      const clear=node('button','Clear photo'),save=node('button','Save my profile'),status=node('p');clear.type='button';save.type='submit';status.setAttribute('role','status');f.append(clear,save,status);
      clear.onclick=()=>{if(busy)return;photoUrl='';preview.replaceChildren();dirty=true;};
      file.onchange=async()=>{const image=file.files[0];file.value='';if(!image||busy)return;if(image.size>8*1024*1024){status.textContent='Choose a photo under 8 MB.';return;}busy=true;controls();const run=generation;
        try{const fd=new FormData();fd.append('file',image);const result=await api('/role-profiles/'+r.kind+'/'+encodeURIComponent(r.profile.id)+'/photo',{method:'POST',form:fd});if(run!==generation||!ready())return;if(!/^\/uploads\/[\w-]+\.(jpe?g|png|webp)$/i.test(result?.url))throw Error('Upload was not confirmed.');photoUrl=result.url;const img=node('img');img.src=photoUrl;img.width=100;img.alt='Draft profile photo';preview.replaceChildren(img);dirty=true;status.textContent='Photo uploaded to draft. Save your profile to publish it.';}catch(e){if(run===generation)status.textContent=e.message+' Other edits are kept.';}finally{if(run===generation){busy=false;controls();}}};
      f.oninput=()=>{dirty=true;};
      f.onsubmit=async e=>{e.preventDefault();if(busy||!ready())return;const run=generation;const profile={...Object.fromEntries(fields.map(([k])=>[k,f.elements.namedItem(k).value])),photoUrl};busy=true;controls();
        try{const result=await api('/role-profiles/'+r.kind+'/'+encodeURIComponent(r.profile.id),{method:'PATCH',body:{profile,expectedRevision:r.revision}});if(run!==generation||!ready())return;if(!Array.isArray(result?.profiles))throw Error('Save was not confirmed. Reload to verify.');render(result.profiles);$('roleProfileStatus').textContent='Profile saved. Published cards show your saved details; hidden profiles remain hidden.';window.dispatchEvent(new Event('wedding:profiles-saved'));}catch(e){if(run===generation)status.textContent=e.message+' Your draft is kept.';}finally{if(run===generation){busy=false;controls();}}};
      $('roleProfileRows').append(f);
    }controls();
  }
  async function load(){
    $('roleProfileSignin').hidden=ready();if(!ready()){$('roleProfileRows').replaceChildren();$('roleProfileStatus').textContent='Sign in with your own account. Profile editing also requires admin approval and an assigned profile.';return;}
    if(busy||loading||dirty)return;loading=true;const run=generation;
    try{const result=await api('/role-profiles');if(run===generation&&ready()&&dialog.open){if(!Array.isArray(result?.profiles))throw Error('Profiles could not load.');render(result.profiles);}}catch(e){if(run===generation)$('roleProfileStatus').textContent=e.message;}finally{if(run===generation)loading=false;}
  }
  $('roleProfilesOpen').onclick=()=>{returnTo=document.activeElement;document.querySelectorAll('dialog[open]').forEach(d=>d.close());dialog.showModal();load();};
  $('roleProfileClose').onclick=()=>{if((dirty||busy)&&!confirm('Close and discard this profile draft?'))return;dialog.close();};
  dialog.addEventListener('cancel',e=>{e.preventDefault();$('roleProfileClose').click();});dialog.addEventListener('close',()=>{reset();returnTo?.focus({preventScroll:true});});
  $('roleProfileReload').onclick=()=>{if(busy||dirty&&!confirm('Discard your unsaved profile edits?'))return;reset();load();};
  $('roleProfileKind').onchange=()=>{if(dirty&&!confirm('Discard your unsaved profile edits?')){$('roleProfileKind').value=selectedKind;return;}selectedKind=$('roleProfileKind').value;reset();load();};
  $('roleProfileSignin').onclick=async()=>{resumeLogin=true;dialog.close();requireCheckIn();showGate(guestLoginScreen);try{const c=await loadOnboarding();showPane(c.otpRequired?'return':'form');}catch{showPane('return');}};
  async function loadAdmin(){
    if(!isAdmin()||adminBusy)return;adminBusy=true;const run=adminGeneration;
    try{const r=await api('/admin/role-profiles',{admin:true});if(run!==adminGeneration||!isAdmin())return;$('roleAdminRows').replaceChildren();
      for(const p of r.profiles){const row=node('form'),label=node('label',title[p.kind]+' · '+p.name),select=node('select'),save=node('button','Save access');label.className='field';row.className='aq-card';select.setAttribute('aria-label','Account for '+p.name);
        for(const g of [{id:'',name:'No self-edit access',status:''},...r.guests]){const option=node('option',g.name+(g.phone?' · '+g.phone:'')+(g.status?' · '+g.status:''));option.value=g.id;option.selected=g.id===p.guestId;select.append(option);}label.append(select);save.type='submit';row.append(label,save);
        row.onsubmit=async e=>{e.preventDefault();if(!isAdmin()||save.disabled)return;save.disabled=true;const version=adminGeneration;try{await api('/admin/role-profiles/'+p.kind+'/'+encodeURIComponent(p.id),{method:'PATCH',admin:true,body:{guestId:select.value}});if(version===adminGeneration)$('roleAdminStatus').textContent='Profile access saved.';}catch(e){if(version===adminGeneration)$('roleAdminStatus').textContent=e.message;}finally{save.disabled=false;}};$('roleAdminRows').append(row);
      }$('roleAdminStatus').textContent='Profile ownership loaded. Admin retains full editing rights.';
    }catch(e){if(run===adminGeneration)$('roleAdminStatus').textContent=e.message;}finally{if(run===adminGeneration)adminBusy=false;}
  }
  $('roleAdminRefresh').onclick=loadAdmin;
  $('roleManageVendors').onclick=()=>{if(isAdmin())document.querySelector('[data-admin-section="vendors"]').click();};$('roleManageBridal').onclick=()=>{if(isAdmin())document.querySelector('[data-admin-section="bridal"]').click();};
  new MutationObserver(()=>{if(isAdmin()&&!panel.classList.contains('hidden'))loadAdmin();}).observe(panel,{attributes:true,attributeFilter:['class']});
  onAdminAuth(()=>{adminGeneration++;adminBusy=false;$('roleAdminRows').replaceChildren();$('roleAdminStatus').textContent='';});
  for(const event of ['wedding:guest-session','wedding:session-state'])window.addEventListener(event,()=>{if(!ready()){reset();if(dialog.open)load();}else if(resumeLogin){resumeLogin=false;$('roleProfilesOpen').click();}else if(dialog.open&&!dirty)load();});
  window.addEventListener('wedding:view',()=>{if(dialog.open)dialog.close();});
  setInterval(async()=>{if(!dialog.open||!ready()||document.hidden||busy||loading)return;const run=generation;try{const r=await api('/role-profiles');if(run!==generation||!dialog.open)return;const current=JSON.stringify(r.profiles.map(p=>p.kind+':'+p.profile.id).sort());if(current!==ownership){reset();render(r.profiles);}else if(!dirty)render(r.profiles);}catch{if(run===generation){reset();$('roleProfileStatus').textContent='Profile access could not be confirmed. Reconnect and reload.';}}},15000);
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
})();
