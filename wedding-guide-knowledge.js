/* Shared, deterministic local search. No models, network calls or conversation storage. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WeddingGuideKnowledge=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clean=(v,n=1800)=>typeof v==='string'?v.trim().slice(0,n):'';
  const photo=v=>/^\/uploads\/[\w.-]+\.(?:jpe?g|png|webp)$/i.test(v||'')?v:'';
  function json(s,fallback){try{return JSON.parse(s)||fallback;}catch{return fallback;}}
  const tokens=s=>clean(s,600).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  const stop=new Set('a an the of to is are do does i we you my me can could please tell about how what where when who and for in on it this that all know show want'.split(' '));
  function build(s,now=Date.now()){
    const cards=[],activities=[],hero=photo(s.couplePhotoUrl)||photo(s['photo:sam-adult']);
    function add(id,title,text,view,keywords='',image=hero){cards.push({id,title:clean(title,160),text:clean(text,3000),view,keywords,image:photo(image)});}
    add('welcome','Meet your S&J Guide','I am a locally built knowledge guide, not a generative AI. I search published wedding details and app instructions. I cannot see private guest records, private conversations, payment status or the couple’s unpublished plans. For unconfirmed details, ask the hosts.','home','help assistant guide ai privacy');
    const facts=[clean(s.weddingFormal,200),s.weddingDateISO?'Published wedding date: '+clean(s.weddingDateISO,80):'',s.weddingVenue?'Venue: '+clean(s.weddingVenue,300):'',s.weddingHashtag?'Hashtag: '+clean(s.weddingHashtag,120):''].filter(Boolean);
    add('wedding','Wedding details',facts.length?facts.join('\n'):'The hosts have not published wedding date or venue details for the guide yet. Please check Home or Events.','events','date venue location address married marriage sam samuel josephine jossy wedding');
    add('story','Sam & Jossy’s story',clean(s.storyText,3000)||'Read the couple’s published story on Our Story. I do not know their private history or plans.','story','couple met love relationship history');
    const moments=json(s.storyItems,[]);
    if(Array.isArray(moments))moments.slice(0,40).forEach((m,i)=>{if(m&&clean(m.title,160))add('story-'+i,clean(m.title,160),[m.m,m.d,m.y].map(v=>clean(v,40)).filter(Boolean).join(' ')+'\n'+clean(m.text,1800),'story','couple story history relationship');});
    add('rsvp','RSVP and guest sign-in','Open RSVP to submit your attendance. '+(s.rsvpDeadline?'Published RSVP deadline: '+clean(s.rsvpDeadline,160)+'. ':'')+'Guest verification uses a one-time code. Opening the guide does not send a code. If a code does not arrive, check your contact details and contact the hosts; do not share your code.','rsvp','attend attending invitation register otp login sign verification code email sms');
    add('gallery','Photos and memories','Open Gallery to see published photos. Share Moments and Share Memories are inside Gallery, not the bottom bar. Uploads may need host approval. Keep the app open until an upload completes; avoid submitting it again while it is pending.','gallery','upload share picture selfie video memories camera');
    add('voice','Voice messages','Open Voice Messages to record a memory. Allow microphone access when asked. Recordings may need host approval before publication.','voicemsg','microphone audio record recording');
    add('video','Video messages','Open Video Messages to record or upload a wedding message. Allow camera and microphone permissions when needed and wait for upload confirmation.','videomsg','camera recording record');
    add('chat','Wedding Chat','Wedding Chat requires a server-verified guest sign-in or an admin session. Guest messages need host approval before appearing to everyone. You can react, search, attach supported files and open competitions from Polls. The guide does not read chat messages.','chat','message pending approval moderation poll friends');
    add('gifts','Gifts and Cash Gifts','Open Gifts to view the published NOVA1 and Cash Gifts options. Use only payment instructions shown there. A checkout screen or redirect is not proof of payment. The guide cannot check balances, verify a payment, request your PIN or confirm a gift.','gifts','cash money momo mobile transfer pay payment speso nova1 donate donation fund');
    add('games','Games and competitions','Open Games to see published competitions and eligibility rules. Verify guest sign-in if required. Draft competitions and private votes are not part of this guide.','competitions','vote voting game competition polls prizes');
    add('navigation','Finding your way','The bottom bar has Home, Story, Events, Bridal Train, Gallery, Live Broadcast, Gifts, Chat and Entertainment. Gallery contains Share Moments and Share Memories. Tap a card in this guide to open its page.','home','tabs menu navigation app features use help');
    add('guestbook','Guest Book','Leave a wedding wish in Guest Book. Messages may need host approval before they appear publicly.','guestbook','wishes wish congratulations blessing');
    add('train','Bridal Train','Meet the published bridal party in Bridal Train. Only profiles saved by the hosts are confirmed; the guide does not have private contacts or guest lists.','bridaltrain','bridesmaids bridesmaid groomsmen groomsman bridal party');
    const train=json(s.bridalTrain,{});
    for(const group of ['bridesmaids','groomsmen'])if(Array.isArray(train[group]))train[group].slice(0,30).forEach((p,i)=>{
      if(p&&clean(p.name,120))add('train-'+group+'-'+i,clean(p.name,120),clean(p.role,100)||group,'bridaltrain','bridal train party '+group,photo(p.photoUrl)||hero);
    });
    for(const key of ['receptionProgram','engagementProgram']){
      const p=json(s[key],{});if(!Array.isArray(p.items))continue;
      add(key,clean(p.title,120)||'Wedding programme',[p.dateLabel,p.timeLabel,p.hosts,...p.items.slice(0,40).filter(Boolean).map(r=>[r.time,r.title,r.details].filter(Boolean).join(' — '))].map(v=>clean(v,600)).filter(Boolean).join('\n'),key==='receptionProgram'?'program':'engagementprogram','schedule programme program reception traditional engagement order activities');
    }
    const events=json(s.events,[]),date=clean(s.weddingDateISO,40).match(/^(\d{4}-\d{2}-\d{2})/);
    if(Array.isArray(events))events.slice(0,40).forEach((e,i)=>{
      if(!e||!clean(e.name,120))return;
      const title=clean(e.name,120),time=clean(e.time,100);add('event-'+i,title,[time,e.location,e.description].map(v=>clean(v,600)).filter(Boolean).join(' — ')||'See Events for published details.','events','schedule time starts ceremony reception traditional white wedding activities');
      const m=time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);let at=null;
      if(date&&m){let h=+m[1];const min=+m[2];if(min<60&&((m[3]&&h>=1&&h<=12)||(!m[3]&&h<=23))){if(m[3])h=h%12+(/pm/i.test(m[3])?12:0);const v=Date.parse(date[1]+'T'+String(h).padStart(2,'0')+':'+m[2]+':00Z');if(Number.isFinite(v))at=v;}}
      if(at!==null)activities.push({id:'event-'+i,title,text:time+' · Ghana time (GMT)',view:'events',image:hero,at,version:String(at)+title});
    });
    const b=json(s.liveBroadcast,{});
    add('broadcast','Live Broadcast',b.status==='live'&&b.streamUrl?'The hosts have marked the broadcast live. Open Live Broadcast to watch; playback still depends on the provider signal.':b.status==='scheduled'&&b.startsAt?'The broadcast is scheduled for '+new Date(b.startsAt).toISOString()+'. Open Live Broadcast for player and schedule.':b.status==='ended'?'The broadcast has ended. Check Live Broadcast for any published replays.':'No live broadcast has been confirmed yet. Check Live Broadcast for updates.','livebroadcast','stream streaming watch online youtube vimeo replay live',photo(b.posterUrl)||hero);
    if(b.status==='live'&&b.streamUrl)activities.push({id:'broadcast',title:'The broadcast is live',text:'Marked live by the hosts. Tap to watch in the app.',view:'livebroadcast',image:photo(b.posterUrl)||hero,at:null,live:true,version:clean(b.streamUrl,2000)});
    const acts=json(s.entertainment,{}).acts;
    add('entertainment','Entertainment',Array.isArray(acts)&&acts.length?'The published lineup is listed below. Open Entertainment for photos, social links and details.':'The hosts have not published a confirmed entertainment lineup yet.','entertainment','performer music dj singer band mc lineup performance');
    if(Array.isArray(acts))acts.slice(0,30).forEach(a=>{
      if(!a||typeof a!=='object')return;
      const at=Number.isSafeInteger(a.startsAt)?a.startsAt:null;
      add('act-'+clean(a.id,80),clean(a.name,120),[a.category,a.description,at?'Scheduled: '+new Date(at).toISOString():'Performance time not confirmed',a.duration].map(v=>clean(v,650)).filter(Boolean).join('\n'),'entertainment','performer music lineup '+clean(a.category,40),photo(a.photoUrl)||hero);
      if(at!==null)activities.push({id:'act-'+clean(a.id,80),title:clean(a.name,120),text:'Scheduled performance · '+new Date(at).toISOString(),view:'entertainment',image:photo(a.photoUrl)||hero,at,version:String(at)+clean(a.name,120)});
    });
    return {mode:'local-knowledge-guide',generatedAt:now,cards,activities:activities.filter(a=>a.live||a.at>=now-20*60000).sort((a,b)=>(a.at||now)-(b.at||now)).slice(0,40)};
  }
  function answer(data,question){
    const q=tokens(question).filter(t=>!stop.has(t));
    if(/\bwhere\b/i.test(question)&&/\bwedding\b/i.test(question))q.push('venue');
    if(/\bwhen\b/i.test(question)&&/\bwedding\b/i.test(question))q.push('date');
    if(!q.length)return {text:'Ask about the wedding, activities or how to use the app. Try “Where is the wedding?”, “How do I upload photos?” or “How do I join Chat?”.',cards:[]};
    if(/\b(password|pin|secret|balance|otp code|guest list|phone number|private|payment status)\b/i.test(question))return {text:'I cannot access private guest details, codes, credentials, chats or payment status. Please use the relevant app page or contact the hosts.',cards:[]};
    const scores=data.cards.map(c=>{const title=new Set(tokens(c.title)),tags=new Set(tokens(c.keywords)),body=new Set(tokens(c.text));let hits=0,score=0;for(const t of new Set(q)){const n=title.has(t)?5:tags.has(t)?4:body.has(t)?1:0;if(n){hits++;score+=n;}}return {c,score,hits};}).filter(r=>r.score>=4&&r.hits>=1).sort((a,b)=>b.score-a.score).slice(0,3);
    return scores.length?{text:'Here is the closest published information I found. Open the source page for current details.',cards:scores.filter(r=>r.score>=scores[0].score*.7).map(r=>r.c)}:{text:'I do not have a confirmed answer to that. I only search published wedding information and app instructions. Try a simpler question or ask the hosts—please do not share private codes or financial details.',cards:[]};
  }
  return {build,answer,photo};
});
