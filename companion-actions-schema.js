/* Shared declarative actions only: no JavaScript, arbitrary URLs or private-data commands. */
((root,factory)=>{const schema=factory();if(typeof module==='object'&&module.exports)module.exports=schema;else root.CompanionActionsSchema=schema;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const types=['message','reminder','suggest','wave','kiss'],sides=['sam','jossy','both'];
  const pages={home:'Home',gallery:'Gallery / Share Memories',guestbook:'Guest Book',program:'Reception Programme',engagementprogram:'Engagement Programme',events:'Events',rsvp:'RSVP',livebroadcast:'Live Broadcast',competitions:'Games & Competitions',bridaltrain:'Bridal Train',vendors:'Vendors',chat:'Wedding Chat',gifts:'Gifts'};
  const defaults=()=>({enabled:true,kissEnabled:true,kissDelaySeconds:5,kissIntervalMinutes:5,kissLimit:15,wavesEnabled:true,waveIntervalMinutes:10,suggestionsEnabled:true,actions:[]});
  const text=(v,max,label)=>{if(typeof v!=='string'||v.length>max)throw Error(label+' is too long or invalid.');return v.trim();};
  const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(label+' must be between '+min+' and '+max+'.');return v;};
  function validate(v){
    if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Choose valid companion settings.');
    const out={};for(const k of ['enabled','kissEnabled','wavesEnabled','suggestionsEnabled']){if(typeof v[k]!=='boolean')throw Error('Choose on/off for '+k+'.');out[k]=v[k];}
    out.kissDelaySeconds=integer(v.kissDelaySeconds,5,300,'First kiss delay');out.kissIntervalMinutes=integer(v.kissIntervalMinutes,1,60,'Kiss interval');out.kissLimit=integer(v.kissLimit,1,30,'Kiss appearances');out.waveIntervalMinutes=integer(v.waveIntervalMinutes,1,60,'Wave interval');
    if(!Array.isArray(v.actions)||v.actions.length>40)throw Error('Keep at most 40 scheduled actions.');const ids=new Set();
    out.actions=v.actions.map(a=>{
      if(!a||typeof a.id!=='string'||!/^[a-f0-9-]{36}$/.test(a.id)||ids.has(a.id))throw Error('Each action needs a unique ID.');ids.add(a.id);
      if(!types.includes(a.type)||!sides.includes(a.side)||typeof a.enabled!=='boolean')throw Error('Choose an action, companion and on/off status.');
      const title=text(a.title,100,'Action title'),message=text(a.message,600,'Message');if(!title)throw Error('Give the action a title.');if(['message','reminder','suggest'].includes(a.type)&&!message)throw Error('Write the guest-facing message.');
      if(a.page!==''&&!Object.hasOwn(pages,a.page))throw Error('Choose a wedding page from the list.');if(a.type==='suggest'&&!a.page)throw Error('Choose the page to suggest.');
      return {id:a.id,title,message,type:a.type,side:a.type==='kiss'?'both':a.side,page:a.page,enabled:a.enabled,startsAt:integer(a.startsAt,Date.UTC(2020,0,1),Date.UTC(2100,0,1),'Scheduled date'),repeatMinutes:integer(a.repeatMinutes,0,1440,'Repeat interval'),repeatCount:integer(a.repeatCount,1,50,'Number of appearances'),durationSeconds:integer(a.durationSeconds,5,20,'Message duration')};
    });return out;
  }
  function due(data,now){if(!data.enabled)return [];return data.actions.filter(a=>a.enabled).flatMap(a=>{const interval=a.repeatMinutes*60000,index=interval?Math.floor((now-a.startsAt)/interval):0;if(now<a.startsAt||index<0||index>=(interval?a.repeatCount:1))return [];const at=a.startsAt+index*interval;if(now-at>120000)return [];return [{...a,occurrence:a.id+':'+at,at,expiresAt:at+120000}];}).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));}
  return {types,sides,pages,defaults,validate,due};
});
