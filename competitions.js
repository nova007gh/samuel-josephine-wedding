/* Custom wedding competitions. Editors stay mounted; polling only runs in visible views. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => escapeHTML(String(value ?? ''));
  let guestRows=[],adminRows=[],guestFilter='all',adminFilter='all',adminId=null;
  let selectedId=new URLSearchParams(location.search).get('competition');
  let sharedEntryPending=!!selectedId;
  try { selectedId ||= sessionStorage.getItem('sj_competition'); } catch {}
  let detail=null,selected=new Set(),selectionDirty=false,voting=false,submitted=false;
  let busy=false,mutating=false,editorDirty=false,editorId=null,photoBusy=false,votersOpen=false;
  let editorOpening=false,revision=0;
  const editor=$('competitionEditor');
  const current=()=>document.querySelector('.view:not(.hidden)')?.dataset.view;
  const message=(id,text)=>{ $(id).textContent=text; };
  const date=value=>value ? new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '';
  const badge=status=>`<span class="comp-badge comp-badge--${esc(status)}">${esc(status)}</span>`;
  const action=(name,label,id='',extra='')=>`<button class="comp-btn ${extra}" data-comp-action="${name}" data-id="${esc(id)}" type="button">${label}</button>`;
  const photo=(url,cls='',caption='Competition photo')=>`<button class="comp-photo-button ${cls==='comp-cover'?'comp-photo-button--cover':''}" type="button" data-comp-action="photo" data-photo-state="loading" data-photo-url="${esc(url)}" data-photo-caption="${esc(caption)}" aria-label="${esc('View full photo: '+caption)}"><img class="${cls}" src="${esc(url)}" alt="${esc(caption)}" loading="${cls==='comp-cover'?'eager':'lazy'}" decoding="async"><span class="comp-photo-feedback" aria-hidden="true">Loading photo…</span></button>`;
  const image=(url,cls='comp-thumb',caption='Competition photo')=>url ? photo(url,cls,caption) : '<span class="comp-placeholder" aria-hidden="true">&#127918;</span>';
  function filterMarkup(rows,filter,admin){
    const types=admin ? ['all','active','upcoming','paused','closed','draft'] : ['all','active','upcoming','paused','closed'];
    return types.map(type=>`<button type="button" data-comp-filter="${type}" data-admin="${admin}" aria-pressed="${filter===type}">${type[0].toUpperCase()+type.slice(1)} (${type==='all'?rows.length:rows.filter(c=>c.status===type).length})</button>`).join('');
  }
  function card(c,admin){
    const timing=c.status==='upcoming' ? 'Starts '+date(c.startAt) : c.endAt ? (c.status==='closed'?'Ended ':'Closes ')+date(c.endAt) : 'No closing date set';
    const counts=c.results ? c.results.totalVotes+' votes' : 'Results hidden';
    return `<article class="comp-card">${image(c.coverUrl,'comp-thumb',c.title)}<div><h2>${esc(c.title)}</h2>${badge(c.status)}<small>${esc(counts)} &middot; ${esc(timing)}</small></div>
      ${action(admin?'manage':'open',admin?'Manage':c.canVote?'Vote Now':'View',c.id,'comp-btn--gold')}</article>`;
  }
  function renderLists(){
    $('competitionFilters').innerHTML=filterMarkup(guestRows,guestFilter,false);
    const guests=guestRows.filter(c=>guestFilter==='all'||c.status===guestFilter);
    $('competitionList').innerHTML=guests.length ? guests.map(c=>card(c,false)).join('') : '<div class="comp-notice">No competitions here yet. Check back when the couple publishes a game!</div>';
    $('competitionAdminFilters').innerHTML=filterMarkup(adminRows,adminFilter,true);
    const admins=adminRows.filter(c=>adminFilter==='all'||c.status===adminFilter);
    $('competitionAdminList').innerHTML=admins.length ? admins.map(c=>card(c,true)).join('') : '<div class="comp-notice">No competitions here yet. Create your first custom competition above.</div>';
  }
  function resultMarkup(c,admin=false){
    if(!c.results) return '<div class="comp-notice">The couple has chosen to keep results private for now.</div>';
    const r=c.results;
    let previous=-1,rank=0;
    const rankings=r.rankings.map((x,i)=>{
      if(x.votes!==previous){rank=i+1;previous=x.votes;}
      return `<div class="comp-result"><b>${rank}</b>${x.photoUrl?photo(x.photoUrl,'',x.name):'<span class="comp-mini-placeholder" aria-hidden="true">&#9819;</span>'}
        <div><strong>${esc(x.name)}</strong><div class="comp-bar"><i style="width:${x.percentage}%"></i></div></div><div><b>${x.percentage}%</b><small>${x.votes} votes</small></div></div>`;
    }).join('');
    return `<div class="comp-panel"><h2>${c.status==='active'?'Live':'Voting'} Results ${admin?'(Admin View)':''}</h2>
      <p>${r.totalVotes?'Rankings refresh every 15 seconds while this page is visible.':'No votes yet. Rankings will appear as guests vote.'}${c.voteMode==='multiple'?' Percentages are shares of all contestant selections.':''}${c.requireVerified===false?' Voters are counted by browser, not verified people.':''}</p>
      ${rankings}<div class="comp-totals"><div>Total Votes<b>${r.totalVotes}</b></div><div>${c.requireVerified===false?'Voting Browsers':'Unique Voters'}<b>${r.uniqueVoters}</b></div></div></div>`;
  }
  function renderDetail(){
    if(!detail) return;
    const c=detail;
    if(!selectionDirty&&!voting) selected=new Set(c.myChoices);
    const draftComment=$('competitionComment')?.value||'';
    const choices=c.choices.map(x=>`<div class="comp-choice">${x.photoUrl?photo(x.photoUrl,'',x.name):''}
      <label class="comp-choice-vote"><input name="competition-choice" type="${c.voteMode==='single'?'radio':'checkbox'}" value="${esc(x.id)}" ${selected.has(x.id)?'checked':''} ${!c.canVote||voting?'disabled':''}>${esc(x.name)}</label></div>`).join('');
    $('competitionDetail').innerHTML=`<div class="comp-heading"><h1>${esc(c.title)}</h1><p>${esc(c.description).replace(/\n/g,'<br>')}</p>${badge(c.status)}</div>
      ${c.coverUrl?image(c.coverUrl,'comp-cover',c.title):''}<p class="comp-status">${esc(c.startAt?'Starts '+date(c.startAt):'')}${c.endAt?'<br>Closes '+esc(date(c.endAt)):''}</p>
      ${submitted?'<div class="comp-success"><b aria-hidden="true">&#10003;</b><h2>Vote Submitted!</h2><p>Thank you for participating. Your vote has been counted.</p>'+action('results','View Results')+action('all','Vote in Another Competition')+'</div>':''}
      ${c.myChoices.length&&!submitted?'<div class="comp-notice">Your vote is counted.'+(c.allowChange?' You can change it while voting is open.':' Vote changes are disabled.')+'</div>':''}
       <p class="comp-status">${c.voteMode==='single'?'Choose one contestant.':'Choose one or more contestants. '+(c.requireVerified===false?'Each browser':'Each guest')+' can vote once per contestant.'}</p>
      ${c.requireVerified===false?'<div class="comp-notice">No verified sign-in needed for this game. Voting is limited per browser. Clearing cookies or using another browser can allow another vote.</div>':''}
      <div class="comp-choices">${choices}</div>
      ${c.canVote ? `${c.commentsEnabled?'<label class="comp-field">Comment (optional, reviewed before sharing)<textarea id="competitionComment" rows="2" maxlength="300">'+esc(draftComment)+'</textarea></label>':''}
         <button id="competitionSubmit" class="comp-btn comp-btn--gold comp-wide" data-comp-action="vote" type="button" ${voting?'disabled':''}>${voting?'Submitting…':c.myChoices.length?'Update Vote':'Submit Vote'}</button>` : `<div class="comp-notice">${esc(c.votingReason)}</div>${c.requireVerified!==false&&(!getGuest()?.id||/Verify/.test(c.votingReason))?action('verify','Verify Guest Sign-in'):''}`}
      <div id="competitionResults">${resultMarkup(c)}</div>
      ${c.commentsEnabled&&c.comments.length?'<div class="comp-panel"><h2>Guest Comments</h2>'+c.comments.map(x=>`<div class="comp-comment"><strong>${esc(x.name||'Guest')}</strong><p>${esc(x.text)}</p></div>`).join('')+'</div>':''}`;
  }
  function renderManage(){
    const c=adminRows.find(x=>x.id===adminId);
    if(!c||!editor.classList.contains('hidden')) return;
    $('competitionAdminManage').innerHTML=`${action('browse','&#8249; All Competitions')}<div class="comp-panel"><h2>${esc(c.title)}</h2>
      ${c.coverUrl?image(c.coverUrl,'comp-cover',c.title):''}${badge(c.status)}<p>${esc(c.description)}</p>
      <p>${c.results.totalVotes} votes &middot; ${c.results.uniqueVoters} ${c.requireVerified===false?'voting browsers':'voters'}${c.endAt?' &middot; Closes '+esc(date(c.endAt)):''}</p>
      <p>${c.requireVerified===false?'Verification off — voting is limited per browser.':'Verified guest sign-in required.'}</p>
      <div class="comp-actions">${action('edit','&#9998; Edit',c.id)}
      ${c.config.status==='active'?action('pause','&#10074;&#10074; Pause',c.id):action('publish',c.config.status==='draft'?'Publish':'Resume / Reopen',c.id,'comp-btn--gold')}
      ${c.config.status!=='closed'?action('close','Close',c.id,'comp-btn--danger'):''}</div>
      <div class="comp-actions">${action('duplicate','Duplicate',c.id)}${action('delete','Delete',c.id,'comp-btn--danger')}</div>
      <div class="comp-actions">${action('contestants','Manage Contestants',c.id)}${action('settings','Voting Settings',c.id)}</div>
      <div class="comp-actions">${action('results','View Live Results')}${action('voters','View Voters / Moderate Comments',c.id)}</div>
      <div class="comp-actions">${action('share','Share to Guests',c.id)}${action('export','Export Results (CSV)',c.id)}</div>
      ${c.config.status==='draft'?'<p>Drafts are private. Publish before sharing with guests.</p>':''}</div>
      <div id="competitionAdminResults">${resultMarkup(c,true)}</div><div id="competitionVoters" class="comp-panel ${votersOpen?'':'hidden'}"></div>`;
  }
  function localDate(ms){
    if(!ms) return '';
    const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function photoControl(url,target){
    return `<div class="comp-photo-control" data-photo-target="${target}" data-photo-url="${esc(url||'')}">
      ${url?photo(url,'','Selected photo'):''}
      <label class="comp-btn">${url?'Change':'Upload'} Photo<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-comp-photo></label>
      ${url?'<button class="comp-btn" data-comp-action="clear-photo" type="button">Remove Photo</button>':''}<span class="comp-photo-status" role="status"></span></div>`;
  }
  function choiceEditor(x={}){
    return `<div class="comp-contestant" data-choice-id="${esc(x.id||'')}"><label class="comp-field">Contestant / Team Name *<input data-choice-name value="${esc(x.name||'')}" maxlength="120" required></label>
      ${photoControl(x.photoUrl,'choice')}<div class="comp-actions">${action('up','Move Up')}${action('down','Move Down')}${action('remove-choice','Remove Contestant','','comp-btn--danger')}</div></div>`;
  }
  async function openEditor(c){
    if(editorOpening) return;
    if(editorDirty&&!confirm('Discard the unsaved competition edits?')) return;
    editorOpening=true;
    const version=revision,view=current();
    let guests;
    try{guests=await api('/admin/guests',{admin:true});}
    finally{editorOpening=false;}
    if(!isAdmin()||version!==revision||current()!==view) return;
    const config=c?.config||{title:'',description:'',choices:[{},{}],audience:'all',voteMode:'single',guestIds:[],showPhotos:true,showResults:true,allowChange:false,commentsEnabled:false};
    editorId=c?.id||null;editorDirty=false;
    $('competitionAdminBrowse').classList.add('hidden');$('competitionAdminManage').classList.add('hidden');editor.classList.remove('hidden');
    const hasVotes=!!c?.results.totalVotes;
    editor.innerHTML=`<h2>${c?'Edit':'Create'} Competition</h2>
      <label class="comp-field">Competition Title *<input name="title" maxlength="120" required value="${esc(config.title)}"></label>
      <label class="comp-field">Description<textarea name="description" maxlength="1000" rows="3">${esc(config.description)}</textarea></label>
      <label class="comp-field">Cover Image</label>${photoControl(config.coverUrl,'cover')}
      <h3 id="competitionChoicesHeading" style="margin-top:22px">Choices / Contestants</h3><p>Add 2–30 contestants or teams. Photos are optional. Move Up / Down controls set their order.</p>
      <div id="competitionChoicesEditor">${config.choices.map(choiceEditor).join('')}</div>${action('add-choice','+ Add Another Contestant')}
      <h3 style="margin-top:24px">Voting Period</h3><p>Dates use your device’s local time zone. Leave blank to open immediately or keep voting open.</p>
      <div class="comp-fields"><label class="comp-field">Start Date<input type="datetime-local" name="startAt" value="${localDate(config.startAt)}"></label>
      <label class="comp-field">End Date<input type="datetime-local" name="endAt" value="${localDate(config.endAt)}"></label></div>
      <h3 id="competitionVotingHeading">Voting Settings</h3>${hasVotes?'<div class="comp-notice">Votes have been cast. Verification, audience and vote limit are locked. Duplicate the competition to change these settings. Contestants with votes cannot be removed.</div>':''}
      <label class="comp-check"><input name="requireVerified" type="checkbox" data-locked="${hasVotes}" ${config.requireVerified!==false?'checked':''} ${hasVotes||config.audience!=='all'?'disabled':''}>Require verified guest sign-in before voting</label>
      <p>On: approved, verified guests only. Off: no extra sign-in verification for this game; limits use a browser cookie, not verified people. Another browser or cleared cookies can vote again. Attending-only and selected-group voting require this option on.</p>
      <label class="comp-field">Who can vote?<select name="audience" ${hasVotes?'disabled':''}>
         ${[['all','All guests (approved if verification is on)'],['attending','Only approved attending guests'],['group','Selected approved guest group']].map(([v,l])=>`<option value="${v}" ${config.audience===v?'selected':''}>${l}</option>`).join('')}</select></label>
      <div id="competitionGuestGroup" class="${config.audience==='group'?'':'hidden'}"><p>Select the guests allowed to vote:</p><div class="comp-groups">
      ${guests.filter(g=>g.status==='approved').map(g=>`<label class="comp-check"><input type="checkbox" data-comp-guest value="${esc(g.id)}" ${config.guestIds.includes(g.id)?'checked':''} ${hasVotes?'disabled':''}>${esc(g.name)}</label>`).join('')||'<p>No approved guests yet. Approve guests first or use All Guests.</p>'}
      ${config.guestIds.filter(id=>!guests.some(g=>g.id===id&&g.status==='approved')).map(id=>`<label class="comp-check"><input type="checkbox" data-comp-guest value="${esc(id)}" checked ${hasVotes?'disabled':''}>Previously selected guest (no longer approved)</label>`).join('')}</div></div>
      <label class="comp-field">Voting Limit<select name="voteMode" ${hasVotes?'disabled':''}>
        <option value="single" ${config.voteMode==='single'?'selected':''}>One contestant per guest (recommended)</option>
        <option value="multiple" ${config.voteMode==='multiple'?'selected':''}>Multiple choices — once per contestant per guest</option></select></label>
      ${[['showResults','Show live results to guests'],['allowChange','Allow guests to change their vote'],['showPhotos','Display photos with contestant names'],['commentsEnabled','Enable comments (admin approval required)']].map(([key,label])=>`<label class="comp-check"><input type="checkbox" name="${key}" ${config[key]?'checked':''}>${label}</label>`).join('')}
      <div class="comp-actions"><button class="comp-btn" type="submit" name="saveAction" value="draft">Save as Draft</button>
      <button class="comp-btn comp-btn--gold" type="submit" name="saveAction" value="${c&&config.status!=='draft'?config.status:'active'}">${c&&config.status!=='draft'?'Save Changes':'Publish Competition'}</button>${action('cancel-editor','Cancel')}</div>
      <p id="competitionEditorStatus" class="comp-status" role="status" aria-live="polite"></p>`;
    editor.querySelector('[name="title"]').focus({preventScroll:true});
    refreshVerificationLabels();
  }
  function refreshVerificationLabels(){
    const unit=editor.elements.namedItem('requireVerified')?.checked?'guest':'browser';
    const options=editor.elements.namedItem('voteMode')?.options;
    if(options){options[0].textContent='One contestant per '+unit+' (recommended)';options[1].textContent='Multiple choices — once per contestant per '+unit;}
  }
  function collect(){
    const field=name=>editor.elements.namedItem(name);
    return {title:field('title').value,description:field('description').value,coverUrl:editor.querySelector('[data-photo-target="cover"]').dataset.photoUrl,
      startAt:field('startAt').value?new Date(field('startAt').value).getTime():null,endAt:field('endAt').value?new Date(field('endAt').value).getTime():null,
      audience:field('audience').value,voteMode:field('voteMode').value,guestIds:[...editor.querySelectorAll('[data-comp-guest]:checked')].map(el=>el.value),
      ...Object.fromEntries(['requireVerified','showResults','allowChange','showPhotos','commentsEnabled'].map(key=>[key,field(key).checked])),
      choices:[...editor.querySelectorAll('.comp-contestant')].map(row=>({id:row.dataset.choiceId||undefined,name:row.querySelector('[data-choice-name]').value,photoUrl:row.querySelector('[data-photo-target]').dataset.photoUrl}))};
  }
  function editorControls(disabled){
    editor.querySelectorAll('input,button,select,textarea').forEach(el=>{
      if(disabled){el.dataset.wasDisabled=String(el.disabled);el.disabled=true;}
      else {el.disabled=el.dataset.wasDisabled==='true';delete el.dataset.wasDisabled;}
    });
  }
  async function showVoters(){
    const id=adminId,version=revision;
    const rows=await api('/admin/competitions/'+id+'/voters',{admin:true});
    if(id!==adminId||!isAdmin()||version!==revision||current()!=='admincompetitions') return;
    votersOpen=true;
    const box=$('competitionVoters');if(!box) return;box.classList.remove('hidden');
    box.innerHTML='<h2>Voters &amp; Comments</h2>'+(rows.length?rows.map(v=>`<div class="comp-voter"><strong>${esc(v.name)}</strong><small>${esc(v.choices.join(', '))}<br>${esc(date(v.createdAt))}</small>
      ${v.comment?`<p>${esc(v.comment.text)}</p>${badge(v.comment.status)}<div class="comp-actions">${action('approve-comment','Approve Comment',v.guestId)}${action('reject-comment','Hide / Reject',v.guestId)}</div>`:''}</div>`).join(''):'<p>No votes yet.</p>');
  }
  async function refresh(){
    const view=current();
    const version=revision;
    const requestedId=selectedId;
    if(busy||mutating||voting||photoBusy||document.hidden||gateShowing()||window.__uploadsInFlight>0||!['competitions','competition','admincompetitions'].includes(view)) return;
    busy=true;
    try{
      if(view==='admincompetitions'){
        if(!isAdmin()) return;
        const rows=await api('/admin/competitions',{admin:true});
        if(!isAdmin()||current()!==view||version!==revision||mutating) return;
        adminRows=rows;renderLists();
        if(adminId&&editor.classList.contains('hidden')){
          if(!rows.some(c=>c.id===adminId)){adminId=null;$('competitionAdminManage').classList.add('hidden');$('competitionAdminBrowse').classList.remove('hidden');}
          else {renderManage();if(votersOpen) await showVoters();}
        }
      }else if(view==='competitions'){
        const rows=await api('/competitions');
        if(current()!==view||version!==revision) return;
        guestRows=rows;renderLists();message('competitionListStatus','');
      }else{
        const id=selectedId;
        if(!id){$('competitionDetail').innerHTML='<div class="comp-notice">Choose a competition from the list first.</div>';return;}
        const c=await api('/competitions/'+encodeURIComponent(id));
        if(current()!==view||id!==selectedId||version!==revision||voting) return;
        const signature=JSON.stringify(c);
        if(signature!==JSON.stringify(detail)){
          const sameForm=detail&&detail.status===c.status&&detail.canVote===c.canVote&&detail.votingReason===c.votingReason
            &&detail.title===c.title&&detail.description===c.description&&detail.coverUrl===c.coverUrl
            &&detail.commentsEnabled===c.commentsEnabled&&detail.requireVerified===c.requireVerified&&detail.voteMode===c.voteMode&&detail.startAt===c.startAt&&detail.endAt===c.endAt
            &&JSON.stringify(detail.choices)===JSON.stringify(c.choices)&&JSON.stringify(detail.myChoices)===JSON.stringify(c.myChoices)
            &&JSON.stringify(detail.comments)===JSON.stringify(c.comments);
          detail=c;
          if(sameForm&&$('competitionResults')) $('competitionResults').innerHTML=resultMarkup(c);
          else renderDetail();
        }
      }
    }catch(err){
      if(current()!==view||version!==revision||(view==='competition'&&requestedId!==selectedId)) return;
      if(view==='competition'&&requestedId===selectedId&&err.message==='Competition not found.'){
        detail=null;selected.clear();selectionDirty=false;submitted=false;
        $('competitionDetail').innerHTML='<div class="comp-notice">Competition not found. It may have been removed or made private.</div>'+action('all','All Competitions');
      }
      message(view==='admincompetitions'?'competitionAdminStatus':view==='competitions'?'competitionListStatus':'competitionVoteStatus',err.message);
    }
    finally {busy=false;if(current()!==view||version!==revision||(view==='competition'&&requestedId!==selectedId)) queueMicrotask(refresh);}
  }
  async function runAction(el){
    const name=el.dataset.compAction,id=el.dataset.id;
    if(name==='photo'){
      const img=el.querySelector('img');
      if(el.dataset.photoState==='error'){
        el.dataset.photoState='loading';el.querySelector('.comp-photo-feedback').textContent='Retrying photo…';
        el.setAttribute('aria-label','Retrying photo: '+el.dataset.photoCaption);
        const url=new URL(el.dataset.photoUrl,location.href);url.searchParams.set('photoRetry',String(Date.now()));img.src=url.href;
        return;
      }
      if(!img.complete||!img.naturalWidth)return;
      openLightbox(img.currentSrc||img.src,el.dataset.photoCaption);return;
    }
    if(name==='open'){
      selectedId=id;detail=null;selected.clear();selectionDirty=false;submitted=false;
      try{sessionStorage.setItem('sj_competition',id);}catch{}
      $('competitionDetail').innerHTML='';message('competitionVoteStatus','');switchView('competition');
      const url=new URL(location.href);url.searchParams.set('competition',id);history.replaceState(history.state,'',url);
      return;
    }
    if(name==='all'){switchView('competitions');return;}
    if(name==='results'){$(current()==='admincompetitions'?'competitionAdminResults':'competitionResults')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(name==='verify'){
      document.getElementById('app').classList.add('hidden');document.body.classList.add('locked');
      showGate(guestLoginScreen);showPane('return');$('returnPhone')?.focus();return;
    }
    if(name==='vote'){
      if(voting||!detail?.canVote) return;
      if(!selected.size){message('competitionVoteStatus','Choose a contestant before submitting.');return;}
      const voteId=detail.id,comment=$('competitionComment')?.value||'';
       revision++;voting=true;el.disabled=true;el.textContent='Submitting…';message('competitionVoteStatus','');
      try{
        const c=await api('/competitions/'+voteId+'/vote',{method:'POST',body:{choices:[...selected],comment}});
        if(selectedId===voteId){detail=c;selectionDirty=false;submitted=true;selected=new Set(c.myChoices);voting=false;renderDetail();message('competitionVoteStatus','Your vote has been counted.');}
      }catch(err){
        if(selectedId===voteId){voting=false;await refresh();message('competitionVoteStatus',err.message);}
      }
      finally{voting=false;const submit=$('competitionSubmit');if(submit){submit.disabled=false;submit.textContent=detail?.myChoices.length?'Update Vote':'Submit Vote';}}
      return;
    }
    if(!isAdmin()) return;
    if(photoBusy||mutating||editorOpening) return;
    if(name==='create'){await openEditor();return;}
    if(name==='manage'){
      adminId=id;votersOpen=false;$('competitionAdminBrowse').classList.add('hidden');editor.classList.add('hidden');$('competitionAdminManage').classList.remove('hidden');renderManage();return;
    }
    if(name==='browse'||name==='cancel-editor'){
      if(editorDirty&&!confirm('Discard the unsaved competition edits?')) return;
      editorDirty=false;editor.classList.add('hidden');
      if(name==='cancel-editor'&&adminId){$('competitionAdminManage').classList.remove('hidden');renderManage();}
      else{adminId=null;$('competitionAdminManage').classList.add('hidden');$('competitionAdminBrowse').classList.remove('hidden');}return;
    }
    if(['edit','contestants','settings'].includes(name)){
      await openEditor(adminRows.find(c=>c.id===id));
      if(name!=='edit') $(name==='contestants'?'competitionChoicesHeading':'competitionVotingHeading')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if(name==='add-choice'){
      if(editor.querySelectorAll('.comp-contestant').length>=30){message('competitionEditorStatus','Maximum 30 contestants.');return;}
      $('competitionChoicesEditor').insertAdjacentHTML('beforeend',choiceEditor());editorDirty=true;return;
    }
    if(['up','down','remove-choice'].includes(name)){
      const row=el.closest('.comp-contestant');
      if(name==='remove-choice'){
        if(editor.querySelectorAll('.comp-contestant').length<=2){message('competitionEditorStatus','Keep at least two contestants.');return;}
        row.remove();
      }else if(name==='up'&&row.previousElementSibling) row.parentNode.insertBefore(row,row.previousElementSibling);
      else if(name==='down'&&row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling,row);
      editorDirty=true;return;
    }
    if(name==='clear-photo'){const box=el.closest('[data-photo-target]');box.outerHTML=photoControl('',box.dataset.photoTarget);editorDirty=true;return;}
    if(name==='share'){
      if(adminRows.find(c=>c.id===id)?.config.status==='draft'){message('competitionAdminStatus','Publish this draft before sharing.');return;}
      const url=new URL(location.origin+location.pathname);url.searchParams.set('competition',id);url.hash='competition';
      if(navigator.share){try{await navigator.share({title:'Wedding Competition',url:url.href});}catch(err){if(err.name!=='AbortError') throw err;}}
      else{await navigator.clipboard.writeText(url.href);message('competitionAdminStatus','Guest competition link copied.');}return;
    }
    if(name==='export'){
      const response=await fetch('/api/admin/competitions/'+id+'/export',{headers:{Authorization:'Bearer '+adminToken},cache:'no-store'});
      if(!response.ok) throw new Error('Could not export results. Sign in again if your session has expired.');
      const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='competition-results.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
    }
    if(name==='voters'){await showVoters();$('competitionVoters').scrollIntoView({behavior:'smooth'});return;}
    if(name==='delete'&&!confirm('Delete this competition and all its votes and comments? This cannot be undone.')) return;
    if(name==='close'&&!confirm('Close voting for this competition? Existing votes will be kept.')) return;
    revision++;mutating=true;el.disabled=true;
    try{
      if(name==='approve-comment'||name==='reject-comment'){
        await api('/admin/competitions/'+adminId+'/comments/'+id,{admin:true,method:'PATCH',body:{status:name==='approve-comment'?'approved':'rejected'}});await showVoters();return;
      }
      const path='/admin/competitions/'+id;
      if(name==='duplicate'){
        const c=await api(path+'/duplicate',{admin:true,method:'POST'});adminRows.unshift(c);adminId=c.id;votersOpen=false;renderManage();message('competitionAdminStatus','Duplicated as a private draft. No votes were copied.');
      }else if(name==='delete'){
        await api(path,{admin:true,method:'DELETE'});adminRows=adminRows.filter(c=>c.id!==id);adminId=null;$('competitionAdminManage').classList.add('hidden');$('competitionAdminBrowse').classList.remove('hidden');renderLists();message('competitionAdminStatus','Competition deleted.');
      }else if(['pause','publish','close'].includes(name)){
        const c=await api(path,{admin:true,method:'PATCH',body:{status:{pause:'paused',publish:'active',close:'closed'}[name]}});
        adminRows=adminRows.map(x=>x.id===c.id?c:x);renderManage();renderLists();message('competitionAdminStatus','Competition updated.');
      }
    }finally{mutating=false;el.disabled=false;}
  }
  document.addEventListener('load',e=>{
    const button=e.target.closest?.('.comp-photo-button');
    if(!button||e.target.tagName!=='IMG'||!e.target.naturalWidth)return;
    button.dataset.photoState='ready';button.setAttribute('aria-label','View full photo: '+button.dataset.photoCaption);
  },true);
  document.addEventListener('error',e=>{
    const button=e.target.closest?.('.comp-photo-button');
    if(!button||e.target.tagName!=='IMG')return;
    button.dataset.photoState='error';button.querySelector('.comp-photo-feedback').textContent='Photo unavailable. Tap to retry.';
    button.setAttribute('aria-label','Photo unavailable. Retry: '+button.dataset.photoCaption);
  },true);
  document.addEventListener('click',e=>{
    const filter=e.target.closest('[data-comp-filter]');
    if(filter){if(filter.dataset.admin==='true')adminFilter=filter.dataset.compFilter;else guestFilter=filter.dataset.compFilter;renderLists();return;}
    const el=e.target.closest('[data-comp-action]');
    if(!el||el.disabled) return;
    runAction(el).catch(err=>message(current()==='admincompetitions'?'competitionAdminStatus':'competitionVoteStatus',err.message));
  });
  $('competitionDetail').addEventListener('change',e=>{
    if(e.target.name!=='competition-choice'||voting) return;
    if(detail.voteMode==='single') selected=new Set([e.target.value]);
    else if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);
    selectionDirty=true;
  });
  editor.addEventListener('input',()=>{editorDirty=true;});
  editor.addEventListener('change',async e=>{
    if(e.target.name==='audience'){
      $('competitionGuestGroup').classList.toggle('hidden',e.target.value!=='group');
      const verification=editor.elements.namedItem('requireVerified');
      if(e.target.value!=='all')verification.checked=true;
      verification.disabled=verification.dataset.locked==='true'||e.target.value!=='all';
      refreshVerificationLabels();
    }
    if(e.target.name==='requireVerified')refreshVerificationLabels();
    if(!e.target.matches('[data-comp-photo]')||!e.target.files[0]||!isAdmin()||photoBusy) return;
    const file=e.target.files[0],box=e.target.closest('[data-photo-target]'),status=box.querySelector('.comp-photo-status');
    if(file.size>10*1024*1024){status.textContent='Photo must be under 10 MB.';return;}
    photoBusy=true;editorControls(true);const form=new FormData();form.append('file',file);
    try{const result=await api('/admin/competition-photos',{admin:true,method:'POST',form,onProgress:p=>{status.textContent=p===100?'100% sent — saving…':'Uploading '+p+'%…';}});
      if(isAdmin()){box.outerHTML=photoControl(result.url,box.dataset.photoTarget);editorDirty=true;}
    }catch(err){status.textContent=err.message;}
    finally{photoBusy=false;editorControls(false);}
  });
  editor.addEventListener('submit',async e=>{
    e.preventDefault();if(!isAdmin()||mutating||photoBusy) return;
    const body=collect();body.status=e.submitter?.value||'draft';
    revision++;mutating=true;editorControls(true);message('competitionEditorStatus','Saving…');
    try{
      const c=await api('/admin/competitions'+(editorId?'/'+editorId:''),{admin:true,method:editorId?'PATCH':'POST',body});
      if(!isAdmin()) return;
      adminRows=adminRows.filter(x=>x.id!==c.id);adminRows.unshift(c);adminId=c.id;editorDirty=false;votersOpen=false;
      editor.classList.add('hidden');$('competitionAdminManage').classList.remove('hidden');renderLists();renderManage();
      message('competitionAdminStatus',c.config.status==='draft'?'Saved as a private draft.':'Saved. Guests can see the competition now.');
    }catch(err){message('competitionEditorStatus',err.message);}
    finally{mutating=false;editorControls(false);}
  });
  onAdminAuth(signedIn=>{
    revision++;
    if(!signedIn){adminRows=[];adminId=null;editorDirty=false;editor.innerHTML='';editor.classList.add('hidden');$('competitionAdminManage').innerHTML='';$('competitionAdminBrowse').classList.remove('hidden');renderLists();}
  });
  window.addEventListener('wedding:view',refresh);
  window.addEventListener('sj:entered',()=>{
    if(sharedEntryPending&&selectedId){sharedEntryPending=false;switchView('competition');}
    else refresh();
  });
  window.addEventListener('popstate',()=>{
    const id=new URLSearchParams(location.search).get('competition');
    if(id&&id!==selectedId){selectedId=id;detail=null;selected.clear();selectionDirty=false;submitted=false;message('competitionVoteStatus','');refresh();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(refresh,15000);renderLists();refresh();
})();
