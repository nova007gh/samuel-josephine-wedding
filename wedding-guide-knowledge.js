/* Shared, deterministic local search. No models, network calls or conversation storage. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WeddingGuideKnowledge=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=(v,n=1800)=>typeof v==='string'?v.trim().slice(0,n):'';
  const photo=v=>/^\/uploads\/[\w.-]+\.(?:jpe?g|png|webp)$/i.test(v||'')?v:'';
  function json(s,fallback){try{return JSON.parse(s)||fallback;}catch{return fallback;}}
  const tokens=s=>clean(s,600).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  const stop=new Set('a an the of to is are do does i we you my me can could please tell about how what where when who and for in on it this that all know show want'.split(' '));
  function day(value){
    const m=clean(value,180).match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);if(!m)return '';
    const at=Date.parse(m[1]+'T00:00:00Z');return Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===m[1]?m[1]:'';
  }
  function programmeDay(label){
    if(day(label))return day(label);
    const m=clean(label,180).match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2}),?\s+(\d{4})\b/i);if(!m)return '';
    const month='JANUARY FEBRUARY MARCH APRIL MAY JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER'.split(' ').indexOf(m[1].toUpperCase())+1;
    return day(m[3]+'-'+String(month).padStart(2,'0')+'-'+m[2].padStart(2,'0'));
  }
  function startsAt(date,time){
    if(!day(date))return null;
    const s=clean(time,160),m=s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);if(!m||(!m[2]&&!m[3]))return null;
    const tail=s.slice(m[0].length).trim();if(tail&&!/^(?:[-–—]|till\b|until\b|to\b)/i.test(tail))return null;
    let h=+m[1],min=+(m[2]||0);if(min>59||(m[3]?(h<1||h>12):h>23))return null;
    if(m[3])h=h%12+(/pm/i.test(m[3])?12:0);
    return Date.parse(date+'T'+String(h).padStart(2,'0')+':'+String(min).padStart(2,'0')+':00Z');
  }
  const validAt=v=>Number.isSafeInteger(v)&&v>=Date.UTC(2020,0,1)&&v<Date.UTC(2100,0,1);
  function build(s,now=Date.now()){
    const cards=[],activities=[],hero=photo(s.couplePhotoUrl)||photo(s['photo:sam-adult']);
    function add(id,title,text,view,keywords='',image=hero){cards.push({id,title:clean(title,160),text:clean(text,3000),view,keywords,image:photo(image)});}
    add('welcome','Meet your S&J Guide','I am a locally built knowledge guide, not a generative AI. I search published wedding details and app instructions. I cannot see private guest records, private conversations, payment status or the couple’s unpublished plans. For unconfirmed details, ask the hosts.','home','help assistant guide ai privacy');
    const date=day(s.weddingDateISO),dateLabel=date?new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'Africa/Accra'}).format(new Date(date+'T00:00:00Z')):'';
    const facts=[clean(s.weddingFormal,200),dateLabel?'Published wedding date: '+dateLabel:'',s.weddingVenue?'Venue: '+clean(s.weddingVenue,300):'',s.weddingHashtag?'Hashtag: '+clean(s.weddingHashtag,120):''].filter(Boolean);
    add('wedding','Wedding details',facts.length?facts.join('\n'):'The hosts have not published wedding date or venue details for the guide yet. Please check Home or Events.','events','date venue location address married marriage sam samuel josephine jossy wedding');
    add('story','Sam & Jossy’s story',clean(s.storyText,3000)||'Read the couple’s published story on Our Story. I do not know their private history or plans.','story','couple met love relationship history');
    const moments=json(s.storyItems,[]);
    if(Array.isArray(moments))moments.slice(0,40).forEach((m,i)=>{if(m&&clean(m.title,160))add('story-'+i,clean(m.title,160),[m.m,m.d,m.y].map(v=>clean(v,40)).filter(Boolean).join(' ')+'\n'+clean(m.text,1800),'story','couple story history relationship');});
    add('rsvp','RSVP and guest sign-in','Open RSVP to submit your attendance. '+(s.rsvpDeadline?'Published RSVP deadline: '+clean(s.rsvpDeadline,160)+'. ':'')+'Guest verification uses a one-time code. Opening the guide does not send a code. If a code does not arrive, check your contact details and contact the hosts; do not share your code.','rsvp','attend attending invitation register otp login sign verification code email sms');
    add('gallery','Photos and memories','Open Gallery to see published photos. Share Moments and Share Memories are inside Gallery, not the bottom bar. Uploads may need host approval. Keep the app open until an upload completes; avoid submitting it again while it is pending.','gallery','upload share picture selfie video memories camera');
    add('voice','Voice messages','Open Voice Messages to record a memory. Allow microphone access when asked. Recordings may need host approval before publication.','voicemsg','microphone audio record recording');
    add('video','Video messages','Open Video Messages to record or upload a wedding message. Allow camera and microphone permissions when needed and wait for upload confirmation.','videomsg','camera recording record');
    add('chat','Wedding Chat','Open Events → Entertainment → Wedding Chat. Chat requires a server-verified guest sign-in or an admin session. Guest messages need host approval before appearing to everyone. You can react, search, attach supported files and open competitions from Polls. The guide does not read chat messages.','chat','message pending approval moderation poll friends');
    add('gifts','Cash Gifts for Sam and Jossy','Open Gifts for the couple’s published MoMo number and account name. Send directly through your own MoMo app or official menu and confirm the recipient before sending. Automatic payment APIs have been removed. An optional gift report is not proof of payment. The guide cannot check balances, verify transfers or request your PIN.','gifts','cash money momo mobile transfer pay payment donate donation fund');
    add('games','Games and competitions','Open Games to see published competitions and eligibility rules. Verify guest sign-in if required. Draft competitions and private votes are not part of this guide.','competitions','vote voting game competition polls prizes');
    add('otp-help','Entry code not arriving?','Check the phone country code or email address you entered. Use the resend or available delivery options on the verification screen, and check email spam/junk. Wait for the resend countdown rather than requesting several codes. Provider acceptance does not prove a code reached your phone. If it still fails, ask the hosts for help. Never share your OTP.','chat','otp code verification login signin sign in missing received arriving delivery failed problem');
    add('upload-help','Upload or camera trouble','Check your connection and camera/photo permissions. Keep the app open until the upload confirms completion. Do not submit the same file again while an upload is still running. If an upload succeeded but is not public, it may be waiting for host approval. Use Gallery to review the available sharing options.','gallery','upload failed stuck progress error camera permission pending approval problem');
    add('watch-help','Broadcast picture or sound trouble','Open Live Broadcast and check whether the hosts have published a stream. Tap play and unmute the player; mobile browsers may require a tap before audio plays. Try the player’s retry or provider fallback if available. An announced start time does not prove the camera signal is live.','livebroadcast','stream video sound audio muted buffering playback failed error problem watch');
    add('install','Keep the app on your home screen','iPhone/iPad: open this site in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome and choose Install app or Add to Home screen from the menu. Availability depends on your browser. No app-store download is required.','home','install download iphone android safari chrome homescreen app');
    add('reminders','Activity reminders','In this guide, expand Privacy & activity reminders and enable reminders for this device. They appear only while the app is open and visible, near published activity times or a host-marked live broadcast. Reminders are optional and do not send SMS, email or background notifications. A reminder does not confirm that an activity has actually started. Turn the option off at any time.','home','alert alerts reminder reminders notification notifications activities');
    add('navigation','Finding your way','The bottom bar has Our Story, Events, Gallery, Bridal Train and Gifts. Open Events for Live Broadcast and Entertainment; Wedding Chat is inside Entertainment. Tap the app’s header logo to return Home. Gallery contains Share Moments and Share Memories. Tap a card in this guide to open its page.','home','tabs menu navigation app features use help');
    add('guestbook','Guest Book','Leave a wedding wish in Guest Book. Messages may need host approval before they appear publicly.','guestbook','wishes wish congratulations blessing');
    add('train','Bridal Train','Meet the published bridal party in Bridal Train. Only profiles saved by the hosts are confirmed; the guide does not have private contacts or guest lists.','bridaltrain','bridesmaids bridesmaid groomsmen groomsman bridal party');
    const train=json(s.bridalTrain,{});
    for(const group of ['bridesmaids','groomsmen'])if(Array.isArray(train[group]))train[group].slice(0,30).forEach((p,i)=>{
      if(p&&clean(p.name,120))add('train-'+group+'-'+i,clean(p.name,120),clean(p.role,100)||group,'bridaltrain','bridal train party '+group,photo(p.photoUrl)||hero);
    });
    for(const key of ['receptionProgram','engagementProgram']){
      const p=json(s[key],{});if(!Array.isArray(p.items))continue;
      add(key,clean(p.title,120)||'Wedding programme',[p.dateLabel,p.timeLabel,p.hosts,...p.items.slice(0,40).filter(Boolean).map(r=>[r.time,r.title,r.details].filter(Boolean).join(' — '))].map(v=>clean(v,600)).filter(Boolean).join('\n'),key==='receptionProgram'?'program':'engagementprogram','schedule programme program reception traditional engagement order activities');
      const pd=programmeDay(p.dateLabel),view=key==='receptionProgram'?'program':'engagementprogram';
      if(clean(p.hosts,300))add(key+'-hosts','Published '+(view==='program'?'reception':'engagement')+' hosts and MCs',clean(p.hosts,300),view,'hosts mc emcee host');
      p.items.slice(0,40).forEach((r,i)=>{
        if(!r||!clean(r.title,180))return;
        const id=key+'-'+i,title=clean(r.title,180),time=clean(r.time,40),at=startsAt(pd,time);
        const text=[clean(p.dateLabel,160)||'Date not confirmed',time?time+' · Ghana time (GMT)':'Time not confirmed',clean(r.details,600)].filter(Boolean).join('\n');
        add(id,title,text,view,'schedule programme activity '+(view==='program'?'reception':'engagement'));
        if(at!==null)activities.push({id,title,text,view,image:hero,at,version:String(at)+title});
      });
    }
    const events=json(s.events,[]);
    if(Array.isArray(events))events.slice(0,40).forEach((e,i)=>{
      if(!e||!clean(e.name,120))return;
      const title=clean(e.name,120),time=clean(e.time,100);add('event-'+i,title,[dateLabel,time?time+' · Ghana time (GMT)':'',e.location,e.description].map(v=>clean(v,600)).filter(Boolean).join(' — ')||'See Events for published details.','events','schedule time starts wedding activities');
      const at=startsAt(date,time);
      if(at!==null)activities.push({id:'event-'+i,title,text:time+' · Ghana time (GMT)',view:'events',image:hero,at,version:String(at)+title});
    });
    const b=json(s.liveBroadcast,{});
    add('broadcast','Live Broadcast',b.status==='live'&&b.streamUrl?'The hosts have marked the broadcast live. Open Live Broadcast to watch; playback still depends on the provider signal.':b.status==='scheduled'&&validAt(b.startsAt)?'The broadcast is scheduled for '+new Date(b.startsAt).toISOString()+'. Open Live Broadcast for player and schedule.':b.status==='ended'?'The broadcast has ended. Check Live Broadcast for any published replays.':'No live broadcast has been confirmed yet. Check Live Broadcast for updates.','livebroadcast','stream streaming watch online youtube vimeo replay live',photo(b.posterUrl)||hero);
    if(b.status==='live'&&b.streamUrl)activities.push({id:'broadcast',title:'The broadcast is live',text:'Marked live by the hosts. Tap to watch in the app.',view:'livebroadcast',image:photo(b.posterUrl)||hero,at:null,live:true,version:clean(b.streamUrl,2000)});
    const acts=json(s.entertainment,{}).acts;
    add('entertainment','Entertainment',Array.isArray(acts)&&acts.length?'The published lineup is listed below. Open Entertainment for photos, social links and details.':'No separate Entertainment lineup has been saved yet. The published reception programme may still name performances; use its source page for those plans.','entertainment','performer music dj singer band mc lineup performance');
    if(Array.isArray(acts))acts.slice(0,30).forEach(a=>{
      if(!a||typeof a!=='object')return;
      const at=validAt(a.startsAt)?a.startsAt:null;
      add('act-'+clean(a.id,80),clean(a.name,120),[a.category,a.description,at?'Scheduled: '+new Date(at).toISOString():'Performance time not confirmed',a.duration].map(v=>clean(v,650)).filter(Boolean).join('\n'),'entertainment','performer music lineup '+clean(a.category,40),photo(a.photoUrl)||hero);
      if(at!==null)activities.push({id:'act-'+clean(a.id,80),title:clean(a.name,120),text:'Scheduled performance · '+new Date(at).toISOString(),view:'entertainment',image:photo(a.photoUrl)||hero,at,version:String(at)+clean(a.name,120)});
    });
    return {mode:'local-knowledge-guide',generatedAt:now,cards,activities:activities.filter(a=>a.live||a.at>=now-20*60000).sort((a,b)=>(a.at||now)-(b.at||now)).slice(0,100)};
  }
  const aliases={pics:'photo',pic:'photo',photos:'photo',pictures:'photo',picture:'photo',photographs:'photo',photograph:'photo',selfies:'selfie',uploads:'upload',uploading:'upload',sharing:'share',messages:'message',messaging:'chat',charts:'chat',chats:'chat',gifting:'gift',gifts:'gift',donations:'gift',donation:'gift',donate:'gift',paying:'payment',pay:'payment',paid:'payment',momo:'payment',money:'payment',programme:'program',programmes:'program',programs:'program',schedules:'schedule',activities:'activity',events:'event',games:'game',voting:'vote',votes:'vote',polls:'poll',livestream:'broadcast',livestreaming:'broadcast',streaming:'broadcast',stream:'broadcast',performers:'performer',artists:'performer',musicians:'performer',bookings:'performer',bridesmaids:'bridesmaid',groomsmen:'groomsman',directions:'venue',location:'venue',address:'venue',wifi:'connection',signin:'login',verification:'otp',otp:'otp',codes:'code',installing:'install',download:'install',reels:'video',videos:'video',recordings:'record',recording:'record'};
  Object.assign(aliases,{send:'share',sending:'share',memories:'memory',wishes:'wish',starts:'time',start:'time',performance:'performer',performances:'performer',artist:'performer',mcs:'mc',emcee:'mc',hosts:'host',alerts:'reminder',alert:'reminder',reminders:'reminder',notifications:'reminder',notification:'reminder'});
  const filler=new Set('be been am was will should would may must there here s j us our your their its it that this those them they more again also just really much have has had get find need like does join happen happening not cant cannot isnt arent dont why which someone anyone work working play'.split(' '));
  const words=s=>tokens(s).filter(t=>!stop.has(t)&&!filler.has(t)).map(t=>aliases[t]||t);
  function near(a,b){
    if(a.length<4||b.length<4||Math.abs(a.length-b.length)>1)return false;
    if(a.length===b.length){const diff=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])diff.push(i);return diff.length===1||(diff.length===2&&diff[1]===diff[0]+1&&a[diff[0]]===b[diff[1]]&&a[diff[1]]===b[diff[0]]);}
    if(a.length>b.length)[a,b]=[b,a];let i=0,j=0,skips=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{skips++;j++;if(skips>1)return false;}}return true;
  }
  const indexes=new WeakMap();
  function index(data){
    if(indexes.has(data))return indexes.get(data);
    const df=new Map(),vocabulary=new Set(),rows=(data.cards||[]).map(c=>{
      const title=new Set(words(c.title)),tags=new Set(words(c.keywords)),body=new Set(words(c.text));
      for(const t of new Set([...title,...tags,...body])){df.set(t,(df.get(t)||0)+1);vocabulary.add(t);}return {c,title,tags,body};
    });const value={df,vocabulary:[...vocabulary].slice(0,5000),rows};indexes.set(data,value);return value;
  }
  const starter=['Wedding date and venue','Full reception programme','How do I upload photos?','How do I join Chat?'];
  function followups(cards){
    const view=cards[0]?.view;
    if(view==='program'||view==='events'||view==='engagementprogram')return ['What time is it?','Full reception programme','Watch live broadcast'];
    if(view==='gallery')return ['My upload is stuck','How do I record a voice message?','How do I join Chat?'];
    if(view==='chat')return ['My entry code is not arriving','How do I upload photos?','Games and competitions'];
    if(view==='livebroadcast')return ['I cannot hear the broadcast','Full reception programme','How do I upload photos?'];
    return starter;
  }
  function answer(data,question,context={}){
    const raw=clean(question,400);
    const help=/\b(?:not|never|isn.t|haven.t|didn.t|cannot|can.t|missing|fail\w*|trouble|problem|arriv\w*|receiv\w*|resend)\b/i.test(raw);
    if(/\b(?:passwords?|pin|secrets?|balances?|guest list|phone numbers?|private|payment status)\b/i.test(raw)||(!help&&/\b(?:show|reveal|read|tell|what is|give)\b.*\b(?:otp|entry|verification) code\b/i.test(raw)))return {text:'I cannot access private guest details, codes, credentials, chats or payment status. Please use the relevant app page or contact the hosts.',cards:[],suggestions:starter};
    if(/^(?:hi|hey|hello|good morning|good afternoon|good evening|thanks|thank you)[!.,\s]*$/i.test(raw))return {text:/thank/i.test(raw)?'You’re welcome! What else would you like to explore?':'Hello! I can help with the wedding date and venue, the programme, sharing memories, Chat and watching live. Choose a question below or ask in your own words.',cards:[],suggestions:starter};
    const previous=(context.ids||[]).map(id=>(data.cards||[]).find(c=>c.id===id)).filter(Boolean).slice(0,3);
    const referential=/^(?:(?:and|so)\s+)?(?:what time is (?:it|that)|when is (?:it|that)|where is (?:it|that)|tell me more|more details|how (?:do|can) i (?:open|find|use) (?:it|that))\??$/i.test(raw);
    if(referential){if(previous.length)return {text:/open|find|use/i.test(raw)?'Use the Open link on the source card below to go there in the app.':'Here are the published details for '+previous[0].title+'. If a specific time or location is not listed, I cannot confirm it.',cards:previous,suggestions:followups(previous),contextIds:previous.map(c=>c.id)};return {text:'Which activity or app feature do you mean? Ask for it by name, or choose one below.',cards:[],suggestions:starter};}
    if(/\b(?:what|which|show|any)\b.*\b(?:today|tonight|now|next|upcoming)\b|\b(?:next|upcoming) (?:activities|activity|events|event)\b/i.test(raw)){
      const now=validAt(context.now)?context.now:Date.now(),ghanaDay=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Accra',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
      const today=/\b(?:today|tonight)\b/i.test(raw),tonight=/\btonight\b/i.test(raw),current=/\bnow\b/i.test(raw);
      const activities=(data.activities||[]).filter(a=>a.live||(validAt(a.at)&&(today?ghanaDay(a.at)===ghanaDay(now)&&(!tonight||new Date(a.at).getUTCHours()>=17):current?a.at<=now&&a.at>=now-20*60000:a.at>=now))).slice(0,3);
      const cards=activities.map(a=>(data.cards||[]).find(c=>c.id===a.id)).filter(Boolean);
      const period=tonight?'this evening in Ghana (GMT, from 5 PM)':'today in Ghana (GMT)';
      const text=cards.length?(today?'These are published scheduled activities for '+period+'.':current?'These starts are scheduled near now, or marked live by the hosts.':'These are the next published scheduled activities.')+' A schedule is not confirmation of actual activity progress.':'I found no '+(today?'timed activities scheduled for '+period:current?'new scheduled starts within the last 20 minutes or host-marked live broadcasts':'upcoming timed activities')+'. You can still browse the full programme; I cannot confirm what is happening in person.';
      return {text,cards,suggestions:['Full reception programme','Wedding date and venue','Watch live broadcast'],contextIds:cards.map(c=>c.id)};
    }
    if(/\b(?:what can you do|help me|what is this app|how does (?:this|the) app work)\b/i.test(raw)){const cards=(data.cards||[]).filter(c=>c.id==='navigation');return {text:'I can help you explore the celebration and find your way around the app. My answers come from published information, not private guest records.',cards,suggestions:starter,contextIds:cards.map(c=>c.id)};}
    const idx=index(data),q=[...new Set(words(raw))],corrections=[];
    if(/\bwhere\b/i.test(raw)&&/\bwedding\b/i.test(raw))q.push('venue');
    if(/\bwhen\b/i.test(raw)&&/\bwedding\b/i.test(raw)&&!/(reception|party|ceremony)/i.test(raw))q.push('date');
    if(help&&/\b(?:otp|code)\b/i.test(raw))q.push('otp','delivery');
    if(help&&/\b(?:hear|sound|audio|buffering)\b/i.test(raw))q.push('sound','playback');
    for(let i=0;i<q.length;i++)if(!idx.df.has(q[i])){
      const candidates=[...new Set([...idx.vocabulary,...Object.keys(aliases)].filter(t=>near(q[i],t)).map(t=>aliases[t]||t))];
      if(candidates.length===1){corrections.push(q[i]+' → '+candidates[0]);q[i]=candidates[0];}
    }
    const terms=[...new Set(q)];
    const scores=idx.rows.map(row=>{
      let score=0,hits=0,strong=0;
      for(const t of terms){const weight=row.title.has(t)?6:row.tags.has(t)?4:row.body.has(t)?1.5:0;if(!weight)continue;hits++;if(weight>=4)strong++;score+=weight*(1+Math.log((idx.rows.length+1)/((idx.df.get(t)||0)+1)));}
      if(help&&row.c.id.endsWith('-help'))score*=1.25;
      // Prefer the full programme only when explicitly requested, not for a named activity.
      if(/\b(?:full|entire|complete|all)\b/i.test(raw)&&/\b(?:programme?|schedule|lineup|activities)\b/i.test(raw)&&['receptionProgram','engagementProgram'].includes(row.c.id))score+=35;
      return {...row,score,hits,strong};
    }).filter(r=>r.score>=5&&(r.strong||r.hits>=2||(/\bwho\b/i.test(raw)&&terms.length===1))&&r.hits>=Math.min(2,terms.length)).sort((a,b)=>b.score-a.score);
    const cards=scores.filter(r=>r.score>=scores[0].score*.7).slice(0,3).map(r=>r.c);
    return cards.length?{text:'Here is the published information for '+cards[0].title+'. Open the source page for current details.',cards,suggestions:followups(cards),contextIds:cards.map(c=>c.id),corrections}:{text:'I do not have a confirmed answer to that. Try the name of an activity or feature, or choose a question below. For unpublished plans, please ask the hosts.',cards:[],suggestions:starter};
  }
  return {build,answer,photo,startsAt,programmeDay};
});
