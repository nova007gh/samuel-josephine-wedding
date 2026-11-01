'use strict';
const fs=require('node:fs'),path=require('node:path');
const S=require(fs.existsSync(path.join(__dirname,'guest-activity-schema.js'))?'./guest-activity-schema':'../guest-activity-schema');
const labels={rsvp:'Saved an RSVP',guestbook:'Submitted a guest-book message','guestbook-reply':'Replied in the guest book',memory:'Submitted a memory',gift:'Recorded a gift report',chat:'Sent a Chat message','chat-upload':'Shared a Chat attachment',vote:'Participated in a competition','competition-comment':'Commented in a competition'};
module.exports=({app,db,requireAdmin,guest,activities})=>{
  db.exec('CREATE TABLE IF NOT EXISTS guest_site_presence (guestId TEXT PRIMARY KEY,page TEXT NOT NULL,lastSeen INTEGER NOT NULL)');
  app.use('/api/admin/guest-activity',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.post('/api/guest-activity/presence',(req,res)=>{
    res.set('Cache-Control','no-store');
    if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Open this from the wedding app.'});
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.get('host'))throw Error();}catch{return res.status(403).json({error:'Open this from the wedding app.'});}}
    const g=guest(req);if(req.headers.authorization||!g||g.status!=='approved')return res.status(403).json({error:'An approved guest session is required.'});
    let input;try{input=S.validate(req.body);}catch(e){return res.status(400).json({error:e.message});}
    const now=Date.now(),old=db.prepare('SELECT lastSeen FROM guest_site_presence WHERE guestId=?').get(g.id);
    if(!old||now-old.lastSeen>=S.minBeatMs)db.transaction(()=>{db.prepare('DELETE FROM guest_site_presence WHERE lastSeen<?').run(now-S.retentionMs);db.prepare('INSERT INTO guest_site_presence VALUES (?,?,?) ON CONFLICT(guestId) DO UPDATE SET page=excluded.page,lastSeen=excluded.lastSeen').run(g.id,input.page,now);})();
    res.json({ok:true});
  });
  app.get('/api/admin/guest-activity',requireAdmin,(req,res)=>{
    res.set('Cache-Control','no-store');
    const q=typeof req.query.q==='string'?req.query.q.trim().toLocaleLowerCase().slice(0,120):'',filter=req.query.filter||'all',page=req.query.page===undefined?0:Number(req.query.page),selected=req.query.guestId||'';
    if(!['all','recent','today'].includes(filter)||!Number.isSafeInteger(page)||page<0||page>9999||typeof selected!=='string'||selected.length>100)return res.status(400).json({error:'Choose a valid activity filter.'});
    const now=Date.now(),cutoff=now-86400000,guests=db.prepare('SELECT g.id,g.name,g.status,g.checkedInAt,p.page,p.lastSeen FROM guests g LEFT JOIN guest_site_presence p ON p.guestId=g.id ORDER BY COALESCE(p.lastSeen,0) DESC,g.name COLLATE NOCASE,g.id').all();
    const allEvents=[],rows=[];
    for(const g of guests){
      // Source IDs can contain ballot-choice IDs; use display-only keys instead.
      const events=activities(g).filter(a=>Number.isSafeInteger(a.at)&&a.at>0&&a.at<=now&&a.kind!=='chat-upload'&&a.kind!=='chat-reaction').map((a,index)=>({id:a.kind+':'+g.id+':'+a.at+':'+index,guestId:g.id,name:g.name,kind:a.kind,label:labels[a.kind]||'Saved wedding activity',at:a.at,status:typeof a.data?.status==='string'?a.data.status:'saved'}));
      const lastAction=events[0]||null,isRecent=S.recent(g.lastSeen,now,g.status),lastSeen=g.lastSeen&&g.lastSeen>=now-S.retentionMs?g.lastSeen:null,pageId=lastSeen&&Object.hasOwn(S.pages,g.page)?g.page:null;
      if((selected&&g.id!==selected)||(q&&!g.name.toLocaleLowerCase().includes(q))||(filter==='recent'&&!isRecent)||(filter==='today'&&!(lastSeen>=cutoff)))continue;
      rows.push({id:g.id,name:g.name,status:g.status,lastSeen,page:pageId,pageLabel:pageId?S.pages[pageId]:null,recent:isRecent,lastAction:lastAction?{label:lastAction.label,at:lastAction.at}:null});
      for(const item of events)if(item.at>=cutoff)allEvents.push(item);
      if(Number.isSafeInteger(g.checkedInAt)&&g.checkedInAt>=cutoff&&g.checkedInAt<=now)allEvents.push({id:'registration:'+g.id,guestId:g.id,name:g.name,kind:'registration',label:'Saved a registration',at:g.checkedInAt,status:g.status});
    }
    allEvents.sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
    res.json({guests:rows.slice(page*50,page*50+50),total:rows.length,page,hasMore:rows.length>(page+1)*50,events:allEvents.slice(0,150),asOf:now,counts:{registered:guests.length,recent:guests.filter(g=>S.recent(g.lastSeen,now,g.status)).length,seenToday:guests.filter(g=>g.lastSeen>=cutoff).length},recentSeconds:S.recentMs/1000,notice:'Recent means an approved signed-in browser reported a visible page within 90 seconds, not proof of reading or physical attendance. Other tabs/devices may be open. Anonymous and pending guests have no identified live signal. Only verified, timestamped saved actions are listed; drafts, typing, message bodies, vote choices and payment amounts are not tracked here.'});
  });
};
