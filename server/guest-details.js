'use strict';
// Private admin dossier. Never return credentials, session records or QR codes.
const normal=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const phone=value=>{let s=String(value||'').replace(/[^\d+]/g,'');if(s.startsWith('00'))s='+'+s.slice(2);if(/^0\d{9}$/.test(s))s='+233'+s.slice(1);if(/^\d{9}$/.test(s))s='+233'+s;return s.replace(/\D/g,'');};
module.exports=({app,db,requireAdmin,guest})=>{
  db.exec(`CREATE TABLE IF NOT EXISTS guest_activity_owners (kind TEXT NOT NULL,recordId TEXT NOT NULL,guestId TEXT NOT NULL,PRIMARY KEY(kind,recordId));
    CREATE INDEX IF NOT EXISTS guest_activity_by_guest ON guest_activity_owners(guestId);`);
  const track=(kind,id,guestId)=>{if(guestId==='@admin'||guestId&&db.prepare('SELECT 1 FROM guests WHERE id=?').get(guestId))db.prepare('INSERT OR IGNORE INTO guest_activity_owners VALUES (?,?,?)').run(kind,id,guestId);};
  const save=(req,kind,id,write)=>db.transaction(()=>{const result=write();if(!req.headers.authorization)track(kind,id,guest(req)?.id);return result;})();
  app.use('/api/admin/guest-details',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  const pageOf=req=>{const value=req.query.page===undefined?'0':req.query.page;return typeof value==='string'&&/^\d{1,6}$/.test(value)?Number(value):null;};
  const summary=g=>({...g,seating:db.prepare('SELECT tableNumber,location,revision FROM guest_seating WHERE guestId=?').get(g.id)||null,arrival:db.prepare('SELECT arrivedAt,method FROM guest_arrivals WHERE guestId=?').get(g.id)||null});
  app.get('/api/admin/guest-details',requireAdmin,(req,res)=>{
    const page=pageOf(req),q=typeof req.query.q==='string'?normal(req.query.q).slice(0,200):'',status=req.query.status||'';
    if(page===null||!['','pending','approved'].includes(status))return res.status(400).json({error:'Choose a valid guest filter and page.'});
    const all=db.prepare('SELECT id,name,phone,email,relation,city,state,country,attending,status,tableGuests,checkedInAt FROM guests ORDER BY name COLLATE NOCASE,id').all();
    const rows=all.filter(g=>(!status||g.status===status)&&(!q||[g.name,g.phone,g.email,g.relation].some(v=>normal(v).includes(q))));
    res.json({guests:rows.slice(page*30,page*30+30).map(summary),page,total:rows.length,hasMore:rows.length>(page+1)*30,counts:{registered:all.length,approved:all.filter(g=>g.status==='approved').length,pending:all.filter(g=>g.status!=='approved').length}});
  });
  const sources=[['rsvp','rsvps','submittedAt'],['guestbook','guestbook','createdAt'],['memory','memories','createdAt'],['gift','gifts','createdAt']];
  function activities(g,possible){
    const records=[];
    const uniqueName=normal(g.name)&&db.prepare('SELECT name FROM guests').all().filter(r=>normal(r.name)===normal(g.name)).length===1;
    for(const [kind,table,time]of sources){
      const hasReceipts=kind==='gift'&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='manual_gift_receipts'").get();
      const rows=possible?db.prepare(`SELECT r.* FROM ${table} r WHERE NOT EXISTS (SELECT 1 FROM guest_activity_owners o WHERE o.kind=? AND o.recordId=r.id) ${hasReceipts?"AND NOT EXISTS (SELECT 1 FROM manual_gift_receipts x WHERE x.giftId=r.id AND x.owner!='admin')":''}`).all(kind):db.prepare(`SELECT r.* FROM ${table} r WHERE EXISTS (SELECT 1 FROM guest_activity_owners o WHERE o.recordId=r.id AND o.kind=? AND o.guestId=?) ${hasReceipts?"OR (NOT EXISTS (SELECT 1 FROM guest_activity_owners o WHERE o.kind='gift' AND o.recordId=r.id) AND EXISTS (SELECT 1 FROM manual_gift_receipts x WHERE x.giftId=r.id AND x.owner=?))":''}`).all(...(hasReceipts?[kind,g.id,g.id]:[kind,g.id]));
      for(const row of rows){
        let match='verified-account';
        if(possible){const contact=(phone(g.phone)&&phone(row.phone)===phone(g.phone))||(normal(g.email)&&normal(row.email)===normal(g.email));const name=uniqueName&&normal(row.guestName||row.name)===normal(g.name);if(!contact&&!name)continue;match=contact?'unverified-contact-match':'unverified-unique-name-match';}
        const item={kind,id:row.id,at:row[time],association:match,data:row};
        if(kind==='gift'){item.data={...row,paymentVerified:!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_payments'").get()&&!!db.prepare("SELECT 1 FROM gift_payments WHERE giftId=? AND mode='live' AND status='completed'").get(row.id)};}
        records.push(item);
      }
    }
    const replyOwners=new Map(db.prepare("SELECT recordId,guestId FROM guest_activity_owners WHERE kind='guestbook-reply'").all().map(r=>[r.recordId,r.guestId]));
    for(const post of db.prepare("SELECT id,replies FROM guestbook WHERE replies IS NOT NULL AND replies!='[]'").all()){
      let replies=[];try{replies=JSON.parse(post.replies);}catch{}if(!Array.isArray(replies))continue;
      replies.forEach((r,index)=>{if(!r||typeof r!=='object')return;const owner=replyOwners.get(r.id);if(possible?(owner||!uniqueName||normal(r.name)!==normal(g.name)):owner!==g.id)return;records.push({kind:'guestbook-reply',id:r.id||post.id+':'+index,at:r.at,association:possible?'unverified-unique-name-match':'verified-account',data:{name:r.name,text:r.text,messageId:post.id}});});
    }
    if(!possible){
      for(const row of db.prepare('SELECT id,name,text,kind,status,pinned,attachmentId,createdAt FROM wedding_chat WHERE actorId=?').all(g.id)){
        const attachment=row.attachmentId?db.prepare('SELECT url,mime,kind,name,size FROM wedding_chat_uploads WHERE id=? AND actorId=?').get(row.attachmentId,g.id):null;
        records.push({kind:'chat',id:row.id,at:row.createdAt,association:'verified-account',data:{...row,attachment}});
      }
      for(const row of db.prepare('SELECT id,url,mime,kind,name,size,createdAt FROM wedding_chat_uploads WHERE actorId=?').all(g.id))records.push({kind:'chat-upload',id:row.id,at:row.createdAt,association:'verified-account',data:row});
      for(const [table,kind]of [['competition_votes','vote'],['competition_comments','competition-comment']])for(const row of db.prepare(`SELECT * FROM ${table} WHERE guestId=?`).all(g.id)){
        const c=db.prepare('SELECT config FROM competitions WHERE id=?').get(row.competitionId);let title='',choice='';try{const config=JSON.parse(c?.config||'{}');title=config.title||'';choice=config.choices?.find(v=>v.id===row.choiceId)?.name||'';}catch{}
        records.push({kind,id:row.competitionId+':'+(row.choiceId||'comment'),at:row.createdAt,association:'verified-account',data:{...row,title,choice}});
      }
      for(const row of db.prepare('SELECT messageId,emoji FROM wedding_chat_reactions WHERE actorId=?').all(g.id))records.push({kind:'chat-reaction',id:row.messageId+row.emoji,at:0,association:'verified-account',data:row});
    }
    return records.sort((a,b)=>(b.at||0)-(a.at||0)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  }
  app.get('/api/admin/guest-details/:id',requireAdmin,(req,res)=>{
    const page=pageOf(req),mode=req.query.mode||'linked';if(page===null||!['linked','possible'].includes(mode))return res.status(400).json({error:'Choose a valid activity page.'});
    const g=db.prepare('SELECT id,name,phone,email,relation,city,state,country,attending,status,tableGuests,checkedInAt FROM guests WHERE id=?').get(req.params.id);if(!g)return res.status(404).json({error:'Guest not found.'});
    const rows=activities(g,mode==='possible');
    res.json({guest:summary(g),activities:rows.slice(page*30,page*30+30),total:rows.length,page,hasMore:rows.length>(page+1)*30,mode,profiles:db.prepare('SELECT kind,profileId FROM role_profile_owners WHERE guestId=?').all(g.id),notice:'Only saved in-app activity is available. Possible legacy matches are not verified ownership. Gift reports are not proof of payment. No external SMS inbox is accessed.'});
  });
  return {save,track};
};
