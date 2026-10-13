/* Independent, editable reception and engagement programs. */
(() => {
  'use strict';
  const receptionDefaults={title:'Reception Program',names:'SAMUEL & JOSEPHINE',tagline:'OUR FOREVER BEGINS',dateLabel:'SATURDAY, JANUARY 9, 2027',timeLabel:'2:00 PM – 10:00 PM',hosts:'MC: Mr. Edward Effah Brobey & Mr. Marcus Bentle',footer:'End of Reception',items:[
    {time:'2:00 PM',title:'GUEST ARRIVAL & WELCOME COCKTAILS',details:'Cocktail Bar Opens | Photo Booth Opens\nLive Violinist @GhViolinist | Ewuraesi Sax'},
    {time:'3:00 PM',title:'TRADITIONAL GAMES & CELEBRATIONS',details:'Local Chops | Pork Stand | Tasty Grilled Chicken'},
    {time:'3:45 PM',title:'LIVE MUSIC PERFORMANCE',details:'Akwesi Orlando & Haywaya'},
    {time:'4:15 PM',title:'WEDDING PARTY ENTRANCE',details:'Bride’s Maids & Groom’s Men'},
    {time:'4:30 PM',title:'SAMUEL & JOSEPHINE',details:'GRAND ENTRANCE'},
    {time:'4:45 PM',title:'WELCOME REMARKS & BLESSINGS',details:'MC: Mr. Edward Effah Brobey & Mr. Marcus Bentle'},
    {time:'5:45 PM',title:'DINNER IS SERVED',details:'Main Course'},
    {time:'5:45 PM',title:'LIVE BAND PERFORMANCE',details:'The Music Acoustics\nPerformance begins with dinner until cake cutting'},
    {time:'7:45 PM',title:'CAKE CUTTING & COUPLE’S FIRST DANCE',details:'Mr. & Mrs. Obeng and families'},
    {time:'8:00 PM',title:'COUPLE’S MOMENT',details:''},
    {time:'8:15 PM',title:'AFTER PARTY BEGINS',details:'DJ Sisco — Dance like there’s no tomorrow'},
    {time:'10:00 PM',title:'THANK YOU & GOODNIGHT',details:''}
  ]};
  const engagementDefaults={title:'Traditional Wedding Ceremony',names:'Samuel & Josephine',tagline:'OUR FOREVER BEGINS',dateLabel:'SATURDAY, JANUARY 9, 2027',timeLabel:'7:00 AM – 11:00 AM',hosts:'',footer:'Grateful for our families, our heritage and everyone walking this journey with us!\n\nALWAYS & FOREVER',items:[
    {time:'7:00 AM',title:'OPENING PRAYER & FAMILY GATHERING',details:'Prayer for the couple, families and marriage'},
    {time:'7:15 AM',title:'GREETINGS & INTRODUCTION OF BOTH FAMILIES',details:'Formal welcome of both families, elders and spokesperson'},
    {time:'7:40 AM',title:'KNOCKING CEREMONY',details:'Groom’s family formally announces its intentions and presents the customary knocking items'},
    {time:'8:15 AM',title:'PRESENTATION & INSPECTION OF TRADITIONAL MARRIAGE ITEMS',details:'Drinks, gifts and customary items are presented and acknowledged by the bride’s family'},
    {time:'8:45 AM',title:'CALLING & PRESENTATION OF THE BRIDE',details:'The bride is ceremonially brought before both families'},
    {time:'9:05 AM',title:'TRADITIONAL ENGAGEMENT / MARRIAGE CEREMONY',details:'Formal acceptance of the marriage, customary rites, exchange of rings where desired, counsel and family blessings'},
    {time:'9:50 AM',title:'PASTOR BLESSING & ADVICE FROM THE ELDERS',details:'Elders from both families offer marital counsel and blessings'},
    {time:'',title:'SPECIAL GUESTS SPEECH',details:'OMANHENE OSEADEEYO KWESI AKUFFO III\nNII KOJO ABABIO I'},
    {time:'10:15 AM',title:'THANKSGIVING & APPRECIATION',details:'Samuel & Josephine and both families express their gratitude'},
    {time:'10:25 AM',title:'FAMILY CELEBRATION & TRADITIONAL PHOTO MOMENT',details:'Family photographs, embraces and brief celebration'},
    {time:'10:50 AM',title:'CLOSING PRAYER & FINAL BLESSING',details:''},
    {time:'',title:'TRADITIONAL WEDDING CEREMONY CONCLUDES',details:''}
  ]};
  function install({key,defaults,formId,rowsId,statusId,hostId,timePrefix,allowUntimed=false}){
  const fields={title:120,names:200,tagline:200,dateLabel:160,timeLabel:160,hosts:300,footer:160};
  const form=document.getElementById(formId),rows=document.getElementById(rowsId),status=document.getElementById(statusId);
  if(!form||!rows||!status||!document.getElementById(hostId))return;
  const esc=value=>escapeHTML(String(value??''));
  let saved=structuredClone(defaults),raw=null,dirty=false,busy=false,version=null,received=false;
  function decode(value){
    if(!value)return structuredClone(defaults);
    const data=JSON.parse(value);
    if(!data||typeof data!=='object'||!Array.isArray(data.items)||data.items.length<1||data.items.length>40)throw new Error('Invalid saved program.');
    for(const [key,max]of Object.entries(fields))if(typeof data[key]!=='string'||data[key].length>max)throw new Error('Invalid program text.');
    for(const item of data.items)for(const [key,max]of Object.entries({time:40,title:180,details:600}))if(typeof item?.[key]!=='string'||item[key].length>max)throw new Error('Invalid activity.');
    return data;
  }
  function render(){
    const host=document.getElementById(hostId);
    host.innerHTML=`<img class="program-seal" src="assets/seal-logo.png" alt="S & J seal"><p class="program-names">${esc(saved.names)}</p><p class="program-tagline">${esc(saved.tagline)}</p><h1>${esc(saved.title)}</h1><p class="program-date">${esc(saved.dateLabel)}</p><p class="program-time">${esc(timePrefix)}: ${esc(saved.timeLabel)}</p><ol class="program-lineup">${saved.items.map(item=>`<li class="${item.time?'':'program-untimed'}">${item.time?`<time>${esc(item.time)}</time>`:''}<div><h2>${esc(item.title)}</h2>${item.details?`<p>${esc(item.details)}</p>`:''}</div></li>`).join('')}</ol>${saved.hosts?`<p class="program-hosts">${esc(saved.hosts)}</p>`:''}<p class="program-footer">${esc(saved.footer)}</p>`;
  }
  function row(item={time:'',title:'',details:''}){
    return `<fieldset class="program-edit-row"><legend>Activity</legend><label class="field">Time${allowUntimed?' (optional)':''}<input data-program-field="time" maxlength="40" ${allowUntimed?'':'required'} value="${esc(item.time)}"></label><label class="field">Activity title<input data-program-field="title" maxlength="180" required value="${esc(item.title)}"></label><label class="field">Details<textarea data-program-field="details" rows="2" maxlength="600">${esc(item.details)}</textarea></label><div class="aq-actions"><button class="aq-approve" data-program-action="up" type="button">MOVE UP</button><button class="aq-approve" data-program-action="down" type="button">MOVE DOWN</button><button class="aq-reject" data-program-action="remove" type="button">REMOVE</button></div></fieldset>`;
  }
  function fill(){
    if(!isAdmin()||dirty||busy||!received)return;
    Object.keys(fields).forEach(key=>{form.elements.namedItem(key).value=saved[key];});
    rows.innerHTML=saved.items.map(row).join('');version=raw;
  }
  function sync(value){
    const nextRaw=value||null;if(nextRaw===raw&&received)return;
    received=true;
    try{const next=decode(value);raw=nextRaw;saved=next;render();if(dirty)status.textContent='The saved program changed. Your unsaved edits are kept; reload before saving.';else fill();}
    catch{status.textContent='The saved program could not be read. Existing content has been kept.';}
  }
  function controls(disabled){
    [...form.elements].forEach(el=>{el.disabled=disabled;});form.setAttribute('aria-busy',String(disabled));
  }
  function collect(){
    const value=Object.fromEntries(Object.keys(fields).map(key=>[key,form.elements.namedItem(key).value.trim()]));
    value.items=[...rows.querySelectorAll('.program-edit-row')].map(el=>Object.fromEntries(['time','title','details'].map(key=>[key,el.querySelector(`[data-program-field="${key}"]`).value.trim()])));
    if(!value.title||value.items.some(item=>!item.title||!allowUntimed&&!item.time))throw new Error('Enter a program title and required activity fields.');
    if(JSON.stringify(value).length>32000)throw new Error('Program is too long. Shorten the activity details.');
    return value;
  }
  form.addEventListener('input',()=>{dirty=true;});
  form.addEventListener('click',async e=>{
    const button=e.target.closest('[data-program-action]');if(!button||busy||!isAdmin())return;
    const action=button.dataset.programAction;
    if(action==='reload'){
      if(dirty&&!confirm('Discard unsaved program changes and reload the saved lineup?'))return;
      busy=true;controls(true);
      try{const settings=await getSettings();if(!isAdmin())return;saved=decode(settings[key]);raw=settings[key]||null;received=true;dirty=false;render();status.textContent='Saved program reloaded.';}
      catch(err){status.textContent=err.message;}
      finally{busy=false;controls(false);fill();}return;
    }
    if(action==='add'){
      if(rows.children.length>=40){status.textContent='Maximum 40 activities.';return;}
      rows.insertAdjacentHTML('beforeend',row());rows.lastElementChild.querySelector('input').focus();
    }else{
      const current=button.closest('.program-edit-row');if(!current)return;
      if(action==='remove'){if(rows.children.length===1){status.textContent='Keep at least one activity.';return;}current.remove();}
      else if(action==='up'&&current.previousElementSibling)rows.insertBefore(current,current.previousElementSibling);
      else if(action==='down'&&current.nextElementSibling)rows.insertBefore(current.nextElementSibling,current);
    }
    dirty=true;
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!isAdmin()||busy)return;
    let value;try{value=collect();}catch(err){status.textContent=err.message;return;}
    busy=true;controls(true);status.textContent='Saving program…';
    try{
      const latest=await getSettings();if(!isAdmin())return;
      if((latest[key]||null)!==version)throw new Error('The program changed on the server. Your draft is kept. Use RELOAD SAVED before editing again.');
      const text=JSON.stringify(value);await patchSettings({[key]:text});if(!isAdmin())return;
      saved=value;raw=text;siteSettings[key]=text;dirty=false;render();status.textContent='Program saved — guests will see the updated lineup.';
    }catch(err){if(isAdmin())status.textContent=err.message+' Your draft is kept; retry when ready.';}
    finally{busy=false;controls(false);fill();}
  });
  window.addEventListener('wedding:settings',e=>{
    if(!Object.prototype.hasOwnProperty.call(e.detail||{},key))return;
    if(e.detail?.ready===false){if(!received)document.getElementById(hostId).textContent='Reconnect to load the current program.';return;}
    sync(e.detail?.[key]);
  });
  onAdminAuth(signedIn=>{
    if(signedIn)fill();else{dirty=false;version=null;form.reset();Object.keys(fields).forEach(key=>{form.elements.namedItem(key).value='';});rows.innerHTML='';status.textContent='';}
  });
  if(photosConfirmed)sync(siteSettings[key]);
  else document.getElementById(hostId).textContent='Loading program…';
  fill();
  }
  install({key:'receptionProgram',defaults:receptionDefaults,formId:'programEditor',rowsId:'programItemsEditor',statusId:'programEditorStatus',hostId:'receptionProgram',timePrefix:'Reception time'});
  install({key:'engagementProgram',defaults:engagementDefaults,formId:'engagementEditor',rowsId:'engagementItemsEditor',statusId:'engagementEditorStatus',hostId:'engagementProgram',timePrefix:'Ceremony time',allowUntimed:true});
  document.querySelectorAll('[data-program-editor]').forEach(button=>button.addEventListener('click',()=>{
    if(!isAdmin())return;
    document.querySelectorAll('[data-program-editor]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
    document.getElementById('programEditor').classList.toggle('hidden',button.dataset.programEditor!=='reception');
    document.getElementById('engagementEditor').classList.toggle('hidden',button.dataset.programEditor!=='engagement');
  }));
})();
