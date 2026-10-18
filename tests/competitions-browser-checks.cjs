const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

/* Render actual UI with in-memory API responses. No competition writes leave the browser. */
module.exports=async({call,evaluate,errors,out})=>{
  await evaluate(`(()=>{
    const original=api;
    const base={description:'Vote for your favourite wedding look!',coverUrl:'assets/couple-home.jpg',status:'active',audience:'all',guestIds:[],voteMode:'single',requireVerified:true,showResults:true,showPhotos:true,allowChange:false,commentsEnabled:true,startAt:null,endAt:null};
    const state=window.__competitionFixture={rows:[{...base,id:'mock-active',title:'Best Dressed Guest',choices:[{id:'one',name:'Guest One',photoUrl:'assets/story/sam-adult.jpg'},{id:'two',name:'Guest Two',photoUrl:'assets/story/jossy-adult.jpg'}]},
      {...base,id:'mock-team',title:'Team Bride vs Team Groom',choices:[{id:'bride',name:'Team Bride',photoUrl:'assets/story/jossy-adult.jpg'},{id:'groom',name:'Team Groom',photoUrl:'assets/story/sam-adult.jpg'}]},
      {...base,id:'mock-future',title:'Wedding Selfie',status:'upcoming',startAt:Date.now()+86400000,choices:[{id:'f1',name:'Choice One'},{id:'f2',name:'Choice Two'}]},
      {...base,id:'mock-closed',title:'Best Dance Moves',status:'closed',choices:[{id:'c1',name:'Choice One'},{id:'c2',name:'Choice Two'}]}],votes:{},calls:[],counter:0};
    const decorate=(c,admin)=>{
      const votes=state.votes[c.id]||[];
      return {...c,config:admin?structuredClone(c):undefined,myChoices:admin?[]:votes,canVote:(!state.unverified||c.requireVerified===false)&&c.status==='active'&&(!votes.length||c.allowChange),
        votingReason:state.unverified&&c.requireVerified!==false?'Verify your guest sign-in before voting.':c.status!=='active'?'Voting is not open.':votes.length&&!c.allowChange?'Your vote is already counted. Changes are disabled.':'',comments:[],
        results:c.showResults||admin?{totalVotes:votes.length,uniqueVoters:votes.length?1:0,rankings:c.choices.map(x=>({...x,votes:votes.includes(x.id)?1:0,percentage:votes.includes(x.id)?Math.round(100/votes.length):0})).sort((a,b)=>b.votes-a.votes)}:null};
    };
    api=async(p,opts={})=>{
      if(!p.includes('competitions')&&p!=='/admin/competition-photos'){
        if(p==='/admin/guests')return [{id:'guest-one',name:'Approved Guest',status:'approved',attending:1}];
        if(p.startsWith('/admin/'))return [];
        return original(p,opts);
      }
      state.calls.push({path:p,method:opts.method||'GET'});
      if(p==='/competitions/notices')return structuredClone(state.notices||[]);
      if(p==='/admin/competition-photos'){opts.onProgress?.(43);if(state.photoWait)await state.photoWait;opts.onProgress?.(100);return {url:'assets/couple-home.jpg'};}
      if(p==='/competitions/session')return {verified:true,approved:true};
      const admin=p.startsWith('/admin/');
      const parts=p.replace('/admin','').split('/');
      const id=parts[2],suffix=parts[3];
      if(!id){
        if(opts.method==='POST'){
          const c={...opts.body,id:'created-'+(++state.counter),choices:opts.body.choices.map((x,i)=>({...x,id:x.id||'new-'+state.counter+'-'+i}))};state.rows.unshift(c);return decorate(c,true);
        }
        return state.rows.filter(c=>admin||c.status!=='draft').map(c=>decorate(c,admin));
      }
      const c=state.rows.find(c=>c.id===id);if(!c)throw new Error('Competition not found.');
      if(suffix==='vote'){
        if(state.voteWait)await state.voteWait;
        if(state.failVote){state.failVote=false;throw new Error('Simulated connection failure.');}
        state.votes[id]=opts.body.choices;return decorate(c,false);
      }
      if(suffix==='duplicate'){
        const copy={...structuredClone(c),id:'copy-'+(++state.counter),title:c.title+' (copy)',status:'draft',choices:c.choices.map((x,i)=>({...x,id:'copy-choice-'+state.counter+'-'+i}))};state.rows.unshift(copy);return decorate(copy,true);
      }
      if(suffix==='voters')return [{guestId:'guest-one',name:'Mock Voter',choices:[c.choices[0].name],createdAt:Date.now(),comment:{text:'Congratulations!',status:'pending'}}];
      if(suffix==='comments')return {ok:true};
      if(opts.method==='PATCH'){Object.assign(c,opts.body);return decorate(c,true);}
      if(opts.method==='DELETE'){state.rows=state.rows.filter(x=>x.id!==id);return {ok:true};}
      return decorate(c,admin);
    };
    setGuest({id:'guest-one',name:'Mock Guest'});setAdminToken('mock-competition-admin');
    switchView('competitions');
  })()`);
  const wait=async expression=>{
    for(let i=0;i<100;i++){
      if(await evaluate(expression))return;
      await new Promise(r=>setTimeout(r,40));
    }
    throw new Error('UI wait timed out: '+expression);
  };
  await wait('document.querySelectorAll("#competitionList .comp-card").length===4');
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    const layout=await evaluate(`(()=>({appVisible:!gateShowing()&&document.getElementById('app').getBoundingClientRect().width>0,
      sevenTabs:document.querySelectorAll('.tabbar .tab').length===7,noOverflow:document.documentElement.scrollWidth===innerWidth,
      buttonsFit:[...document.querySelectorAll('[data-view="competitions"] button')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+.5;})}))()`);
    for(const [name,ok]of Object.entries(layout))assert.equal(ok,true,name+' at '+width);
    console.log('PASS competitions list',width,'pixels, seven main tabs available');
  }
  await evaluate(`document.querySelector('#competitionFilters [data-comp-filter="upcoming"]').click()`);
  assert.equal(await evaluate('document.querySelectorAll("#competitionList .comp-card").length'),1);
  await evaluate(`document.querySelector('#competitionFilters [data-comp-filter="all"]').click();document.querySelector('[data-comp-action="open"][data-id="mock-active"]').click()`);
  await wait('!!document.getElementById("competitionSubmit")');
  await evaluate(`document.getElementById('competitionSubmit').click()`);
  assert.equal(await evaluate(`document.getElementById('competitionVoteStatus').textContent`),'Choose a contestant before submitting.');
  await evaluate(`(()=>{const input=document.querySelector('[name="competition-choice"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
    const s=window.__competitionFixture;s.voteWait=new Promise(r=>s.releaseVote=r);document.getElementById('competitionSubmit').click();
    document.getElementById('competitionSubmit').dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
  assert.equal(await evaluate(`window.__competitionFixture.calls.filter(x=>x.path.endsWith('/vote')).length`),1);
  await evaluate(`window.__competitionFixture.releaseVote();window.__competitionFixture.voteWait=null`);
  await wait('document.querySelector(".comp-success")!==null');
  assert.equal(await evaluate(`document.querySelectorAll('[name="competition-choice"]:disabled').length`),2);
  assert.equal(await evaluate(`document.querySelector('#competitionResults .comp-totals').textContent.includes('1')`),true);
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth===innerWidth'),true,'Vote/results width '+width);
  }
  await evaluate(`document.querySelector('[data-comp-action="all"]').click()`);
  await wait('document.querySelector("#competitionList .comp-card")!==null');
  await evaluate(`document.querySelector('[data-comp-action="open"][data-id="mock-team"]').click()`);
  await wait(`document.querySelector('#competitionDetail h1')?.textContent==='Team Bride vs Team Groom'&&!!document.getElementById('competitionSubmit')`);
  await evaluate(`(()=>{const input=document.querySelector('[name="competition-choice"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));window.__competitionFixture.failVote=true;document.getElementById('competitionSubmit').click();})()`);
  await wait(`document.getElementById('competitionVoteStatus').textContent==='Simulated connection failure.'`);
  assert.equal(await evaluate(`document.querySelector('[name="competition-choice"]:checked')?.value==='bride'&&!document.getElementById('competitionSubmit').disabled`),true,'Retry keeps selection');
  await evaluate(`switchView('admincompetitions')`);
  await wait(`document.querySelectorAll('#competitionAdminList .comp-card').length===4`);
  await evaluate(`document.querySelector('[data-comp-action="create"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.getElementById('competitionEditor').elements.requireVerified.checked`),true,'New competitions default to verified sign-in');
  await evaluate(`(()=>{const f=document.getElementById('competitionEditor');f.elements.title.value='Custom Wedding Game';f.elements.description.value='Our own competition message';f.dispatchEvent(new Event('input',{bubbles:true}));
    const names=f.querySelectorAll('[data-choice-name]');names[0].value='Team One';names[1].value='Team Two';f.elements.audience.value='group';f.elements.audience.dispatchEvent(new Event('change',{bubbles:true}));f.querySelector('[data-comp-guest]').checked=true;})()`);
  for(const width of [320,375,430,1024]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth===innerWidth'),true,'Editor no overflow '+width);
  }
  await evaluate(`document.querySelector('[data-comp-action="add-choice"]').click();document.querySelectorAll('[data-choice-name]')[2].value='Team Three';document.querySelectorAll('[data-comp-action="up"]')[2].click()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-choice-name]')[1].value`),'Team Three');
  await evaluate(`document.querySelectorAll('[data-comp-action="remove-choice"]')[1].click()`);
  await evaluate(`(()=>{const s=window.__competitionFixture;s.photoWait=new Promise(r=>s.releasePhoto=r);const input=document.querySelector('[data-photo-target="cover"] input');const dt=new DataTransfer();dt.items.add(new File(['mock'],'mock.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelector('.comp-photo-status').textContent==='Uploading 43%…'`);
  assert.equal(await evaluate(`document.querySelector('#competitionEditor [type="submit"]').disabled`),true);
  await evaluate(`window.__competitionFixture.releasePhoto();window.__competitionFixture.photoWait=null`);
  await wait(`document.querySelector('[data-photo-target="cover"]').dataset.photoUrl==='assets/couple-home.jpg'`);
  await evaluate(`document.querySelector('#competitionEditor button[value="draft"]').click()`);
  await wait(`document.getElementById('competitionEditor').classList.contains('hidden')&&document.querySelector('#competitionAdminManage h2')?.textContent==='Custom Wedding Game'`);
  assert.equal(await evaluate(`window.__competitionFixture.rows[0].status==='draft'&&window.__competitionFixture.rows[0].guestIds[0]==='guest-one'`),true);
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="publish"]').click()`);
  await wait(`window.__competitionFixture.rows[0].status==='active'`);
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="pause"]').click()`);
  await wait(`window.__competitionFixture.rows[0].status==='paused'`);
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="edit"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.getElementById('competitionEditor').elements.title.value`),'Custom Wedding Game');
  await evaluate(`switchView('home');switchView('admincompetitions')`);
  assert.equal(await evaluate(`!document.getElementById('competitionEditor').classList.contains('hidden')&&document.getElementById('competitionEditor').elements.title.value==='Custom Wedding Game'`),true,'Editor survives navigation');
  await evaluate(`document.querySelector('#competitionEditor [data-comp-action="cancel-editor"]').click();document.querySelector('#competitionAdminManage [data-comp-action="voters"]').click()`);
  await wait(`document.getElementById('competitionVoters').textContent.includes('Mock Voter')`);
  await evaluate(`document.querySelector('#competitionVoters [data-comp-action="approve-comment"]').click()`);
  await wait(`window.__competitionFixture.calls.some(x=>x.path.includes('/comments/')&&x.method==='PATCH')`);
  await evaluate(`document.querySelector('#competitionAdminManage [data-comp-action="duplicate"]').click()`);
  await wait(`document.querySelector('#competitionAdminManage h2')?.textContent==='Custom Wedding Game (copy)'`);
  assert.equal(await evaluate(`window.__competitionFixture.rows[0].status==='draft'`),true);
  await call('Emulation.setDeviceMetricsOverride',{width:430,height:1100,deviceScaleFactor:1,mobile:true});
  await evaluate(`(async()=>{await new Promise(r=>setTimeout(r,700));document.getElementById('pageLoader').classList.add('hidden');scrollTo(0,0);})()`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'competitions-admin-preview.png'),Buffer.from(shot.data,'base64'));
  await evaluate(`const originalConfirm=window.confirm;window.confirm=()=>true;document.querySelector('#competitionAdminManage [data-comp-action="delete"]').click();window.confirm=originalConfirm`);
  await wait(`!window.__competitionFixture.rows.some(x=>x.title==='Custom Wedding Game (copy)')`);
  await evaluate(`document.querySelector('[data-comp-action="create"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  await evaluate(`(()=>{const form=document.getElementById('competitionEditor');form.elements.title.value='Verification Optional';const names=form.querySelectorAll('[data-choice-name]');names[0].value='Male';names[1].value='Female';form.elements.requireVerified.checked=false;form.dispatchEvent(new Event('input',{bubbles:true}));form.querySelector('button[value="active"]').click();})()`);
  await wait(`document.querySelector('#competitionAdminManage h2')?.textContent==='Verification Optional'`);
  assert.equal(await evaluate(`window.__competitionFixture.rows[0].requireVerified`),false,'Unchecked verification is saved');
  await evaluate(`window.__optionalCompetitionId=window.__competitionFixture.rows[0].id;window.__competitionFixture.unverified=true;setAdminToken(null);switchView('competitions')`);
  await wait(`document.querySelector('#competitionList [data-id="'+window.__optionalCompetitionId+'"]')!==null`);
  await evaluate(`document.querySelector('#competitionList [data-id="'+window.__optionalCompetitionId+'"]').click()`);
  await wait(`document.querySelector('#competitionDetail h1')?.textContent==='Verification Optional'&&!!document.getElementById('competitionSubmit')`);
  assert.equal(await evaluate(`!document.querySelector('#competitionDetail [data-comp-action="verify"]')&&document.querySelector('#competitionDetail').textContent.includes('No verified sign-in needed')`),true,'Optional mode removes the verification gate');
  await evaluate(`(()=>{const input=document.querySelector('[name="competition-choice"]');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('competitionSubmit').click();})()`);
  await wait(`!!document.querySelector('#competitionDetail .comp-success')`);
  assert.equal(await evaluate(`document.getElementById('competitionResults').textContent.includes('Voting Browsers')`),true,'Browser counts are labelled honestly');
  await evaluate(`setAdminToken('mock-admin');switchView('admincompetitions')`);
  await wait(`!!document.querySelector('#competitionAdminList [data-id="'+window.__optionalCompetitionId+'"]')`);
  await evaluate(`document.querySelector('#competitionAdminList [data-id="'+window.__optionalCompetitionId+'"]').click();document.querySelector('#competitionAdminManage [data-comp-action="edit"]').click()`);
  await wait(`!document.getElementById('competitionEditor').classList.contains('hidden')`);
  assert.equal(await evaluate(`document.getElementById('competitionEditor').elements.requireVerified.disabled&&!document.getElementById('competitionEditor').elements.requireVerified.checked`),true,'Verification policy is locked after votes');
  await evaluate(`document.querySelector('#competitionEditor [data-comp-action="cancel-editor"]').click()`);
  console.log('PASS verification checkbox defaults/save, optional guest voting without sign-in, browser-count labels and policy lock after votes (API mocked)');
  await evaluate(`switchView('competitions');document.querySelector('#competitionFilters [data-comp-filter="all"]').click()`);
  await wait(`document.querySelector('#competitionList [data-id="mock-team"]')!==null`);
  await evaluate(`document.querySelector('#competitionList [data-id="mock-team"]').click()`);
  await wait(`document.querySelector('#competitionDetail h1')?.textContent==='Team Bride vs Team Groom'`);
  await evaluate(`(async()=>{await new Promise(r=>setTimeout(r,700));document.getElementById('pageLoader').classList.add('hidden');scrollTo(0,0);})()`);
  const guestShot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'competitions-guest-preview.png'),Buffer.from(guestShot.data,'base64'));
  await evaluate(`setAdminToken(null);switchView('admincompetitions')`);
  assert.equal(await evaluate(`document.querySelector('.view:not(.hidden)').dataset.view`),'adminlogin');
  await evaluate(`window.__competitionFixture.notices=[{id:'mock-team',title:'New game <b>with love</b>',status:'active',publishedAt:123,startAt:null,canVote:true}];switchView('home')`);
  await wait(`!!document.querySelector('.competition-toast')`);
  assert.equal(await evaluate(`document.querySelector('.competition-toast p').textContent==='New game <b>with love</b>'&&!document.querySelector('.competition-toast p b')&&document.querySelector('.competition-toast-open').textContent==='Vote Now'`),true,'Toast safely renders title and vote action');
  for(const width of [320,375,430]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`(()=>{const r=document.querySelector('.competition-toast').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+.5;})()`),true,'Toast fits '+width);
  }
  await evaluate(`(async()=>{await new Promise(r=>setTimeout(r,700));document.getElementById('pageLoader').classList.add('hidden');scrollTo(0,0);})()`);
  const noticeShot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'competition-toast-preview.png'),Buffer.from(noticeShot.data,'base64'));
  await evaluate(`document.querySelector('.competition-toast-open').click()`);
  await wait(`document.querySelector('#competitionDetail h1')?.textContent==='Team Bride vs Team Groom'`);
  await evaluate(`window.dispatchEvent(new CustomEvent('wedding:view'))`);
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await evaluate(`!document.querySelector('.competition-toast')&&JSON.parse(localStorage.getItem('sj_competition_notices:guest-one')).includes('mock-team:123:active')`),true,'Notice is saved and not repeated');
  await evaluate(`window.__competitionFixture.notices=[{id:'mock-team',title:'Scheduled game',status:'upcoming',publishedAt:124,startAt:Date.now()+60000,canVote:false}];switchView('home')`);
  await wait(`document.querySelector('.competition-toast-open')?.textContent==='View Competition'`);
  await evaluate(`document.querySelector('.competition-toast-close').click();window.__competitionFixture.notices[0].status='active';window.__competitionFixture.notices[0].canVote=true;window.dispatchEvent(new CustomEvent('wedding:view'))`);
  await wait(`document.querySelector('.competition-toast b')?.textContent==='Wedding competition is open!'`);
  await evaluate(`window.__competitionFixture.notices=[];window.dispatchEvent(new CustomEvent('wedding:view'))`);
  await wait(`!document.querySelector('.competition-toast')`);
  const callsBefore=await evaluate(`window.__competitionFixture.calls.filter(x=>x.path==='/competitions/notices').length`);
  await evaluate(`window.__uploadsInFlight=1;window.dispatchEvent(new CustomEvent('wedding:view'))`);
  assert.equal(await evaluate(`window.__competitionFixture.calls.filter(x=>x.path==='/competitions/notices').length`),callsBefore,'Notices pause during uploads');
  await evaluate(`window.__uploadsInFlight=0;setAdminToken('mock-admin');window.__competitionFixture.notices=[{id:'mock-team',title:'Admin should not see this',status:'active',publishedAt:125}];window.dispatchEvent(new CustomEvent('wedding:view'))`);
  assert.equal(await evaluate(`!document.querySelector('.competition-toast')`),true,'Guest toasts do not appear for admin');
  await evaluate(`window.__competitionFixture.notices=[];setAdminToken(null)`);
  console.log('PASS competition toasts across guest pages, safe titles, mobile fit, Vote Now navigation, per-guest dedup, scheduled opening alert, removed-game cleanup, upload pause and admin suppression (API mocked)');
  await evaluate(`window.__competitionFixture.unverified=true;switchView('competitions')`);
  await wait(`document.querySelector('#competitionList [data-id="mock-team"]')!==null`);
  await evaluate(`document.querySelector('#competitionList [data-id="mock-team"]').click()`);
  await wait(`document.querySelector('#competitionDetail [data-comp-action="verify"]')!==null`);
  await evaluate(`document.querySelector('#competitionDetail [data-comp-action="verify"]').click()`);
  assert.equal(await evaluate(`gateShowing()&&!document.getElementById('guestLoginScreen').classList.contains('hidden')&&document.getElementById('returnPhone').getBoundingClientRect().width>0`),true,'Verification opens returning-guest sign-in, not registration');
  assert.equal(errors.length,0,'Uncaught browser exceptions');
  console.log('PASS competition filters, voting/duplicate guard/retry, rankings, editor/group/contestant order, photo progress, draft/publish/pause, navigation preservation, voters/comments, duplication/deletion and admin guard (API mocked)');
};
