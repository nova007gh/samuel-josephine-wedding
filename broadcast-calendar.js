/* Shared pure calendar builder; imports work without browser state in tests. */
((root,factory)=>{const build=factory();if(typeof module==='object'&&module.exports)module.exports=build;else root.buildBroadcastCalendar=build;})(globalThis,()=>{
  return (data,{reminder=false,hostname='snybena.com',now=Date.now()}={})=>{
    const date=value=>{if(typeof value!=='number'||!Number.isFinite(value)||!Number.isFinite(new Date(value).getTime()))throw new Error('The broadcast date is invalid.');return new Date(value).toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';};
    const text=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const fold=line=>{const encoder=new TextEncoder();let out=[],part='',bytes=0;for(const char of line){const n=encoder.encode(char).length;if(bytes+n>75){out.push(part);part=' ';bytes=1;}part+=char;bytes+=n;}return [...out,part].join('\r\n');};
    let events=(data.schedule||[]).filter(row=>row.startsAt!==null);
    if(!events.length&&data.startsAt!==null)events=[{id:'main',title:data.title,startsAt:data.startsAt,endsAt:null,url:data.streamUrl}];
    if(!events.length)throw new Error('Broadcast dates have not been announced yet.');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//S&J Wedding//Live Broadcast//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
    for(const row of events){
      if(!/^[\w-]{1,80}$/.test(row.id))throw new Error('Invalid calendar entry ID.');
      lines.push('BEGIN:VEVENT',`UID:sj-live-${row.id}@${hostname.replace(/[^a-zA-Z0-9.-]/g,'')||'wedding'}`,`DTSTAMP:${date(now)}`,`DTSTART:${date(row.startsAt)}`,`SUMMARY:${text(row.title)}`,`DESCRIPTION:${text(data.intro)}`);
      if(row.endsAt!==null&&row.endsAt!==undefined){if(row.endsAt<=row.startsAt)throw new Error('Broadcast end must follow its start.');lines.push(`DTEND:${date(row.endsAt)}`);}
      if(row.url||data.streamUrl)lines.push(`URL:${String(row.url||data.streamUrl).replace(/[\r\n]/g,'')}`);
      if(reminder)lines.push('BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY',`DESCRIPTION:${text(row.title)}`,'END:VALARM');
      lines.push('END:VEVENT');
    }
    return [...lines,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
  };
});
