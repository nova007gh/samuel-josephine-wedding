'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const defaults={title:'Our Live Broadcast',subtitle:'Be part of our special day, no matter where you are',intro:'Watch our wedding ceremony, reception and special moments as we say “I do” and begin our forever.',status:'unconfigured',streamUrl:'',startsAt:null,heroPhotoUrl:'',posterUrl:'',schedule:['Ceremony','Reception','Special Moments'].map((title,i)=>({id:'event-'+i,title,startsAt:null,endsAt:null,url:''})),replays:[]};
function safeURL(value){
  if(typeof value!=='string'||value.length>2000)throw new Error('Enter an HTTPS broadcast or replay URL (up to 2,000 characters).');
  if(!value.trim())return '';
  let url;try{url=new URL(value.trim());}catch{throw new Error('Enter a valid HTTPS URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||!url.hostname.includes('.')||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':'))throw new Error('Use a public HTTPS URL without passwords or custom ports.');
  return url.href;
}
function embedURL(value){
  if(!value)return '';
  const u=new URL(value),host=u.hostname.toLowerCase();let id;
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
    id=host.endsWith('youtu.be')?u.pathname.split('/')[1]:u.searchParams.get('v')||u.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/)?.[1];
    if(/^[\w-]{11}$/.test(id||''))return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&autoplay=1`;
  }
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
    const match=u.pathname.match(/^\/(?:video\/)?(\d{1,12})(?:\/([\w-]{1,128}))?\/?$/);
    if(match){const h=match[2]||u.searchParams.get('h');return `https://player.vimeo.com/video/${match[1]}?dnt=1&autoplay=1${h&&/^[\w-]{1,128}$/.test(h)?'&h='+encodeURIComponent(h):''}`;}
  }
  return '';
}
function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid broadcast configuration.');
  const text=(v,max,label,required=false)=>{if(typeof v!=='string'||v.length>max)throw new Error(`${label} must be text of at most ${max} characters.`);v=v.trim();if(required&&!v)throw new Error(`Enter ${label.toLowerCase()}.`);return v;};
  const photo=v=>{v=text(v,200,'Photo');if(v&&!/^\/uploads\/[a-zA-Z0-9-]+\.(jpe?g|png|webp)$/i.test(v))throw new Error('Use an uploaded JPEG, PNG or WebP photo.');return v;};
  const date=v=>{if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v)||new Date(v).getUTCFullYear()<2020||new Date(v).getUTCFullYear()>2100||!Number.isFinite(new Date(v).getTime()))throw new Error('Choose a valid broadcast date between 2020 and 2100.');return v;};
  const out={title:text(value.title,120,'Title',true),subtitle:text(value.subtitle,240,'Subtitle'),intro:text(value.intro,600,'Introduction')};
  if(!['unconfigured','scheduled','live','ended'].includes(value.status))throw new Error('Choose a valid broadcast status.');
  Object.assign(out,{status:value.status,streamUrl:safeURL(value.streamUrl),startsAt:date(value.startsAt),heroPhotoUrl:photo(value.heroPhotoUrl),posterUrl:photo(value.posterUrl)});
  if(['scheduled','live'].includes(out.status)&&!out.streamUrl)throw new Error('Add a real broadcast URL before scheduling or going live.');
  if(out.status==='scheduled'&&out.startsAt===null)throw new Error('Set the scheduled broadcast start time.');
  if(out.status==='unconfigured'&&out.streamUrl)throw new Error('Select Scheduled, Live or Ended to publish a broadcast link.');
  const ids=new Set();
  for(const [key,max]of [['schedule',12],['replays',30]]){
    if(!Array.isArray(value[key])||value[key].length>max)throw new Error(`Maximum ${max} ${key} entries.`);
    out[key]=value[key].map(row=>{
      if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(row.id)||ids.has(row.id))throw new Error('Every schedule/replay entry needs a unique ID.');ids.add(row.id);
      const item={id:row.id,title:text(row.title,120,'Entry title',true),startsAt:date(row.startsAt),url:safeURL(row.url)};
      if(key==='schedule'){item.endsAt=date(row.endsAt);if(item.endsAt!==null&&(item.startsAt===null||item.endsAt<=item.startsAt))throw new Error('Schedule end must be after its start.');}
      else{if(!item.url)throw new Error('Add a replay URL.');item.posterUrl=photo(row.posterUrl);item.duration=text(row.duration,20,'Replay duration');}
      return item;
    });
  }
  return out;
}
module.exports=({app,db,requireAdmin,multer,storage,uploadsDir,previews})=>{
  const raw=()=>db.prepare('SELECT value FROM settings WHERE key=?').get('liveBroadcast')?.value||null;
  const revision=text=>crypto.createHash('sha256').update(text||'').digest('hex');
  const photos=data=>[data.heroPhotoUrl,data.posterUrl,...data.replays.map(r=>r.posterUrl)].filter(Boolean);
  const response=()=>{
    const stored=raw(),data=stored?validate(JSON.parse(stored)):structuredClone(defaults),images={},embeds={};
    for(const url of photos(data)){previews.enqueue({mediaUrl:url,type:'image/jpeg'});const p=previews.decorate({mediaUrl:url,type:'image/jpeg'}).thumbnailUrl;if(p)images[url]=p;}
    for(const url of [data.streamUrl,...data.schedule.map(r=>r.url),...data.replays.map(r=>r.url)].filter(Boolean)){const embed=embedURL(url);if(embed)embeds[url]=embed;}
    return {data,revision:revision(stored),previews:images,embeds,serverNow:Date.now()};
  };
  app.get('/api/live-broadcast',(req,res)=>{try{res.json(response());}catch{res.status(500).json({error:'Broadcast details could not load. Please retry.'});}});
  const save=db.transaction((data,expected)=>{if(expected!==revision(raw()))return false;db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('liveBroadcast',JSON.stringify(data));return true;});
  app.patch('/api/admin/live-broadcast',requireAdmin,(req,res)=>{
    let data;try{data=validate(req.body?.data);for(const url of photos(data))if(!fs.existsSync(path.join(uploadsDir,path.basename(url))))throw new Error('A selected photo is missing. Upload it again.');}catch(err){return res.status(400).json({error:err.message});}
    if(!save(data,req.body?.expectedRevision))return res.status(409).json({error:'Broadcast details changed on another device. Your draft is kept; reload saved content before editing again.'});
    res.json(response());
  });
  const upload=multer({storage,limits:{fileSize:10*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
  app.post('/api/admin/live-broadcast/photo',requireAdmin,upload.single('file'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Choose a JPEG, PNG or WebP photo.'});const url='/uploads/'+req.file.filename;previews.enqueue({mediaUrl:url,type:req.file.mimetype});res.json({url});});
};
Object.assign(module.exports,{validate,defaults,safeURL,embedURL});
