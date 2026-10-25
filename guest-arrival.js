/* Private arrival/seating channel. Never added to public guide knowledge. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id),card=$('guestArrivalCard'),panel=$('admin-panel-arrivals'),checkin=$('arrivalCheckinDialog'),adminCard=panel.querySelector('.arrival-admin');
  const adminHome=document.createComment('entrance admin home'),guestHome=document.createComment('guest pass home');adminCard.before(adminHome);card.before(guestHome);
  let checkinMode='',checkinReturn=null,checkinRun=0;
  let epoch=0,adminVersion=0,guestBusy=false,guestQueued=false,adminBusy=false,rows=[],selected=null,seatRevision=0,dirty=false,saving=false,passBusy=false,review=null,stream=null,scanEpoch=0,scanTimer=null,starting=false,torch=false,lastGuestKey='',notice=null,pendingNotice=null;
  const guestReady=()=>!!window.WeddingAccess?.canUse()&&WeddingAccess.isCheckedIn()&&WeddingAccess.isGuestApproved();
  const adminVisible=()=>isAdmin()&&!document.hidden&&(checkin.open?checkinMode==='scan'&&adminCard.parentElement===$('arrivalCheckinScannerHost'):!panel.classList.contains('hidden')&&!document.querySelector('[data-view="admin"]').classList.contains('hidden'));
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function say(id,text){$(id).textContent=text;}
  function clearPass(){const c=$('guestArrivalCanvas');c.getContext('2d').clearRect(0,0,c.width,c.height);$('guestArrivalQR').hidden=true;}
  function clearNotice(){notice?.remove();notice=null;pendingNotice=null;}
  function guestReset(){card.hidden=true;clearPass();clearNotice();lastGuestKey='';for(const id of ['guestArrivalMessage','guestArrivalTable','guestArrivalLocation','guestArrivalSpeaker','guestPassName','guestPassInitials','guestPassParty','guestPassConnection','guestPassRSVP','guestPassTableName','guestPassSeatNote','guestPassDirections'])say(id,'');for(const id of ['guestPassParty','guestPassConnection','guestPassRSVP','guestPassDirections'])$(id).hidden=true;delete $('guestPassRSVP').dataset.attending;$('guestPassViewLocation').disabled=true;$('guestPassViewLocation').setAttribute('aria-expanded','false');$('guestArrivalGuide').hidden=true;}
  function tableMessage(data){const seat=data.seating;if(!seat?.tableNumber)return 'Your table has not been assigned yet. Please ask an usher for help.';return 'Your table: '+seat.tableNumber+(seat.location?'\nLocation: '+seat.location:'\nPlease ask an usher for directions to your table.');}
  function showNotice(){
    if(!pendingNotice||notice||!guestReady()||document.hidden||window.__uploadsInFlight||document.querySelector('dialog[open],.activity-toast,.competition-toast,.sj-guide-alert,.sj-admin-companion-alert')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||['chat','gifts','livebroadcast','admin'].includes(currentView))return;
    const d=pendingNotice;pendingNotice=null;const name=d.side==='jossy'?'Jossy':'Sam';notice=el('aside');notice.className='arrival-toast arrival-toast--'+d.side;notice.setAttribute('role','status');notice.append(el('strong',name+' · Your entrance & table'),el('p','Your arrival is confirmed. '+tableMessage(d)));
    const open=el('button','View my table'),dismiss=el('button','Dismiss');open.type=dismiss.type='button';open.onclick=()=>{clearNotice();showAssistance();};dismiss.onclick=clearNotice;notice.append(open,dismiss);document.body.append(notice);
  }
  function renderGuest(data){
    card.hidden=false;$('guestArrivalPass').hidden=false;$('guestArrivalGuide').hidden=!data.arrival;
    say('guestPassName',data.name);const parts=data.name.trim().split(/\s+/);say('guestPassInitials',[parts[0],parts.length>1?parts[parts.length-1]:''].map(s=>Array.from(s)[0]||'').join('').toLocaleUpperCase());
    $('guestPassParty').hidden=!Number.isInteger(data.partySize);say('guestPassParty',Number.isInteger(data.partySize)?'Party size: '+data.partySize:'');$('guestPassConnection').hidden=!data.connection;say('guestPassConnection',data.connection?'Connection: '+data.connection:'');
    $('guestPassRSVP').hidden=typeof data.attending!=='boolean';$('guestPassRSVP').dataset.attending=String(data.attending);say('guestPassRSVP',data.attending?'✓ RSVP: ATTENDING':'RSVP: EXPLORING');
    const seat=data.arrival?data.seating:null,table=seat?.tableNumber||'',directions=seat?.location||'';say('guestPassTableName',table?(/^\d+$/.test(table)?'Table '+table:table):data.arrival?'See an usher':'After entrance check-in');say('guestPassSeatNote',table?'Your saved table assignment':data.arrival?'Your table has not been assigned yet.':'Your table will appear after your arrival is confirmed.');
    if($('guestPassDirections').textContent!==directions){$('guestPassDirections').hidden=true;$('guestPassViewLocation').setAttribute('aria-expanded','false');}say('guestPassDirections',directions);$('guestPassViewLocation').disabled=!table||!directions;
    if(!data.arrival){say('guestArrivalTitle','Your wedding entrance pass');say('guestArrivalMessage','Your registration is saved. Present your QR pass to the entrance admin to confirm your arrival. Your table will appear here after entrance check-in.');}
    else{
      if(!checkin.open||checkinMode!=='pass')clearPass();const name=data.side==='jossy'?'Jossy':'Sam';say('guestArrivalTitle','Welcome to the celebration');say('guestArrivalMessage','Entrance check-in confirmed. Your arrival is recorded once.');say('guestArrivalSpeaker',name+' · Your wedding companion');$('guestArrivalAvatar').src=data.side==='jossy'?'assets/guide-launcher-jossy.png':'assets/guide-launcher.png';say('guestArrivalTable',data.seating?.tableNumber?'Your table: '+data.seating.tableNumber:'Your table has not been assigned yet.');say('guestArrivalLocation',data.seating?.location?'Location: '+data.seating.location:'Please ask an usher '+(data.seating?.tableNumber?'for directions to your table.':'for help with your seat.'));
      const key=JSON.stringify([data.arrival.arrivedAt,data.seating,data.side]);if(lastGuestKey!==key){clearNotice();lastGuestKey=key;pendingNotice=data;showNotice();}
    }
  }
  async function refreshGuest(){
    if(!guestReady()){guestReset();return;}if(document.hidden||window.__uploadsInFlight)return;if(guestBusy){guestQueued=true;return;}guestBusy=true;const run=epoch;
    try{const d=await api('/guest-arrival');if(run!==epoch||!guestReady())return;if(!['sam','jossy'].includes(d.side)||!Object.hasOwn(d,'arrival'))throw Error('Invalid arrival response');renderGuest(d);}
    catch(error){if(run===epoch){guestReset();if(guestReady()){card.hidden=false;say('guestArrivalTitle','Your entrance & table');say('guestArrivalMessage',error.message||'Unable to confirm your arrival. Reconnect and refresh.');$('guestArrivalPass').hidden=true;}}}finally{guestBusy=false;if(guestQueued){guestQueued=false;queueMicrotask(refreshGuest);}}
  }
  async function showPass(){
    if(!guestReady()||passBusy)return;passBusy=true;$('guestArrivalPass').disabled=true;const run=epoch,portalRun=checkin.open?checkinRun:null;
    try{const d=await api('/guest-arrival/pass',{method:'POST'});if(run!==epoch||!guestReady()||portalRun!==null&&portalRun!==checkinRun)return;if(!/^SJ1-[a-f0-9]{64}$/.test(d.code))throw Error('Invalid pass response');const qr=qrcode(0,'M');qr.addData(d.code);qr.make();const count=qr.getModuleCount(),size=(count+8)*6,c=$('guestArrivalCanvas');c.width=c.height=size;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#000';for(let r=0;r<count;r++)for(let col=0;col<count;col++)if(qr.isDark(r,col))ctx.fillRect((col+4)*6,(r+4)*6,6,6);card.hidden=false;$('guestArrivalQR').hidden=false;}
    catch(error){if(run===epoch&&(portalRun===null||portalRun===checkinRun))say('guestArrivalMessage',error.message||'Pass could not load. Retry safely.');}finally{passBusy=false;$('guestArrivalPass').disabled=false;if(portalRun!==null&&portalRun!==checkinRun&&checkin.open&&checkinMode==='pass'&&guestReady()&&$('guestArrivalQR').hidden)queueMicrotask(showPass);}
  }
  function showAssistance(){if(!guestReady()){say('sjGuideStatus','Your own approved guest sign-in is needed to show your entrance pass and table.');return;}closeCheckIn();document.getElementById('sjGuideDialog')?.close();switchView('home');refreshGuest();card.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  function restoreCheckIn(){checkinRun++;checkinMode='';checkin.classList.remove('checkin-pass-view','pass-options-open');$('guestPassMore').setAttribute('aria-expanded','false');stopCamera();clearPass();review=null;$('arrivalScanReview').hidden=true;adminHome.after(adminCard);guestHome.after(card);$('arrivalCheckinScannerHost').hidden=true;$('arrivalCheckinPassHost').hidden=true;document.body.classList.remove('checkin-open');}
  function closeCheckIn(){if(checkin.open)checkin.close();restoreCheckIn();}
  async function chooseCheckIn(mode,{camera=false,manual=false}={}){
    if(checkin.open&&mode===checkinMode&&(mode==='pass'&&(passBusy||!$('guestArrivalQR').hidden)||mode==='scan'&&camera&&!manual&&!checkin.classList.contains('checkin-manual')&&(starting||stream)))return;
    if(!checkin.open)return;const run=++checkinRun;stopCamera();checkinMode=mode;clearPass();review=null;$('arrivalScanReview').hidden=true;checkin.scrollTop=0;
    checkin.classList.toggle('checkin-pass-view',mode==='pass'&&guestReady());checkin.classList.remove('pass-options-open');$('guestPassMore').setAttribute('aria-expanded','false');
    checkin.classList.toggle('checkin-manual',manual);$('arrivalCheckinManual').setAttribute('aria-pressed',String(manual));$('arrivalCheckinScan').setAttribute('aria-pressed',String(mode==='scan'&&!manual));$('arrivalCheckinPass').setAttribute('aria-pressed',String(mode==='pass'));
    $('arrivalCheckinScannerHost').hidden=true;$('arrivalCheckinPassHost').hidden=true;$('arrivalCheckinSignin').hidden=guestReady();$('arrivalCheckinAdmin').hidden=isAdmin();
    if(mode==='pass'){
      if(!guestReady()){say('arrivalCheckinStatus',WeddingAccess?.isCheckedIn()?'Waiting for admin approval. Your personal QR code becomes available after approval.':'Sign in or register first. Your personal QR code is available after admin approval.');return;}
      adminHome.after(adminCard);$('arrivalCheckinPassHost').append(card);$('arrivalCheckinPassHost').hidden=false;say('arrivalCheckinStatus','Present your personal QR code to the entrance admin. Please do not share it.');await refreshGuest();if(run!==checkinRun||!checkin.open||!guestReady())return;await showPass();
    }else{
      guestHome.after(card);
      if(!isAdmin()){say('arrivalCheckinStatus','The scanner and guest search are for entrance admins only. Select “Show My Check-In QR Code” to present your own pass, or sign in as an entrance admin.');return;}
      $('arrivalCheckinScannerHost').append(adminCard);$('arrivalCheckinScannerHost').hidden=false;say('arrivalCheckinStatus',manual?'Search for the guest below, verify their identity, then confirm arrival.':'Position the guest’s QR code inside the frame. Scanning previews the guest; confirm their arrival separately.');if(camera)startCamera();await refreshAdmin();if(run!==checkinRun||!checkin.open||!adminVisible())return;if(manual){$('arrivalSearch').scrollIntoView({block:'center'});$('arrivalSearch').focus();}
    }
  }
  function openCheckIn(){if(checkin.open)return;document.querySelectorAll('dialog[open]').forEach(d=>d.close());checkinReturn=document.activeElement;checkin.showModal();document.body.classList.add('checkin-open');chooseCheckIn(isAdmin()?'scan':guestReady()?'pass':'scan',{camera:isAdmin()});}
  checkin.addEventListener('close',()=>{if(checkin.open)return;restoreCheckIn();if(checkinReturn?.isConnected)checkinReturn.focus({preventScroll:true});});
  checkin.addEventListener('cancel',closeCheckIn);$('arrivalCheckinClose').onclick=closeCheckIn;
  $('arrivalCheckinScan').onclick=()=>chooseCheckIn('scan',{camera:true});$('arrivalCheckinManual').onclick=()=>chooseCheckIn('scan',{manual:true});$('arrivalCheckinPass').onclick=()=>{if(checkinMode==='pass'&&!$('guestArrivalQR').hidden)$('guestArrivalQR').scrollIntoView({block:'center',behavior:'instant'});else chooseCheckIn('pass');};
  $('guestPassMore').onclick=()=>{$('guestPassMore').setAttribute('aria-expanded',String(checkin.classList.toggle('pass-options-open')));};
  $('guestPassViewLocation').onclick=()=>{if($('guestPassViewLocation').disabled)return;$('guestPassDirections').hidden=!$('guestPassDirections').hidden;$('guestPassViewLocation').setAttribute('aria-expanded',String(!$('guestPassDirections').hidden));};
  $('guestPassEvents').onclick=()=>{if(guestReady()){closeCheckIn();switchView('events');}};$('guestPassHelp').onclick=showAssistance;
  $('arrivalCheckinSignin').onclick=async()=>{closeCheckIn();requireCheckIn();showGate(guestLoginScreen);try{const config=await loadOnboarding();showPane(config.otpRequired?'return':'form');}catch{showPane('return');}};
  $('arrivalCheckinAdmin').onclick=()=>{closeCheckIn();enterApp();switchView('adminlogin');};
  window.WeddingArrival={showAssistance,openCheckIn};
  $('guestArrivalPass').onclick=showPass;$('guestArrivalRefresh').onclick=refreshGuest;
  const guideButton=el('button','My entrance & table');guideButton.type='button';guideButton.onclick=showAssistance;document.querySelector('.sj-guide-chips')?.append(guideButton);
  function selectedRow(){return rows.find(g=>g.id===selected);}
  function fillSeat(){const g=selectedRow();$('arrivalSeatingForm').hidden=!g;if(!g)return;seatRevision=g.seating.revision;say('arrivalSelectedName',g.name);say('arrivalSelectedStatus',g.arrival?'Already checked in at '+new Date(g.arrival.arrivedAt).toLocaleString():g.status==='approved'?'Approved · not yet arrived':'Not approved · entrance check-in unavailable');$('arrivalTableNumber').value=g.seating.tableNumber;$('arrivalTableLocation').value=g.seating.location;$('arrivalConfirmManual').disabled=saving||g.status!=='approved'||!!g.arrival;dirty=false;}
  function renderList(){
    const query=$('arrivalSearch').value.trim().toLocaleLowerCase(),list=$('arrivalGuestList');list.replaceChildren();
    const matches=rows.filter(g=>(g.name+' '+g.phone).toLocaleLowerCase().includes(query));
    for(const g of matches.slice(0,100)){const b=el('button',g.name+' · '+(g.arrival?'Checked in':g.status==='approved'?'Not yet arrived':'Pending approval')+(g.seating.tableNumber?' · Table '+g.seating.tableNumber:''));b.type='button';b.onclick=()=>{if(saving)return;if(dirty&&!confirm('Discard this unsaved table assignment?'))return;selected=g.id;fillSeat();};list.append(b);}
    if(!matches.length)list.append(el('p','No registered guests match.'));if(matches.length>100)list.append(el('p','Showing the first 100 matches. Refine your search.'));
  }
  async function refreshAdmin(){
    if(!adminVisible()||adminBusy||saving||window.__uploadsInFlight)return;adminBusy=true;const run=epoch,version=adminVersion;
    try{const d=await api('/admin/arrivals',{admin:true});if(run!==epoch||version!==adminVersion||!isAdmin())return;rows=d.guests;const reconciled=uncertainGuest&&rows.find(g=>g.id===uncertainGuest&&g.arrival);if(reconciled){say('arrivalAdminStatus','Arrival verified — already checked in, no duplicate: '+reconciled.name);uncertainGuest=null;}const stats=$('arrivalStats');stats.replaceChildren();for(const [key,title]of [['checkedIn','Checked In'],['notYetArrived','Not Yet Arrived'],['totalApproved','Approved Guests']]){const p=el('p');p.append(el('strong',String(d.stats[key])),el('span',title));stats.append(p);}renderList();if(!dirty&&!saving)fillSeat();}
    catch(error){if(run===epoch)say('arrivalAdminStatus',error.message||'Unable to refresh registered guests.');}finally{adminBusy=false;}
  }
  $('arrivalSearch').oninput=renderList;$('arrivalAdminRefresh').onclick=refreshAdmin;
  $('arrivalSeatingForm').addEventListener('input',()=>{dirty=true;say('arrivalSeatStatus','Unsaved table assignment');});
  $('arrivalReloadSeat').onclick=()=>{if(!dirty||confirm('Discard your unsaved assignment and load the saved table?')){dirty=false;refreshAdmin();}};
  $('arrivalSeatingForm').onsubmit=async e=>{
    e.preventDefault();const g=selectedRow();if(!g||saving||!isAdmin())return;saving=true;adminVersion++;const run=epoch,body={tableNumber:$('arrivalTableNumber').value,location:$('arrivalTableLocation').value,expectedRevision:seatRevision};for(const control of $('arrivalSeatingForm').elements)control.disabled=true;
    try{const result=await api('/admin/arrivals/'+encodeURIComponent(g.id)+'/seating',{method:'PATCH',admin:true,body});if(run!==epoch||!isAdmin())return;if(!result?.seating||!Number.isInteger(result.seating.revision))throw Error('Save confirmation was invalid. Your draft is kept; reload to verify.');g.seating=result.seating;seatRevision=result.seating.revision;dirty=false;say('arrivalSeatStatus','Table assignment saved.');renderList();}
    catch(error){if(run===epoch)say('arrivalSeatStatus',error.message||'Could not confirm save. Your draft is kept; reload if the assignment changed.');}finally{saving=false;for(const control of $('arrivalSeatingForm').elements)control.disabled=false;const current=selectedRow();$('arrivalConfirmManual').disabled=!current||current.status!=='approved'||!!current.arrival;}
  };
  function stopCamera(){scanEpoch++;starting=false;clearTimeout(scanTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;$('arrivalVideo').srcObject=null;$('arrivalVideo').hidden=true;$('arrivalCameraStop').hidden=true;$('arrivalTorch').hidden=true;$('arrivalCameraStart').disabled=false;torch=false;}
  async function resolveCode(code){
    if(!isAdmin()||!adminVisible())return;if(!/^SJ1-[a-f0-9]{64}$/.test(code)){say('arrivalAdminStatus','This QR is not a valid wedding entrance pass.');return;}
    stopCamera();const run=epoch,scanRun=scanEpoch;review=null;$('arrivalScanReview').hidden=true;
    try{const result=await api('/admin/arrivals/resolve',{method:'POST',admin:true,body:{code}});if(run!==epoch||scanRun!==scanEpoch||!adminVisible())return;review={code,guest:result.guest};say('arrivalScanName',result.guest.name);say('arrivalScanDetails',(result.guest.arrival?'Already checked in. This scan will not add another arrival.':'Check the guest’s name before confirming entrance check-in.')+(result.guest.seating.tableNumber?'\nTable: '+result.guest.seating.tableNumber:'\nTable not assigned yet.'));$('arrivalScanReview').hidden=false;$('arrivalConfirmQR').disabled=!!result.guest.arrival;say('arrivalAdminStatus','Pass verified.');}
    catch(error){if(run===epoch)say('arrivalAdminStatus',error.message||'Pass could not be verified.');}
  }
  const scanCanvas=document.createElement('canvas'),ctx=scanCanvas.getContext('2d',{willReadFrequently:true});
  function decodeImage(source,width,height,max=1200){const scale=Math.min(1,max/Math.max(width,height));scanCanvas.width=Math.max(1,Math.round(width*scale));scanCanvas.height=Math.max(1,Math.round(height*scale));ctx.drawImage(source,0,0,scanCanvas.width,scanCanvas.height);const pixels=ctx.getImageData(0,0,scanCanvas.width,scanCanvas.height);return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data;}
  async function startCamera(){
    if(starting||stream||!adminVisible())return;stopCamera();starting=true;$('arrivalCameraStart').disabled=true;const run=scanEpoch;
    try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera scanning is unavailable. Use Scan QR image or manual check-in.');const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});if(run!==scanEpoch||!adminVisible()){next.getTracks().forEach(t=>t.stop());return;}stream=next;const video=$('arrivalVideo');video.srcObject=stream;video.hidden=false;await video.play();if(run!==scanEpoch||!adminVisible())return;starting=false;$('arrivalCameraStop').hidden=false;$('arrivalTorch').hidden=!stream.getVideoTracks()[0]?.getCapabilities?.().torch;say('arrivalAdminStatus','Scanner ready. No arrival is recorded until you confirm.');
      const tick=()=>{if(run!==scanEpoch||!stream||!adminVisible())return;try{if(video.readyState>=2){const code=decodeImage(video,video.videoWidth,video.videoHeight,640);if(code&&/^SJ1-[a-f0-9]{64}$/.test(code)){resolveCode(code);return;}}}catch{say('arrivalAdminStatus','Could not read this frame. Try a clearer QR image or manual check-in.');}scanTimer=setTimeout(tick,220);};tick();
    }catch(error){if(run===scanEpoch){stopCamera();say('arrivalAdminStatus',error.name==='NotAllowedError'?'Camera permission denied. Allow access and retry, or scan an image / check in manually.':error.message||'Camera could not start.');}}
  }
  $('arrivalCameraStart').onclick=startCamera;$('arrivalCameraStop').onclick=stopCamera;
  $('arrivalTorch').onclick=async()=>{const track=stream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;say('arrivalAdminStatus',torch?'Flashlight on.':'Flashlight off.');}catch{say('arrivalAdminStatus','Flashlight is not supported on this camera.');}};
  $('arrivalImage').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file||!adminVisible())return;stopCamera();const run=epoch,imageRun=scanEpoch;let image;
    try{if(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP QR image up to 8 MB.');image=await createImageBitmap(file);if(image.width*image.height>24000000)throw Error('Choose a QR image smaller than 24 megapixels.');const code=decodeImage(image,image.width,image.height);if(run!==epoch||imageRun!==scanEpoch||!adminVisible())return;if(!code)throw Error('No readable QR found. Try a clear, uncropped pass image.');await resolveCode(code);}
    catch(error){if(run===epoch)say('arrivalAdminStatus',error.message||'Image could not be read. Use camera or manual check-in.');}finally{image?.close();}
  };
  let confirming=false,uncertainGuest=null;
  async function confirmArrival(body,button){
    if(confirming||!adminVisible())return;confirming=true;button.disabled=true;const run=epoch;
    try{const result=await api('/admin/arrivals/confirm',{method:'POST',admin:true,body});if(run!==epoch||!isAdmin())return;if(!result?.guest?.arrival)throw Error('No valid arrival confirmation received. Retry safely.');adminVersion++;const index=rows.findIndex(g=>g.id===result.guest.id);if(index>=0)rows[index]=result.guest;renderList();if(!dirty)fillSeat();say('arrivalAdminStatus',(result.alreadyCheckedIn?'Already checked in — no duplicate arrival. ':'Entrance check-in confirmed. ')+result.guest.name);review=null;$('arrivalScanReview').hidden=true;await refreshAdmin();}
    catch(error){if(run===epoch){uncertainGuest=body.guestId||review?.guest?.id||null;say('arrivalAdminStatus',(error.message||'No confirmation received.')+' Refresh the guest list to verify, or retry safely; arrival cannot count twice.');}}finally{confirming=false;button.disabled=button===$('arrivalConfirmManual')?!!selectedRow()?.arrival:false;}
  }
  $('arrivalConfirmQR').onclick=()=>{if(review)confirmArrival({code:review.code},$('arrivalConfirmQR'));};
  $('arrivalConfirmManual').onclick=()=>{const g=selectedRow();if(g&&g.status==='approved'&&confirm('Confirm '+g.name+' has arrived at the entrance?'))confirmArrival({guestId:g.id},$('arrivalConfirmManual'));};
  $('arrivalScanCancel').onclick=()=>{stopCamera();review=null;$('arrivalScanReview').hidden=true;say('arrivalAdminStatus','Scan cancelled; no arrival recorded.');};
  function reset(){epoch++;closeCheckIn();guestReset();stopCamera();review=null;uncertainGuest=null;rows=[];selected=null;dirty=false;$('arrivalSeatingForm').hidden=true;$('arrivalSeatingForm').reset();$('arrivalGuestList').replaceChildren();$('arrivalStats').replaceChildren();$('arrivalScanReview').hidden=true;$('arrivalSearch').value='';say('arrivalAdminStatus','');say('arrivalScanName','');say('arrivalScanDetails','');say('arrivalSelectedName','');say('arrivalSelectedStatus','');say('arrivalSeatStatus','');}
  window.addEventListener('wedding:guest-session',()=>{reset();refreshGuest();});
  window.addEventListener('wedding:session-state',()=>{epoch++;if(!guestReady())guestReset();else refreshGuest();if(checkin.open&&(!WeddingAccess.canUse()||checkinMode==='scan'&&!isAdmin())){closeCheckIn();}});
  window.addEventListener('wedding:view',()=>{if(checkin.open)closeCheckIn();if(!adminVisible())stopCamera();refreshGuest();refreshAdmin();showNotice();});
  new MutationObserver(()=>{if(!adminVisible())stopCamera();else refreshAdmin();}).observe(panel,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else{refreshGuest();refreshAdmin();showNotice();}});
  window.addEventListener('pagehide',stopCamera);window.addEventListener('beforeunload',e=>{if(dirty&&isAdmin()){e.preventDefault();e.returnValue='';}});
  let authToken;onAdminAuth(()=>{if(authToken===adminToken)return;authToken=adminToken;reset();refreshGuest();refreshAdmin();});
  setInterval(()=>{refreshGuest();refreshAdmin();showNotice();},15000);refreshGuest();
})();
